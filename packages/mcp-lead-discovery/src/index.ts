#!/usr/bin/env node

/**
 * MCP Lead Discovery Server
 *
 * Scrapes Google Maps to discover local businesses
 * using network interception for stealth data extraction.
 */

export { LeadDiscoveryServer } from "./server.js";
export { MapsScraper } from "./maps-scraper.js";

// Types
export type {
  DiscoveryQuery,
  DiscoveredBusiness,
  SearchCriteria,
  RawBusinessEntity,
  MapsScraperConfig,
  StealthConfig,
  ScraperResult,
} from "./types.js";

export {
  DiscoveryQuerySchema,
  DiscoveredBusinessSchema,
  SearchCriteriaSchema,
  RawBusinessEntitySchema,
  MapsScraperConfigSchema,
  StealthConfigSchema,
} from "./types.js";
