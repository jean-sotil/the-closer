/**
 * Secure API Wrapper
 *
 * Wraps all API calls with rate limiting, error handling,
 * and security best practices.
 */

import { rateLimiter } from "../utils/rateLimiter";
import { sanitizeErrorMessage } from "../config/security";
import { RATE_LIMIT_CONFIG } from "../config/security";

export class ApiError extends Error {
  constructor(
    message: string,
    public statusCode?: number,
    public code?: string
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export class RateLimitError extends ApiError {
  constructor(
    public resetIn: number,
    message = "Rate limit exceeded"
  ) {
    super(message, 429, "RATE_LIMIT_EXCEEDED");
    this.name = "RateLimitError";
  }
}

/**
 * Secure API call wrapper with rate limiting
 */
export async function secureApiCall<T>(
  key: string,
  fn: () => Promise<T>,
  options?: {
    maxRequests?: number;
    windowMs?: number;
    skipRateLimit?: boolean;
  }
): Promise<T> {
  // Apply rate limiting
  if (!options?.skipRateLimit) {
    const maxRequests = options?.maxRequests ?? RATE_LIMIT_CONFIG.api.max;
    const windowMs = options?.windowMs ?? RATE_LIMIT_CONFIG.api.windowMs;

    const { allowed, resetIn } = rateLimiter.checkLimit(key, maxRequests, windowMs);

    if (!allowed) {
      throw new RateLimitError(resetIn);
    }
  }

  try {
    return await fn();
  } catch (error) {
    // Sanitize error messages
    if (error instanceof Error) {
      const sanitized = sanitizeErrorMessage(error.message);

      // Log original error in development only
      if (import.meta.env.DEV) {
        console.error('[API Error]', error);
      }

      throw new ApiError(
        sanitized,
        (error as any).statusCode,
        (error as any).code
      );
    }

    throw error;
  }
}

/**
 * Validate input against XSS attacks
 */
export function sanitizeInput(input: string): string {
  // Remove potentially dangerous HTML tags
  const dangerous = /<script|<iframe|<object|<embed|javascript:/gi;

  if (dangerous.test(input)) {
    console.warn('[Security] Potentially dangerous input detected and sanitized');
    return input.replace(dangerous, '');
  }

  return input;
}

/**
 * Validate and sanitize object properties
 */
export function sanitizeObject<T extends Record<string, any>>(obj: T): T {
  const sanitized = { ...obj };

  for (const [key, value] of Object.entries(sanitized)) {
    if (typeof value === 'string') {
      (sanitized as any)[key] = sanitizeInput(value);
    } else if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      (sanitized as any)[key] = sanitizeObject(value as Record<string, any>);
    }
  }

  return sanitized;
}

/**
 * Extract safe error message for display to user
 */
export function getSafeErrorMessage(error: unknown): string {
  if (error instanceof RateLimitError) {
    const seconds = Math.ceil(error.resetIn / 1000);
    return `Too many requests. Please try again in ${seconds} seconds.`;
  }

  if (error instanceof ApiError) {
    return error.message;
  }

  if (error instanceof Error) {
    // Don't expose internal error details to users
    if (import.meta.env.PROD) {
      return 'An unexpected error occurred. Please try again later.';
    }
    return sanitizeErrorMessage(error.message);
  }

  return 'An unexpected error occurred. Please try again later.';
}
