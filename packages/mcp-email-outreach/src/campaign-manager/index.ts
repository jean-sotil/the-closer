/**
 * Campaign Manager Module
 *
 * Orchestrates email campaigns with multi-step sequences,
 * scheduling, and follow-up automation.
 */

// Main campaign manager class
export {
  CampaignManager,
  type ILeadRepository,
  type IStatusTracker,
  type ICampaignRepository,
  type IStorage,
  type IEmailEventStorage,
} from "./campaign-manager.js";

// Types and schemas
export type {
  CampaignExecutionResult,
  ScheduledEmail,
  ScheduledEmailStatus,
  CampaignState,
  LeadFilterCriteria,
  CampaignManagerConfig,
  ScheduledEmailProcessingResult,
  CampaignCreationResult,
  LeadEmailContext,
  SendConditionResult,
} from "./types.js";

export {
  CampaignExecutionResultSchema,
  ScheduledEmailStatusSchema,
  ScheduledEmailSchema,
  CampaignStateSchema,
  LeadFilterCriteriaSchema,
  CampaignManagerConfigSchema,
  getTodayDateString,
  calculateScheduledTime,
  isWithinSendWindow,
} from "./types.js";
