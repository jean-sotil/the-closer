// Base error class and codes
export { AppError, ErrorCode, type ErrorCodeType } from "./base-error.js";

// Client errors (4xx)
export {
  ValidationError,
  NotFoundError,
  RateLimitError,
  UnauthorizedError,
  ForbiddenError,
  BadRequestError,
} from "./client-errors.js";

// Server errors (5xx)
export {
  MCPConnectionError,
  AuditFailedError,
  EmailDeliveryError,
  DatabaseError,
  BrowserError,
  ExternalServiceError,
} from "./server-errors.js";

// Error handling utilities
export {
  normalizeError,
  isOperationalError,
  createErrorLogEntry,
  serializeError,
  logError,
  withErrorHandling,
  tryCatch,
  tryCatchSync,
  setupGlobalErrorHandlers,
  assertCondition,
  assertDefined,
  type ErrorLogEntry,
  type SerializedError,
  type Result,
} from "./handlers.js";
