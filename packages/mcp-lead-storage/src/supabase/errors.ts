import { DatabaseError } from "@the-closer/shared";

import {
  SupabaseErrorCode,
  type SupabaseErrorCodeType,
} from "./types.js";

/**
 * Supabase-specific error class
 */
export class SupabaseError extends DatabaseError {
  public readonly supabaseCode: SupabaseErrorCodeType;
  public readonly pgCode: string | undefined;

  constructor(
    message: string,
    supabaseCode: SupabaseErrorCodeType,
    options?: {
      cause?: Error;
      pgCode?: string;
      context?: Record<string, unknown>;
    }
  ) {
    super(message, {
      cause: options?.cause,
      context: {
        ...options?.context,
        supabaseCode,
        pgCode: options?.pgCode,
      },
    });
    this.supabaseCode = supabaseCode;
    this.pgCode = options?.pgCode;
  }
}

/**
 * PostgreSQL error code mappings
 */
const PG_ERROR_MAP: Record<string, SupabaseErrorCodeType> = {
  "23505": SupabaseErrorCode.UNIQUE_VIOLATION,
  "23503": SupabaseErrorCode.FOREIGN_KEY_VIOLATION,
  "23502": SupabaseErrorCode.NOT_NULL_VIOLATION,
  "23514": SupabaseErrorCode.CHECK_VIOLATION,
  "42P01": SupabaseErrorCode.QUERY_FAILED, // Undefined table
  "42703": SupabaseErrorCode.QUERY_FAILED, // Undefined column
  "42601": SupabaseErrorCode.QUERY_FAILED, // Syntax error
  "28000": SupabaseErrorCode.CONNECTION_FAILED, // Invalid auth
  "28P01": SupabaseErrorCode.CONNECTION_FAILED, // Invalid password
  "3D000": SupabaseErrorCode.CONNECTION_FAILED, // Invalid database
  "57P03": SupabaseErrorCode.CONNECTION_FAILED, // Cannot connect now
};

/**
 * Map Supabase/PostgREST error to typed SupabaseError
 */
export function mapSupabaseError(error: unknown): SupabaseError {
  if (error instanceof SupabaseError) {
    return error;
  }

  // Handle Supabase client errors
  if (isSupabaseClientError(error)) {
    const pgCode = error.code;
    const mappedCode = pgCode
      ? PG_ERROR_MAP[pgCode] ?? SupabaseErrorCode.UNKNOWN_ERROR
      : SupabaseErrorCode.UNKNOWN_ERROR;

    const errorOptions: { pgCode?: string; context?: Record<string, unknown> } = {
      context: {
        details: error.details,
        hint: error.hint,
      },
    };
    if (pgCode) {
      errorOptions.pgCode = pgCode;
    }

    return new SupabaseError(error["message"], mappedCode, errorOptions);
  }

  // Handle PostgREST errors
  if (isPostgRESTError(error)) {
    const pgCode = error.code;
    const mappedCode = pgCode
      ? PG_ERROR_MAP[pgCode] ?? SupabaseErrorCode.QUERY_FAILED
      : SupabaseErrorCode.QUERY_FAILED;

    const pgErrorOptions: { pgCode?: string; context?: Record<string, unknown> } = {
      context: {
        details: error.details,
        hint: error.hint,
      },
    };
    if (pgCode) {
      pgErrorOptions.pgCode = pgCode;
    }

    return new SupabaseError(error["message"], mappedCode, pgErrorOptions);
  }

  // Handle storage errors
  if (isStorageError(error)) {
    let code: SupabaseErrorCodeType = SupabaseErrorCode.STORAGE_ERROR;
    const errorMessage = error["message"];

    if (errorMessage?.includes("not found")) {
      code = SupabaseErrorCode.FILE_NOT_FOUND;
    } else if (errorMessage?.includes("bucket")) {
      code = SupabaseErrorCode.BUCKET_NOT_FOUND;
    }

    return new SupabaseError(errorMessage ?? "Storage error", code, {
      context: { statusCode: error.statusCode },
    });
  }

  // Handle generic errors
  if (error instanceof Error) {
    return new SupabaseError(
      error.message,
      SupabaseErrorCode.UNKNOWN_ERROR,
      { cause: error }
    );
  }

  // Handle unknown errors
  return new SupabaseError(
    String(error),
    SupabaseErrorCode.UNKNOWN_ERROR
  );
}

/**
 * Type guard for Supabase client errors
 */
function isSupabaseClientError(
  error: unknown
): error is Record<string, unknown> & { message: string; code?: string; details?: string; hint?: string } {
  return (
    typeof error === "object" &&
    error !== null &&
    "message" in error &&
    typeof (error as Record<string, unknown>)["message"] === "string"
  );
}

/**
 * Type guard for PostgREST errors
 */
function isPostgRESTError(
  error: unknown
): error is Record<string, unknown> & { message: string; code?: string; details?: string; hint?: string } {
  return (
    typeof error === "object" &&
    error !== null &&
    "message" in error &&
    typeof (error as Record<string, unknown>)["message"] === "string"
  );
}

/**
 * Type guard for storage errors
 */
function isStorageError(
  error: unknown
): error is { message?: string; statusCode?: number } {
  return (
    typeof error === "object" &&
    error !== null &&
    ("statusCode" in error || "message" in error)
  );
}

/**
 * Type guard to check if an error is a SupabaseError
 */
export function isSupabaseError(error: unknown): error is SupabaseError {
  return error instanceof SupabaseError;
}

/**
 * Check if error is a retriable error
 */
export function isRetriableError(error: unknown): boolean {
  if (error instanceof SupabaseError) {
    // Connection errors are retriable
    if (error.supabaseCode === SupabaseErrorCode.CONNECTION_FAILED) {
      return true;
    }

    // Some PG errors are transient
    const retriablePgCodes = [
      "40001", // Serialization failure
      "40P01", // Deadlock detected
      "57P03", // Cannot connect now
      "08000", // Connection exception
      "08003", // Connection does not exist
      "08006", // Connection failure
    ];

    if (error.pgCode && retriablePgCodes.includes(error.pgCode)) {
      return true;
    }
  }

  // Network errors are retriable
  if (error instanceof Error) {
    const message = error.message.toLowerCase();
    if (
      message.includes("network") ||
      message.includes("timeout") ||
      message.includes("econnreset") ||
      message.includes("econnrefused")
    ) {
      return true;
    }
  }

  return false;
}
