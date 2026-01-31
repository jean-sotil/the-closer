import { randomUUID } from "node:crypto";
import { ValidationError, AppError, ErrorCode } from "@the-closer/shared";
import type { LeadProfile, CampaignConfig, EmailSequenceStep, ContactStatus } from "@the-closer/shared";
import { MailgunClient } from "../mailgun/index.js";
import { TemplateEngine, type EmailContext } from "../template-engine/index.js";
import {
  type CampaignManagerConfig,
  type CampaignExecutionResult,
  type ScheduledEmail,
  type ScheduledEmailStatus,
  type CampaignState,
  type LeadFilterCriteria,
  type ScheduledEmailProcessingResult,
  type CampaignCreationResult,
  type SendConditionResult,
  CampaignManagerConfigSchema,
  getTodayDateString,
  calculateScheduledTime,
  isWithinSendWindow,
} from "./types.js";

/**
 * Lead Repository interface
 */
export interface ILeadRepository {
  getLeadById(id: string): Promise<LeadProfile | null>;
  searchLeads(
    filters: {
      status?: ContactStatus | ContactStatus[];
      minRating?: number;
      discoveredAfter?: string;
      discoveredBefore?: string;
    },
    pagination: { limit?: number; offset?: number }
  ): Promise<{ items: LeadProfile[]; total: number }>;
  updateLead(
    id: string,
    updates: Partial<Omit<LeadProfile, "id" | "discoveredAt">>
  ): Promise<LeadProfile>;
}

/**
 * Status Tracker interface
 */
export interface IStatusTracker {
  updateLeadStatus(
    id: string,
    newStatus: ContactStatus,
    options?: { notes?: string; reason?: string }
  ): Promise<LeadProfile>;
}

/**
 * Campaign Repository interface
 */
export interface ICampaignRepository {
  getCampaignById(id: string): Promise<CampaignConfig | null>;
  updateCampaign(id: string, updates: Partial<CampaignConfig>): Promise<CampaignConfig>;
  createCampaign(config: Omit<CampaignConfig, "id" | "createdAt" | "updatedAt">): Promise<CampaignConfig>;
}

/**
 * Database client interface for storage
 */
export interface IStorage {
  insert<T extends Record<string, unknown>>(table: string, data: T): Promise<T>;
  select<T extends Record<string, unknown>>(
    table: string,
    options?: {
      filters?: Array<{ column: string; operator: string; value: unknown }>;
      ordering?: Array<{ column: string; ascending: boolean }>;
      limit?: number;
    }
  ): Promise<{ data: T[] }>;
  update<T extends Record<string, unknown>>(
    table: string,
    id: string,
    data: Partial<T>
  ): Promise<T>;
}

/**
 * Email event storage interface for checking conditions
 */
export interface IEmailEventStorage {
  getEventsForLead(leadId: string, campaignId?: string): Promise<Array<{ eventType: string; timestamp: Date }>>;
}

/**
 * Campaign Manager
 *
 * Orchestrates email campaigns with multi-step sequences,
 * scheduling, and follow-up automation.
 */
export class CampaignManager {
  private readonly config: CampaignManagerConfig;
  private readonly mailgunClient: MailgunClient;
  private readonly leadRepository: ILeadRepository;
  private readonly statusTracker: IStatusTracker;
  private readonly templateEngine: TemplateEngine;
  private readonly campaignRepository: ICampaignRepository | null;
  private readonly storage: IStorage | null;
  private readonly eventStorage: IEmailEventStorage | null;

  // In-memory state cache (for when storage is unavailable)
  private readonly campaignStates = new Map<string, CampaignState>();
  private readonly scheduledEmails = new Map<string, ScheduledEmail>();

  constructor(
    mailgunClient: MailgunClient,
    leadRepository: ILeadRepository,
    statusTracker: IStatusTracker,
    templateEngine: TemplateEngine,
    options: {
      campaignRepository?: ICampaignRepository;
      storage?: IStorage;
      eventStorage?: IEmailEventStorage;
      config?: Partial<CampaignManagerConfig>;
    } = {}
  ) {
    const parseResult = CampaignManagerConfigSchema.safeParse(options.config ?? {});
    if (!parseResult.success) {
      throw new ValidationError("Invalid campaign manager configuration", {
        context: { errors: parseResult.error.errors },
      });
    }

    this.config = parseResult.data;
    this.mailgunClient = mailgunClient;
    this.leadRepository = leadRepository;
    this.statusTracker = statusTracker;
    this.templateEngine = templateEngine;
    this.campaignRepository = options.campaignRepository ?? null;
    this.storage = options.storage ?? null;
    this.eventStorage = options.eventStorage ?? null;
  }

  // ============================================
  // Campaign Execution
  // ============================================

  /**
   * Execute a campaign - send emails to eligible leads
   */
  async executeCampaign(
    campaign: CampaignConfig,
    filterCriteria?: LeadFilterCriteria
  ): Promise<CampaignExecutionResult> {
    const startTime = Date.now();
    const result: CampaignExecutionResult = {
      campaignId: campaign.id,
      executedAt: new Date(),
      leadsProcessed: 0,
      emailsSent: 0,
      emailsFailed: 0,
      followUpsScheduled: 0,
      successfulLeads: [],
      failedLeads: [],
      durationMs: 0,
    };

    // Check campaign status
    if (campaign.status !== "active") {
      throw new AppError(`Campaign ${campaign.id} is not active (status: ${campaign.status})`, {
        code: ErrorCode.BAD_REQUEST,
        statusCode: 400,
      });
    }

    // Get campaign state
    const state = await this.getOrCreateCampaignState(campaign.id);

    // Check daily limit
    const todayStr = getTodayDateString(this.config.timezone);
    if (state.dailySendDate !== todayStr) {
      // Reset daily count for new day
      state.dailySendCount = 0;
      state.dailySendDate = todayStr;
    }

    const dailyLimit = campaign.dailySendLimit ?? this.config.defaultDailySendLimit;
    const remainingToday = Math.max(0, dailyLimit - state.dailySendCount);

    if (remainingToday === 0) {
      result.durationMs = Date.now() - startTime;
      return result;
    }

    // Get eligible leads
    const eligibleLeads = await this.getEligibleLeads(campaign, filterCriteria, remainingToday);

    if (eligibleLeads.length === 0) {
      result.durationMs = Date.now() - startTime;
      return result;
    }

    // Get first step of sequence
    const firstStep = campaign.sequence.find((s) => s.stepNumber === 1);
    if (!firstStep) {
      throw new AppError(`Campaign ${campaign.id} has no step 1 in sequence`, {
        code: ErrorCode.VALIDATION_ERROR,
        statusCode: 400,
      });
    }

    // Process leads in batches
    for (let i = 0; i < eligibleLeads.length; i += this.config.batchSize) {
      const batch = eligibleLeads.slice(i, i + this.config.batchSize);

      for (const lead of batch) {
        result.leadsProcessed++;

        try {
          // Send initial email
          await this.sendEmailToLead(lead, campaign, firstStep);
          result.emailsSent++;
          result.successfulLeads.push(lead.id);
          state.dailySendCount++;
          state.totalEmailsSent++;
          state.totalLeadsContacted++;

          // Update lead status
          await this.statusTracker.updateLeadStatus(lead.id, "emailed", {
            reason: `Campaign: ${campaign.name}`,
          });

          // Schedule follow-ups
          const followUpsScheduled = await this.scheduleFollowUps(lead.id, campaign);
          result.followUpsScheduled += followUpsScheduled;

          // Rate limiting delay
          if (i + batch.indexOf(lead) < eligibleLeads.length - 1) {
            await this.sleep(this.config.sendIntervalMs);
          }
        } catch (error) {
          result.emailsFailed++;
          result.failedLeads.push({
            leadId: lead.id,
            error: error instanceof Error ? error.message : String(error),
          });
        }
      }
    }

    // Update campaign state
    state.lastExecutedAt = new Date();
    await this.saveCampaignState(state);

    result.durationMs = Date.now() - startTime;
    return result;
  }

  /**
   * Send an email to a lead
   */
  private async sendEmailToLead(
    lead: LeadProfile,
    campaign: CampaignConfig,
    step: EmailSequenceStep
  ): Promise<void> {
    // Build email context
    const context: EmailContext = {
      lead,
      audit: null, // Would need to fetch audit from storage
      calendarLink: "", // Would come from campaign config or user settings
    };

    // Render template
    const rendered = await this.templateEngine.renderEmail(step.templateId, context);

    // Send via Mailgun
    await this.mailgunClient.sendEmail({
      to: lead.phoneNumber ? lead.phoneNumber : (lead.websiteUrl ?? ""), // Would need email field
      from: `outreach@${this.config.timezone}.com`, // Would come from config
      subject: rendered.subject,
      html: rendered.html,
      text: rendered.text,
      tags: [`lead-${lead.id}`, `campaign-${campaign.id}`, `step-${step.stepNumber}`],
      tracking: {
        opens: campaign.trackOpens,
        clicks: campaign.trackClicks,
      },
    });
  }

  // ============================================
  // Sequence Management
  // ============================================

  /**
   * Schedule follow-up emails for a lead
   */
  async scheduleFollowUp(
    leadId: string,
    campaignId: string,
    step: EmailSequenceStep
  ): Promise<void> {
    const scheduledTime = calculateScheduledTime(
      step.delayDays,
      step.delayHours,
      this.config.defaultSendHourStart,
      this.config.defaultSendHourEnd
    );

    const scheduledEmail: ScheduledEmail = {
      id: randomUUID(),
      campaignId,
      leadId,
      templateId: step.templateId,
      stepNumber: step.stepNumber,
      scheduledFor: scheduledTime,
      sendCondition: step.sendCondition,
      status: "pending",
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    // Store scheduled email
    if (this.storage) {
      await this.storage.insert(this.config.scheduledEmailsTable, scheduledEmail);
    } else {
      this.scheduledEmails.set(scheduledEmail.id, scheduledEmail);
    }
  }

  /**
   * Schedule all follow-ups for a lead based on campaign sequence
   */
  private async scheduleFollowUps(leadId: string, campaign: CampaignConfig): Promise<number> {
    let count = 0;

    // Skip step 1 (already sent), schedule remaining steps
    for (const step of campaign.sequence) {
      if (step.stepNumber > 1) {
        await this.scheduleFollowUp(leadId, campaign.id, step);
        count++;
      }
    }

    return count;
  }

  /**
   * Process scheduled emails (called by cron job)
   */
  async processScheduledEmails(): Promise<ScheduledEmailProcessingResult> {
    const result: ScheduledEmailProcessingResult = {
      processed: 0,
      sent: 0,
      skipped: 0,
      failed: 0,
      details: [],
    };

    // Check if within send window
    if (!isWithinSendWindow(this.config.defaultSendHourStart, this.config.defaultSendHourEnd)) {
      return result;
    }

    // Get due scheduled emails
    const dueEmails = await this.getDueScheduledEmails();

    for (const scheduledEmail of dueEmails) {
      result.processed++;

      try {
        // Check send condition
        const conditionResult = await this.checkSendCondition(scheduledEmail);

        if (!conditionResult.shouldSend) {
          // Skip this email
          await this.updateScheduledEmailStatus(scheduledEmail.id, "skipped", conditionResult.reason);
          result.skipped++;
          result.details.push({
            emailId: scheduledEmail.id,
            leadId: scheduledEmail.leadId,
            status: "skipped",
            reason: conditionResult.reason,
          });
          continue;
        }

        // Get lead and campaign
        const lead = await this.leadRepository.getLeadById(scheduledEmail.leadId);
        if (!lead) {
          await this.updateScheduledEmailStatus(scheduledEmail.id, "failed", "Lead not found");
          result.failed++;
          continue;
        }

        // Check lead status - skip if declined or converted
        if (lead.contactStatus === "declined" || lead.contactStatus === "converted") {
          await this.updateScheduledEmailStatus(
            scheduledEmail.id,
            "skipped",
            `Lead status is ${lead.contactStatus}`
          );
          result.skipped++;
          continue;
        }

        // Build minimal campaign config for sending
        const step: EmailSequenceStep = {
          stepNumber: scheduledEmail.stepNumber,
          delayDays: 0,
          delayHours: 0,
          templateId: scheduledEmail.templateId,
          sendCondition: scheduledEmail.sendCondition,
          sendTimePreference: "any",
        };

        const campaignStub: CampaignConfig = {
          id: scheduledEmail.campaignId,
          name: "Follow-up",
          leadFilters: {},
          sequence: [step],
          status: "active",
          dailySendLimit: this.config.defaultDailySendLimit,
          timezone: this.config.timezone,
          trackOpens: true,
          trackClicks: true,
          totalLeads: 0,
          emailsSent: 0,
          emailsOpened: 0,
          emailsClicked: 0,
          replies: 0,
          booked: 0,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };

        // Send email
        await this.sendEmailToLead(lead, campaignStub, step);

        // Update status
        await this.updateScheduledEmailStatus(scheduledEmail.id, "sent");
        result.sent++;
        result.details.push({
          emailId: scheduledEmail.id,
          leadId: scheduledEmail.leadId,
          status: "sent",
        });

        // Rate limiting
        await this.sleep(this.config.sendIntervalMs);
      } catch (error) {
        await this.updateScheduledEmailStatus(
          scheduledEmail.id,
          "failed",
          error instanceof Error ? error.message : String(error)
        );
        result.failed++;
        result.details.push({
          emailId: scheduledEmail.id,
          leadId: scheduledEmail.leadId,
          status: "failed",
          reason: error instanceof Error ? error.message : String(error),
        });
      }
    }

    return result;
  }

  /**
   * Check if send condition is met
   */
  private async checkSendCondition(scheduledEmail: ScheduledEmail): Promise<SendConditionResult> {
    const { sendCondition, leadId, campaignId } = scheduledEmail;

    // "always" condition always sends
    if (sendCondition === "always") {
      return { shouldSend: true, reason: "Condition: always" };
    }

    // Get events for this lead
    const events = this.eventStorage
      ? await this.eventStorage.getEventsForLead(leadId, campaignId)
      : [];

    const hasReplied = events.some((e) => e.eventType === "replied");
    const hasOpened = events.some((e) => e.eventType === "opened");
    const hasClicked = events.some((e) => e.eventType === "clicked");

    switch (sendCondition) {
      case "no_reply":
        if (hasReplied) {
          return { shouldSend: false, reason: "Lead has already replied" };
        }
        return { shouldSend: true, reason: "No reply received" };

      case "no_open":
        if (hasOpened) {
          return { shouldSend: false, reason: "Lead has already opened an email" };
        }
        return { shouldSend: true, reason: "No opens recorded" };

      case "no_click":
        if (hasClicked) {
          return { shouldSend: false, reason: "Lead has already clicked a link" };
        }
        return { shouldSend: true, reason: "No clicks recorded" };

      case "replied":
        if (!hasReplied) {
          return { shouldSend: false, reason: "Lead has not replied yet" };
        }
        return { shouldSend: true, reason: "Lead has replied" };

      case "opened":
        if (!hasOpened) {
          return { shouldSend: false, reason: "Lead has not opened any email" };
        }
        return { shouldSend: true, reason: "Lead has opened an email" };

      case "clicked":
        if (!hasClicked) {
          return { shouldSend: false, reason: "Lead has not clicked any link" };
        }
        return { shouldSend: true, reason: "Lead has clicked a link" };

      default:
        return { shouldSend: true, reason: "Unknown condition, defaulting to send" };
    }
  }

  /**
   * Get due scheduled emails
   */
  private async getDueScheduledEmails(): Promise<ScheduledEmail[]> {
    const now = new Date();

    if (this.storage) {
      const result = await this.storage.select<Record<string, unknown>>(
        this.config.scheduledEmailsTable,
        {
          filters: [
            { column: "status", operator: "eq", value: "pending" },
            { column: "scheduled_for", operator: "lte", value: now.toISOString() },
          ],
          ordering: [{ column: "scheduled_for", ascending: true }],
          limit: 100,
        }
      );

      return result.data.map((row) => ({
        id: row["id"] as string,
        campaignId: row["campaign_id"] as string,
        leadId: row["lead_id"] as string,
        templateId: row["template_id"] as string,
        stepNumber: row["step_number"] as number,
        scheduledFor: new Date(row["scheduled_for"] as string),
        sendCondition: row["send_condition"] as ScheduledEmail["sendCondition"],
        status: row["status"] as ScheduledEmailStatus,
        sentAt: row["sent_at"] ? new Date(row["sent_at"] as string) : undefined,
        skipReason: row["skip_reason"] as string | undefined,
        errorMessage: row["error_message"] as string | undefined,
        createdAt: new Date(row["created_at"] as string),
        updatedAt: new Date(row["updated_at"] as string),
      }));
    }

    // In-memory fallback
    return Array.from(this.scheduledEmails.values()).filter(
      (email) => email.status === "pending" && email.scheduledFor <= now
    );
  }

  /**
   * Update scheduled email status
   */
  private async updateScheduledEmailStatus(
    id: string,
    status: ScheduledEmailStatus,
    reason?: string
  ): Promise<void> {
    const updates: Partial<ScheduledEmail> = {
      status,
      updatedAt: new Date(),
    };

    if (status === "sent") {
      updates.sentAt = new Date();
    } else if (status === "skipped" && reason) {
      updates.skipReason = reason;
    } else if (status === "failed" && reason) {
      updates.errorMessage = reason;
    }

    if (this.storage) {
      await this.storage.update(this.config.scheduledEmailsTable, id, updates);
    } else {
      const existing = this.scheduledEmails.get(id);
      if (existing) {
        this.scheduledEmails.set(id, { ...existing, ...updates });
      }
    }
  }

  // ============================================
  // Campaign Lifecycle
  // ============================================

  /**
   * Create a new campaign
   */
  async createCampaign(
    config: Omit<CampaignConfig, "id" | "createdAt" | "updatedAt">
  ): Promise<CampaignCreationResult> {
    if (!this.campaignRepository) {
      throw new AppError("Campaign repository not configured", {
        code: ErrorCode.INTERNAL_ERROR,
        statusCode: 500,
      });
    }

    const campaign = await this.campaignRepository.createCampaign(config);

    const state: CampaignState = {
      campaignId: campaign.id,
      status: campaign.status,
      dailySendCount: 0,
      dailySendDate: getTodayDateString(this.config.timezone),
      totalEmailsSent: 0,
      totalLeadsContacted: 0,
    };

    await this.saveCampaignState(state);

    return { campaign, state };
  }

  /**
   * Pause a campaign
   */
  async pauseCampaign(campaignId: string): Promise<void> {
    if (!this.campaignRepository) {
      throw new AppError("Campaign repository not configured", {
        code: ErrorCode.INTERNAL_ERROR,
        statusCode: 500,
      });
    }

    await this.campaignRepository.updateCampaign(campaignId, { status: "paused" });

    const state = await this.getOrCreateCampaignState(campaignId);
    state.status = "paused";
    await this.saveCampaignState(state);
  }

  /**
   * Resume a paused campaign
   */
  async resumeCampaign(campaignId: string): Promise<void> {
    if (!this.campaignRepository) {
      throw new AppError("Campaign repository not configured", {
        code: ErrorCode.INTERNAL_ERROR,
        statusCode: 500,
      });
    }

    await this.campaignRepository.updateCampaign(campaignId, { status: "active" });

    const state = await this.getOrCreateCampaignState(campaignId);
    state.status = "active";
    await this.saveCampaignState(state);
  }

  /**
   * Stop (cancel) a campaign
   */
  async stopCampaign(campaignId: string): Promise<void> {
    if (!this.campaignRepository) {
      throw new AppError("Campaign repository not configured", {
        code: ErrorCode.INTERNAL_ERROR,
        statusCode: 500,
      });
    }

    await this.campaignRepository.updateCampaign(campaignId, { status: "cancelled" });

    // Cancel all pending scheduled emails
    await this.cancelPendingEmails(campaignId);

    const state = await this.getOrCreateCampaignState(campaignId);
    state.status = "cancelled";
    await this.saveCampaignState(state);
  }

  /**
   * Cancel all pending emails for a campaign
   */
  private async cancelPendingEmails(campaignId: string): Promise<void> {
    if (this.storage) {
      const result = await this.storage.select<Record<string, unknown>>(
        this.config.scheduledEmailsTable,
        {
          filters: [
            { column: "campaign_id", operator: "eq", value: campaignId },
            { column: "status", operator: "eq", value: "pending" },
          ],
        }
      );

      for (const row of result.data) {
        await this.updateScheduledEmailStatus(row["id"] as string, "cancelled", "Campaign stopped");
      }
    } else {
      for (const [id, email] of this.scheduledEmails) {
        if (email.campaignId === campaignId && email.status === "pending") {
          this.scheduledEmails.set(id, {
            ...email,
            status: "cancelled",
            skipReason: "Campaign stopped",
            updatedAt: new Date(),
          });
        }
      }
    }
  }

  // ============================================
  // Lead Filtering
  // ============================================

  /**
   * Get eligible leads for a campaign
   */
  private async getEligibleLeads(
    _campaign: CampaignConfig, // Campaign's leadFilters could be used in future
    filterCriteria?: LeadFilterCriteria,
    limit?: number
  ): Promise<LeadProfile[]> {
    const criteria = filterCriteria ?? {};

    // Build filters
    const filters: {
      status?: ContactStatus | ContactStatus[];
      discoveredBefore?: string;
    } = {};

    // Status filter - default to pending
    const includeStatuses = criteria.includeStatuses ?? ["pending"];
    const excludeStatuses = criteria.excludeStatuses ?? ["declined", "converted"];
    filters.status = includeStatuses.filter((s) => !excludeStatuses.includes(s));

    // Exclude recently contacted
    const excludeDays = criteria.excludeContactedWithinDays ?? this.config.defaultExcludeContactedWithinDays;
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - excludeDays);
    // Note: This is a simplified filter - actual implementation would need lastContactedAt filter

    // Fetch leads
    const result = await this.leadRepository.searchLeads(
      filters,
      { limit: limit ?? criteria.maxLeads ?? 1000 }
    );

    let leads = result.items;

    // Apply additional filters
    if (criteria.includeCategories && criteria.includeCategories.length > 0) {
      leads = leads.filter(
        (l) => l.businessCategory && criteria.includeCategories!.includes(l.businessCategory)
      );
    }

    if (criteria.excludeCategories && criteria.excludeCategories.length > 0) {
      leads = leads.filter(
        (l) => !l.businessCategory || !criteria.excludeCategories!.includes(l.businessCategory)
      );
    }

    if (criteria.minPerformanceScore !== undefined) {
      leads = leads.filter(
        (l) => l.performanceScore !== undefined && l.performanceScore >= criteria.minPerformanceScore!
      );
    }

    if (criteria.maxPerformanceScore !== undefined) {
      leads = leads.filter(
        (l) => l.performanceScore === undefined || l.performanceScore <= criteria.maxPerformanceScore!
      );
    }

    return leads.slice(0, limit);
  }

  // ============================================
  // State Management
  // ============================================

  /**
   * Get or create campaign state
   */
  private async getOrCreateCampaignState(campaignId: string): Promise<CampaignState> {
    // Try to load from storage
    if (this.storage) {
      const result = await this.storage.select<Record<string, unknown>>(
        this.config.campaignStateTable,
        {
          filters: [{ column: "campaign_id", operator: "eq", value: campaignId }],
          limit: 1,
        }
      );

      if (result.data.length > 0) {
        const row = result.data[0]!;
        return {
          campaignId: row["campaign_id"] as string,
          status: row["status"] as CampaignState["status"],
          dailySendCount: row["daily_send_count"] as number,
          dailySendDate: row["daily_send_date"] as string,
          totalEmailsSent: row["total_emails_sent"] as number,
          totalLeadsContacted: row["total_leads_contacted"] as number,
          lastExecutedAt: row["last_executed_at"]
            ? new Date(row["last_executed_at"] as string)
            : undefined,
          nextScheduledAt: row["next_scheduled_at"]
            ? new Date(row["next_scheduled_at"] as string)
            : undefined,
        };
      }
    }

    // Check in-memory cache
    const cached = this.campaignStates.get(campaignId);
    if (cached) {
      return cached;
    }

    // Create new state
    const state: CampaignState = {
      campaignId,
      status: "draft",
      dailySendCount: 0,
      dailySendDate: getTodayDateString(this.config.timezone),
      totalEmailsSent: 0,
      totalLeadsContacted: 0,
    };

    return state;
  }

  /**
   * Save campaign state
   */
  private async saveCampaignState(state: CampaignState): Promise<void> {
    // Save to in-memory cache
    this.campaignStates.set(state.campaignId, state);

    // Save to storage if available
    if (this.storage) {
      try {
        await this.storage.update(this.config.campaignStateTable, state.campaignId, {
          status: state.status,
          daily_send_count: state.dailySendCount,
          daily_send_date: state.dailySendDate,
          total_emails_sent: state.totalEmailsSent,
          total_leads_contacted: state.totalLeadsContacted,
          last_executed_at: state.lastExecutedAt?.toISOString(),
          next_scheduled_at: state.nextScheduledAt?.toISOString(),
        });
      } catch {
        // Insert if update fails (record doesn't exist)
        await this.storage.insert(this.config.campaignStateTable, {
          campaign_id: state.campaignId,
          status: state.status,
          daily_send_count: state.dailySendCount,
          daily_send_date: state.dailySendDate,
          total_emails_sent: state.totalEmailsSent,
          total_leads_contacted: state.totalLeadsContacted,
          last_executed_at: state.lastExecutedAt?.toISOString(),
          next_scheduled_at: state.nextScheduledAt?.toISOString(),
        });
      }
    }
  }

  // ============================================
  // Utility Methods
  // ============================================

  /**
   * Sleep for specified milliseconds
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Get campaign statistics
   */
  async getCampaignStats(campaignId: string): Promise<CampaignState | null> {
    return this.getOrCreateCampaignState(campaignId);
  }
}
