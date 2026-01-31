import type { Page } from "puppeteer";

import type { LeadProfile } from "@the-closer/shared";

import { MapsScraper } from "./maps-scraper.js";
import { DataExtractor } from "./data-extractor.js";
import { ProspectQualifier } from "./qualifier.js";
import type {
  SearchCriteria,
  DiscoveredBusiness,
  RawBusinessEntity,
} from "./types.js";

/**
 * Lead repository interface (to avoid circular dependency)
 */
export interface ILeadRepository {
  findDuplicateByWebsite(url: string): Promise<LeadProfile | null>;
  saveLeadsBatch(leads: LeadInput[]): Promise<LeadProfile[]>;
}

/**
 * Lead input type for saving
 */
export type LeadInput = Omit<LeadProfile, "id" | "discoveredAt" | "updatedAt">;

/**
 * Discovery service configuration
 */
export interface DiscoveryServiceConfig {
  /** Maximum leads to discover per search */
  maxLeadsPerSearch: number;

  /** Enable duplicate detection by website URL */
  deduplicateByWebsite: boolean;

  /** Stop on first error vs continue with partial results */
  stopOnError: boolean;

  /** Minimum qualification score to save */
  minQualificationScore: number;
}

/**
 * Default configuration
 */
const DEFAULT_CONFIG: DiscoveryServiceConfig = {
  maxLeadsPerSearch: 100,
  deduplicateByWebsite: true,
  stopOnError: false,
  minQualificationScore: 50,
};

/**
 * Discovery pipeline stages
 */
export type DiscoveryStage =
  | "scraping"
  | "extracting"
  | "qualifying"
  | "deduplicating"
  | "saving"
  | "complete"
  | "error";

/**
 * Progress status for callbacks
 */
export interface ProgressStatus {
  stage: DiscoveryStage;
  message: string;
  current: number;
  total: number;
  percentage: number;
}

/**
 * Discovery result with statistics
 */
export interface DiscoveryResult {
  /** Total businesses found from scraper */
  found: number;

  /** Businesses that passed extraction */
  extracted: number;

  /** Businesses that passed qualification */
  qualified: number;

  /** Businesses saved to database */
  saved: number;

  /** Duplicate businesses skipped */
  duplicates: number;

  /** Errors encountered during discovery */
  errors: DiscoveryError[];

  /** Duration of discovery in milliseconds */
  durationMs: number;

  /** The saved lead profiles */
  leads: LeadProfile[];
}

/**
 * Discovery error details
 */
export interface DiscoveryError {
  stage: DiscoveryStage;
  message: string;
  businessName?: string;
  details?: unknown;
}

/**
 * Progress callback type
 */
export type ProgressCallback = (status: ProgressStatus) => void;

/**
 * LeadDiscoveryService - Orchestrates the full discovery pipeline
 *
 * Wires together scraping, extraction, qualification, deduplication,
 * and persistence into a single discoverable flow with error handling
 * and progress reporting.
 */
export class LeadDiscoveryService {
  private readonly scraper: MapsScraper;
  private readonly extractor: typeof DataExtractor;
  private readonly qualifier: ProspectQualifier;
  private readonly repository: ILeadRepository | null;
  private readonly config: DiscoveryServiceConfig;

  constructor(
    scraper: MapsScraper,
    qualifier: ProspectQualifier,
    repository: ILeadRepository | null = null,
    config: Partial<DiscoveryServiceConfig> = {}
  ) {
    this.scraper = scraper;
    this.extractor = DataExtractor;
    this.qualifier = qualifier;
    this.repository = repository;
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Discover leads from Google Maps and persist to database
   */
  async discoverLeads(
    page: Page,
    criteria: SearchCriteria,
    onProgress?: ProgressCallback
  ): Promise<DiscoveryResult> {
    const startTime = Date.now();
    const errors: DiscoveryError[] = [];
    let found = 0;
    let extracted = 0;
    let qualified = 0;
    let saved = 0;
    let duplicates = 0;
    const savedLeads: LeadProfile[] = [];

    try {
      // Stage 1: Scrape businesses from Google Maps
      this.reportProgress(onProgress, "scraping", "Scraping Google Maps...", 0, 4);

      let rawBusinesses: RawBusinessEntity[] = [];
      try {
        const scraperResult = await this.scraper.searchBusinesses(page, criteria);
        rawBusinesses = scraperResult.businesses.slice(0, this.config.maxLeadsPerSearch);
        found = rawBusinesses.length;

        if (scraperResult.errors.length > 0) {
          for (const err of scraperResult.errors) {
            errors.push({ stage: "scraping", message: err });
          }
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        errors.push({ stage: "scraping", message, details: error });

        if (this.config.stopOnError) {
          throw error;
        }
      }

      if (found === 0) {
        this.reportProgress(onProgress, "complete", "No businesses found", 4, 4);
        return this.buildResult(found, extracted, qualified, saved, duplicates, errors, startTime, savedLeads);
      }

      // Stage 2: Extract and normalize business data
      this.reportProgress(onProgress, "extracting", `Extracting ${found} businesses...`, 1, 4);

      let discoveredBusinesses: DiscoveredBusiness[] = [];
      try {
        const extractionResult = this.extractor.extractBatch(rawBusinesses);
        discoveredBusinesses = extractionResult.successful;
        extracted = discoveredBusinesses.length;

        // Log extraction failures
        for (const failure of extractionResult.failed) {
          errors.push({
            stage: "extracting",
            message: failure.errors.join("; "),
            businessName: failure.raw.name,
          });
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        errors.push({ stage: "extracting", message, details: error });

        if (this.config.stopOnError) {
          throw error;
        }
      }

      if (extracted === 0) {
        this.reportProgress(onProgress, "complete", "No valid businesses extracted", 4, 4);
        return this.buildResult(found, extracted, qualified, saved, duplicates, errors, startTime, savedLeads);
      }

      // Stage 3: Qualify prospects
      this.reportProgress(onProgress, "qualifying", `Qualifying ${extracted} prospects...`, 2, 4);

      let qualifiedBusinesses: DiscoveredBusiness[] = [];
      try {
        qualifiedBusinesses = this.qualifier.filterQualified(discoveredBusinesses);
        qualified = qualifiedBusinesses.length;
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        errors.push({ stage: "qualifying", message, details: error });

        if (this.config.stopOnError) {
          throw error;
        }
        // Fall back to all extracted if qualification fails
        qualifiedBusinesses = discoveredBusinesses;
        qualified = qualifiedBusinesses.length;
      }

      if (qualified === 0) {
        this.reportProgress(onProgress, "complete", "No businesses qualified", 4, 4);
        return this.buildResult(found, extracted, qualified, saved, duplicates, errors, startTime, savedLeads);
      }

      // Stage 4: Deduplicate and save
      if (this.repository) {
        this.reportProgress(onProgress, "deduplicating", `Checking ${qualified} for duplicates...`, 3, 4);

        const leadsToSave: LeadInput[] = [];

        for (const business of qualifiedBusinesses) {
          try {
            // Check for duplicates
            if (this.config.deduplicateByWebsite && business.websiteUrl) {
              const existing = await this.repository.findDuplicateByWebsite(business.websiteUrl);
              if (existing) {
                duplicates++;
                continue;
              }
            }

            // Convert to lead input
            leadsToSave.push(this.businessToLeadInput(business, criteria));
          } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            errors.push({
              stage: "deduplicating",
              message,
              businessName: business.businessName,
            });
          }
        }

        // Save leads
        this.reportProgress(onProgress, "saving", `Saving ${leadsToSave.length} leads...`, 3, 4);

        if (leadsToSave.length > 0) {
          try {
            const savedResults = await this.repository.saveLeadsBatch(leadsToSave);
            saved = savedResults.length;
            savedLeads.push(...savedResults);
          } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            errors.push({ stage: "saving", message, details: error });

            if (this.config.stopOnError) {
              throw error;
            }
          }
        }
      } else {
        // No repository - just count qualified as "saved"
        saved = qualified;
      }

      this.reportProgress(onProgress, "complete", `Discovery complete: ${saved} leads saved`, 4, 4);

    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      errors.push({ stage: "error", message, details: error });
      this.reportProgress(onProgress, "error", message, 0, 4);
    }

    return this.buildResult(found, extracted, qualified, saved, duplicates, errors, startTime, savedLeads);
  }

  /**
   * Discover leads without a browser page (for testing)
   */
  async discoverFromRaw(
    rawBusinesses: RawBusinessEntity[],
    sourceQuery: string,
    onProgress?: ProgressCallback
  ): Promise<DiscoveryResult> {
    const startTime = Date.now();
    const errors: DiscoveryError[] = [];
    const found = rawBusinesses.length;
    let extracted = 0;
    let qualified = 0;
    let saved = 0;
    let duplicates = 0;
    const savedLeads: LeadProfile[] = [];

    // Extract
    this.reportProgress(onProgress, "extracting", `Extracting ${found} businesses...`, 1, 4);
    const extractionResult = this.extractor.extractBatch(rawBusinesses);
    const discoveredBusinesses = extractionResult.successful;
    extracted = discoveredBusinesses.length;

    // Qualify
    this.reportProgress(onProgress, "qualifying", `Qualifying ${extracted} prospects...`, 2, 4);
    const qualifiedBusinesses = this.qualifier.filterQualified(discoveredBusinesses);
    qualified = qualifiedBusinesses.length;

    // Deduplicate and save
    if (this.repository && qualified > 0) {
      this.reportProgress(onProgress, "deduplicating", `Checking duplicates...`, 3, 4);

      const leadsToSave: LeadInput[] = [];
      for (const business of qualifiedBusinesses) {
        if (this.config.deduplicateByWebsite && business.websiteUrl) {
          const existing = await this.repository.findDuplicateByWebsite(business.websiteUrl);
          if (existing) {
            duplicates++;
            continue;
          }
        }
        leadsToSave.push(this.businessToLeadInput(business, { query: sourceQuery, location: "" }));
      }

      if (leadsToSave.length > 0) {
        this.reportProgress(onProgress, "saving", `Saving ${leadsToSave.length} leads...`, 3, 4);
        const savedResults = await this.repository.saveLeadsBatch(leadsToSave);
        saved = savedResults.length;
        savedLeads.push(...savedResults);
      }
    } else {
      saved = qualified;
    }

    this.reportProgress(onProgress, "complete", `Complete: ${saved} leads`, 4, 4);

    return this.buildResult(found, extracted, qualified, saved, duplicates, errors, startTime, savedLeads);
  }

  /**
   * Convert discovered business to lead input
   */
  private businessToLeadInput(
    business: DiscoveredBusiness,
    criteria: SearchCriteria
  ): LeadInput {
    return {
      businessName: business.businessName,
      address: business.address,
      phoneNumber: business.phoneNumber,
      websiteUrl: business.websiteUrl,
      rating: business.rating,
      reviewCount: business.reviewCount,
      businessCategory: business.businessCategory,
      painPoints: [],
      evidenceUrls: [],
      contactStatus: "pending",
      sourceQuery: `${criteria.query} ${criteria.location}`.trim(),
    };
  }

  /**
   * Report progress to callback
   */
  private reportProgress(
    callback: ProgressCallback | undefined,
    stage: DiscoveryStage,
    message: string,
    current: number,
    total: number
  ): void {
    if (callback) {
      callback({
        stage,
        message,
        current,
        total,
        percentage: Math.round((current / total) * 100),
      });
    }
  }

  /**
   * Build the discovery result
   */
  private buildResult(
    found: number,
    extracted: number,
    qualified: number,
    saved: number,
    duplicates: number,
    errors: DiscoveryError[],
    startTime: number,
    leads: LeadProfile[]
  ): DiscoveryResult {
    return {
      found,
      extracted,
      qualified,
      saved,
      duplicates,
      errors,
      durationMs: Date.now() - startTime,
      leads,
    };
  }

  /**
   * Get current configuration
   */
  getConfig(): DiscoveryServiceConfig {
    return { ...this.config };
  }
}

/**
 * Create a lead discovery service with default configuration
 */
export function createLeadDiscoveryService(
  scraper: MapsScraper,
  qualifier: ProspectQualifier,
  repository?: ILeadRepository,
  config?: Partial<DiscoveryServiceConfig>
): LeadDiscoveryService {
  return new LeadDiscoveryService(scraper, qualifier, repository ?? null, config);
}
