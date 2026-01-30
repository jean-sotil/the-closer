import { z } from "zod";

/**
 * Pain point types identified during site audits
 */
export const PainPointTypeSchema = z.enum([
  "SLOW_LOAD",
  "BROKEN_MOBILE_UX",
  "UNUSED_CSS",
  "UNUSED_JS",
  "WCAG_VIOLATION",
  "MISSING_META",
  "BROKEN_LINKS",
  "LARGE_IMAGES",
  "NO_HTTPS",
  "RENDER_BLOCKING",
]);

export type PainPointType = z.infer<typeof PainPointTypeSchema>;

/**
 * Severity levels for pain points
 */
export const SeveritySchema = z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]);
export type Severity = z.infer<typeof SeveritySchema>;

/**
 * Pain point identified during audit
 */
export const PainPointSchema = z.object({
  type: PainPointTypeSchema,
  value: z.string(),
  severity: SeveritySchema,
  description: z.string().optional(),
});

export type PainPoint = z.infer<typeof PainPointSchema>;

/**
 * Contact status for lead outreach
 */
export const ContactStatusSchema = z.enum([
  "pending",
  "emailed",
  "called",
  "booked",
  "converted",
  "declined",
]);

export type ContactStatus = z.infer<typeof ContactStatusSchema>;

/**
 * Evidence types collected during audits
 */
export const EvidenceTypeSchema = z.enum([
  "screenshot",
  "video",
  "report",
  "trace",
]);

export type EvidenceType = z.infer<typeof EvidenceTypeSchema>;

/**
 * Evidence item schema
 */
export const EvidenceItemSchema = z.object({
  type: EvidenceTypeSchema,
  url: z.string().url(),
  description: z.string().optional(),
  createdAt: z.string().datetime().optional(),
});

export type EvidenceItem = z.infer<typeof EvidenceItemSchema>;

/**
 * Lead profile - central data model
 */
export const LeadProfileSchema = z.object({
  id: z.string().uuid(),

  // Discovery data
  businessName: z.string(),
  address: z.string().optional(),
  phoneNumber: z.string().optional(),
  websiteUrl: z.string().url().optional(),
  rating: z.number().min(0).max(5).optional(),
  reviewCount: z.number().int().nonnegative().optional(),
  businessCategory: z.string().optional(),

  // Audit results
  painPoints: z.array(PainPointSchema).default([]),
  performanceScore: z.number().int().min(0).max(100).optional(),
  accessibilityScore: z.number().int().min(0).max(100).optional(),
  mobileFriendly: z.boolean().optional(),

  // Evidence
  evidenceUrls: z.array(EvidenceItemSchema).default([]),

  // Outreach status
  contactStatus: ContactStatusSchema.default("pending"),
  lastContactedAt: z.string().datetime().optional(),
  nextFollowupAt: z.string().datetime().optional(),
  notes: z.string().optional(),

  // Metadata
  discoveredAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  sourceQuery: z.string().optional(),
});

export type LeadProfile = z.infer<typeof LeadProfileSchema>;

/**
 * Input schema for creating a new lead
 */
export const CreateLeadInputSchema = LeadProfileSchema.omit({
  id: true,
  discoveredAt: true,
  updatedAt: true,
}).partial({
  painPoints: true,
  evidenceUrls: true,
  contactStatus: true,
});

export type CreateLeadInput = z.infer<typeof CreateLeadInputSchema>;

// ============================================
// Lead Status & Filters
// ============================================

/**
 * Lead status for tracking pipeline stage
 */
export const LeadStatusSchema = z.enum([
  "PENDING",
  "CONTACTED",
  "RESPONDED",
  "BOOKED",
  "CONVERTED",
  "DISQUALIFIED",
]);

export type LeadStatus = z.infer<typeof LeadStatusSchema>;

/**
 * Lead filters for search/query operations
 */
export const LeadFiltersSchema = z.object({
  status: z.array(ContactStatusSchema).optional(),
  leadStatus: z.array(LeadStatusSchema).optional(),
  minRating: z.number().min(0).max(5).optional(),
  maxRating: z.number().min(0).max(5).optional(),
  minPerformanceScore: z.number().min(0).max(100).optional(),
  maxPerformanceScore: z.number().min(0).max(100).optional(),
  categories: z.array(z.string()).optional(),
  sourceQuery: z.string().optional(),
  hasWebsite: z.boolean().optional(),
  hasPhone: z.boolean().optional(),
  mobileFriendly: z.boolean().optional(),
  discoveredAfter: z.string().datetime().optional(),
  discoveredBefore: z.string().datetime().optional(),
  painPointTypes: z.array(PainPointTypeSchema).optional(),
  minPainPoints: z.number().int().nonnegative().optional(),
});

export type LeadFilters = z.infer<typeof LeadFiltersSchema>;

// ============================================
// Audit Types
// ============================================

/**
 * WCAG severity levels
 */
export const WCAGSeveritySchema = z.enum([
  "minor",
  "moderate",
  "serious",
  "critical",
]);

export type WCAGSeverity = z.infer<typeof WCAGSeveritySchema>;

/**
 * WCAG violation found during accessibility audit
 */
export const WCAGViolationSchema = z.object({
  ruleId: z.string(),
  severity: WCAGSeveritySchema,
  description: z.string(),
  elementSelector: z.string().optional(),
  htmlSnippet: z.string().optional(),
  recommendation: z.string(),
  wcagCriteria: z.string().optional(),
  impact: z.string().optional(),
});

export type WCAGViolation = z.infer<typeof WCAGViolationSchema>;

/**
 * Responsive/mobile layout issue
 */
export const ResponsiveIssueSchema = z.object({
  type: z.enum([
    "HORIZONTAL_SCROLL",
    "TOUCH_TARGET_TOO_SMALL",
    "TEXT_TOO_SMALL",
    "CONTENT_OVERFLOW",
    "FIXED_WIDTH_ELEMENTS",
    "MISSING_VIEWPORT",
  ]),
  description: z.string(),
  elementSelector: z.string().optional(),
  viewportWidth: z.number().int().optional(),
  actualWidth: z.number().int().optional(),
  recommendation: z.string(),
});

export type ResponsiveIssue = z.infer<typeof ResponsiveIssueSchema>;

/**
 * Core Web Vitals and performance metrics
 */
export const PerformanceMetricsSchema = z.object({
  // Core Web Vitals
  firstContentfulPaint: z.number().optional(),
  largestContentfulPaint: z.number().optional(),
  cumulativeLayoutShift: z.number().optional(),
  firstInputDelay: z.number().optional(),
  interactionToNextPaint: z.number().optional(),
  timeToFirstByte: z.number().optional(),

  // Load metrics
  domContentLoaded: z.number().optional(),
  loadComplete: z.number().optional(),
  timeToInteractive: z.number().optional(),

  // Resource metrics
  totalResourceSize: z.number().int().optional(),
  totalRequests: z.number().int().optional(),
  unusedJsBytes: z.number().int().optional(),
  unusedCssBytes: z.number().int().optional(),
  unusedJsPercent: z.number().min(0).max(100).optional(),
  unusedCssPercent: z.number().min(0).max(100).optional(),

  // Lighthouse scores (0-100)
  performanceScore: z.number().int().min(0).max(100).optional(),
  accessibilityScore: z.number().int().min(0).max(100).optional(),
  bestPracticesScore: z.number().int().min(0).max(100).optional(),
  seoScore: z.number().int().min(0).max(100).optional(),
});

export type PerformanceMetrics = z.infer<typeof PerformanceMetricsSchema>;

/**
 * Complete audit result for a website
 */
export const AuditResultSchema = z.object({
  id: z.string().uuid(),
  leadId: z.string().uuid(),
  url: z.string().url(),
  auditedAt: z.string().datetime(),

  // Performance
  metrics: PerformanceMetricsSchema,

  // Accessibility
  wcagViolations: z.array(WCAGViolationSchema).default([]),
  accessibilityScore: z.number().int().min(0).max(100).optional(),

  // Mobile/Responsive
  mobileFriendly: z.boolean(),
  responsiveIssues: z.array(ResponsiveIssueSchema).default([]),
  testedViewports: z
    .array(
      z.object({
        width: z.number().int(),
        height: z.number().int(),
        deviceName: z.string().optional(),
      })
    )
    .default([]),

  // Pain points summary
  painPoints: z.array(PainPointSchema).default([]),

  // Evidence
  evidence: z.array(EvidenceItemSchema).default([]),

  // Metadata
  durationMs: z.number().int().optional(),
  error: z.string().optional(),
});

export type AuditResult = z.infer<typeof AuditResultSchema>;

// ============================================
// Campaign Types
// ============================================

/**
 * Campaign status
 */
export const CampaignStatusSchema = z.enum([
  "draft",
  "scheduled",
  "active",
  "paused",
  "completed",
  "cancelled",
]);

export type CampaignStatus = z.infer<typeof CampaignStatusSchema>;

/**
 * Condition for sending an email in a sequence
 */
export const SendConditionSchema = z.enum([
  "always",
  "no_reply",
  "no_open",
  "no_click",
  "replied",
  "opened",
  "clicked",
]);

export type SendCondition = z.infer<typeof SendConditionSchema>;

/**
 * Email template with variable placeholders
 */
export const EmailTemplateSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  subject: z.string(),
  htmlBody: z.string(),
  textBody: z.string().optional(),
  variables: z.array(z.string()).default([]),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export type EmailTemplate = z.infer<typeof EmailTemplateSchema>;

/**
 * Step in an email sequence
 */
export const EmailSequenceStepSchema = z.object({
  stepNumber: z.number().int().positive(),
  delayDays: z.number().int().nonnegative(),
  delayHours: z.number().int().nonnegative().default(0),
  templateId: z.string().uuid(),
  sendCondition: SendConditionSchema.default("always"),
  sendTimePreference: z
    .enum(["morning", "afternoon", "evening", "any"])
    .default("any"),
});

export type EmailSequenceStep = z.infer<typeof EmailSequenceStepSchema>;

/**
 * Campaign configuration
 */
export const CampaignConfigSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  description: z.string().optional(),

  // Lead targeting
  leadFilters: LeadFiltersSchema,

  // Email sequence
  sequence: z.array(EmailSequenceStepSchema),

  // Settings
  status: CampaignStatusSchema.default("draft"),
  dailySendLimit: z.number().int().positive().default(50),
  timezone: z.string().default("America/New_York"),

  // Tracking
  trackOpens: z.boolean().default(true),
  trackClicks: z.boolean().default(true),

  // Stats
  totalLeads: z.number().int().nonnegative().default(0),
  emailsSent: z.number().int().nonnegative().default(0),
  emailsOpened: z.number().int().nonnegative().default(0),
  emailsClicked: z.number().int().nonnegative().default(0),
  replies: z.number().int().nonnegative().default(0),
  booked: z.number().int().nonnegative().default(0),

  // Timestamps
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  scheduledAt: z.string().datetime().optional(),
  startedAt: z.string().datetime().optional(),
  completedAt: z.string().datetime().optional(),
});

export type CampaignConfig = z.infer<typeof CampaignConfigSchema>;
