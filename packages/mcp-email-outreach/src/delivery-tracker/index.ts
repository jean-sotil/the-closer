/**
 * Email Delivery Tracker Module
 *
 * Handles webhook events from Mailgun, tracks email engagement,
 * and updates lead statuses based on email interactions.
 */

// Main delivery tracker class
export {
  DeliveryTracker,
  type ILeadRepository,
  type IStatusTracker,
  type IEventStorage,
} from "./delivery-tracker.js";

// Types and schemas
export type {
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
} from "./types.js";

export {
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
} from "./types.js";
