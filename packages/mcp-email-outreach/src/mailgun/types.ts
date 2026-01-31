import { z } from "zod";

// ============================================
// Configuration
// ============================================

/**
 * Mailgun client configuration
 */
export const MailgunClientConfigSchema = z.object({
  apiKey: z.string().min(1),
  domain: z.string().min(1),
  defaultFrom: z.string().email().optional(),
  defaultTimeout: z.number().int().positive().default(30000),
  maxRetries: z.number().int().nonnegative().default(3),
  region: z.enum(["us", "eu"]).default("us"),
});

export type MailgunClientConfig = z.output<typeof MailgunClientConfigSchema>;

// ============================================
// Email Options
// ============================================

/**
 * Tracking options for emails
 */
export const TrackingOptionsSchema = z.object({
  opens: z.boolean().default(true),
  clicks: z.boolean().default(true),
});

export type TrackingOptions = z.output<typeof TrackingOptionsSchema>;

/**
 * Email sending options
 */
export const EmailOptionsSchema = z.object({
  to: z.union([z.string().email(), z.array(z.string().email()).min(1)]),
  from: z.string().email(),
  subject: z.string().min(1),
  html: z.string().min(1),
  text: z.string().optional(),
  cc: z.array(z.string().email()).optional(),
  bcc: z.array(z.string().email()).optional(),
  replyTo: z.string().email().optional(),
  tags: z.array(z.string()).optional(),
  tracking: TrackingOptionsSchema.optional(),
  headers: z.record(z.string()).optional(),
  attachments: z
    .array(
      z.object({
        filename: z.string(),
        data: z.union([z.string(), z.instanceof(Buffer)]),
        contentType: z.string().optional(),
      })
    )
    .optional(),
});

export type EmailOptions = z.output<typeof EmailOptionsSchema>;

/**
 * Result of sending an email
 */
export const SendResultSchema = z.object({
  id: z.string(),
  message: z.string(),
  status: z.enum(["queued", "sent"]),
});

export type SendResult = z.output<typeof SendResultSchema>;

// ============================================
// Bulk Email Options
// ============================================

/**
 * Recipient with personalization variables
 */
export const RecipientSchema = z.object({
  email: z.string().email(),
  variables: z.record(z.unknown()).default({}),
});

export type Recipient = z.output<typeof RecipientSchema>;

/**
 * Bulk email sending options
 */
export const BulkEmailOptionsSchema = EmailOptionsSchema.omit({ to: true }).extend({
  recipientVariables: z.record(z.record(z.unknown())).optional(),
});

export type BulkEmailOptions = z.output<typeof BulkEmailOptionsSchema>;

/**
 * Result of bulk email send
 */
export const BulkSendResultSchema = z.object({
  totalAccepted: z.number().int().nonnegative(),
  totalRejected: z.number().int().nonnegative(),
  messageIds: z.array(z.string()),
  rejectedRecipients: z.array(z.string()).optional(),
});

export type BulkSendResult = z.output<typeof BulkSendResultSchema>;

// ============================================
// Templates
// ============================================

/**
 * Email template
 */
export const TemplateSchema = z.object({
  name: z.string(),
  description: z.string().optional(),
  content: z.string(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export type Template = z.output<typeof TemplateSchema>;

/**
 * Template variable pattern
 */
export const TEMPLATE_VARIABLE_PATTERN = /\{\{([^}]+)\}\}/g;

// ============================================
// Tracking & Events
// ============================================

/**
 * Event types from Mailgun
 */
export const MessageEventTypeSchema = z.enum([
  "delivered",
  "opened",
  "clicked",
  "bounced",
  "complained",
  "unsubscribed",
  "failed",
  "accepted",
  "rejected",
  "stored",
]);

export type MessageEventType = z.output<typeof MessageEventTypeSchema>;

/**
 * Message event from Mailgun
 */
export const MessageEventSchema = z.object({
  id: z.string(),
  event: MessageEventTypeSchema,
  timestamp: z.date(),
  recipient: z.string().email(),
  messageId: z.string(),
  details: z.record(z.unknown()).default({}),
});

export type MessageEvent = z.output<typeof MessageEventSchema>;

/**
 * Message delivery status
 */
export const MessageStatusSchema = z.enum([
  "queued",
  "delivered",
  "opened",
  "clicked",
  "bounced",
  "failed",
]);

export type MessageStatus = z.output<typeof MessageStatusSchema>;

// ============================================
// Webhooks
// ============================================

/**
 * Base webhook event
 */
const WebhookEventBaseSchema = z.object({
  signature: z.object({
    timestamp: z.string(),
    token: z.string(),
    signature: z.string(),
  }),
  eventData: z.object({
    id: z.string(),
    timestamp: z.number(),
    recipient: z.string().email(),
    "message-id": z.string().optional(),
    tags: z.array(z.string()).optional(),
  }),
});

/**
 * Delivered webhook event
 */
export const DeliveredWebhookEventSchema = WebhookEventBaseSchema.extend({
  eventType: z.literal("delivered"),
  eventData: WebhookEventBaseSchema.shape.eventData.extend({
    "delivery-status": z.object({
      code: z.number(),
      message: z.string(),
    }),
  }),
});

/**
 * Opened webhook event
 */
export const OpenedWebhookEventSchema = WebhookEventBaseSchema.extend({
  eventType: z.literal("opened"),
  eventData: WebhookEventBaseSchema.shape.eventData.extend({
    ip: z.string().optional(),
    "client-info": z
      .object({
        "client-type": z.string().optional(),
        "client-name": z.string().optional(),
        "client-os": z.string().optional(),
        "device-type": z.string().optional(),
      })
      .optional(),
  }),
});

/**
 * Clicked webhook event
 */
export const ClickedWebhookEventSchema = WebhookEventBaseSchema.extend({
  eventType: z.literal("clicked"),
  eventData: WebhookEventBaseSchema.shape.eventData.extend({
    url: z.string().url(),
    ip: z.string().optional(),
  }),
});

/**
 * Bounced webhook event
 */
export const BouncedWebhookEventSchema = WebhookEventBaseSchema.extend({
  eventType: z.literal("bounced"),
  eventData: WebhookEventBaseSchema.shape.eventData.extend({
    "delivery-status": z.object({
      code: z.number(),
      message: z.string(),
      description: z.string().optional(),
    }),
    severity: z.enum(["permanent", "temporary"]),
  }),
});

/**
 * Complained webhook event (spam report)
 */
export const ComplainedWebhookEventSchema = WebhookEventBaseSchema.extend({
  eventType: z.literal("complained"),
});

/**
 * Unsubscribed webhook event
 */
export const UnsubscribedWebhookEventSchema = WebhookEventBaseSchema.extend({
  eventType: z.literal("unsubscribed"),
});

/**
 * Failed webhook event
 */
export const FailedWebhookEventSchema = WebhookEventBaseSchema.extend({
  eventType: z.literal("failed"),
  eventData: WebhookEventBaseSchema.shape.eventData.extend({
    "delivery-status": z.object({
      code: z.number(),
      message: z.string(),
      description: z.string().optional(),
    }),
    severity: z.enum(["permanent", "temporary"]),
    reason: z.string().optional(),
  }),
});

/**
 * Union of all webhook event types
 */
export const WebhookEventSchema = z.discriminatedUnion("eventType", [
  DeliveredWebhookEventSchema,
  OpenedWebhookEventSchema,
  ClickedWebhookEventSchema,
  BouncedWebhookEventSchema,
  ComplainedWebhookEventSchema,
  UnsubscribedWebhookEventSchema,
  FailedWebhookEventSchema,
]);

export type WebhookEvent = z.output<typeof WebhookEventSchema>;

// ============================================
// Rate Limiting
// ============================================

/**
 * Rate limit status
 */
export const RateLimitStatusSchema = z.object({
  currentUsage: z.number().int().nonnegative(),
  limit: z.number().int().positive(),
  remaining: z.number().int().nonnegative(),
  resetsAt: z.date(),
  isLimited: z.boolean(),
});

export type RateLimitStatus = z.output<typeof RateLimitStatusSchema>;

// ============================================
// Error Codes
// ============================================

/**
 * Mailgun-specific error codes
 */
export const MailgunErrorCode = {
  SEND_FAILED: "MAILGUN_SEND_FAILED",
  TEMPLATE_NOT_FOUND: "MAILGUN_TEMPLATE_NOT_FOUND",
  TEMPLATE_EXISTS: "MAILGUN_TEMPLATE_EXISTS",
  RATE_LIMITED: "MAILGUN_RATE_LIMITED",
  WEBHOOK_INVALID: "MAILGUN_WEBHOOK_INVALID",
  API_ERROR: "MAILGUN_API_ERROR",
  CONNECTION_FAILED: "MAILGUN_CONNECTION_FAILED",
  INVALID_CREDENTIALS: "MAILGUN_INVALID_CREDENTIALS",
  DOMAIN_NOT_FOUND: "MAILGUN_DOMAIN_NOT_FOUND",
} as const;

export type MailgunErrorCodeType = (typeof MailgunErrorCode)[keyof typeof MailgunErrorCode];
