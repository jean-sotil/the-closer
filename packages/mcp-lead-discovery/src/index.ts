#!/usr/bin/env node

/**
 * MCP Lead Discovery Server
 *
 * Scrapes Google Maps to discover local businesses
 * using network interception for stealth data extraction.
 */

export { LeadDiscoveryServer } from "./server.js";
export { MapsScraper } from "./maps-scraper.js";
export { ResilientMapsScraper, RateLimitError } from "./resilient-scraper.js";
export { DataExtractor } from "./data-extractor.js";
export {
  ProspectQualifier,
  DEFAULT_QUALIFICATION_RULES,
} from "./qualifier.js";
export {
  LeadDiscoveryService,
  createLeadDiscoveryService,
} from "./discovery-service.js";

// Discovery service types
export type {
  ILeadRepository,
  LeadInput,
  DiscoveryServiceConfig,
  DiscoveryStage,
  ProgressStatus,
  DiscoveryResult,
  DiscoveryError,
  ProgressCallback,
} from "./discovery-service.js";

// Qualifier types
export type {
  QualificationRules,
  QualificationResult,
  QualificationReasonDetail,
  QualificationReason,
  DisqualificationReason,
  BatchQualificationSummary,
} from "./qualifier.js";

export { QualificationRulesSchema } from "./qualifier.js";

// Data extractor types
export type {
  ValidationResult,
  ValidationError,
  ValidationWarning,
  BatchExtractionResult,
  FailedExtraction,
  ExtractionOptions,
} from "./data-extractor.js";

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

// Resilient scraper types
export type {
  ResilientScraperConfig,
  BatchSearchResult,
} from "./resilient-scraper.js";
