import type { Page } from "puppeteer";

import {
  retryAsync,
  CircuitBreaker,
  withTimeout,
  TimeoutError,
  type RetryConfig,
  type CircuitBreakerConfig,
  type AuditResult,
  type PainPoint,
} from "@the-closer/shared";

import { AuditService, type AuditOptions } from "./service.js";

/**
 * Resilient audit configuration
 */
export interface ResilientAuditConfig {
  /** Timeout for each site audit in ms (default: 60000 - 60 seconds) */
  siteTimeoutMs?: number;
  /** Retry configuration for failed operations */
  retry?: Partial<RetryConfig>;
  /** Circuit breaker configuration */
  circuitBreaker?: Partial<CircuitBreakerConfig>;
  /** Whether to continue batch on individual failures */
  continueOnFailure?: boolean;
  /** Callback when a site requires manual review */
  onManualReviewRequired?: (leadId: string, reason: string) => void;
  /** Callback when a site is blocked/inaccessible */
  onSiteBlocked?: (leadId: string, url: string, error: Error) => void;
}

/**
 * Default resilient audit configuration
 */
const DEFAULT_CONFIG: Required<ResilientAuditConfig> = {
  siteTimeoutMs: 60000, // 60 seconds per site
  retry: {
    maxAttempts: 2,
    baseDelayMs: 5000,
    maxDelayMs: 15000,
    backoffMultiplier: 2,
    jitterFactor: 0.1,
  },
  circuitBreaker: {
    failureThreshold: 10, // More lenient for audits
    successThreshold: 3,
    timeout: 120000, // 2 minutes before trying again
  },
  continueOnFailure: true,
  onManualReviewRequired: () => {},
  onSiteBlocked: () => {},
};

/**
 * Partial audit result when full audit fails
 */
export interface PartialAuditResult {
  id: string;
  leadId: string;
  url: string;
  auditedAt: string;
  /** Indicates the audit was partial due to errors */
  isPartial: true;
  /** Flag for manual review */
  requiresManualReview: boolean;
  /** Reason for requiring manual review */
  manualReviewReason: string | null;
  /** Any pain points discovered before failure */
  painPoints: PainPoint[];
  /** Error that caused partial result */
  error: string;
  /** Duration before failure in ms */
  durationMs: number;
}

/**
 * Result that can be either full or partial
 */
export type ResilientAuditResult = AuditResult | PartialAuditResult;

/**
 * Batch audit result with resilience metadata
 */
export interface ResilientBatchResult {
  total: number;
  successful: number;
  partial: number;
  failed: number;
  requiresManualReview: string[];
  results: Map<string, ResilientAuditResult>;
  errors: Map<string, Error>;
  circuitBreakerTripped: boolean;
}

/**
 * Check if result is partial
 */
export function isPartialResult(result: ResilientAuditResult): result is PartialAuditResult {
  return "isPartial" in result && result.isPartial === true;
}

/**
 * ResilientAuditService - Wraps AuditService with timeout, retry, and circuit breaker
 */
export class ResilientAuditService {
  private readonly auditService: AuditService;
  private readonly config: Required<ResilientAuditConfig>;
  private readonly circuitBreaker: CircuitBreaker;
  private blockedSites = 0;
  private partialAudits = 0;

  constructor(auditService: AuditService, config: ResilientAuditConfig = {}) {
    this.auditService = auditService;
    this.config = {
      ...DEFAULT_CONFIG,
      ...config,
      retry: { ...DEFAULT_CONFIG.retry, ...config.retry },
      circuitBreaker: { ...DEFAULT_CONFIG.circuitBreaker, ...config.circuitBreaker },
    };

    this.circuitBreaker = new CircuitBreaker("audit-service", this.config.circuitBreaker);

    // Log circuit breaker state changes
    this.circuitBreaker.on((event) => {
      if (event.type === "state_change") {
        console.log(`[ResilientAudit] Circuit breaker: ${event.from} -> ${event.to}`);
      }
    });
  }

  /**
   * Run audit with resilience wrapping
   */
  async runAudit(
    leadId: string,
    page: Page,
    options: AuditOptions = {}
  ): Promise<ResilientAuditResult> {
    const startTime = Date.now();

    try {
      // Execute through circuit breaker
      const result = await this.circuitBreaker.execute(async () => {
        // Wrap with timeout
        return withTimeout(
          async () => {
            // Use retry logic for transient failures
            const retryResult = await retryAsync(
              async (context) => {
                if (context.attempt > 1) {
                  console.log(
                    `[ResilientAudit] Retry attempt ${context.attempt}/${context.maxAttempts} for lead: ${leadId}`
                  );
                }

                return this.auditService.runAudit(leadId, page, options);
              },
              {
                ...this.config.retry,
                retryableErrors: [
                  "ECONNRESET",
                  "ETIMEDOUT",
                  "ECONNREFUSED",
                  "Navigation timeout",
                  "net::ERR",
                  "Target closed",
                  "Protocol error",
                ],
              },
              (context, error) => {
                console.log(
                  `[ResilientAudit] Attempt ${context.attempt} failed for ${leadId}: ${error.message}`
                );
              }
            );

            if (!retryResult.success) {
              throw retryResult.error ?? new Error("Audit failed after retries");
            }

            return retryResult.data!;
          },
          this.config.siteTimeoutMs,
          `Audit timed out after ${this.config.siteTimeoutMs}ms`
        );
      });

      return result;
    } catch (error) {
      // Create partial result on failure
      return this.createPartialResult(leadId, error, startTime);
    }
  }

  /**
   * Run batch audits with resilience
   */
  async runBatchAudit(
    leadIds: string[],
    getPage: () => Promise<Page>,
    releasePage: (page: Page) => Promise<void>,
    options: AuditOptions = {},
    onProgress?: (completed: number, total: number, current: string) => void
  ): Promise<ResilientBatchResult> {
    const results = new Map<string, ResilientAuditResult>();
    const errors = new Map<string, Error>();
    const requiresManualReview: string[] = [];
    let successful = 0;
    let partial = 0;
    let failed = 0;

    for (let i = 0; i < leadIds.length; i++) {
      const leadId = leadIds[i]!;

      onProgress?.(i, leadIds.length, leadId);

      // Check circuit breaker before each audit
      if (this.circuitBreaker.getState() === "open") {
        console.log("[ResilientAudit] Circuit breaker open, marking remaining as failed");

        // Mark remaining leads as requiring manual review
        for (let j = i; j < leadIds.length; j++) {
          const remainingId = leadIds[j]!;
          requiresManualReview.push(remainingId);
          errors.set(remainingId, new Error("Circuit breaker open - service unavailable"));
          failed++;
        }
        break;
      }

      let page: Page | null = null;
      try {
        page = await getPage();
        const result = await this.runAudit(leadId, page, options);
        results.set(leadId, result);

        if (isPartialResult(result)) {
          partial++;
          if (result.requiresManualReview) {
            requiresManualReview.push(leadId);
          }
        } else {
          successful++;
        }
      } catch (error) {
        failed++;
        const errorObj = error instanceof Error ? error : new Error(String(error));
        errors.set(leadId, errorObj);

        this.config.onSiteBlocked(leadId, "", errorObj);

        if (!this.config.continueOnFailure) {
          break;
        }
      } finally {
        if (page) {
          await releasePage(page).catch(() => {});
        }
      }
    }

    return {
      total: leadIds.length,
      successful,
      partial,
      failed,
      requiresManualReview,
      results,
      errors,
      circuitBreakerTripped: this.circuitBreaker.getState() === "open",
    };
  }

  /**
   * Create partial result when audit fails
   */
  private createPartialResult(
    leadId: string,
    error: unknown,
    startTime: number
  ): PartialAuditResult {
    this.partialAudits++;

    const errorMessage = error instanceof Error ? error.message : String(error);
    const isTimeout = error instanceof TimeoutError;
    const isBlocked = this.isBlockedError(errorMessage);

    let manualReviewReason: string | null = null;

    if (isTimeout) {
      manualReviewReason = `Site audit timed out after ${this.config.siteTimeoutMs}ms - may be slow or unresponsive`;
      this.blockedSites++;
    } else if (isBlocked) {
      manualReviewReason = `Site appears to be blocked or inaccessible: ${errorMessage}`;
      this.blockedSites++;
      this.config.onSiteBlocked(leadId, "", error instanceof Error ? error : new Error(errorMessage));
    } else if (this.circuitBreaker.getState() === "open") {
      manualReviewReason = "Service circuit breaker tripped - too many failures";
    }

    const requiresManualReview = manualReviewReason !== null;

    if (requiresManualReview && manualReviewReason) {
      this.config.onManualReviewRequired(leadId, manualReviewReason);
    }

    return {
      id: `partial-${leadId}-${Date.now()}`,
      leadId,
      url: "", // URL not available in partial result
      auditedAt: new Date().toISOString(),
      isPartial: true,
      requiresManualReview,
      manualReviewReason,
      painPoints: [], // No pain points discovered
      error: errorMessage,
      durationMs: Date.now() - startTime,
    };
  }

  /**
   * Check if error indicates a blocked site
   */
  private isBlockedError(errorMessage: string): boolean {
    const blockedPatterns = [
      "net::ERR_BLOCKED",
      "net::ERR_FAILED",
      "net::ERR_CONNECTION_REFUSED",
      "net::ERR_CONNECTION_RESET",
      "net::ERR_NAME_NOT_RESOLVED",
      "net::ERR_SSL",
      "net::ERR_CERT",
      "access denied",
      "forbidden",
      "blocked",
      "cloudflare",
      "captcha",
      "robot",
      "bot detected",
    ];

    const lower = errorMessage.toLowerCase();
    return blockedPatterns.some((pattern) => lower.includes(pattern.toLowerCase()));
  }

  /**
   * Get circuit breaker state
   */
  getCircuitState(): "closed" | "open" | "half-open" {
    return this.circuitBreaker.getState();
  }

  /**
   * Get service statistics
   */
  getStats(): {
    circuitState: string;
    blockedSites: number;
    partialAudits: number;
  } {
    return {
      circuitState: this.circuitBreaker.getState(),
      blockedSites: this.blockedSites,
      partialAudits: this.partialAudits,
    };
  }

  /**
   * Reset statistics and circuit breaker
   */
  reset(): void {
    this.blockedSites = 0;
    this.partialAudits = 0;
    this.circuitBreaker.reset();
  }
}
