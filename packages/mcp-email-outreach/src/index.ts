#!/usr/bin/env node

/**
 * MCP Email Outreach Server
 *
 * Handles automated email campaigns via Mailgun
 * with personalized templates based on audit data.
 */

// Server exports
export { EmailOutreachServer } from "./server.js";
export type { EmailTemplate, SendEmailRequest } from "./types.js";

// Mailgun client exports
export {
  MailgunClient,
  MailgunError,
  mapMailgunApiError,
  isMailgunError,
  isRetryableError,
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
} from "./mailgun/index.js";

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
} from "./mailgun/index.js";

// Template engine exports
export {
  TemplateEngine,
  DEFAULT_TEMPLATES,
  DEFAULT_TEMPLATE_IDS,
  INITIAL_OUTREACH_TEMPLATE,
  FOLLOWUP_1_TEMPLATE,
  FOLLOWUP_2_TEMPLATE,
  getDefaultTemplate,
  RenderedEmailSchema,
  StoredTemplateSchema,
  TemplateEngineConfigSchema,
  TemplateEngineErrorCode,
  getTopPainPoint,
  formatLoadTime,
  formatScore,
} from "./template-engine/index.js";

export type {
  EmailContext,
  TemplateVariables,
  RenderedEmail,
  StoredTemplate,
  TemplateEngineConfig,
  ToneSeverity,
  ToneReplacements,
  TemplateEngineErrorCodeType,
} from "./template-engine/index.js";

// Delivery tracker exports
export {
  DeliveryTracker,
  EmailEventBaseSchema,
  DeliveredEventSchema,
  OpenedEventSchema,
  ClickedEventSchema,
  BouncedEventSchema,
  ComplainedEventSchema,
  UnsubscribedEventSchema,
  FailedEventSchema,
  RepliedEventSchema,
  EmailMetricsSchema,
  StoredEmailEventSchema,
  DeliveryTrackerConfigSchema,
  calculateRate,
  hasBookingIntent,
} from "./delivery-tracker/index.js";

export type {
  ILeadRepository,
  IStatusTracker,
  IEventStorage,
  EmailEvent,
  EmailEventBase,
  EmailEventType,
  DeliveredEvent,
  OpenedEvent,
  ClickedEvent,
  BouncedEvent,
  ComplainedEvent,
  UnsubscribedEvent,
  FailedEvent,
  RepliedEvent,
  EmailMetrics,
  StoredEmailEvent,
  DeliveryTrackerConfig,
  WebhookProcessingResult,
} from "./delivery-tracker/index.js";
