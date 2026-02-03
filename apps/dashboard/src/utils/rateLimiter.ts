/**
 * Client-Side Rate Limiter
 *
 * Provides rate limiting for client-side API calls to prevent
 * abuse and reduce load on backend services.
 */

interface RateLimitEntry {
  count: number;
  resetTime: number;
}

class RateLimiter {
  private limits = new Map<string, RateLimitEntry>();

  /**
   * Check if a request is allowed under rate limits
   */
  checkLimit(key: string, maxRequests: number, windowMs: number): {
    allowed: boolean;
    remaining: number;
    resetIn: number;
  } {
    const now = Date.now();
    const entry = this.limits.get(key);

    // No previous entry or window expired
    if (!entry || now >= entry.resetTime) {
      this.limits.set(key, {
        count: 1,
        resetTime: now + windowMs,
      });

      return {
        allowed: true,
        remaining: maxRequests - 1,
        resetIn: windowMs,
      };
    }

    // Within rate limit window
    if (entry.count < maxRequests) {
      entry.count++;

      return {
        allowed: true,
        remaining: maxRequests - entry.count,
        resetIn: entry.resetTime - now,
      };
    }

    // Rate limit exceeded
    return {
      allowed: false,
      remaining: 0,
      resetIn: entry.resetTime - now,
    };
  }

  /**
   * Reset rate limit for a specific key
   */
  reset(key: string): void {
    this.limits.delete(key);
  }

  /**
   * Clear all rate limits
   */
  clearAll(): void {
    this.limits.clear();
  }

  /**
   * Clean up expired entries
   */
  cleanup(): void {
    const now = Date.now();
    for (const [key, entry] of this.limits.entries()) {
      if (now >= entry.resetTime) {
        this.limits.delete(key);
      }
    }
  }
}

// Singleton instance
export const rateLimiter = new RateLimiter();

// Cleanup expired entries every minute
setInterval(() => {
  rateLimiter.cleanup();
}, 60 * 1000);

/**
 * Rate limit decorator for async functions
 */
export function withRateLimit<T extends (...args: unknown[]) => Promise<unknown>>(
  fn: T,
  key: string,
  maxRequests: number,
  windowMs: number
): T {
  return (async (...args: unknown[]) => {
    const { allowed, resetIn } = rateLimiter.checkLimit(
      key,
      maxRequests,
      windowMs
    );

    if (!allowed) {
      const resetInSeconds = Math.ceil(resetIn / 1000);
      throw new Error(
        `Rate limit exceeded. Try again in ${resetInSeconds} seconds.`
      );
    }

    // Add rate limit info to console in development
    if (import.meta.env.DEV) {
      console.debug(`[Rate Limit] ${key}: ${allowed ? 'allowed' : 'blocked'}`);
    }

    return fn(...args);
  }) as T;
}

/**
 * React hook for rate-limited API calls
 */
export function useRateLimit(key: string, maxRequests: number, windowMs: number) {
  const checkAndExecute = async <T,>(fn: () => Promise<T>): Promise<T> => {
    const { allowed, resetIn } = rateLimiter.checkLimit(
      key,
      maxRequests,
      windowMs
    );

    if (!allowed) {
      const resetInSeconds = Math.ceil(resetIn / 1000);
      throw new Error(
        `Rate limit exceeded. Try again in ${resetInSeconds} seconds.`
      );
    }

    return fn();
  };

  return { checkAndExecute };
}
