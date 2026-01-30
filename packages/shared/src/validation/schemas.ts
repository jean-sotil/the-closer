import { z } from "zod";

/**
 * Phone number normalization transform
 * Removes all non-digit characters and validates length
 */
export const phoneNumberSchema = z
  .string()
  .transform((val) => val.replace(/\D/g, ""))
  .refine((val) => val.length >= 10 && val.length <= 15, {
    message: "Phone number must be between 10-15 digits",
  });

/**
 * Normalized phone number (optional)
 */
export const optionalPhoneSchema = z
  .string()
  .optional()
  .transform((val) => (val ? val.replace(/\D/g, "") : undefined))
  .refine((val) => !val || (val.length >= 10 && val.length <= 15), {
    message: "Phone number must be between 10-15 digits",
  });

/**
 * URL validation with optional protocol
 */
export const websiteUrlSchema = z
  .string()
  .transform((val) => {
    // Add https:// if no protocol specified
    if (val && !val.startsWith("http://") && !val.startsWith("https://")) {
      return `https://${val}`;
    }
    return val;
  })
  .pipe(z.string().url());

/**
 * Optional website URL
 */
export const optionalWebsiteUrlSchema = z
  .string()
  .optional()
  .transform((val) => {
    if (!val) return undefined;
    if (!val.startsWith("http://") && !val.startsWith("https://")) {
      return `https://${val}`;
    }
    return val;
  })
  .refine((val) => !val || z.string().url().safeParse(val).success, {
    message: "Invalid URL format",
  });

/**
 * Rating validation (0-5 scale)
 */
export const ratingSchema = z.number().min(0).max(5);

/**
 * Score validation (0-100 scale)
 */
export const scoreSchema = z.number().int().min(0).max(100);

/**
 * Percentage validation (0-100)
 */
export const percentageSchema = z.number().min(0).max(100);

/**
 * Positive integer
 */
export const positiveIntSchema = z.number().int().positive();

/**
 * Non-negative integer
 */
export const nonNegativeIntSchema = z.number().int().nonnegative();

/**
 * UUID validation
 */
export const uuidSchema = z.string().uuid();

/**
 * Email validation
 */
export const emailSchema = z.string().email();

/**
 * ISO datetime string
 */
export const datetimeSchema = z.string().datetime();

/**
 * Search criteria for lead discovery
 */
export const SearchCriteriaSchema = z.object({
  // Location-based search
  query: z.string().min(1).describe("Search query, e.g., 'dentists in Austin'"),
  location: z
    .object({
      city: z.string().optional(),
      state: z.string().optional(),
      country: z.string().default("US"),
      zipCode: z.string().optional(),
      coordinates: z
        .object({
          latitude: z.number().min(-90).max(90),
          longitude: z.number().min(-180).max(180),
        })
        .optional(),
    })
    .optional(),

  // Filtering criteria
  category: z.string().optional(),
  maxRating: ratingSchema.optional().describe("Filter businesses below this rating"),
  minReviewCount: nonNegativeIntSchema.optional(),
  radiusMiles: positiveIntSchema.default(25),

  // Pagination
  maxResults: positiveIntSchema.default(50),
  offset: nonNegativeIntSchema.default(0),
});

export type SearchCriteria = z.infer<typeof SearchCriteriaSchema>;

/**
 * Discovery session configuration
 */
export const DiscoverySessionSchema = z.object({
  id: uuidSchema,
  criteria: SearchCriteriaSchema,
  status: z.enum(["pending", "running", "completed", "failed", "cancelled"]),
  totalFound: nonNegativeIntSchema.default(0),
  totalProcessed: nonNegativeIntSchema.default(0),
  startedAt: datetimeSchema.optional(),
  completedAt: datetimeSchema.optional(),
  error: z.string().optional(),
});

export type DiscoverySession = z.infer<typeof DiscoverySessionSchema>;

/**
 * Audit session configuration
 */
export const AuditSessionSchema = z.object({
  id: uuidSchema,
  leadIds: z.array(uuidSchema),
  config: z.object({
    checkMobile: z.boolean().default(true),
    checkPerformance: z.boolean().default(true),
    checkAccessibility: z.boolean().default(true),
    captureScreenshots: z.boolean().default(true),
    captureVideo: z.boolean().default(false),
    concurrency: positiveIntSchema.default(5),
    timeoutMs: positiveIntSchema.default(30000),
  }),
  status: z.enum(["pending", "running", "completed", "failed", "cancelled"]),
  totalLeads: nonNegativeIntSchema,
  completedLeads: nonNegativeIntSchema.default(0),
  failedLeads: nonNegativeIntSchema.default(0),
  startedAt: datetimeSchema.optional(),
  completedAt: datetimeSchema.optional(),
});

export type AuditSession = z.infer<typeof AuditSessionSchema>;

/**
 * Email campaign submission
 */
export const CampaignSubmissionSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  leadFilters: z.object({
    status: z.array(z.string()).optional(),
    minPerformanceScore: scoreSchema.optional(),
    maxPerformanceScore: scoreSchema.optional(),
    categories: z.array(z.string()).optional(),
    minPainPoints: nonNegativeIntSchema.optional(),
  }),
  sequence: z
    .array(
      z.object({
        stepNumber: positiveIntSchema,
        delayDays: nonNegativeIntSchema,
        delayHours: nonNegativeIntSchema.default(0),
        templateId: uuidSchema,
        sendCondition: z
          .enum([
            "always",
            "no_reply",
            "no_open",
            "no_click",
            "replied",
            "opened",
            "clicked",
          ])
          .default("always"),
      })
    )
    .min(1)
    .refine(
      (steps) => {
        // Verify step numbers are sequential starting from 1
        const sortedSteps = [...steps].sort(
          (a, b) => a.stepNumber - b.stepNumber
        );
        return sortedSteps.every((step, idx) => step.stepNumber === idx + 1);
      },
      { message: "Step numbers must be sequential starting from 1" }
    ),
  dailySendLimit: positiveIntSchema.default(50),
  timezone: z.string().default("America/New_York"),
});

export type CampaignSubmission = z.infer<typeof CampaignSubmissionSchema>;
