import { z } from "zod";

/**
 * Query parameters for lead discovery
 */
export const DiscoveryQuerySchema = z.object({
  query: z.string().min(1).describe("Search query, e.g., 'dentists in Austin'"),
  maxResults: z.number().int().positive().default(50),
  filterRating: z
    .number()
    .min(0)
    .max(5)
    .optional()
    .describe("Only include businesses below this rating"),
});

export type DiscoveryQuery = z.infer<typeof DiscoveryQuerySchema>;

/**
 * Business discovered from Google Maps
 */
export const DiscoveredBusinessSchema = z.object({
  businessName: z.string(),
  address: z.string().optional(),
  phoneNumber: z.string().optional(),
  websiteUrl: z.string().url().optional(),
  rating: z.number().min(0).max(5).optional(),
  reviewCount: z.number().int().nonnegative().optional(),
  businessCategory: z.string().optional(),
  placeId: z.string().optional(),
  latitude: z.number().optional(),
  longitude: z.number().optional(),
});

export type DiscoveredBusiness = z.infer<typeof DiscoveredBusinessSchema>;
