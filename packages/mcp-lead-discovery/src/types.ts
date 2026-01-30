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

export type DiscoveryQuery = z.output<typeof DiscoveryQuerySchema>;

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

export type DiscoveredBusiness = z.output<typeof DiscoveredBusinessSchema>;

/**
 * Search criteria for Maps scraper
 */
export const SearchCriteriaSchema = z.object({
  query: z.string().min(1).describe("Search query, e.g., 'dentists'"),
  location: z.string().min(1).describe("Location, e.g., 'Austin, TX'"),
  radius: z.number().int().positive().optional().describe("Search radius in miles"),
  category: z.string().optional().describe("Business category filter"),
});

export type SearchCriteria = z.output<typeof SearchCriteriaSchema>;

/**
 * Raw business entity from Google Maps network response
 */
export const RawBusinessEntitySchema = z.object({
  name: z.string(),
  address: z.string(),
  phone: z.string().nullable(),
  website: z.string().nullable(),
  rating: z.number().nullable(),
  reviewCount: z.number(),
  placeId: z.string(),
  latitude: z.number().optional(),
  longitude: z.number().optional(),
  categories: z.array(z.string()).default([]),
});

export type RawBusinessEntity = z.output<typeof RawBusinessEntitySchema>;

/**
 * Maps scraper configuration
 */
export const MapsScraperConfigSchema = z.object({
  delayBetweenScrolls: z.number().int().positive().default(2000),
  delayBetweenSearches: z.number().int().positive().default(5000),
  maxScrollAttempts: z.number().int().positive().default(20),
  scrollTimeout: z.number().int().positive().default(10000),
  maxResults: z.number().int().positive().default(100),
});

export type MapsScraperConfig = z.output<typeof MapsScraperConfigSchema>;

/**
 * Stealth configuration for anti-detection
 */
export const StealthConfigSchema = z.object({
  userAgents: z.array(z.string()).default([
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.1 Safari/605.1.15",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0",
  ]),
  minDelay: z.number().int().nonnegative().default(500),
  maxDelay: z.number().int().positive().default(1500),
  scrollVariance: z.number().min(0).max(1).default(0.2),
});

export type StealthConfig = z.output<typeof StealthConfigSchema>;

/**
 * Scraper result with statistics
 */
export interface ScraperResult {
  businesses: RawBusinessEntity[];
  totalFound: number;
  searchDurationMs: number;
  scrollAttempts: number;
  errors: string[];
}
