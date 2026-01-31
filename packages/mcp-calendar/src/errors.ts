import { AppError, type ErrorCodeType } from "@the-closer/shared";
import { CalendarErrorCode, type CalendarErrorCodeType } from "./types.js";

/**
 * Calendar-specific error class
 */
export class CalendarError extends AppError {
  public readonly calendarCode: CalendarErrorCodeType;
  public readonly originalError: Error | undefined;

  constructor(
    message: string,
    options: {
      calendarCode: CalendarErrorCodeType;
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
      code: mapCalendarCodeToAppCode(options.calendarCode),
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

    this.calendarCode = options.calendarCode;
    this.originalError = options.originalError;

    Object.setPrototypeOf(this, new.target.prototype);
  }

  override toJSON(): Record<string, unknown> {
    return {
      ...super.toJSON(),
      calendarCode: this.calendarCode,
    };
  }
}

/**
 * Map Calendar error codes to application error codes
 */
function mapCalendarCodeToAppCode(calendarCode: CalendarErrorCodeType): ErrorCodeType {
  switch (calendarCode) {
    case CalendarErrorCode.AUTH_FAILED:
    case CalendarErrorCode.TOKEN_EXPIRED:
    case CalendarErrorCode.TOKEN_REFRESH_FAILED:
      return "UNAUTHORIZED";
    case CalendarErrorCode.CALENDAR_NOT_FOUND:
    case CalendarErrorCode.EVENT_NOT_FOUND:
      return "NOT_FOUND";
    case CalendarErrorCode.CONFLICT:
      return "BAD_REQUEST";
    case CalendarErrorCode.RATE_LIMITED:
      return "RATE_LIMIT";
    case CalendarErrorCode.INVALID_SLOT:
      return "VALIDATION_ERROR";
    case CalendarErrorCode.API_ERROR:
      return "EXTERNAL_SERVICE_ERROR";
    default:
      return "INTERNAL_ERROR";
  }
}

/**
 * Map raw Google Calendar API errors to CalendarError
 */
export function mapCalendarApiError(error: unknown): CalendarError {
  if (error instanceof CalendarError) {
    return error;
  }

  if (error instanceof Error) {
    const message = error.message.toLowerCase();

    // Check for auth errors
    if (
      message.includes("unauthorized") ||
      message.includes("authentication") ||
      message.includes("invalid_grant") ||
      message.includes("access_denied")
    ) {
      return new CalendarError("Calendar authentication failed", {
        calendarCode: CalendarErrorCode.AUTH_FAILED,
        statusCode: 401,
        originalError: error,
      });
    }

    // Check for token expiry
    if (message.includes("token") && (message.includes("expired") || message.includes("invalid"))) {
      return new CalendarError("Calendar access token expired", {
        calendarCode: CalendarErrorCode.TOKEN_EXPIRED,
        statusCode: 401,
        originalError: error,
      });
    }

    // Check for not found
    if (message.includes("not found") || message.includes("404")) {
      if (message.includes("calendar")) {
        return new CalendarError("Calendar not found", {
          calendarCode: CalendarErrorCode.CALENDAR_NOT_FOUND,
          statusCode: 404,
          originalError: error,
        });
      }
      return new CalendarError("Calendar event not found", {
        calendarCode: CalendarErrorCode.EVENT_NOT_FOUND,
        statusCode: 404,
        originalError: error,
      });
    }

    // Check for conflict
    if (message.includes("conflict") || message.includes("409")) {
      return new CalendarError("Calendar event conflict", {
        calendarCode: CalendarErrorCode.CONFLICT,
        statusCode: 409,
        originalError: error,
      });
    }

    // Check for rate limiting
    if (message.includes("rate") || message.includes("quota") || message.includes("429")) {
      return new CalendarError("Calendar API rate limited", {
        calendarCode: CalendarErrorCode.RATE_LIMITED,
        statusCode: 429,
        originalError: error,
      });
    }

    // Generic API error
    return new CalendarError(error.message, {
      calendarCode: CalendarErrorCode.API_ERROR,
      statusCode: 500,
      originalError: error,
    });
  }

  // Unknown error type
  return new CalendarError("Unknown calendar error occurred", {
    calendarCode: CalendarErrorCode.API_ERROR,
    statusCode: 500,
    context: { rawError: String(error) },
  });
}

/**
 * Type guard for CalendarError
 */
export function isCalendarError(error: unknown): error is CalendarError {
  return error instanceof CalendarError;
}

/**
 * Check if an error is retryable
 */
export function isRetryableCalendarError(error: unknown): boolean {
  if (error instanceof CalendarError) {
    return (
      error.calendarCode === CalendarErrorCode.RATE_LIMITED ||
      error.calendarCode === CalendarErrorCode.TOKEN_EXPIRED ||
      error.statusCode >= 500
    );
  }

  if (error instanceof Error) {
    const message = error.message.toLowerCase();
    return (
      message.includes("timeout") ||
      message.includes("network") ||
      message.includes("rate") ||
      message.includes("quota")
    );
  }

  return false;
}
