import Mailgun, { Interfaces, type MailgunMessageData, type EventsQuery, type DomainEvent } from "mailgun.js";
import FormData from "form-data";

type IMailgunClient = Interfaces.IMailgunClient;
import { createHmac, timingSafeEqual } from "crypto";
import { ValidationError } from "@the-closer/shared";
import { MailgunError, mapMailgunApiError, isRetryableError } from "./errors.js";
import {
  type MailgunClientConfig,
  type EmailOptions,
  type SendResult,
  type Recipient,
  type BulkEmailOptions,
  type BulkSendResult,
  type Template,
  type MessageEvent,
  type MessageStatus,
  type WebhookEvent,
  type RateLimitStatus,
  MailgunClientConfigSchema,
  EmailOptionsSchema,
  MailgunErrorCode,
  TEMPLATE_VARIABLE_PATTERN,
  MessageEventTypeSchema,
  WebhookEventSchema,
} from "./types.js";

/**
 * Maximum recipients per batch (Mailgun limit)
 */
const MAX_BATCH_SIZE = 1000;

/**
 * Default rate limits (conservative defaults, actual limits depend on plan)
 */
const DEFAULT_RATE_LIMIT = 300; // per minute

/**
 * Maximum webhook timestamp age (5 minutes)
 */
const MAX_WEBHOOK_AGE_MS = 5 * 60 * 1000;

/**
 * Retry delays in milliseconds
 */
const RETRY_DELAYS = [1000, 2000, 4000];

/**
 * Type-safe client wrapper for Mailgun
 *
 * Provides email sending, template management, tracking,
 * and webhook handling with built-in rate limiting.
 */
export class MailgunClient {
  private readonly config: MailgunClientConfig;
  private client: IMailgunClient | null = null;
  private connected = false;

  // Rate limiting state
  private sendCount = 0;
  private rateLimitWindowStart: Date = new Date();
  private readonly rateLimit: number;

  // Template cache (in-memory for now)
  private readonly templateCache = new Map<string, Template>();

  constructor(config: Partial<MailgunClientConfig> & { apiKey: string; domain: string }) {
    // Validate and apply defaults
    const parseResult = MailgunClientConfigSchema.safeParse(config);
    if (!parseResult.success) {
      throw new ValidationError("Invalid Mailgun configuration", {
        context: { errors: parseResult.error.errors },
      });
    }
    this.config = parseResult.data;
    this.rateLimit = DEFAULT_RATE_LIMIT;
  }

  // ============================================
  // Connection Management
  // ============================================

  /**
   * Connect to Mailgun and verify credentials
   */
  async connect(): Promise<void> {
    if (this.connected) {
      return;
    }

    try {
      // Use the default export which is the Mailgun class
      const MailgunClass = Mailgun.default ?? Mailgun;
      const mailgun = new MailgunClass(FormData);
      const baseUrl =
        this.config.region === "eu"
          ? "https://api.eu.mailgun.net"
          : "https://api.mailgun.net";

      this.client = mailgun.client({
        username: "api",
        key: this.config.apiKey,
        url: baseUrl,
      });

      // Verify connection by fetching domain info
      await this.client.domains.get(this.config.domain);
      this.connected = true;
    } catch (error) {
      throw mapMailgunApiError(error);
    }
  }

  /**
   * Check if client is connected
   */
  isConnected(): boolean {
    return this.connected;
  }

  /**
   * Ensure client is connected before operations
   */
  private ensureConnected(): void {
    if (!this.connected || !this.client) {
      throw new MailgunError("Mailgun client not connected. Call connect() first.", {
        mailgunCode: MailgunErrorCode.CONNECTION_FAILED,
        statusCode: 503,
      });
    }
  }

  // ============================================
  // Email Sending
  // ============================================

  /**
   * Send a single email
   */
  async sendEmail(options: EmailOptions): Promise<SendResult> {
    this.ensureConnected();

    // Validate options
    const parseResult = EmailOptionsSchema.safeParse(options);
    if (!parseResult.success) {
      throw new ValidationError("Invalid email options", {
        context: { errors: parseResult.error.errors },
      });
    }

    const validated = parseResult.data;
    this.validateEmailAddresses(validated);

    // Check rate limit
    await this.withRateLimit(async () => {
      // Rate limiting wrapper
    });

    const messageData = this.buildMessageData(validated);

    return this.withRetry(async () => {
      const response = await this.client!.messages.create(this.config.domain, messageData);
      this.sendCount++;

      return {
        id: response.id ?? "",
        message: response.message ?? "Queued",
        status: "queued" as const,
      };
    });
  }

  /**
   * Send bulk email to multiple recipients with personalization
   */
  async sendBulkEmail(recipients: Recipient[], options: BulkEmailOptions): Promise<BulkSendResult> {
    this.ensureConnected();

    if (recipients.length === 0) {
      throw new ValidationError("Recipients list cannot be empty", {});
    }

    // Validate recipient emails
    for (const recipient of recipients) {
      if (!this.isValidEmail(recipient.email)) {
        throw new ValidationError(`Invalid email address: ${recipient.email}`, {
          context: { email: recipient.email },
        });
      }
    }

    // Batch recipients (max 1000 per batch per Mailgun limits)
    const batches = this.chunkArray(recipients, MAX_BATCH_SIZE);

    const results: BulkSendResult = {
      totalAccepted: 0,
      totalRejected: 0,
      messageIds: [],
      rejectedRecipients: [],
    };

    for (const batch of batches) {
      // Check rate limit for each batch
      await this.withRateLimit(async () => {
        // Rate limiting wrapper
      });

      const batchResult = await this.sendBatch(batch, options);
      results.totalAccepted += batchResult.totalAccepted;
      results.totalRejected += batchResult.totalRejected;
      results.messageIds.push(...batchResult.messageIds);
      if (batchResult.rejectedRecipients) {
        results.rejectedRecipients = results.rejectedRecipients ?? [];
        results.rejectedRecipients.push(...batchResult.rejectedRecipients);
      }
    }

    return results;
  }

  /**
   * Send a single batch of emails
   */
  private async sendBatch(recipients: Recipient[], options: BulkEmailOptions): Promise<BulkSendResult> {
    const recipientEmails = recipients.map((r) => r.email);
    const recipientVariables: Record<string, Record<string, unknown>> = {};

    for (const recipient of recipients) {
      recipientVariables[recipient.email] = recipient.variables;
    }

    const baseMessageData = this.buildMessageData({ ...options, to: recipientEmails.join(",") });
    const messageData: MailgunMessageData = {
      ...baseMessageData,
      "recipient-variables": JSON.stringify(recipientVariables),
    };

    return this.withRetry(async () => {
      const response = await this.client!.messages.create(this.config.domain, messageData);
      this.sendCount += recipients.length;

      return {
        totalAccepted: recipients.length,
        totalRejected: 0,
        messageIds: response.id ? [response.id] : [],
      };
    });
  }

  /**
   * Build Mailgun message data from options
   */
  private buildMessageData(options: EmailOptions | (BulkEmailOptions & { to: string })): MailgunMessageData {
    const data: MailgunMessageData = {
      from: options.from,
      to: Array.isArray(options.to) ? options.to.join(",") : options.to,
      subject: options.subject,
      html: options.html,
    };

    if (options.text !== undefined) {
      data.text = options.text;
    }
    if (options.cc !== undefined) {
      data.cc = options.cc.join(",");
    }
    if (options.bcc !== undefined) {
      data.bcc = options.bcc.join(",");
    }
    if (options.replyTo !== undefined) {
      data["h:Reply-To"] = options.replyTo;
    }
    if (options.tags !== undefined) {
      data["o:tag"] = options.tags;
    }
    if (options.tracking !== undefined) {
      data["o:tracking-opens"] = options.tracking.opens ? "yes" : "no";
      data["o:tracking-clicks"] = options.tracking.clicks ? "yes" : "no";
    }
    if (options.headers !== undefined) {
      for (const [key, value] of Object.entries(options.headers)) {
        (data as Record<string, unknown>)[`h:${key}`] = value;
      }
    }

    return data;
  }

  // ============================================
  // Template Operations
  // ============================================

  /**
   * Create a new email template
   */
  async createTemplate(name: string, content: string, description?: string): Promise<void> {
    this.validateTemplateName(name);

    if (this.templateCache.has(name)) {
      throw new MailgunError(`Template '${name}' already exists`, {
        mailgunCode: MailgunErrorCode.TEMPLATE_EXISTS,
        statusCode: 409,
        context: { templateName: name },
      });
    }

    const now = new Date();
    const template: Template = {
      name,
      content,
      createdAt: now,
      updatedAt: now,
    };

    if (description !== undefined) {
      template.description = description;
    }

    this.templateCache.set(name, template);
  }

  /**
   * Get a template by name
   */
  async getTemplate(name: string): Promise<Template> {
    const template = this.templateCache.get(name);

    if (!template) {
      throw new MailgunError(`Template '${name}' not found`, {
        mailgunCode: MailgunErrorCode.TEMPLATE_NOT_FOUND,
        statusCode: 404,
        context: { templateName: name },
      });
    }

    return template;
  }

  /**
   * Update an existing template
   */
  async updateTemplate(name: string, content: string): Promise<void> {
    const template = await this.getTemplate(name);

    template.content = content;
    template.updatedAt = new Date();

    this.templateCache.set(name, template);
  }

  /**
   * Delete a template
   */
  async deleteTemplate(name: string): Promise<void> {
    if (!this.templateCache.has(name)) {
      throw new MailgunError(`Template '${name}' not found`, {
        mailgunCode: MailgunErrorCode.TEMPLATE_NOT_FOUND,
        statusCode: 404,
        context: { templateName: name },
      });
    }

    this.templateCache.delete(name);
  }

  /**
   * List all templates
   */
  async listTemplates(): Promise<Template[]> {
    return Array.from(this.templateCache.values());
  }

  /**
   * Render a template with variables
   */
  async renderTemplate(name: string, variables: Record<string, unknown>): Promise<string> {
    const template = await this.getTemplate(name);

    // Extract required variables from template
    const requiredVariables = this.extractTemplateVariables(template.content);

    // Validate all required variables are provided
    const missingVariables = requiredVariables.filter((v) => !(v in variables));
    if (missingVariables.length > 0) {
      throw new ValidationError("Missing required template variables", {
        context: { missingVariables, templateName: name },
      });
    }

    // Render template with variable substitution
    let rendered = template.content;
    for (const [key, value] of Object.entries(variables)) {
      const pattern = new RegExp(`\\{\\{\\s*${key}\\s*\\}\\}`, "g");
      rendered = rendered.replace(pattern, String(value));
    }

    return rendered;
  }

  /**
   * Extract variable names from template content
   */
  private extractTemplateVariables(content: string): string[] {
    const variables = new Set<string>();
    let match;

    const pattern = new RegExp(TEMPLATE_VARIABLE_PATTERN.source, "g");
    while ((match = pattern.exec(content)) !== null) {
      const variable = match[1];
      if (variable) {
        variables.add(variable.trim());
      }
    }

    return Array.from(variables);
  }

  /**
   * Validate template name format
   */
  private validateTemplateName(name: string): void {
    if (!/^[a-zA-Z0-9-_]+$/.test(name)) {
      throw new ValidationError(
        "Template name must contain only alphanumeric characters, hyphens, and underscores",
        { context: { templateName: name } }
      );
    }
  }

  // ============================================
  // Tracking Operations
  // ============================================

  /**
   * Get events for a specific message
   */
  async getMessageEvents(messageId: string): Promise<MessageEvent[]> {
    this.ensureConnected();

    const query: EventsQuery = {
      "message-id": messageId,
    };

    const response = await this.client!.events.get(this.config.domain, query);

    const events: MessageEvent[] = [];

    for (const item of response.items) {
      const domainEvent = item as DomainEvent;
      const eventType = domainEvent.event;
      if (typeof eventType !== "string") continue;

      const parseResult = MessageEventTypeSchema.safeParse(eventType);
      if (!parseResult.success) continue;

      const timestamp = domainEvent.timestamp;
      const recipient = domainEvent.recipient;
      const itemMessageId = domainEvent.message?.headers?.["message-id"];

      if (typeof timestamp !== "number" || typeof recipient !== "string") continue;

      events.push({
        id: typeof domainEvent.id === "string" ? domainEvent.id : "",
        event: parseResult.data,
        timestamp: new Date(timestamp * 1000),
        recipient,
        messageId: typeof itemMessageId === "string" ? itemMessageId : messageId,
        details: domainEvent as unknown as Record<string, unknown>,
      });
    }

    // Sort chronologically
    events.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());

    return events;
  }

  /**
   * Get the latest status of a message
   */
  async getMessageStatus(messageId: string): Promise<MessageStatus> {
    const events = await this.getMessageEvents(messageId);

    if (events.length === 0) {
      return "queued";
    }

    // Find the most advanced status
    const statusPriority: Record<string, number> = {
      clicked: 5,
      opened: 4,
      delivered: 3,
      bounced: 2,
      failed: 1,
      queued: 0,
    };

    let highestStatus: MessageStatus = "queued";
    let highestPriority = 0;

    for (const event of events) {
      const eventStatus = this.eventToStatus(event.event);
      const priority = statusPriority[eventStatus] ?? 0;
      if (priority > highestPriority) {
        highestPriority = priority;
        highestStatus = eventStatus;
      }
    }

    return highestStatus;
  }

  /**
   * Map event type to message status
   */
  private eventToStatus(event: string): MessageStatus {
    switch (event) {
      case "delivered":
        return "delivered";
      case "opened":
        return "opened";
      case "clicked":
        return "clicked";
      case "bounced":
        return "bounced";
      case "failed":
      case "rejected":
        return "failed";
      default:
        return "queued";
    }
  }

  // ============================================
  // Webhook Handling
  // ============================================

  /**
   * Parse and validate a webhook payload
   */
  parseWebhook(payload: unknown, signature: string, timestamp: string): WebhookEvent {
    // Validate timestamp to prevent replay attacks
    if (!this.isValidWebhookTimestamp(timestamp)) {
      throw new MailgunError("Webhook timestamp is too old (possible replay attack)", {
        mailgunCode: MailgunErrorCode.WEBHOOK_INVALID,
        statusCode: 400,
        context: { timestamp },
      });
    }

    // Extract token from payload for signature verification
    const payloadObj = payload as Record<string, unknown>;
    const signatureData = payloadObj["signature"] as Record<string, unknown> | undefined;
    const token = signatureData?.["token"];

    if (typeof token !== "string") {
      throw new MailgunError("Invalid webhook payload: missing signature token", {
        mailgunCode: MailgunErrorCode.WEBHOOK_INVALID,
        statusCode: 400,
      });
    }

    // Verify signature
    if (!this.verifyWebhookSignature(timestamp, token, signature)) {
      throw new MailgunError("Invalid webhook signature", {
        mailgunCode: MailgunErrorCode.WEBHOOK_INVALID,
        statusCode: 401,
      });
    }

    // Parse the event type
    const eventData = payloadObj["event-data"] as Record<string, unknown> | undefined;
    const eventType = eventData?.["event"];

    if (typeof eventType !== "string") {
      throw new MailgunError("Invalid webhook payload: missing event type", {
        mailgunCode: MailgunErrorCode.WEBHOOK_INVALID,
        statusCode: 400,
      });
    }

    // Build webhook event object for validation
    const webhookEvent = {
      eventType,
      signature: signatureData,
      eventData,
    };

    const parseResult = WebhookEventSchema.safeParse(webhookEvent);
    if (!parseResult.success) {
      throw new MailgunError("Invalid webhook payload format", {
        mailgunCode: MailgunErrorCode.WEBHOOK_INVALID,
        statusCode: 400,
        context: { errors: parseResult.error.errors },
      });
    }

    return parseResult.data;
  }

  /**
   * Verify webhook signature using HMAC-SHA256
   */
  private verifyWebhookSignature(timestamp: string, token: string, signature: string): boolean {
    const encodedToken = createHmac("sha256", this.config.apiKey)
      .update(timestamp + token)
      .digest("hex");

    try {
      return timingSafeEqual(Buffer.from(signature), Buffer.from(encodedToken));
    } catch {
      return false;
    }
  }

  /**
   * Check if webhook timestamp is within acceptable range
   */
  private isValidWebhookTimestamp(timestamp: string): boolean {
    const webhookTime = parseInt(timestamp, 10) * 1000;
    const now = Date.now();
    const age = now - webhookTime;

    return age >= 0 && age < MAX_WEBHOOK_AGE_MS;
  }

  // ============================================
  // Rate Limiting
  // ============================================

  /**
   * Get current rate limit status
   */
  getRateLimitStatus(): RateLimitStatus {
    this.checkRateLimitWindow();

    const remaining = Math.max(0, this.rateLimit - this.sendCount);
    const resetsAt = new Date(this.rateLimitWindowStart.getTime() + 60000);

    return {
      currentUsage: this.sendCount,
      limit: this.rateLimit,
      remaining,
      resetsAt,
      isLimited: remaining === 0,
    };
  }

  /**
   * Reset rate limit counters (for testing)
   */
  resetRateLimitCounters(): void {
    this.sendCount = 0;
    this.rateLimitWindowStart = new Date();
  }

  /**
   * Check and reset rate limit window if needed
   */
  private checkRateLimitWindow(): void {
    const now = new Date();
    const windowAge = now.getTime() - this.rateLimitWindowStart.getTime();

    // Reset window every minute
    if (windowAge >= 60000) {
      this.sendCount = 0;
      this.rateLimitWindowStart = now;
    }
  }

  /**
   * Execute function with rate limiting
   */
  private async withRateLimit<T>(fn: () => Promise<T>): Promise<T> {
    this.checkRateLimitWindow();

    if (this.sendCount >= this.rateLimit) {
      const status = this.getRateLimitStatus();
      const waitTime = status.resetsAt.getTime() - Date.now();

      if (waitTime > 0) {
        // Wait for rate limit window to reset
        await this.sleep(waitTime);
        this.checkRateLimitWindow();
      }
    }

    return fn();
  }

  /**
   * Execute function with retry logic
   */
  private async withRetry<T>(fn: () => Promise<T>, maxRetries?: number): Promise<T> {
    const retries = maxRetries ?? this.config.maxRetries;
    let lastError: Error | undefined;

    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        return await fn();
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));

        if (attempt < retries && isRetryableError(error)) {
          const delay = RETRY_DELAYS[attempt] ?? RETRY_DELAYS[RETRY_DELAYS.length - 1]!;
          await this.sleep(delay);
        } else {
          throw mapMailgunApiError(error);
        }
      }
    }

    throw mapMailgunApiError(lastError);
  }

  // ============================================
  // Utility Methods
  // ============================================

  /**
   * Validate email addresses in options
   */
  private validateEmailAddresses(options: EmailOptions): void {
    const emails = Array.isArray(options.to) ? options.to : [options.to];

    for (const email of emails) {
      if (!this.isValidEmail(email)) {
        throw new ValidationError(`Invalid email address: ${email}`, {
          context: { email },
        });
      }
    }

    if (!this.isValidEmail(options.from)) {
      throw new ValidationError(`Invalid from address: ${options.from}`, {
        context: { email: options.from },
      });
    }
  }

  /**
   * Basic email validation
   */
  private isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  /**
   * Split array into chunks
   */
  private chunkArray<T>(array: T[], size: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size));
    }
    return chunks;
  }

  /**
   * Sleep for specified milliseconds
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
