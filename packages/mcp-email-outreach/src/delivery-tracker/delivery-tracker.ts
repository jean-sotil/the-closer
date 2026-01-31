import { randomUUID } from "node:crypto";
import { ValidationError, AppError, ErrorCode } from "@the-closer/shared";
import type { LeadProfile } from "@the-closer/shared";
import { MailgunClient, type WebhookEvent } from "../mailgun/index.js";
import {
  type DeliveryTrackerConfig,
  type EmailEvent,
  type DeliveredEvent,
  type OpenedEvent,
  type ClickedEvent,
  type BouncedEvent,
  type ComplainedEvent,
  type RepliedEvent,
  type EmailMetrics,
  type StoredEmailEvent,
  type WebhookProcessingResult,
  DeliveryTrackerConfigSchema,
  calculateRate,
  hasBookingIntent,
} from "./types.js";

/**
 * Lead Repository interface (to avoid circular dependency)
 */
export interface ILeadRepository {
  getLeadById(id: string): Promise<LeadProfile | null>;
  updateLead(
    id: string,
    updates: Partial<Omit<LeadProfile, "id" | "discoveredAt">>
  ): Promise<LeadProfile>;
}

/**
 * Status Tracker interface (to avoid circular dependency)
 */
export interface IStatusTracker {
  updateLeadStatus(
    id: string,
    newStatus: "pending" | "emailed" | "called" | "booked" | "converted" | "declined",
    options?: { notes?: string; reason?: string }
  ): Promise<LeadProfile>;
}

/**
 * Database client interface for event storage
 */
export interface IEventStorage {
  insert<T extends Record<string, unknown>>(table: string, data: T): Promise<T>;
  select<T extends Record<string, unknown>>(
    table: string,
    options?: {
      filters?: Array<{ column: string; operator: string; value: unknown }>;
    }
  ): Promise<{ data: T[] }>;
}

/**
 * Email Delivery Tracker
 *
 * Handles webhook events from Mailgun, tracks email engagement,
 * and updates lead statuses based on email interactions.
 */
export class DeliveryTracker {
  private readonly config: DeliveryTrackerConfig;
  private readonly mailgunClient: MailgunClient;
  private readonly statusTracker: IStatusTracker;
  private readonly eventStorage: IEventStorage | null;

  constructor(
    mailgunClient: MailgunClient,
    _leadRepository: ILeadRepository, // Reserved for future use
    statusTracker: IStatusTracker,
    eventStorage: IEventStorage | null = null,
    config: Partial<DeliveryTrackerConfig> = {}
  ) {
    const parseResult = DeliveryTrackerConfigSchema.safeParse(config);
    if (!parseResult.success) {
      throw new ValidationError("Invalid delivery tracker configuration", {
        context: { errors: parseResult.error.errors },
      });
    }
    this.config = parseResult.data;
    this.mailgunClient = mailgunClient;
    this.statusTracker = statusTracker;
    this.eventStorage = eventStorage;
  }

  // ============================================
  // Webhook Processing
  // ============================================

  /**
   * Process a webhook payload from Mailgun
   */
  async processWebhook(
    payload: unknown,
    signature: string,
    timestamp: string
  ): Promise<WebhookProcessingResult> {
    let eventId: string | null = null;
    let eventType: string | null = null;
    let leadId: string | null = null;
    let statusUpdated = false;

    try {
      // Parse and validate webhook
      const webhookEvent = this.mailgunClient.parseWebhook(payload, signature, timestamp);

      eventType = webhookEvent.eventType;

      // Extract lead ID from message tags or recipient-variables
      leadId = this.extractLeadId(webhookEvent);

      if (!leadId) {
        return {
          success: false,
          eventId: null,
          eventType,
          leadId: null,
          statusUpdated: false,
          error: "Could not extract lead ID from webhook payload",
        };
      }

      // Convert to internal event format
      const event = this.convertWebhookToEvent(webhookEvent, leadId);
      eventId = event.id;

      // Store event
      await this.storeEvent(event);

      // Route to appropriate handler
      statusUpdated = await this.routeEvent(event);

      return {
        success: true,
        eventId,
        eventType,
        leadId,
        statusUpdated,
        error: null,
      };
    } catch (error) {
      return {
        success: false,
        eventId,
        eventType,
        leadId,
        statusUpdated,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Extract lead ID from webhook event
   */
  private extractLeadId(event: WebhookEvent): string | null {
    // Try to get from tags (format: "lead-{uuid}")
    const tags = event.eventData.tags ?? [];
    for (const tag of tags) {
      if (tag.startsWith("lead-")) {
        return tag.substring(5);
      }
    }

    // Try to get from user-variables in event data
    const eventData = event.eventData as Record<string, unknown>;
    const userVariables = eventData["user-variables"] as Record<string, string> | undefined;
    if (userVariables?.["lead_id"]) {
      return userVariables["lead_id"];
    }

    return null;
  }

  /**
   * Convert Mailgun webhook event to internal event format
   */
  private convertWebhookToEvent(webhook: WebhookEvent, leadId: string): EmailEvent {
    // Capture event type before switch for use in default case
    const webhookEventType: string = webhook.eventType;

    const baseEvent = {
      id: randomUUID(),
      messageId: webhook.eventData["message-id"] ?? randomUUID(),
      leadId,
      recipient: webhook.eventData.recipient,
      timestamp: new Date(webhook.eventData.timestamp * 1000),
    };

    switch (webhook.eventType) {
      case "delivered":
        return {
          ...baseEvent,
          type: "delivered",
          deliveryCode: webhook.eventData["delivery-status"]?.code,
          deliveryMessage: webhook.eventData["delivery-status"]?.message,
        };

      case "opened":
        return {
          ...baseEvent,
          type: "opened",
          ip: webhook.eventData.ip,
          userAgent: webhook.eventData["client-info"]?.["client-name"],
          deviceType: webhook.eventData["client-info"]?.["device-type"],
        };

      case "clicked":
        return {
          ...baseEvent,
          type: "clicked",
          url: webhook.eventData.url,
          ip: webhook.eventData.ip,
        };

      case "bounced":
        return {
          ...baseEvent,
          type: "bounced",
          bounceType: webhook.eventData.severity,
          bounceCode: webhook.eventData["delivery-status"]?.code,
          bounceMessage: webhook.eventData["delivery-status"]?.message,
        };

      case "complained":
        return {
          ...baseEvent,
          type: "complained",
        };

      case "unsubscribed":
        return {
          ...baseEvent,
          type: "unsubscribed",
        };

      case "failed":
        return {
          ...baseEvent,
          type: "failed",
          failureReason: webhook.eventData["delivery-status"]?.message,
          severity: webhook.eventData.severity,
        };

      default:
        throw new AppError(`Unknown webhook event type: ${webhookEventType}`, {
          code: ErrorCode.VALIDATION_ERROR,
          statusCode: 400,
        });
    }
  }

  /**
   * Route event to appropriate handler
   */
  private async routeEvent(event: EmailEvent): Promise<boolean> {
    switch (event.type) {
      case "delivered":
        return this.handleDelivered(event);
      case "opened":
        return this.handleOpened(event);
      case "clicked":
        return this.handleClicked(event);
      case "bounced":
        return this.handleBounced(event);
      case "complained":
        return this.handleComplained(event);
      case "replied":
        return this.handleReplied(event);
      default:
        return false;
    }
  }

  // ============================================
  // Event Handlers
  // ============================================

  /**
   * Handle delivered event
   */
  async handleDelivered(_event: DeliveredEvent): Promise<boolean> {
    // Delivered events don't typically trigger status updates
    // They're mainly for metrics tracking
    return false;
  }

  /**
   * Handle opened event
   */
  async handleOpened(_event: OpenedEvent): Promise<boolean> {
    // Opened events can be used to prioritize leads
    // For now, just track the event
    return false;
  }

  /**
   * Handle clicked event
   */
  async handleClicked(_event: ClickedEvent): Promise<boolean> {
    // Clicked events indicate high engagement
    // Could trigger priority notifications
    return false;
  }

  /**
   * Handle bounced event
   */
  async handleBounced(event: BouncedEvent): Promise<boolean> {
    // Hard bounces should mark the lead as invalid
    if (event.bounceType === "permanent" && this.config.markDeclinedOnHardBounce) {
      try {
        await this.statusTracker.updateLeadStatus(event.leadId, "declined", {
          reason: `Email hard bounced: ${event.bounceMessage ?? "Invalid email address"}`,
        });
        return true;
      } catch (error) {
        console.error(`Failed to update lead status for bounce: ${event.leadId}`, error);
      }
    }
    return false;
  }

  /**
   * Handle complained event (spam report)
   */
  async handleComplained(event: ComplainedEvent): Promise<boolean> {
    // Spam complaints should immediately stop outreach
    if (this.config.markDeclinedOnComplaint) {
      try {
        await this.statusTracker.updateLeadStatus(event.leadId, "declined", {
          reason: "Recipient reported email as spam",
        });
        return true;
      } catch (error) {
        console.error(`Failed to update lead status for complaint: ${event.leadId}`, error);
      }
    }
    return false;
  }

  /**
   * Handle replied event
   */
  async handleReplied(event: RepliedEvent): Promise<boolean> {
    // Replies indicate active engagement - stop sequence and track
    if (this.config.haltSequenceOnReply) {
      try {
        // Check if reply contains booking intent
        const hasIntent =
          event.hasBookingIntent ||
          (event.snippet &&
            hasBookingIntent(event.snippet, this.config.bookingIntentKeywords));

        const notes = hasIntent
          ? "Lead replied with booking intent - follow up immediately"
          : "Lead replied to outreach email";

        // Move to "called" status to indicate follow-up needed
        // (emailed -> called is valid transition for "contacted but needs follow-up")
        await this.statusTracker.updateLeadStatus(event.leadId, "called", {
          reason: "Replied to email",
          notes,
        });

        return true;
      } catch (error) {
        console.error(`Failed to update lead status for reply: ${event.leadId}`, error);
      }
    }
    return false;
  }

  // ============================================
  // Event Storage
  // ============================================

  /**
   * Store an email event
   */
  private async storeEvent(event: EmailEvent): Promise<void> {
    if (!this.eventStorage) return;

    const storedEvent: StoredEmailEvent = {
      id: event.id,
      eventType: event.type,
      messageId: event.messageId,
      leadId: event.leadId,
      campaignId: (event as { campaignId?: string }).campaignId,
      recipient: event.recipient,
      timestamp: event.timestamp,
      eventData: event as unknown as Record<string, unknown>,
      createdAt: new Date(),
    };

    try {
      await this.eventStorage.insert(this.config.eventsTableName, storedEvent);
    } catch (error) {
      console.error("Failed to store email event:", error);
    }
  }

  // ============================================
  // Metrics Aggregation
  // ============================================

  /**
   * Get email metrics for a campaign
   */
  async getEmailMetrics(campaignId: string): Promise<EmailMetrics> {
    if (!this.eventStorage) {
      return this.createEmptyMetrics(campaignId);
    }

    try {
      const result = await this.eventStorage.select<Record<string, unknown>>(
        this.config.eventsTableName,
        {
          filters: [{ column: "campaign_id", operator: "eq", value: campaignId }],
        }
      );

      // Cast to StoredEmailEvent array
      const events = result.data as unknown as StoredEmailEvent[];

      // Count events by type
      const counts = {
        sent: 0, // Need to track sends separately
        delivered: 0,
        opened: 0,
        clicked: 0,
        bounced: 0,
        complained: 0,
        unsubscribed: 0,
        replied: 0,
      };

      // Track unique recipients for each event type
      const uniqueDelivered = new Set<string>();
      const uniqueOpened = new Set<string>();
      const uniqueClicked = new Set<string>();

      for (const event of events) {
        switch (event.eventType) {
          case "delivered":
            uniqueDelivered.add(event.recipient);
            break;
          case "opened":
            uniqueOpened.add(event.recipient);
            break;
          case "clicked":
            uniqueClicked.add(event.recipient);
            break;
          case "bounced":
            counts.bounced++;
            break;
          case "complained":
            counts.complained++;
            break;
          case "unsubscribed":
            counts.unsubscribed++;
            break;
          case "replied":
            counts.replied++;
            break;
        }
      }

      counts.delivered = uniqueDelivered.size;
      counts.opened = uniqueOpened.size;
      counts.clicked = uniqueClicked.size;
      // Estimate sent as delivered + bounced (simplified)
      counts.sent = counts.delivered + counts.bounced;

      return {
        campaignId,
        ...counts,
        deliveryRate: calculateRate(counts.delivered, counts.sent),
        openRate: calculateRate(counts.opened, counts.delivered),
        clickRate: calculateRate(counts.clicked, counts.opened),
        bounceRate: calculateRate(counts.bounced, counts.sent),
        replyRate: calculateRate(counts.replied, counts.delivered),
        calculatedAt: new Date(),
      };
    } catch (error) {
      console.error("Failed to get email metrics:", error);
      return this.createEmptyMetrics(campaignId);
    }
  }

  /**
   * Create empty metrics object
   */
  private createEmptyMetrics(campaignId: string): EmailMetrics {
    return {
      campaignId,
      sent: 0,
      delivered: 0,
      opened: 0,
      clicked: 0,
      bounced: 0,
      complained: 0,
      unsubscribed: 0,
      replied: 0,
      deliveryRate: 0,
      openRate: 0,
      clickRate: 0,
      bounceRate: 0,
      replyRate: 0,
      calculatedAt: new Date(),
    };
  }

  /**
   * Get events for a specific lead
   */
  async getLeadEvents(leadId: string): Promise<StoredEmailEvent[]> {
    if (!this.eventStorage) return [];

    try {
      const result = await this.eventStorage.select<Record<string, unknown>>(
        this.config.eventsTableName,
        {
          filters: [{ column: "lead_id", operator: "eq", value: leadId }],
        }
      );

      return result.data as unknown as StoredEmailEvent[];
    } catch (error) {
      console.error("Failed to get lead events:", error);
      return [];
    }
  }

  /**
   * Get events for a specific message
   */
  async getMessageEvents(messageId: string): Promise<StoredEmailEvent[]> {
    if (!this.eventStorage) return [];

    try {
      const result = await this.eventStorage.select<Record<string, unknown>>(
        this.config.eventsTableName,
        {
          filters: [{ column: "message_id", operator: "eq", value: messageId }],
        }
      );

      return result.data as unknown as StoredEmailEvent[];
    } catch (error) {
      console.error("Failed to get message events:", error);
      return [];
    }
  }

  // ============================================
  // Reply Processing
  // ============================================

  /**
   * Process an inbound reply email
   */
  async processReply(
    recipient: string,
    subject: string,
    body: string,
    leadId: string,
    messageId?: string
  ): Promise<void> {
    const hasIntent = hasBookingIntent(body, this.config.bookingIntentKeywords);

    const replyEvent: RepliedEvent = {
      id: randomUUID(),
      type: "replied",
      messageId: messageId ?? randomUUID(),
      leadId,
      recipient,
      timestamp: new Date(),
      subject,
      snippet: body.substring(0, 200),
      hasBookingIntent: hasIntent,
    };

    await this.storeEvent(replyEvent);
    await this.handleReplied(replyEvent);
  }
}
