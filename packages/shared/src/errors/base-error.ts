/**
 * Error codes for the application
 */
export const ErrorCode = {
  // Client errors (4xx)
  VALIDATION_ERROR: "VALIDATION_ERROR",
  NOT_FOUND: "NOT_FOUND",
  UNAUTHORIZED: "UNAUTHORIZED",
  FORBIDDEN: "FORBIDDEN",
  RATE_LIMIT: "RATE_LIMIT",
  BAD_REQUEST: "BAD_REQUEST",

  // Server errors (5xx)
  INTERNAL_ERROR: "INTERNAL_ERROR",
  MCP_CONNECTION_ERROR: "MCP_CONNECTION_ERROR",
  AUDIT_FAILED: "AUDIT_FAILED",
  EMAIL_DELIVERY_FAILED: "EMAIL_DELIVERY_FAILED",
  DATABASE_ERROR: "DATABASE_ERROR",
  BROWSER_ERROR: "BROWSER_ERROR",
  EXTERNAL_SERVICE_ERROR: "EXTERNAL_SERVICE_ERROR",

  // Business logic errors
  LEAD_NOT_QUALIFIED: "LEAD_NOT_QUALIFIED",
  CAMPAIGN_LIMIT_REACHED: "CAMPAIGN_LIMIT_REACHED",
  DUPLICATE_LEAD: "DUPLICATE_LEAD",
} as const;

export type ErrorCodeType = (typeof ErrorCode)[keyof typeof ErrorCode];

/**
 * Base application error class
 *
 * All custom errors should extend this class for consistent
 * error handling across the application.
 */
export class AppError extends Error {
  /**
   * Error code for programmatic handling
   */
  public readonly code: ErrorCodeType;

  /**
   * HTTP status code for API responses
   */
  public readonly statusCode: number;

  /**
   * Whether this error is operational (expected) vs programming error
   * Operational errors are safe to show to users
   */
  public readonly isOperational: boolean;

  /**
   * Additional context for debugging
   */
  public readonly context: Record<string, unknown> | undefined;

  /**
   * Timestamp when the error occurred
   */
  public readonly timestamp: string;

  constructor(
    message: string,
    options: {
      code?: ErrorCodeType | undefined;
      statusCode?: number | undefined;
      isOperational?: boolean | undefined;
      context?: Record<string, unknown> | undefined;
      cause?: Error | undefined;
    } = {}
  ) {
    super(message, options.cause ? { cause: options.cause } : undefined);

    this.name = this.constructor.name;
    this.code = options.code ?? ErrorCode.INTERNAL_ERROR;
    this.statusCode = options.statusCode ?? 500;
    this.isOperational = options.isOperational ?? true;
    this.context = options.context;
    this.timestamp = new Date().toISOString();

    // Capture stack trace, excluding constructor call
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }

    // Ensure prototype chain is correct
    Object.setPrototypeOf(this, new.target.prototype);
  }

  /**
   * Convert error to JSON for API responses
   */
  toJSON(): Record<string, unknown> {
    return {
      name: this.name,
      message: this.message,
      code: this.code,
      statusCode: this.statusCode,
      timestamp: this.timestamp,
      ...(this.context && { context: this.context }),
    };
  }

  /**
   * Convert error to string with full details for logging
   */
  toDetailedString(): string {
    const parts = [
      `[${this.code}] ${this.name}: ${this.message}`,
      `Status: ${this.statusCode}`,
      `Operational: ${this.isOperational}`,
      `Timestamp: ${this.timestamp}`,
    ];

    if (this.context) {
      parts.push(`Context: ${JSON.stringify(this.context)}`);
    }

    if (this.cause) {
      parts.push(`Cause: ${String(this.cause)}`);
    }

    if (this.stack) {
      parts.push(`Stack:\n${this.stack}`);
    }

    return parts.join("\n");
  }
}
