import { AppError, ErrorCode } from "./base-error.js";

/**
 * MCP connection error for Model Context Protocol failures
 * HTTP 503 Service Unavailable
 */
export class MCPConnectionError extends AppError {
  public readonly serverName: string | undefined;
  public readonly tool: string | undefined;

  constructor(
    message: string,
    options: {
      serverName?: string | undefined;
      tool?: string | undefined;
      context?: Record<string, unknown> | undefined;
      cause?: Error | undefined;
    } = {}
  ) {
    super(message, {
      code: ErrorCode.MCP_CONNECTION_ERROR,
      statusCode: 503,
      isOperational: true,
      context: {
        ...options.context,
        ...(options.serverName ? { serverName: options.serverName } : {}),
        ...(options.tool ? { tool: options.tool } : {}),
      },
      cause: options.cause,
    });
    this.serverName = options.serverName;
    this.tool = options.tool;
  }

  static forServer(serverName: string, cause?: Error): MCPConnectionError {
    return new MCPConnectionError(
      `Failed to connect to MCP server: ${serverName}`,
      { serverName, cause }
    );
  }

  static forTool(
    serverName: string,
    tool: string,
    cause?: Error
  ): MCPConnectionError {
    return new MCPConnectionError(
      `MCP tool "${tool}" failed on server "${serverName}"`,
      { serverName, tool, cause }
    );
  }
}

/**
 * Audit failed error for website auditing failures
 * HTTP 500 Internal Server Error
 */
export class AuditFailedError extends AppError {
  public readonly url: string | undefined;
  public readonly phase: string | undefined;

  constructor(
    message: string,
    options: {
      url?: string | undefined;
      phase?: string | undefined;
      context?: Record<string, unknown> | undefined;
      cause?: Error | undefined;
    } = {}
  ) {
    super(message, {
      code: ErrorCode.AUDIT_FAILED,
      statusCode: 500,
      isOperational: true,
      context: {
        ...options.context,
        ...(options.url ? { url: options.url } : {}),
        ...(options.phase ? { phase: options.phase } : {}),
      },
      cause: options.cause,
    });
    this.url = options.url;
    this.phase = options.phase;
  }

  static forNavigation(url: string, cause?: Error): AuditFailedError {
    return new AuditFailedError(`Failed to navigate to URL: ${url}`, {
      url,
      phase: "navigation",
      cause,
    });
  }

  static forPerformance(url: string, cause?: Error): AuditFailedError {
    return new AuditFailedError(`Performance audit failed for: ${url}`, {
      url,
      phase: "performance",
      cause,
    });
  }

  static forAccessibility(url: string, cause?: Error): AuditFailedError {
    return new AuditFailedError(`Accessibility audit failed for: ${url}`, {
      url,
      phase: "accessibility",
      cause,
    });
  }

  static forScreenshot(url: string, cause?: Error): AuditFailedError {
    return new AuditFailedError(`Screenshot capture failed for: ${url}`, {
      url,
      phase: "screenshot",
      cause,
    });
  }

  static forTimeout(url: string, timeoutMs: number): AuditFailedError {
    return new AuditFailedError(
      `Audit timed out after ${timeoutMs}ms for: ${url}`,
      {
        url,
        phase: "timeout",
        context: { timeoutMs },
      }
    );
  }
}

/**
 * Email delivery error for Mailgun and email failures
 * HTTP 502 Bad Gateway
 */
export class EmailDeliveryError extends AppError {
  public readonly recipient: string | undefined;
  public readonly mailgunError: string | undefined;

  constructor(
    message: string,
    options: {
      recipient?: string | undefined;
      mailgunError?: string | undefined;
      context?: Record<string, unknown> | undefined;
      cause?: Error | undefined;
    } = {}
  ) {
    super(message, {
      code: ErrorCode.EMAIL_DELIVERY_FAILED,
      statusCode: 502,
      isOperational: true,
      context: {
        ...options.context,
        ...(options.recipient ? { recipient: options.recipient } : {}),
        ...(options.mailgunError ? { mailgunError: options.mailgunError } : {}),
      },
      cause: options.cause,
    });
    this.recipient = options.recipient;
    this.mailgunError = options.mailgunError;
  }

  static forSendFailure(
    recipient: string,
    mailgunError: string,
    cause?: Error
  ): EmailDeliveryError {
    return new EmailDeliveryError(`Failed to send email to: ${recipient}`, {
      recipient,
      mailgunError,
      cause,
    });
  }

  static forInvalidRecipient(recipient: string): EmailDeliveryError {
    return new EmailDeliveryError(`Invalid email recipient: ${recipient}`, {
      recipient,
      mailgunError: "Invalid recipient address",
    });
  }

  static forTemplateError(
    templateId: string,
    cause?: Error
  ): EmailDeliveryError {
    return new EmailDeliveryError(
      `Failed to render email template: ${templateId}`,
      {
        context: { templateId },
        cause,
      }
    );
  }
}

/**
 * Database error for Supabase and PostgreSQL failures
 * HTTP 500 Internal Server Error
 */
export class DatabaseError extends AppError {
  public readonly operation: string | undefined;
  public readonly table: string | undefined;

  constructor(
    message: string,
    options: {
      operation?: string | undefined;
      table?: string | undefined;
      context?: Record<string, unknown> | undefined;
      cause?: Error | undefined;
    } = {}
  ) {
    super(message, {
      code: ErrorCode.DATABASE_ERROR,
      statusCode: 500,
      isOperational: true,
      context: {
        ...options.context,
        ...(options.operation ? { operation: options.operation } : {}),
        ...(options.table ? { table: options.table } : {}),
      },
      cause: options.cause,
    });
    this.operation = options.operation;
    this.table = options.table;
  }

  static forQuery(
    operation: string,
    table: string,
    cause?: Error
  ): DatabaseError {
    return new DatabaseError(
      `Database ${operation} failed on table "${table}"`,
      { operation, table, cause }
    );
  }

  static forConnection(cause?: Error): DatabaseError {
    return new DatabaseError("Failed to connect to database", {
      operation: "connect",
      cause,
    });
  }
}

/**
 * Browser error for Puppeteer and browser automation failures
 * HTTP 500 Internal Server Error
 */
export class BrowserError extends AppError {
  public readonly browserAction: string | undefined;

  constructor(
    message: string,
    options: {
      browserAction?: string | undefined;
      context?: Record<string, unknown> | undefined;
      cause?: Error | undefined;
    } = {}
  ) {
    super(message, {
      code: ErrorCode.BROWSER_ERROR,
      statusCode: 500,
      isOperational: true,
      context: {
        ...options.context,
        ...(options.browserAction
          ? { browserAction: options.browserAction }
          : {}),
      },
      cause: options.cause,
    });
    this.browserAction = options.browserAction;
  }

  static forLaunch(cause?: Error): BrowserError {
    return new BrowserError("Failed to launch browser", {
      browserAction: "launch",
      cause,
    });
  }

  static forPage(action: string, cause?: Error): BrowserError {
    return new BrowserError(`Browser page action failed: ${action}`, {
      browserAction: action,
      cause,
    });
  }

  static forDetection(): BrowserError {
    return new BrowserError(
      "Browser automation was detected and blocked by the target site",
      { browserAction: "detection" }
    );
  }
}

/**
 * External service error for third-party API failures
 * HTTP 502 Bad Gateway
 */
export class ExternalServiceError extends AppError {
  public readonly serviceName: string | undefined;
  public readonly endpoint: string | undefined;

  constructor(
    message: string,
    options: {
      serviceName?: string | undefined;
      endpoint?: string | undefined;
      context?: Record<string, unknown> | undefined;
      cause?: Error | undefined;
    } = {}
  ) {
    super(message, {
      code: ErrorCode.EXTERNAL_SERVICE_ERROR,
      statusCode: 502,
      isOperational: true,
      context: {
        ...options.context,
        ...(options.serviceName ? { serviceName: options.serviceName } : {}),
        ...(options.endpoint ? { endpoint: options.endpoint } : {}),
      },
      cause: options.cause,
    });
    this.serviceName = options.serviceName;
    this.endpoint = options.endpoint;
  }

  static forGoogleMaps(endpoint: string, cause?: Error): ExternalServiceError {
    return new ExternalServiceError(`Google Maps API error: ${endpoint}`, {
      serviceName: "Google Maps",
      endpoint,
      cause,
    });
  }

  static forVapi(cause?: Error): ExternalServiceError {
    return new ExternalServiceError("VAPI voice service error", {
      serviceName: "VAPI",
      cause,
    });
  }

  static forGoogleCalendar(cause?: Error): ExternalServiceError {
    return new ExternalServiceError("Google Calendar API error", {
      serviceName: "Google Calendar",
      cause,
    });
  }
}
