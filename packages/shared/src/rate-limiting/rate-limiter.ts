import {
  TokenBucket,
  type TokenBucketConfig,
  TOKEN_BUCKET_PRESETS,
} from "./token-bucket.js";

/**
 * Rate limiter configuration
 */
export interface RateLimiterConfig {
  /** Minimum delay between requests (ms) */
  minDelayMs: number;

  /** Maximum delay between requests (ms) */
  maxDelayMs: number;

  /** Token bucket configuration */
  tokenBucket: TokenBucketConfig;

  /** Enable random delay jitter */
  enableJitter: boolean;

  /** Jitter factor (0-1) - portion of delay that can vary */
  jitterFactor: number;
}

/**
 * Rate limiter category configurations
 */
export type RateLimiterCategory = "maps" | "audit" | "email" | "api";

/**
 * Default configurations per category
 */
const DEFAULT_CONFIGS: Record<RateLimiterCategory, RateLimiterConfig> = {
  maps: {
    minDelayMs: 2000,
    maxDelayMs: 5000,
    tokenBucket: TOKEN_BUCKET_PRESETS.MAPS_SCRAPING,
    enableJitter: true,
    jitterFactor: 0.3,
  },
  audit: {
    minDelayMs: 1000,
    maxDelayMs: 2000,
    tokenBucket: TOKEN_BUCKET_PRESETS.SITE_AUDIT,
    enableJitter: true,
    jitterFactor: 0.2,
  },
  email: {
    minDelayMs: 100,
    maxDelayMs: 500,
    tokenBucket: TOKEN_BUCKET_PRESETS.EMAIL_SENDING,
    enableJitter: true,
    jitterFactor: 0.5,
  },
  api: {
    minDelayMs: 100,
    maxDelayMs: 300,
    tokenBucket: TOKEN_BUCKET_PRESETS.API_CALLS,
    enableJitter: true,
    jitterFactor: 0.2,
  },
};

/**
 * Request statistics
 */
export interface RateLimiterStats {
  totalRequests: number;
  throttledRequests: number;
  totalDelayMs: number;
  averageDelayMs: number;
  lastRequestTime: number | null;
}

/**
 * Rate limiter with token bucket and random delays
 *
 * Coordinates request timing with:
 * - Token bucket for overall rate limiting
 * - Random delays between requests for human-like behavior
 * - Statistics tracking
 */
export class RateLimiter {
  private readonly config: RateLimiterConfig;
  private readonly bucket: TokenBucket;
  private stats: RateLimiterStats;
  private lastRequestTime: number | null = null;

  constructor(configOrCategory: RateLimiterConfig | RateLimiterCategory) {
    if (typeof configOrCategory === "string") {
      this.config = { ...DEFAULT_CONFIGS[configOrCategory] };
    } else {
      this.config = { ...configOrCategory };
    }

    this.bucket = new TokenBucket(this.config.tokenBucket);
    this.stats = this.createInitialStats();
  }

  /**
   * Create initial stats object
   */
  private createInitialStats(): RateLimiterStats {
    return {
      totalRequests: 0,
      throttledRequests: 0,
      totalDelayMs: 0,
      averageDelayMs: 0,
      lastRequestTime: null,
    };
  }

  /**
   * Generate a random delay within configured bounds
   */
  private generateDelay(): number {
    const { minDelayMs, maxDelayMs, enableJitter, jitterFactor } = this.config;

    let baseDelay = minDelayMs + Math.random() * (maxDelayMs - minDelayMs);

    if (enableJitter) {
      const jitterRange = baseDelay * jitterFactor;
      const jitter = (Math.random() - 0.5) * 2 * jitterRange;
      baseDelay += jitter;
    }

    // Ensure delay stays within bounds
    return Math.max(minDelayMs, Math.min(maxDelayMs, baseDelay));
  }

  /**
   * Wait for rate limit to allow a request
   * @returns The actual delay waited (ms)
   */
  async waitForSlot(): Promise<number> {
    this.stats.totalRequests++;

    // Check token bucket
    const bucketResult = this.bucket.tryConsume();

    if (!bucketResult.success) {
      // Wait for token availability
      this.stats.throttledRequests++;
      await this.delay(bucketResult.waitTimeMs);
      await this.bucket.consume();
    }

    // Calculate time since last request
    const now = Date.now();
    let delayNeeded = 0;

    if (this.lastRequestTime !== null) {
      const elapsed = now - this.lastRequestTime;
      const targetDelay = this.generateDelay();

      if (elapsed < targetDelay) {
        delayNeeded = targetDelay - elapsed;
      }
    } else {
      // First request - add small random delay
      delayNeeded = Math.random() * this.config.minDelayMs;
    }

    if (delayNeeded > 0) {
      await this.delay(delayNeeded);
    }

    // Update stats
    this.lastRequestTime = Date.now();
    this.stats.lastRequestTime = this.lastRequestTime;
    this.stats.totalDelayMs += delayNeeded;
    this.stats.averageDelayMs = this.stats.totalDelayMs / this.stats.totalRequests;

    return delayNeeded;
  }

  /**
   * Execute a function with rate limiting
   * @param fn - Function to execute
   * @returns Function result
   */
  async execute<T>(fn: () => T | Promise<T>): Promise<T> {
    await this.waitForSlot();
    return fn();
  }

  /**
   * Get current statistics
   */
  getStats(): RateLimiterStats {
    return { ...this.stats };
  }

  /**
   * Reset statistics
   */
  resetStats(): void {
    this.stats = this.createInitialStats();
  }

  /**
   * Reset rate limiter completely
   */
  reset(): void {
    this.bucket.reset();
    this.resetStats();
    this.lastRequestTime = null;
  }

  /**
   * Get configuration
   */
  getConfig(): RateLimiterConfig {
    return { ...this.config };
  }

  /**
   * Check if rate limiter would throttle next request
   */
  wouldThrottle(): boolean {
    return !this.bucket.hasTokens();
  }

  /**
   * Delay helper
   */
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

/**
 * Create a rate limiter for a specific category
 */
export function createRateLimiter(category: RateLimiterCategory): RateLimiter {
  return new RateLimiter(category);
}

/**
 * Rate limiter factory for creating coordinated limiters
 */
export class RateLimiterFactory {
  private readonly limiters = new Map<string, RateLimiter>();

  /**
   * Get or create a rate limiter by key
   */
  get(key: string, config: RateLimiterConfig | RateLimiterCategory): RateLimiter {
    if (!this.limiters.has(key)) {
      this.limiters.set(key, new RateLimiter(config));
    }
    return this.limiters.get(key)!;
  }

  /**
   * Get all active limiters
   */
  getAll(): Map<string, RateLimiter> {
    return new Map(this.limiters);
  }

  /**
   * Get combined statistics
   */
  getCombinedStats(): Record<string, RateLimiterStats> {
    const result: Record<string, RateLimiterStats> = {};
    for (const [key, limiter] of this.limiters) {
      result[key] = limiter.getStats();
    }
    return result;
  }

  /**
   * Reset all limiters
   */
  resetAll(): void {
    for (const limiter of this.limiters.values()) {
      limiter.reset();
    }
  }

  /**
   * Remove a limiter
   */
  remove(key: string): boolean {
    return this.limiters.delete(key);
  }

  /**
   * Clear all limiters
   */
  clear(): void {
    this.limiters.clear();
  }
}

/**
 * Global rate limiter factory instance
 */
export const globalRateLimiterFactory = new RateLimiterFactory();
