import { z } from "zod";
import type { LeadProfile, CampaignConfig, EmailSequenceStep } from "@the-closer/shared";

// ============================================
// Campaign Execution
// ============================================

/**
 * Result of executing a campaign
 */
export const CampaignExecutionResultSchema = z.object({
  campaignId: z.string().uuid(),
  executedAt: z.date(),

  // Counts
  leadsProcessed: z.number().int().nonnegative(),
  emailsSent: z.number().int().nonnegative(),
  emailsFailed: z.number().int().nonnegative(),
  followUpsScheduled: z.number().int().nonnegative(),

  // Details
  successfulLeads: z.array(z.string().uuid()),
  failedLeads: z.array(z.object({
    leadId: z.string().uuid(),
    error: z.string(),
  })),

  // Timing
  durationMs: z.number().int().nonnegative(),
});

export type CampaignExecutionResult = z.output<typeof CampaignExecutionResultSchema>;

// ============================================
// Scheduled Emails
// ============================================

/**
 * Status of a scheduled email
 */
export const ScheduledEmailStatusSchema = z.enum([
  "pending",
  "sent",
  "skipped",
  "failed",
  "cancelled",
]);

export type ScheduledEmailStatus = z.output<typeof ScheduledEmailStatusSchema>;

/**
 * Scheduled email in the queue
 */
export const ScheduledEmailSchema = z.object({
  id: z.string().uuid(),
  campaignId: z.string().uuid(),
  leadId: z.string().uuid(),
  templateId: z.string().uuid(),
  stepNumber: z.number().int().positive(),

  // Scheduling
  scheduledFor: z.date(),
  sendCondition: z.enum(["always", "no_reply", "no_open", "no_click", "replied", "opened", "clicked"]),

  // Status
  status: ScheduledEmailStatusSchema,
  sentAt: z.date().optional(),
  skipReason: z.string().optional(),
  errorMessage: z.string().optional(),

  // Metadata
  createdAt: z.date(),
  updatedAt: z.date(),
});

export type ScheduledEmail = z.output<typeof ScheduledEmailSchema>;

// ============================================
// Campaign State
// ============================================

/**
 * Campaign runtime state
 */
export const CampaignStateSchema = z.object({
  campaignId: z.string().uuid(),
  status: z.enum(["draft", "scheduled", "active", "paused", "completed", "cancelled"]),

  // Daily tracking
  dailySendCount: z.number().int().nonnegative(),
  dailySendDate: z.string(), // YYYY-MM-DD

  // Overall stats
  totalEmailsSent: z.number().int().nonnegative(),
  totalLeadsContacted: z.number().int().nonnegative(),

  // Timing
  lastExecutedAt: z.date().optional(),
  nextScheduledAt: z.date().optional(),
});

export type CampaignState = z.output<typeof CampaignStateSchema>;

// ============================================
// Lead Filtering
// ============================================

/**
 * Lead filter criteria for campaigns
 */
export const LeadFilterCriteriaSchema = z.object({
  // Score filters
  minQualificationScore: z.number().int().min(0).max(100).optional(),
  maxQualificationScore: z.number().int().min(0).max(100).optional(),

  // Category filters
  includeCategories: z.array(z.string()).optional(),
  excludeCategories: z.array(z.string()).optional(),

  // Status filters
  includeStatuses: z.array(z.enum(["pending", "emailed", "called", "booked", "converted", "declined"])).optional(),
  excludeStatuses: z.array(z.enum(["pending", "emailed", "called", "booked", "converted", "declined"])).optional(),

  // Contact history
  excludeContactedWithinDays: z.number().int().positive().optional(),

  // Audit results
  requireAudit: z.boolean().optional(),
  minPerformanceScore: z.number().int().min(0).max(100).optional(),
  maxPerformanceScore: z.number().int().min(0).max(100).optional(),

  // Limits
  maxLeads: z.number().int().positive().optional(),
});

export type LeadFilterCriteria = z.output<typeof LeadFilterCriteriaSchema>;

// ============================================
// Configuration
// ============================================

/**
 * Campaign manager configuration
 */
export const CampaignManagerConfigSchema = z.object({
  // Storage
  scheduledEmailsTable: z.string().default("scheduled_emails"),
  campaignStateTable: z.string().default("campaign_states"),

  // Capacity
  defaultDailySendLimit: z.number().int().positive().default(100),
  maxDailySendLimit: z.number().int().positive().default(500),

  // Rate limiting
  sendIntervalMs: z.number().int().positive().default(2000), // 2 seconds between sends
  batchSize: z.number().int().positive().default(10),

  // Scheduling
  defaultSendHourStart: z.number().int().min(0).max(23).default(9), // 9 AM
  defaultSendHourEnd: z.number().int().min(0).max(23).default(17), // 5 PM
  timezone: z.string().default("America/New_York"),

  // Contact exclusion
  defaultExcludeContactedWithinDays: z.number().int().positive().default(30),
});

export type CampaignManagerConfig = z.output<typeof CampaignManagerConfigSchema>;

// ============================================
// Processing Results
// ============================================

/**
 * Result of processing scheduled emails
 */
export interface ScheduledEmailProcessingResult {
  processed: number;
  sent: number;
  skipped: number;
  failed: number;
  details: Array<{
    emailId: string;
    leadId: string;
    status: ScheduledEmailStatus;
    reason?: string;
  }>;
}

/**
 * Result of creating a campaign
 */
export interface CampaignCreationResult {
  campaign: CampaignConfig;
  state: CampaignState;
}

// ============================================
// Helper Types
// ============================================

/**
 * Email send context for a lead
 */
export interface LeadEmailContext {
  lead: LeadProfile;
  campaign: CampaignConfig;
  step: EmailSequenceStep;
  calendarLink: string;
}

/**
 * Send condition check result
 */
export interface SendConditionResult {
  shouldSend: boolean;
  reason: string;
}

// ============================================
// Helper Functions
// ============================================

/**
 * Get today's date string in YYYY-MM-DD format
 */
export function getTodayDateString(_timezone: string = "America/New_York"): string {
  const now = new Date();
  // Simple timezone handling - for production, use a proper library like date-fns-tz
  // Note: _timezone parameter reserved for future timezone-aware implementation
  return now.toISOString().split("T")[0] ?? "";
}

/**
 * Calculate scheduled send time based on delay
 */
export function calculateScheduledTime(
  delayDays: number,
  delayHours: number = 0,
  sendHourStart: number = 9,
  sendHourEnd: number = 17
): Date {
  const now = new Date();
  const scheduledDate = new Date(now);

  // Add delay
  scheduledDate.setDate(scheduledDate.getDate() + delayDays);
  scheduledDate.setHours(scheduledDate.getHours() + delayHours);

  // Adjust to be within send window
  const hour = scheduledDate.getHours();
  if (hour < sendHourStart) {
    scheduledDate.setHours(sendHourStart, 0, 0, 0);
  } else if (hour >= sendHourEnd) {
    // Push to next day's send window
    scheduledDate.setDate(scheduledDate.getDate() + 1);
    scheduledDate.setHours(sendHourStart, 0, 0, 0);
  }

  return scheduledDate;
}

/**
 * Check if current time is within send window
 */
export function isWithinSendWindow(
  sendHourStart: number = 9,
  sendHourEnd: number = 17
): boolean {
  const now = new Date();
  const hour = now.getHours();
  return hour >= sendHourStart && hour < sendHourEnd;
}
