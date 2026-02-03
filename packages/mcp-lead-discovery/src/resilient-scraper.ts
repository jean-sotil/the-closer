import type { Page } from "puppeteer";

import {
  retryAsync,
  CircuitBreaker,
  withTimeout,
  type RetryConfig,
  type CircuitBreakerConfig,
} from "@the-closer/shared";

import { MapsScraper } from "./maps-scraper.js";
import type { SearchCriteria, ScraperResult, MapsScraperConfig, StealthConfig } from "./types.js";

/**
 * Rate limit detection result
 */
interface RateLimitInfo {
  isRateLimited: boolean;
  retryAfterMs: number | null;
  reason: string | null;
}

/**
 * Resilient scraper configuration
 */
export interface ResilientScraperConfig {
  /** Retry configuration for failed operations */
  retry?: Partial<RetryConfig>;
  /** Circuit breaker configuration */
  circuitBreaker?: Partial<CircuitBreakerConfig>;
  /** Timeout for each search operation in ms */
  searchTimeoutMs?: number;
  /** Whether to continue batch on individual failures */
  continueOnFailure?: boolean;
  /** Callback when rate limit is detected */
  onRateLimitDetected?: (info: RateLimitInfo) => void;
  /** Callback when an error is skipped in batch processing */
  onErrorSkipped?: (criteria: SearchCriteria, error: Error) => void;
}

/**
 * Default resilient scraper configuration
 */
const DEFAULT_RESILIENT_CONFIG: Required<ResilientScraperConfig> = {
  retry: {
    maxAttempts: 3,
    baseDelayMs: 2000,
    maxDelayMs: 30000,
    backoffMultiplier: 2,
    jitterFactor: 0.2,
  },
  circuitBreaker: {
    failureThreshold: 5,
    successThreshold: 2,
    timeout: 60000, // 1 minute before trying again
  },
  searchTimeoutMs: 120000, // 2 minutes per search
  continueOnFailure: true,
  onRateLimitDetected: () => {},
  onErrorSkipped: () => {},
};

/**
 * Batch search result with resilience metadata
 */
export interface BatchSearchResult {
  results: ScraperResult[];
  totalSearches: number;
  successfulSearches: number;
  failedSearches: number;
  skippedBusinesses: number;
  rateLimitEvents: number;
  errors: Array<{ criteria: SearchCriteria; error: string }>;
}

/**
 * ResilientMapsScraper - Wraps MapsScraper with retry, circuit breaker, and rate limit handling
 */
export class ResilientMapsScraper {
  private readonly scraper: MapsScraper;
  private readonly config: Required<ResilientScraperConfig>;
  private readonly circuitBreaker: CircuitBreaker;
  private rateLimitEvents = 0;
  private consecutiveRateLimits = 0;

  constructor(
    scraperConfig: Partial<MapsScraperConfig> = {},
    stealthConfig: Partial<StealthConfig> = {},
    resilientConfig: ResilientScraperConfig = {}
  ) {
    this.scraper = new MapsScraper(scraperConfig, stealthConfig);
    this.config = {
      ...DEFAULT_RESILIENT_CONFIG,
      ...resilientConfig,
      retry: { ...DEFAULT_RESILIENT_CONFIG.retry, ...resilientConfig.retry },
      circuitBreaker: { ...DEFAULT_RESILIENT_CONFIG.circuitBreaker, ...resilientConfig.circuitBreaker },
    };

    this.circuitBreaker = new CircuitBreaker("maps-scraper", this.config.circuitBreaker);

    // Log circuit breaker state changes
    this.circuitBreaker.on((event) => {
      if (event.type === "state_change") {
        console.log(`[ResilientScraper] Circuit breaker: ${event.from} -> ${event.to}`);
      }
    });
  }

  /**
   * Search for businesses with retry and circuit breaker protection
   */
  async searchBusinesses(page: Page, criteria: SearchCriteria): Promise<ScraperResult> {
    // Check circuit breaker first
    const result = await this.circuitBreaker.execute(async () => {
      // Wrap with timeout
      return withTimeout(
        async () => {
          // Use retry logic
          const retryResult = await retryAsync(
            async (context) => {
              if (context.attempt > 1) {
                console.log(
                  `[ResilientScraper] Retry attempt ${context.attempt}/${context.maxAttempts} for: ${criteria.query} in ${criteria.location}`
                );
              }

              const searchResult = await this.scraper.searchBusinesses(page, criteria);

              // Check for rate limiting indicators
              const rateLimitInfo = this.detectRateLimit(searchResult, page);
              if (rateLimitInfo.isRateLimited) {
                this.handleRateLimitDetected(rateLimitInfo);
                throw new RateLimitError(rateLimitInfo.reason ?? "Rate limit detected");
              }

              // Reset consecutive rate limit counter on success
              this.consecutiveRateLimits = 0;

              return searchResult;
            },
            {
              ...this.config.retry,
              retryableErrors: [
                "ECONNRESET",
                "ETIMEDOUT",
                "ECONNREFUSED",
                "NETWORK_ERROR",
                "RATE_LIMITED",
                "Navigation timeout",
                "net::ERR",
              ],
            },
            (context, error) => {
              console.log(
                `[ResilientScraper] Attempt ${context.attempt} failed: ${error.message}. ` +
                  `Total delay: ${context.totalDelayMs}ms`
              );
            }
          );

          if (!retryResult.success) {
            throw retryResult.error ?? new Error("Search failed after retries");
          }

          return retryResult.data!;
        },
        this.config.searchTimeoutMs,
        `Search timed out after ${this.config.searchTimeoutMs}ms`
      );
    });

    return result;
  }

  /**
   * Batch search with error handling and continuation
   */
  async batchSearch(
    page: Page,
    criteriaList: SearchCriteria[],
    onProgress?: (completed: number, total: number, current: SearchCriteria) => void
  ): Promise<BatchSearchResult> {
    const results: ScraperResult[] = [];
    const errors: Array<{ criteria: SearchCriteria; error: string }> = [];
    let skippedBusinesses = 0;

    for (let i = 0; i < criteriaList.length; i++) {
      const criteria = criteriaList[i]!;

      onProgress?.(i, criteriaList.length, criteria);

      try {
        const result = await this.searchBusinesses(page, criteria);
        results.push(result);

        // Track skipped businesses from errors in this search
        skippedBusinesses += result.errors.length;
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        errors.push({ criteria, error: errorMessage });

        // Call error callback
        this.config.onErrorSkipped(criteria, error instanceof Error ? error : new Error(errorMessage));

        if (!this.config.continueOnFailure) {
          // Stop batch processing on error
          break;
        }

        // If circuit breaker is open, wait before continuing
        if (this.circuitBreaker.getState() === "open") {
          console.log("[ResilientScraper] Circuit breaker open, waiting before next search...");
          await this.delay(this.config.circuitBreaker.timeout ?? 60000);
        }
      }

      // Add delay between searches to avoid rate limiting
      if (i < criteriaList.length - 1) {
        await this.delay(this.getAdaptiveDelay());
      }
    }

    return {
      results,
      totalSearches: criteriaList.length,
      successfulSearches: results.length,
      failedSearches: errors.length,
      skippedBusinesses,
      rateLimitEvents: this.rateLimitEvents,
      errors,
    };
  }

  /**
   * Detect rate limiting from search results and page state
   */
  private detectRateLimit(result: ScraperResult, page: Page): RateLimitInfo {
    // Check for zero results with no errors (potential soft block)
    if (result.totalFound === 0 && result.errors.length === 0) {
      // Could be a legitimate empty result or a soft rate limit
      // We track consecutive zeros to detect patterns
      return {
        isRateLimited: false, // Don't immediately assume rate limit
        retryAfterMs: null,
        reason: null,
      };
    }

    // Check for specific error patterns that indicate rate limiting
    const rateLimitPatterns = [
      "unusual traffic",
      "automated queries",
      "rate limit",
      "too many requests",
      "captcha",
      "blocked",
      "forbidden",
      "429",
    ];

    for (const error of result.errors) {
      const lowerError = error.toLowerCase();
      for (const pattern of rateLimitPatterns) {
        if (lowerError.includes(pattern)) {
          this.rateLimitEvents++;
          return {
            isRateLimited: true,
            retryAfterMs: this.calculateBackoffDelay(),
            reason: `Rate limit detected: ${error}`,
          };
        }
      }
    }

    // Check page URL for captcha or block pages
    const pageUrl = page.url();
    if (pageUrl.includes("sorry") || pageUrl.includes("captcha") || pageUrl.includes("blocked")) {
      this.rateLimitEvents++;
      return {
        isRateLimited: true,
        retryAfterMs: this.calculateBackoffDelay(),
        reason: `Redirected to block page: ${pageUrl}`,
      };
    }

    return {
      isRateLimited: false,
      retryAfterMs: null,
      reason: null,
    };
  }

  /**
   * Handle rate limit detection
   */
  private handleRateLimitDetected(info: RateLimitInfo): void {
    this.consecutiveRateLimits++;
    this.config.onRateLimitDetected(info);

    console.warn(
      `[ResilientScraper] Rate limit detected (${this.consecutiveRateLimits} consecutive). ` +
        `Reason: ${info.reason}. Backing off for ${info.retryAfterMs}ms`
    );
  }

  /**
   * Calculate exponential backoff delay for rate limiting
   */
  private calculateBackoffDelay(): number {
    const baseDelay = 30000; // 30 seconds
    const maxDelay = 300000; // 5 minutes
    const multiplier = Math.pow(2, this.consecutiveRateLimits);
    const delay = Math.min(baseDelay * multiplier, maxDelay);

    // Add jitter
    const jitter = delay * 0.2 * (Math.random() * 2 - 1);
    return Math.round(delay + jitter);
  }

  /**
   * Get adaptive delay based on rate limit history
   */
  private getAdaptiveDelay(): number {
    const baseDelay = 3000; // 3 seconds minimum

    // Increase delay if we've had recent rate limits
    if (this.rateLimitEvents > 0) {
      const multiplier = 1 + this.rateLimitEvents * 0.5;
      return Math.round(baseDelay * multiplier);
    }

    return baseDelay;
  }

  /**
   * Get circuit breaker state
   */
  getCircuitState(): "closed" | "open" | "half-open" {
    return this.circuitBreaker.getState();
  }

  /**
   * Get scraper statistics
   */
  getStats(): {
    circuitState: string;
    rateLimitEvents: number;
    consecutiveRateLimits: number;
  } {
    return {
      circuitState: this.circuitBreaker.getState(),
      rateLimitEvents: this.rateLimitEvents,
      consecutiveRateLimits: this.consecutiveRateLimits,
    };
  }

  /**
   * Reset statistics and circuit breaker
   */
  reset(): void {
    this.rateLimitEvents = 0;
    this.consecutiveRateLimits = 0;
    this.circuitBreaker.reset();
  }

  /**
   * Delay execution
   */
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

/**
 * Custom error for rate limiting
 */
export class RateLimitError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RateLimitError";
  }
}
