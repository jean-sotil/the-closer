import { z } from "zod";

/**
 * Retry configuration schema
 */
export const RetryConfigSchema = z.object({
  maxAttempts: z.number().int().positive().default(3),
  baseDelayMs: z.number().int().positive().default(1000),
  maxDelayMs: z.number().int().positive().default(30000),
  backoffMultiplier: z.number().positive().default(2),
  jitterFactor: z.number().min(0).max(1).default(0.1),
  retryableErrors: z.array(z.string()).default([
    "ECONNRESET",
    "ETIMEDOUT",
    "ECONNREFUSED",
    "NETWORK_ERROR",
    "RATE_LIMITED",
    "SERVICE_UNAVAILABLE",
  ]),
  retryableStatusCodes: z.array(z.number()).default([429, 500, 502, 503, 504]),
});

export type RetryConfig = z.infer<typeof RetryConfigSchema>;

/**
 * Retry context passed to callbacks
 */
export interface RetryContext {
  attempt: number;
  maxAttempts: number;
  lastError: Error | null;
  totalDelayMs: number;
}

/**
 * Retry result with metadata
 */
export interface RetryResult<T> {
  success: boolean;
  data?: T;
  error?: Error;
  attempts: number;
  totalDelayMs: number;
}

/**
 * Error classification types
 */
export type ErrorClassification = "retryable" | "non-retryable" | "unknown";

/**
 * Check if an error is retryable based on configuration
 */
export function classifyError(
  error: unknown,
  config: RetryConfig
): ErrorClassification {
  if (error instanceof Error) {
    // Check error code (Node.js errors)
    const errorWithCode = error as Error & { code?: string };
    if (errorWithCode.code && config.retryableErrors.includes(errorWithCode.code)) {
      return "retryable";
    }

    // Check for rate limit error
    if (
      error.message.toLowerCase().includes("rate limit") ||
      error.message.toLowerCase().includes("too many requests")
    ) {
      return "retryable";
    }

    // Check for network errors
    if (
      error.message.toLowerCase().includes("network") ||
      error.message.toLowerCase().includes("timeout") ||
      error.message.toLowerCase().includes("econnreset")
    ) {
      return "retryable";
    }

    // Check for validation errors (non-retryable)
    if (
      error.message.toLowerCase().includes("validation") ||
      error.message.toLowerCase().includes("invalid")
    ) {
      return "non-retryable";
    }

    // Check for auth errors (non-retryable)
    if (
      error.message.toLowerCase().includes("unauthorized") ||
      error.message.toLowerCase().includes("forbidden") ||
      error.message.toLowerCase().includes("authentication")
    ) {
      return "non-retryable";
    }
  }

  // Check HTTP status codes
  const errorWithStatus = error as { status?: number; statusCode?: number };
  const status = errorWithStatus.status ?? errorWithStatus.statusCode;
  if (status) {
    if (config.retryableStatusCodes.includes(status)) {
      return "retryable";
    }
    // 4xx errors (except 429) are non-retryable
    if (status >= 400 && status < 500) {
      return "non-retryable";
    }
  }

  return "unknown";
}

/**
 * Calculate delay with exponential backoff and jitter
 */
export function calculateDelay(
  attempt: number,
  config: RetryConfig
): number {
  // Exponential backoff: baseDelay * (multiplier ^ attempt)
  const exponentialDelay =
    config.baseDelayMs * Math.pow(config.backoffMultiplier, attempt - 1);

  // Cap at max delay
  const cappedDelay = Math.min(exponentialDelay, config.maxDelayMs);

  // Add jitter to prevent thundering herd
  const jitter = cappedDelay * config.jitterFactor * (Math.random() * 2 - 1);

  return Math.max(0, Math.round(cappedDelay + jitter));
}

/**
 * Sleep for a specified duration
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Retry an async operation with exponential backoff
 */
export async function retryAsync<T>(
  operation: (context: RetryContext) => Promise<T>,
  config: Partial<RetryConfig> = {},
  onRetry?: (context: RetryContext, error: Error) => void
): Promise<RetryResult<T>> {
  const resolvedConfig = RetryConfigSchema.parse(config);
  let lastError: Error | null = null;
  let totalDelayMs = 0;

  for (let attempt = 1; attempt <= resolvedConfig.maxAttempts; attempt++) {
    const context: RetryContext = {
      attempt,
      maxAttempts: resolvedConfig.maxAttempts,
      lastError,
      totalDelayMs,
    };

    try {
      const data = await operation(context);
      return {
        success: true,
        data,
        attempts: attempt,
        totalDelayMs,
      };
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      // Classify the error
      const classification = classifyError(error, resolvedConfig);

      // Don't retry non-retryable errors
      if (classification === "non-retryable") {
        return {
          success: false,
          error: lastError,
          attempts: attempt,
          totalDelayMs,
        };
      }

      // Don't retry if we've exhausted attempts
      if (attempt === resolvedConfig.maxAttempts) {
        return {
          success: false,
          error: lastError,
          attempts: attempt,
          totalDelayMs,
        };
      }

      // Calculate delay and wait
      const delay = calculateDelay(attempt, resolvedConfig);
      totalDelayMs += delay;

      // Notify retry callback
      if (onRetry) {
        onRetry({ ...context, totalDelayMs }, lastError);
      }

      await sleep(delay);
    }
  }

  // Should never reach here, but TypeScript needs this
  return {
    success: false,
    error: lastError ?? new Error("Unknown error"),
    attempts: resolvedConfig.maxAttempts,
    totalDelayMs,
  };
}

/**
 * Decorator for adding retry logic to class methods
 */
export function withRetry(config: Partial<RetryConfig> = {}) {
  return function <T>(
    _target: object,
    _propertyKey: string,
    descriptor: TypedPropertyDescriptor<(...args: unknown[]) => Promise<T>>
  ): TypedPropertyDescriptor<(...args: unknown[]) => Promise<T>> {
    const originalMethod = descriptor.value;
    if (!originalMethod) return descriptor;

    descriptor.value = async function (
      this: unknown,
      ...args: unknown[]
    ): Promise<T> {
      const result = await retryAsync<T>(
        () => originalMethod.apply(this, args),
        config
      );

      if (result.success && result.data !== undefined) {
        return result.data;
      }

      throw result.error ?? new Error("Retry failed");
    };

    return descriptor;
  };
}

/**
 * Create a retryable version of any async function
 */
export function makeRetryable<TArgs extends unknown[], TReturn>(
  fn: (...args: TArgs) => Promise<TReturn>,
  config: Partial<RetryConfig> = {}
): (...args: TArgs) => Promise<RetryResult<TReturn>> {
  return async (...args: TArgs): Promise<RetryResult<TReturn>> => {
    return retryAsync(() => fn(...args), config);
  };
}
