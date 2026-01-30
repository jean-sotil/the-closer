import { AppError, ErrorCode, type ErrorCodeType } from "./base-error.js";

/**
 * Structured log entry for errors
 */
export interface ErrorLogEntry {
  timestamp: string;
  level: "error" | "warn" | "info";
  code: ErrorCodeType;
  message: string;
  statusCode: number;
  isOperational: boolean;
  context: Record<string, unknown> | undefined;
  stack: string | undefined;
  cause: string | undefined;
}

/**
 * Serialized error for API responses
 */
export interface SerializedError {
  error: {
    code: ErrorCodeType;
    message: string;
    statusCode: number;
    timestamp: string;
    details?: Record<string, unknown>;
  };
}

/**
 * Convert any error to an AppError
 */
export function normalizeError(error: unknown): AppError {
  if (error instanceof AppError) {
    return error;
  }

  if (error instanceof Error) {
    return new AppError(error.message, {
      code: ErrorCode.INTERNAL_ERROR,
      statusCode: 500,
      isOperational: false,
      cause: error,
    });
  }

  return new AppError(String(error), {
    code: ErrorCode.INTERNAL_ERROR,
    statusCode: 500,
    isOperational: false,
  });
}

/**
 * Check if an error is operational (expected) vs programming error
 */
export function isOperationalError(error: unknown): boolean {
  if (error instanceof AppError) {
    return error.isOperational;
  }
  return false;
}

/**
 * Create a structured log entry from an error
 */
export function createErrorLogEntry(
  error: unknown,
  level: "error" | "warn" | "info" = "error"
): ErrorLogEntry {
  const appError = normalizeError(error);

  return {
    timestamp: appError.timestamp,
    level,
    code: appError.code,
    message: appError.message,
    statusCode: appError.statusCode,
    isOperational: appError.isOperational,
    context: appError.context,
    stack: appError.stack,
    cause: appError.cause ? String(appError.cause) : undefined,
  };
}

/**
 * Serialize error for API response (safe for client)
 */
export function serializeError(error: unknown): SerializedError {
  const appError = normalizeError(error);

  // Only include context for operational errors
  const details = appError.isOperational ? appError.context : undefined;

  return {
    error: {
      code: appError.code,
      message: appError.isOperational
        ? appError.message
        : "An unexpected error occurred",
      statusCode: appError.statusCode,
      timestamp: appError.timestamp,
      ...(details && { details }),
    },
  };
}

/**
 * Log error with structured output
 */
export function logError(
  error: unknown,
  additionalContext?: Record<string, unknown>
): void {
  const entry = createErrorLogEntry(error);

  if (additionalContext) {
    entry.context = { ...entry.context, ...additionalContext };
  }

  // Use console.error for actual errors, console.warn for operational ones
  const logFn = entry.isOperational ? console.warn : console.error;

  logFn(JSON.stringify(entry, null, 2));
}

/**
 * Wrap an async function with error handling
 */
export function withErrorHandling<T extends unknown[], R>(
  fn: (...args: T) => Promise<R>,
  options: {
    onError?: (error: AppError) => void;
    rethrow?: boolean;
    defaultValue?: R;
  } = {}
): (...args: T) => Promise<R> {
  const { onError, rethrow = true, defaultValue } = options;

  return async (...args: T): Promise<R> => {
    try {
      return await fn(...args);
    } catch (error) {
      const appError = normalizeError(error);

      if (onError) {
        onError(appError);
      } else {
        logError(appError);
      }

      if (rethrow) {
        throw appError;
      }

      return defaultValue as R;
    }
  };
}

/**
 * Try-catch wrapper that returns a Result type
 */
export type Result<T, E = AppError> =
  | { success: true; data: T }
  | { success: false; error: E };

export async function tryCatch<T>(
  fn: () => Promise<T>
): Promise<Result<T, AppError>> {
  try {
    const data = await fn();
    return { success: true, data };
  } catch (error) {
    return { success: false, error: normalizeError(error) };
  }
}

/**
 * Synchronous version of tryCatch
 */
export function tryCatchSync<T>(fn: () => T): Result<T, AppError> {
  try {
    const data = fn();
    return { success: true, data };
  } catch (error) {
    return { success: false, error: normalizeError(error) };
  }
}

/**
 * Global error handler for uncaught exceptions
 */
export function setupGlobalErrorHandlers(options: {
  onUncaughtException?: (error: Error) => void;
  onUnhandledRejection?: (reason: unknown) => void;
  exitOnUncaught?: boolean;
} = {}): void {
  const { onUncaughtException, onUnhandledRejection, exitOnUncaught = true } = options;

  process.on("uncaughtException", (error: Error) => {
    logError(error, { type: "uncaughtException" });

    if (onUncaughtException) {
      onUncaughtException(error);
    }

    if (exitOnUncaught) {
      process.exit(1);
    }
  });

  process.on("unhandledRejection", (reason: unknown) => {
    logError(reason, { type: "unhandledRejection" });

    if (onUnhandledRejection) {
      onUnhandledRejection(reason);
    }
  });
}

/**
 * Assert a condition, throwing an AppError if false
 */
export function assertCondition(
  condition: unknown,
  message: string,
  options: {
    code?: ErrorCodeType;
    statusCode?: number;
    context?: Record<string, unknown>;
  } = {}
): asserts condition {
  if (!condition) {
    throw new AppError(message, {
      code: options.code ?? ErrorCode.INTERNAL_ERROR,
      statusCode: options.statusCode ?? 500,
      context: options.context,
    });
  }
}

/**
 * Assert a value is not null or undefined
 */
export function assertDefined<T>(
  value: T | null | undefined,
  message: string,
  options: {
    code?: ErrorCodeType;
    statusCode?: number;
    context?: Record<string, unknown>;
  } = {}
): asserts value is T {
  assertCondition(value !== null && value !== undefined, message, options);
}
