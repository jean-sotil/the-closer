import { randomUUID } from "crypto";

import {
  CircuitBreaker,
  type CircuitBreakerConfig,
} from "@the-closer/shared";

import { MailgunClient } from "../mailgun/client.js";
import { isRetryableError } from "../mailgun/errors.js";
import {
  type EmailQueueEntry,
  type EmailQueueConfig,
  type EmailQueueStats,
  type EmailSendRequest,
  type BatchProcessResult,
  type EmailQueueStatus,
  EmailQueueConfigSchema,
} from "./types.js";

/**
 * Email queue storage interface
 * Can be implemented with Supabase, Redis, or in-memory for testing
 */
export interface EmailQueueStorage {
  /** Add entry to queue */
  enqueue(entry: EmailQueueEntry): Promise<void>;
  /** Update entry */
  update(id: string, updates: Partial<EmailQueueEntry>): Promise<void>;
  /** Get entry by ID */
  getById(id: string): Promise<EmailQueueEntry | null>;
  /** Get entries by status */
  getByStatus(status: EmailQueueStatus, limit?: number): Promise<EmailQueueEntry[]>;
  /** Get entries ready for retry */
  getReadyForRetry(limit?: number): Promise<EmailQueueEntry[]>;
  /** Get bounced entries for daily retry */
  getBouncedForRetry(maxAgeDays: number, limit?: number): Promise<EmailQueueEntry[]>;
  /** Get queue statistics */
  getStats(): Promise<EmailQueueStats>;
  /** Delete old entries */
  deleteOlderThan(days: number): Promise<number>;
}

/**
 * In-memory queue storage for testing
 */
export class InMemoryEmailQueueStorage implements EmailQueueStorage {
  private entries = new Map<string, EmailQueueEntry>();

  async enqueue(entry: EmailQueueEntry): Promise<void> {
    this.entries.set(entry.id, entry);
  }

  async update(id: string, updates: Partial<EmailQueueEntry>): Promise<void> {
    const entry = this.entries.get(id);
    if (entry) {
      this.entries.set(id, { ...entry, ...updates, updatedAt: new Date() });
    }
  }

  async getById(id: string): Promise<EmailQueueEntry | null> {
    return this.entries.get(id) ?? null;
  }

  async getByStatus(status: EmailQueueStatus, limit = 100): Promise<EmailQueueEntry[]> {
    return Array.from(this.entries.values())
      .filter((e) => e.status === status)
      .slice(0, limit);
  }

  async getReadyForRetry(limit = 100): Promise<EmailQueueEntry[]> {
    const now = new Date();
    return Array.from(this.entries.values())
      .filter(
        (e) =>
          e.status === "failed" &&
          e.retryCount < e.maxRetries &&
          e.nextRetryAt !== null &&
          e.nextRetryAt <= now
      )
      .slice(0, limit);
  }

  async getBouncedForRetry(maxAgeDays: number, limit = 100): Promise<EmailQueueEntry[]> {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - maxAgeDays);

    return Array.from(this.entries.values())
      .filter((e) => e.status === "bounced" && e.createdAt >= cutoff)
      .slice(0, limit);
  }

  async getStats(): Promise<EmailQueueStats> {
    const entries = Array.from(this.entries.values());
    const statuses = entries.reduce(
      (acc, e) => {
        acc[e.status] = (acc[e.status] ?? 0) + 1;
        return acc;
      },
      {} as Record<string, number>
    );

    const totalRetries = entries.reduce((sum, e) => sum + e.retryCount, 0);

    return {
      pending: statuses["pending"] ?? 0,
      processing: statuses["processing"] ?? 0,
      sent: statuses["sent"] ?? 0,
      failed: statuses["failed"] ?? 0,
      bounced: statuses["bounced"] ?? 0,
      permanentFailure: statuses["permanent_failure"] ?? 0,
      avgRetryCount: entries.length > 0 ? totalRetries / entries.length : 0,
      circuitBreakerState: "closed",
    };
  }

  async deleteOlderThan(days: number): Promise<number> {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);

    let deleted = 0;
    for (const [id, entry] of this.entries) {
      if (entry.createdAt < cutoff) {
        this.entries.delete(id);
        deleted++;
      }
    }
    return deleted;
  }
}

/**
 * ResilientEmailQueue - Handles email sending with retry, circuit breaker, and queue management
 */
export class ResilientEmailQueue {
  private readonly client: MailgunClient;
  private readonly storage: EmailQueueStorage;
  private readonly config: EmailQueueConfig;
  private readonly circuitBreaker: CircuitBreaker;

  constructor(
    client: MailgunClient,
    storage: EmailQueueStorage,
    config: Partial<EmailQueueConfig> = {}
  ) {
    this.client = client;
    this.storage = storage;
    this.config = EmailQueueConfigSchema.parse(config);

    const cbConfig: Partial<CircuitBreakerConfig> = {
      failureThreshold: this.config.circuitBreakerThreshold,
      timeout: this.config.circuitBreakerTimeoutMs,
      successThreshold: 2,
    };

    this.circuitBreaker = new CircuitBreaker("email-queue", cbConfig);

    this.circuitBreaker.on((event) => {
      if (event.type === "state_change") {
        console.log(`[EmailQueue] Circuit breaker: ${event.from} -> ${event.to}`);
      }
    });
  }

  /**
   * Queue an email for sending
   */
  async queueEmail(request: EmailSendRequest): Promise<string> {
    const now = new Date();
    const entry: EmailQueueEntry = {
      id: randomUUID(),
      leadId: request.leadId,
      campaignId: request.campaignId,
      to: request.to,
      from: request.from,
      subject: request.subject,
      html: request.html,
      text: request.text,
      status: "pending",
      retryCount: 0,
      maxRetries: this.config.maxRetries,
      lastAttemptAt: null,
      nextRetryAt: null,
      lastError: null,
      mailgunMessageId: null,
      createdAt: now,
      updatedAt: now,
    };

    await this.storage.enqueue(entry);
    return entry.id;
  }

  /**
   * Send an email immediately with resilience
   */
  async sendImmediate(request: EmailSendRequest): Promise<{ id: string; messageId: string | null }> {
    const queueId = await this.queueEmail(request);

    try {
      const messageId = await this.processEntry(queueId);
      return { id: queueId, messageId };
    } catch (error) {
      // Entry is already queued for retry
      return { id: queueId, messageId: null };
    }
  }

  /**
   * Process a single queue entry
   */
  private async processEntry(id: string): Promise<string | null> {
    const entry = await this.storage.getById(id);
    if (!entry) {
      throw new Error(`Queue entry not found: ${id}`);
    }

    // Update status to processing
    await this.storage.update(id, { status: "processing", lastAttemptAt: new Date() });

    try {
      // Execute through circuit breaker
      const result = await this.circuitBreaker.execute(async () => {
        return this.client.sendEmail({
          to: entry.to,
          from: entry.from,
          subject: entry.subject,
          html: entry.html,
          text: entry.text,
        });
      });

      // Mark as sent
      await this.storage.update(id, {
        status: "sent",
        mailgunMessageId: result.id,
        lastError: null,
      });

      return result.id;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      await this.handleSendError(entry, errorMessage, error);
      throw error;
    }
  }

  /**
   * Handle send error and schedule retry if appropriate
   */
  private async handleSendError(
    entry: EmailQueueEntry,
    errorMessage: string,
    error: unknown
  ): Promise<void> {
    const newRetryCount = entry.retryCount + 1;

    // Check if error is retryable
    if (!isRetryableError(error) || newRetryCount >= entry.maxRetries) {
      // Permanent failure
      await this.storage.update(entry.id, {
        status: "permanent_failure",
        retryCount: newRetryCount,
        lastError: errorMessage,
        nextRetryAt: null,
      });
      return;
    }

    // Calculate next retry time with exponential backoff
    const delay = this.calculateRetryDelay(newRetryCount);
    const nextRetryAt = new Date(Date.now() + delay);

    await this.storage.update(entry.id, {
      status: "failed",
      retryCount: newRetryCount,
      lastError: errorMessage,
      nextRetryAt,
    });

    console.log(
      `[EmailQueue] Scheduled retry ${newRetryCount}/${entry.maxRetries} for ${entry.id} at ${nextRetryAt.toISOString()}`
    );
  }

  /**
   * Calculate retry delay with exponential backoff
   */
  private calculateRetryDelay(retryCount: number): number {
    const baseDelay = this.config.baseDelryMs;
    const maxDelay = this.config.maxDelayMs;
    const multiplier = this.config.backoffMultiplier;

    const delay = baseDelay * Math.pow(multiplier, retryCount - 1);
    const jitter = delay * 0.1 * (Math.random() * 2 - 1);

    return Math.min(delay + jitter, maxDelay);
  }

  /**
   * Process pending emails in the queue
   */
  async processPendingQueue(limit = 50): Promise<BatchProcessResult> {
    const pending = await this.storage.getByStatus("pending", limit);
    return this.processBatch(pending);
  }

  /**
   * Process emails ready for retry
   */
  async processRetryQueue(limit = 50): Promise<BatchProcessResult> {
    const ready = await this.storage.getReadyForRetry(limit);
    return this.processBatch(ready);
  }

  /**
   * Process bounced emails for daily retry
   * Should be called once per day (e.g., via cron job)
   */
  async processDailyBounceRetry(limit = 100): Promise<BatchProcessResult> {
    const bounced = await this.storage.getBouncedForRetry(
      this.config.bouncedRetryMaxAgeDays,
      limit
    );

    // Reset bounced entries to pending for retry
    for (const entry of bounced) {
      await this.storage.update(entry.id, {
        status: "pending",
        retryCount: 0, // Reset retry count for daily retry
        nextRetryAt: null,
        lastError: null,
      });
    }

    // Now process them
    const reset = await this.storage.getByStatus("pending", limit);
    return this.processBatch(reset.filter((e) => bounced.some((b) => b.id === e.id)));
  }

  /**
   * Process a batch of queue entries
   */
  private async processBatch(entries: EmailQueueEntry[]): Promise<BatchProcessResult> {
    const result: BatchProcessResult = {
      processed: 0,
      sent: 0,
      failed: 0,
      retryQueued: 0,
      permanentFailures: 0,
    };

    // Check circuit breaker before processing
    if (this.circuitBreaker.getState() === "open") {
      console.log("[EmailQueue] Circuit breaker open, skipping batch processing");
      return result;
    }

    for (const entry of entries) {
      result.processed++;

      try {
        await this.processEntry(entry.id);
        result.sent++;
      } catch {
        // Check updated entry status
        const updated = await this.storage.getById(entry.id);
        if (updated?.status === "permanent_failure") {
          result.permanentFailures++;
        } else if (updated?.status === "failed") {
          result.retryQueued++;
        }
        result.failed++;
      }

      // Check if circuit breaker tripped during processing
      if (this.circuitBreaker.getState() === "open") {
        console.log("[EmailQueue] Circuit breaker tripped, stopping batch");
        break;
      }
    }

    return result;
  }

  /**
   * Handle webhook event for bounce/failure tracking
   */
  async handleWebhookEvent(
    messageId: string,
    eventType: "bounced" | "failed" | "delivered"
  ): Promise<void> {
    // Find entry by mailgun message ID
    const pending = await this.storage.getByStatus("sent", 1000);
    const entry = pending.find((e) => e.mailgunMessageId === messageId);

    if (!entry) {
      console.log(`[EmailQueue] No entry found for message ID: ${messageId}`);
      return;
    }

    if (eventType === "bounced") {
      await this.storage.update(entry.id, { status: "bounced" });
      console.log(`[EmailQueue] Marked ${entry.id} as bounced`);
    } else if (eventType === "failed") {
      await this.storage.update(entry.id, { status: "permanent_failure" });
      console.log(`[EmailQueue] Marked ${entry.id} as permanent failure`);
    }
    // 'delivered' doesn't need status update - already 'sent'
  }

  /**
   * Get queue statistics
   */
  async getStats(): Promise<EmailQueueStats> {
    const stats = await this.storage.getStats();
    stats.circuitBreakerState = this.circuitBreaker.getState();
    return stats;
  }

  /**
   * Get circuit breaker state
   */
  getCircuitState(): "closed" | "open" | "half-open" {
    return this.circuitBreaker.getState();
  }

  /**
   * Reset circuit breaker
   */
  resetCircuitBreaker(): void {
    this.circuitBreaker.reset();
  }

  /**
   * Clean up old entries
   */
  async cleanup(olderThanDays = 30): Promise<number> {
    return this.storage.deleteOlderThan(olderThanDays);
  }
}
