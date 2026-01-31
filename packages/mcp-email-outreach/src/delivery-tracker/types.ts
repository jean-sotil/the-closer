import { z } from "zod";

// ============================================
// Email Event Types
// ============================================

/**
 * Base email event
 */
export const EmailEventBaseSchema = z.object({
  id: z.string(),
  messageId: z.string(),
  leadId: z.string().uuid(),
  campaignId: z.string().uuid().optional(),
  recipient: z.string().email(),
  timestamp: z.date(),
});

export type EmailEventBase = z.output<typeof EmailEventBaseSchema>;

/**
 * Delivered event
 */
export const DeliveredEventSchema = EmailEventBaseSchema.extend({
  type: z.literal("delivered"),
  deliveryCode: z.number().optional(),
  deliveryMessage: z.string().optional(),
});

export type DeliveredEvent = z.output<typeof DeliveredEventSchema>;

/**
 * Opened event
 */
export const OpenedEventSchema = EmailEventBaseSchema.extend({
  type: z.literal("opened"),
  ip: z.string().optional(),
  userAgent: z.string().optional(),
  deviceType: z.string().optional(),
});

export type OpenedEvent = z.output<typeof OpenedEventSchema>;

/**
 * Clicked event
 */
export const ClickedEventSchema = EmailEventBaseSchema.extend({
  type: z.literal("clicked"),
  url: z.string().url(),
  ip: z.string().optional(),
});

export type ClickedEvent = z.output<typeof ClickedEventSchema>;

/**
 * Bounced event
 */
export const BouncedEventSchema = EmailEventBaseSchema.extend({
  type: z.literal("bounced"),
  bounceType: z.enum(["permanent", "temporary"]),
  bounceCode: z.number().optional(),
  bounceMessage: z.string().optional(),
});

export type BouncedEvent = z.output<typeof BouncedEventSchema>;

/**
 * Complained event (spam report)
 */
export const ComplainedEventSchema = EmailEventBaseSchema.extend({
  type: z.literal("complained"),
});

export type ComplainedEvent = z.output<typeof ComplainedEventSchema>;

/**
 * Unsubscribed event
 */
export const UnsubscribedEventSchema = EmailEventBaseSchema.extend({
  type: z.literal("unsubscribed"),
});

export type UnsubscribedEvent = z.output<typeof UnsubscribedEventSchema>;

/**
 * Failed event
 */
export const FailedEventSchema = EmailEventBaseSchema.extend({
  type: z.literal("failed"),
  failureReason: z.string().optional(),
  severity: z.enum(["permanent", "temporary"]),
});

export type FailedEvent = z.output<typeof FailedEventSchema>;

/**
 * Replied event (detected via inbound)
 */
export const RepliedEventSchema = EmailEventBaseSchema.extend({
  type: z.literal("replied"),
  subject: z.string().optional(),
  snippet: z.string().optional(),
  hasBookingIntent: z.boolean().default(false),
});

export type RepliedEvent = z.output<typeof RepliedEventSchema>;

/**
 * All email event types
 */
export type EmailEvent =
  | DeliveredEvent
  | OpenedEvent
  | ClickedEvent
  | BouncedEvent
  | ComplainedEvent
  | UnsubscribedEvent
  | FailedEvent
  | RepliedEvent;

/**
 * Event type literals
 */
export type EmailEventType = EmailEvent["type"];

// ============================================
// Email Metrics
// ============================================

/**
 * Email campaign metrics
 */
export const EmailMetricsSchema = z.object({
  campaignId: z.string().uuid(),

  // Counts
  sent: z.number().int().nonnegative(),
  delivered: z.number().int().nonnegative(),
  opened: z.number().int().nonnegative(),
  clicked: z.number().int().nonnegative(),
  bounced: z.number().int().nonnegative(),
  complained: z.number().int().nonnegative(),
  unsubscribed: z.number().int().nonnegative(),
  replied: z.number().int().nonnegative(),

  // Rates (as percentages 0-100)
  deliveryRate: z.number().min(0).max(100),
  openRate: z.number().min(0).max(100),
  clickRate: z.number().min(0).max(100),
  bounceRate: z.number().min(0).max(100),
  replyRate: z.number().min(0).max(100),

  // Timestamps
  calculatedAt: z.date(),
});

export type EmailMetrics = z.output<typeof EmailMetricsSchema>;

// ============================================
// Stored Event
// ============================================

/**
 * Email event stored in database
 */
export const StoredEmailEventSchema = z.object({
  id: z.string().uuid(),
  eventType: z.string(),
  messageId: z.string(),
  leadId: z.string().uuid(),
  campaignId: z.string().uuid().optional(),
  recipient: z.string().email(),
  timestamp: z.date(),
  eventData: z.record(z.unknown()).default({}),
  createdAt: z.date(),
});

export type StoredEmailEvent = z.output<typeof StoredEmailEventSchema>;

// ============================================
// Configuration
// ============================================

/**
 * Delivery tracker configuration
 */
export const DeliveryTrackerConfigSchema = z.object({
  // Event storage table name
  eventsTableName: z.string().default("email_events"),

  // Reply detection
  enableReplyDetection: z.boolean().default(true),
  bookingIntentKeywords: z
    .array(z.string())
    .default([
      "schedule",
      "book",
      "meeting",
      "call",
      "appointment",
      "available",
      "calendar",
      "time",
      "when",
      "interested",
      "yes",
      "sounds good",
      "let's talk",
    ]),

  // Auto status updates
  markDeclinedOnHardBounce: z.boolean().default(true),
  markDeclinedOnComplaint: z.boolean().default(true),
  haltSequenceOnReply: z.boolean().default(true),
});

export type DeliveryTrackerConfig = z.output<typeof DeliveryTrackerConfigSchema>;

// ============================================
// Processing Result
// ============================================

/**
 * Result of processing a webhook
 */
export interface WebhookProcessingResult {
  success: boolean;
  eventId: string | null;
  eventType: string | null;
  leadId: string | null;
  statusUpdated: boolean;
  error: string | null;
}

// ============================================
// Helper Functions
// ============================================

/**
 * Calculate rate as percentage, handling division by zero
 */
export function calculateRate(numerator: number, denominator: number): number {
  if (denominator === 0) return 0;
  return Math.round((numerator / denominator) * 1000) / 10; // Round to 1 decimal
}

/**
 * Check if text contains booking intent keywords
 */
export function hasBookingIntent(text: string, keywords: string[]): boolean {
  const lowerText = text.toLowerCase();
  return keywords.some((keyword) => lowerText.includes(keyword.toLowerCase()));
}
