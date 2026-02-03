import { z } from "zod";

/**
 * Email queue entry status
 */
export type EmailQueueStatus =
  | "pending"
  | "processing"
  | "sent"
  | "failed"
  | "bounced"
  | "permanent_failure";

/**
 * Email queue entry schema
 */
export const EmailQueueEntrySchema = z.object({
  id: z.string().uuid(),
  leadId: z.string().uuid().optional(),
  campaignId: z.string().uuid().optional(),
  to: z.string().email(),
  from: z.string().email(),
  subject: z.string(),
  html: z.string(),
  text: z.string().optional(),
  status: z.enum(["pending", "processing", "sent", "failed", "bounced", "permanent_failure"]),
  retryCount: z.number().int().min(0).default(0),
  maxRetries: z.number().int().min(0).default(3),
  lastAttemptAt: z.date().nullable(),
  nextRetryAt: z.date().nullable(),
  lastError: z.string().nullable(),
  mailgunMessageId: z.string().nullable(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export type EmailQueueEntry = z.infer<typeof EmailQueueEntrySchema>;

/**
 * Email queue configuration
 */
export const EmailQueueConfigSchema = z.object({
  /** Maximum retry attempts for transient failures */
  maxRetries: z.number().int().min(0).default(3),
  /** Base delay between retries in ms */
  baseDelryMs: z.number().int().min(0).default(60000), // 1 minute
  /** Maximum delay between retries in ms */
  maxDelayMs: z.number().int().min(0).default(3600000), // 1 hour
  /** Backoff multiplier */
  backoffMultiplier: z.number().min(1).default(2),
  /** Daily retry time for bounced messages (hour in UTC) */
  dailyRetryHour: z.number().int().min(0).max(23).default(6), // 6 AM UTC
  /** Maximum age for retrying bounced messages (days) */
  bouncedRetryMaxAgeDays: z.number().int().min(1).default(7),
  /** Circuit breaker failure threshold */
  circuitBreakerThreshold: z.number().int().min(1).default(10),
  /** Circuit breaker timeout in ms */
  circuitBreakerTimeoutMs: z.number().int().min(0).default(300000), // 5 minutes
});

export type EmailQueueConfig = z.infer<typeof EmailQueueConfigSchema>;

/**
 * Queue statistics
 */
export interface EmailQueueStats {
  pending: number;
  processing: number;
  sent: number;
  failed: number;
  bounced: number;
  permanentFailure: number;
  avgRetryCount: number;
  circuitBreakerState: "closed" | "open" | "half-open";
}

/**
 * Email send request
 */
export interface EmailSendRequest {
  to: string;
  from: string;
  subject: string;
  html: string;
  text?: string;
  leadId?: string;
  campaignId?: string;
}

/**
 * Batch process result
 */
export interface BatchProcessResult {
  processed: number;
  sent: number;
  failed: number;
  retryQueued: number;
  permanentFailures: number;
}
