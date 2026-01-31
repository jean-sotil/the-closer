import { AppError, type ErrorCodeType } from "@the-closer/shared";
import { MailgunErrorCode, type MailgunErrorCodeType } from "./types.js";

/**
 * Mailgun-specific error class
 */
export class MailgunError extends AppError {
  public readonly mailgunCode: MailgunErrorCodeType;
  public readonly originalError: Error | undefined;

  constructor(
    message: string,
    options: {
      mailgunCode: MailgunErrorCodeType;
      statusCode?: number | undefined;
      context?: Record<string, unknown> | undefined;
      originalError?: Error | undefined;
    }
  ) {
    const errorOptions: {
      code: ErrorCodeType;
      statusCode?: number;
      isOperational?: boolean;
      context?: Record<string, unknown>;
      cause?: Error;
    } = {
      code: mapMailgunCodeToAppCode(options.mailgunCode),
      isOperational: true,
    };

    if (options.statusCode !== undefined) {
      errorOptions.statusCode = options.statusCode;
    }
    if (options.context !== undefined) {
      errorOptions.context = options.context;
    }
    if (options.originalError !== undefined) {
      errorOptions.cause = options.originalError;
    }

    super(message, errorOptions);

    this.mailgunCode = options.mailgunCode;
    this.originalError = options.originalError;

    Object.setPrototypeOf(this, new.target.prototype);
  }

  override toJSON(): Record<string, unknown> {
    return {
      ...super.toJSON(),
      mailgunCode: this.mailgunCode,
    };
  }
}

/**
 * Map Mailgun error codes to application error codes
 */
function mapMailgunCodeToAppCode(mailgunCode: MailgunErrorCodeType): ErrorCodeType {
  switch (mailgunCode) {
    case MailgunErrorCode.SEND_FAILED:
      return "EMAIL_DELIVERY_FAILED";
    case MailgunErrorCode.TEMPLATE_NOT_FOUND:
      return "NOT_FOUND";
    case MailgunErrorCode.TEMPLATE_EXISTS:
      return "BAD_REQUEST";
    case MailgunErrorCode.RATE_LIMITED:
      return "RATE_LIMIT";
    case MailgunErrorCode.WEBHOOK_INVALID:
      return "VALIDATION_ERROR";
    case MailgunErrorCode.API_ERROR:
      return "EXTERNAL_SERVICE_ERROR";
    case MailgunErrorCode.CONNECTION_FAILED:
      return "MCP_CONNECTION_ERROR";
    case MailgunErrorCode.INVALID_CREDENTIALS:
      return "UNAUTHORIZED";
    case MailgunErrorCode.DOMAIN_NOT_FOUND:
      return "NOT_FOUND";
    default:
      return "INTERNAL_ERROR";
  }
}

/**
 * Map raw Mailgun API errors to MailgunError
 */
export function mapMailgunApiError(error: unknown): MailgunError {
  if (error instanceof MailgunError) {
    return error;
  }

  if (error instanceof Error) {
    const message = error.message.toLowerCase();

    // Check for rate limiting
    if (message.includes("rate limit") || message.includes("too many requests")) {
      return new MailgunError("Rate limit exceeded", {
        mailgunCode: MailgunErrorCode.RATE_LIMITED,
        statusCode: 429,
        originalError: error,
      });
    }

    // Check for authentication errors
    if (
      message.includes("unauthorized") ||
      message.includes("authentication") ||
      message.includes("invalid api key")
    ) {
      return new MailgunError("Invalid API credentials", {
        mailgunCode: MailgunErrorCode.INVALID_CREDENTIALS,
        statusCode: 401,
        originalError: error,
      });
    }

    // Check for domain errors
    if (message.includes("domain not found") || message.includes("invalid domain")) {
      return new MailgunError("Domain not found or invalid", {
        mailgunCode: MailgunErrorCode.DOMAIN_NOT_FOUND,
        statusCode: 404,
        originalError: error,
      });
    }

    // Check for connection errors
    if (
      message.includes("network") ||
      message.includes("connection") ||
      message.includes("timeout")
    ) {
      return new MailgunError("Failed to connect to Mailgun API", {
        mailgunCode: MailgunErrorCode.CONNECTION_FAILED,
        statusCode: 503,
        originalError: error,
      });
    }

    // Generic API error
    return new MailgunError(error.message, {
      mailgunCode: MailgunErrorCode.API_ERROR,
      statusCode: 500,
      originalError: error,
    });
  }

  // Unknown error type
  return new MailgunError("Unknown Mailgun error occurred", {
    mailgunCode: MailgunErrorCode.API_ERROR,
    statusCode: 500,
    context: { rawError: String(error) },
  });
}

/**
 * Type guard for MailgunError
 */
export function isMailgunError(error: unknown): error is MailgunError {
  return error instanceof MailgunError;
}

/**
 * Check if an error is a transient/retryable error
 */
export function isRetryableError(error: unknown): boolean {
  if (error instanceof MailgunError) {
    return (
      error.mailgunCode === MailgunErrorCode.RATE_LIMITED ||
      error.mailgunCode === MailgunErrorCode.CONNECTION_FAILED ||
      error.statusCode >= 500
    );
  }

  if (error instanceof Error) {
    const message = error.message.toLowerCase();
    return (
      message.includes("timeout") ||
      message.includes("network") ||
      message.includes("connection") ||
      message.includes("rate limit")
    );
  }

  return false;
}
