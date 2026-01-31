/**
 * Mailgun Client Module
 *
 * Type-safe client wrapper for Mailgun email operations
 * with rate limiting, retry logic, and webhook handling.
 */

// Main client class
export { MailgunClient } from "./client.js";

// Error handling
export { MailgunError, mapMailgunApiError, isMailgunError, isRetryableError } from "./errors.js";

// Types and schemas
export type {
  MailgunClientConfig,
  EmailOptions,
  SendResult,
  Recipient,
  BulkEmailOptions,
  BulkSendResult,
  Template,
  TrackingOptions,
  MessageEvent,
  MessageEventType,
  MessageStatus,
  WebhookEvent,
  RateLimitStatus,
  MailgunErrorCodeType,
} from "./types.js";

export {
  MailgunClientConfigSchema,
  EmailOptionsSchema,
  SendResultSchema,
  RecipientSchema,
  BulkEmailOptionsSchema,
  BulkSendResultSchema,
  TemplateSchema,
  TrackingOptionsSchema,
  MessageEventSchema,
  MessageEventTypeSchema,
  MessageStatusSchema,
  WebhookEventSchema,
  RateLimitStatusSchema,
  MailgunErrorCode,
  TEMPLATE_VARIABLE_PATTERN,
} from "./types.js";
