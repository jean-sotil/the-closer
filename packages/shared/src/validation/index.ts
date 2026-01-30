// Primitive schemas
export {
  phoneNumberSchema,
  optionalPhoneSchema,
  websiteUrlSchema,
  optionalWebsiteUrlSchema,
  ratingSchema,
  scoreSchema,
  percentageSchema,
  positiveIntSchema,
  nonNegativeIntSchema,
  uuidSchema,
  emailSchema,
  datetimeSchema,
} from "./schemas.js";

// Complex schemas
export {
  SearchCriteriaSchema,
  DiscoverySessionSchema,
  AuditSessionSchema,
  CampaignSubmissionSchema,
  type SearchCriteria,
  type DiscoverySession,
  type AuditSession,
  type CampaignSubmission,
} from "./schemas.js";

// Validation utilities
export {
  validate,
  validateSafe,
  validateLeadProfile,
  validateAuditResult,
  validateCampaignConfig,
  validateLeadFilters,
  validateSearchCriteria,
  validateCampaignSubmission,
  validateArray,
  isValidLeadProfile,
  isValidAuditResult,
  isValidCampaignConfig,
} from "./validators.js";
