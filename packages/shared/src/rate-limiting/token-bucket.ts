/**
 * Token Bucket Rate Limiter
 *
 * Implements the token bucket algorithm for rate limiting with:
 * - Configurable capacity and refill rate
 * - Burst handling
 * - Random delay injection
 */

/**
 * Token bucket configuration
 */
export interface TokenBucketConfig {
  /** Maximum tokens the bucket can hold */
  capacity: number;

  /** Tokens added per refill interval */
  refillRate: number;

  /** Milliseconds between refills */
  refillIntervalMs: number;

  /** Initial tokens (defaults to capacity) */
  initialTokens?: number;
}

/**
 * Token consumption result
 */
export interface TokenConsumptionResult {
  /** Whether tokens were consumed successfully */
  success: boolean;

  /** Milliseconds to wait if not successful */
  waitTimeMs: number;

  /** Tokens remaining after consumption */
  remainingTokens: number;
}

/**
 * Token bucket implementation
 *
 * The bucket holds tokens that are consumed by requests.
 * Tokens refill at a steady rate up to the capacity.
 */
export class TokenBucket {
  private tokens: number;
  private lastRefillTime: number;
  private readonly config: Required<TokenBucketConfig>;

  constructor(config: TokenBucketConfig) {
    this.config = {
      capacity: config.capacity,
      refillRate: config.refillRate,
      refillIntervalMs: config.refillIntervalMs,
      initialTokens: config.initialTokens ?? config.capacity,
    };

    this.tokens = this.config.initialTokens;
    this.lastRefillTime = Date.now();
  }

  /**
   * Refill tokens based on elapsed time
   */
  private refill(): void {
    const now = Date.now();
    const elapsed = now - this.lastRefillTime;
    const intervalsElapsed = Math.floor(elapsed / this.config.refillIntervalMs);

    if (intervalsElapsed > 0) {
      const tokensToAdd = intervalsElapsed * this.config.refillRate;
      this.tokens = Math.min(this.config.capacity, this.tokens + tokensToAdd);
      this.lastRefillTime = now;
    }
  }

  /**
   * Try to consume tokens from the bucket
   * @param count - Number of tokens to consume (default: 1)
   * @returns Consumption result with success status and wait time
   */
  tryConsume(count = 1): TokenConsumptionResult {
    this.refill();

    if (this.tokens >= count) {
      this.tokens -= count;
      return {
        success: true,
        waitTimeMs: 0,
        remainingTokens: this.tokens,
      };
    }

    // Calculate wait time for enough tokens
    const tokensNeeded = count - this.tokens;
    const intervalsNeeded = Math.ceil(tokensNeeded / this.config.refillRate);
    const waitTimeMs = intervalsNeeded * this.config.refillIntervalMs;

    return {
      success: false,
      waitTimeMs,
      remainingTokens: this.tokens,
    };
  }

  /**
   * Consume tokens, waiting if necessary
   * @param count - Number of tokens to consume (default: 1)
   * @returns Promise that resolves when tokens are consumed
   */
  async consume(count = 1): Promise<void> {
    const result = this.tryConsume(count);

    if (!result.success) {
      await this.delay(result.waitTimeMs);
      // Recursively try again (in case of concurrent access)
      await this.consume(count);
    }
  }

  /**
   * Get current token count
   */
  getTokenCount(): number {
    this.refill();
    return this.tokens;
  }

  /**
   * Get bucket configuration
   */
  getConfig(): Required<TokenBucketConfig> {
    return { ...this.config };
  }

  /**
   * Check if bucket has tokens available
   */
  hasTokens(count = 1): boolean {
    this.refill();
    return this.tokens >= count;
  }

  /**
   * Reset bucket to initial state
   */
  reset(): void {
    this.tokens = this.config.initialTokens;
    this.lastRefillTime = Date.now();
  }

  /**
   * Delay helper
   */
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

/**
 * Preset configurations for common use cases
 */
export const TOKEN_BUCKET_PRESETS = {
  /** Google Maps scraping: ~20 requests per minute */
  MAPS_SCRAPING: {
    capacity: 5,
    refillRate: 1,
    refillIntervalMs: 3000, // 1 token every 3 seconds
  },

  /** Site auditing: ~60 requests per minute */
  SITE_AUDIT: {
    capacity: 10,
    refillRate: 1,
    refillIntervalMs: 1000,
  },

  /** Email sending: 100 per hour (Mailgun limits) */
  EMAIL_SENDING: {
    capacity: 10,
    refillRate: 1,
    refillIntervalMs: 36000, // ~100 per hour
  },

  /** API calls: ~120 per minute */
  API_CALLS: {
    capacity: 20,
    refillRate: 2,
    refillIntervalMs: 1000,
  },
} as const;

/**
 * Create a token bucket from a preset
 */
export function createTokenBucket(
  preset: keyof typeof TOKEN_BUCKET_PRESETS
): TokenBucket {
  return new TokenBucket(TOKEN_BUCKET_PRESETS[preset]);
}
