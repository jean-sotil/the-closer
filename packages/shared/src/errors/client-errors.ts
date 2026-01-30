import { AppError, ErrorCode } from "./base-error.js";

/**
 * Validation error for invalid input data
 * HTTP 400 Bad Request
 */
export class ValidationError extends AppError {
  public readonly fields: Record<string, string[]> | undefined;

  constructor(
    message: string,
    options: {
      fields?: Record<string, string[]> | undefined;
      context?: Record<string, unknown> | undefined;
      cause?: Error | undefined;
    } = {}
  ) {
    super(message, {
      code: ErrorCode.VALIDATION_ERROR,
      statusCode: 400,
      isOperational: true,
      context: options.context,
      cause: options.cause,
    });
    this.fields = options.fields;
  }

  override toJSON(): Record<string, unknown> {
    return {
      ...super.toJSON(),
      ...(this.fields ? { fields: this.fields } : {}),
    };
  }
}

/**
 * Not found error for missing resources
 * HTTP 404 Not Found
 */
export class NotFoundError extends AppError {
  public readonly resourceType: string | undefined;
  public readonly resourceId: string | undefined;

  constructor(
    message: string,
    options: {
      resourceType?: string | undefined;
      resourceId?: string | undefined;
      context?: Record<string, unknown> | undefined;
      cause?: Error | undefined;
    } = {}
  ) {
    super(message, {
      code: ErrorCode.NOT_FOUND,
      statusCode: 404,
      isOperational: true,
      context: {
        ...options.context,
        ...(options.resourceType ? { resourceType: options.resourceType } : {}),
        ...(options.resourceId ? { resourceId: options.resourceId } : {}),
      },
      cause: options.cause,
    });
    this.resourceType = options.resourceType;
    this.resourceId = options.resourceId;
  }

  static forLead(leadId: string): NotFoundError {
    return new NotFoundError(`Lead not found: ${leadId}`, {
      resourceType: "Lead",
      resourceId: leadId,
    });
  }

  static forCampaign(campaignId: string): NotFoundError {
    return new NotFoundError(`Campaign not found: ${campaignId}`, {
      resourceType: "Campaign",
      resourceId: campaignId,
    });
  }

  static forTemplate(templateId: string): NotFoundError {
    return new NotFoundError(`Email template not found: ${templateId}`, {
      resourceType: "EmailTemplate",
      resourceId: templateId,
    });
  }
}

/**
 * Rate limit error when API limits are exceeded
 * HTTP 429 Too Many Requests
 */
export class RateLimitError extends AppError {
  public readonly retryAfterMs: number | undefined;
  public readonly limit: number | undefined;
  public readonly remaining: number | undefined;

  constructor(
    message: string,
    options: {
      retryAfterMs?: number | undefined;
      limit?: number | undefined;
      remaining?: number | undefined;
      context?: Record<string, unknown> | undefined;
      cause?: Error | undefined;
    } = {}
  ) {
    super(message, {
      code: ErrorCode.RATE_LIMIT,
      statusCode: 429,
      isOperational: true,
      context: {
        ...options.context,
        ...(options.retryAfterMs !== undefined
          ? { retryAfterMs: options.retryAfterMs }
          : {}),
        ...(options.limit !== undefined ? { limit: options.limit } : {}),
        ...(options.remaining !== undefined
          ? { remaining: options.remaining }
          : {}),
      },
      cause: options.cause,
    });
    this.retryAfterMs = options.retryAfterMs;
    this.limit = options.limit;
    this.remaining = options.remaining;
  }

  static forGoogleMaps(retryAfterMs: number = 60000): RateLimitError {
    return new RateLimitError(
      "Google Maps rate limit exceeded. Please wait before retrying.",
      { retryAfterMs }
    );
  }

  static forMailgun(retryAfterMs: number = 60000): RateLimitError {
    return new RateLimitError(
      "Mailgun rate limit exceeded. Please wait before retrying.",
      { retryAfterMs }
    );
  }

  static forDailyEmailLimit(limit: number): RateLimitError {
    return new RateLimitError(
      `Daily email limit of ${limit} reached. Campaign will resume tomorrow.`,
      { limit, remaining: 0 }
    );
  }
}

/**
 * Unauthorized error for authentication failures
 * HTTP 401 Unauthorized
 */
export class UnauthorizedError extends AppError {
  constructor(
    message: string = "Authentication required",
    options: {
      context?: Record<string, unknown> | undefined;
      cause?: Error | undefined;
    } = {}
  ) {
    super(message, {
      code: ErrorCode.UNAUTHORIZED,
      statusCode: 401,
      isOperational: true,
      context: options.context,
      cause: options.cause,
    });
  }
}

/**
 * Forbidden error for authorization failures
 * HTTP 403 Forbidden
 */
export class ForbiddenError extends AppError {
  constructor(
    message: string = "Access denied",
    options: {
      context?: Record<string, unknown> | undefined;
      cause?: Error | undefined;
    } = {}
  ) {
    super(message, {
      code: ErrorCode.FORBIDDEN,
      statusCode: 403,
      isOperational: true,
      context: options.context,
      cause: options.cause,
    });
  }
}

/**
 * Bad request error for malformed requests
 * HTTP 400 Bad Request
 */
export class BadRequestError extends AppError {
  constructor(
    message: string,
    options: {
      context?: Record<string, unknown> | undefined;
      cause?: Error | undefined;
    } = {}
  ) {
    super(message, {
      code: ErrorCode.BAD_REQUEST,
      statusCode: 400,
      isOperational: true,
      context: options.context,
      cause: options.cause,
    });
  }
}
