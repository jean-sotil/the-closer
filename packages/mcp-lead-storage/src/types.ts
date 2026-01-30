import { z } from "zod";

import { ContactStatusSchema } from "@the-closer/shared";

/**
 * Lead query parameters
 */
export const LeadQuerySchema = z.object({
  status: ContactStatusSchema.optional(),
  minRating: z.number().min(0).max(5).optional(),
  maxRating: z.number().min(0).max(5).optional(),
  category: z.string().optional(),
  sourceQuery: z.string().optional(),
  limit: z.number().int().positive().default(50),
  offset: z.number().int().nonnegative().default(0),
  orderBy: z.enum(["discoveredAt", "rating", "performanceScore"]).optional(),
  orderDirection: z.enum(["asc", "desc"]).default("desc"),
});

export type LeadQuery = z.infer<typeof LeadQuerySchema>;

/**
 * Lead update input
 */
export const LeadUpdateInputSchema = z.object({
  id: z.string().uuid(),
  contactStatus: ContactStatusSchema.optional(),
  notes: z.string().optional(),
  nextFollowupAt: z.string().datetime().optional(),
});

export type LeadUpdateInput = z.infer<typeof LeadUpdateInputSchema>;
