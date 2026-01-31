import {
  type RawBusinessEntity,
  type DiscoveredBusiness,
  DiscoveredBusinessSchema,
} from "./types.js";

/**
 * Validation result for a business profile
 */
export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
}

/**
 * Validation error details
 */
export interface ValidationError {
  field: string;
  message: string;
  value: unknown;
}

/**
 * Validation warning details
 */
export interface ValidationWarning {
  field: string;
  message: string;
  value: unknown;
}

/**
 * Batch extraction result
 */
export interface BatchExtractionResult {
  successful: DiscoveredBusiness[];
  failed: FailedExtraction[];
  totalProcessed: number;
  successCount: number;
  failureCount: number;
}

/**
 * Failed extraction details
 */
export interface FailedExtraction {
  raw: RawBusinessEntity;
  errors: string[];
}

/**
 * Extraction options
 */
export interface ExtractionOptions {
  /** Skip businesses without phone numbers */
  requirePhone?: boolean;
  /** Skip businesses without websites */
  requireWebsite?: boolean;
  /** Minimum rating threshold (skip below this) */
  minRating?: number;
  /** Maximum rating threshold (skip above this) */
  maxRating?: number;
  /** Primary category to filter by (first matching category) */
  primaryCategory?: string;
}

/**
 * US state abbreviations for address normalization
 */
const US_STATES: Record<string, string> = {
  alabama: "AL",
  alaska: "AK",
  arizona: "AZ",
  arkansas: "AR",
  california: "CA",
  colorado: "CO",
  connecticut: "CT",
  delaware: "DE",
  florida: "FL",
  georgia: "GA",
  hawaii: "HI",
  idaho: "ID",
  illinois: "IL",
  indiana: "IN",
  iowa: "IA",
  kansas: "KS",
  kentucky: "KY",
  louisiana: "LA",
  maine: "ME",
  maryland: "MD",
  massachusetts: "MA",
  michigan: "MI",
  minnesota: "MN",
  mississippi: "MS",
  missouri: "MO",
  montana: "MT",
  nebraska: "NE",
  nevada: "NV",
  "new hampshire": "NH",
  "new jersey": "NJ",
  "new mexico": "NM",
  "new york": "NY",
  "north carolina": "NC",
  "north dakota": "ND",
  ohio: "OH",
  oklahoma: "OK",
  oregon: "OR",
  pennsylvania: "PA",
  "rhode island": "RI",
  "south carolina": "SC",
  "south dakota": "SD",
  tennessee: "TN",
  texas: "TX",
  utah: "UT",
  vermont: "VT",
  virginia: "VA",
  washington: "WA",
  "west virginia": "WV",
  wisconsin: "WI",
  wyoming: "WY",
  "district of columbia": "DC",
};

/**
 * Common address abbreviations
 */
const ADDRESS_ABBREVIATIONS: Record<string, string> = {
  street: "St",
  avenue: "Ave",
  boulevard: "Blvd",
  drive: "Dr",
  road: "Rd",
  lane: "Ln",
  court: "Ct",
  place: "Pl",
  circle: "Cir",
  highway: "Hwy",
  parkway: "Pkwy",
  suite: "Ste",
  apartment: "Apt",
  building: "Bldg",
  floor: "Fl",
  north: "N",
  south: "S",
  east: "E",
  west: "W",
  northeast: "NE",
  northwest: "NW",
  southeast: "SE",
  southwest: "SW",
};

/**
 * DataExtractor - Parse and normalize business data from raw Maps responses
 *
 * Transforms raw scraped data into structured, validated business profiles
 * with normalized phone numbers, addresses, and URLs.
 */
export class DataExtractor {
  /**
   * Extract and normalize business data from raw Maps entity
   */
  static extractBusinessData(
    raw: RawBusinessEntity,
    options: ExtractionOptions = {}
  ): DiscoveredBusiness {
    const normalized: DiscoveredBusiness = {
      businessName: DataExtractor.normalizeBusinessName(raw.name),
      address: DataExtractor.normalizeAddress(raw.address),
      phoneNumber: raw.phone
        ? DataExtractor.normalizePhoneNumber(raw.phone)
        : undefined,
      websiteUrl: raw.website
        ? DataExtractor.normalizeWebsiteUrl(raw.website)
        : undefined,
      rating: raw.rating ?? undefined,
      reviewCount: raw.reviewCount,
      businessCategory: raw.categories[0] ?? undefined,
      placeId: raw.placeId,
      latitude: raw.latitude,
      longitude: raw.longitude,
    };

    // Apply filters based on options
    if (options.requirePhone && !normalized.phoneNumber) {
      throw new Error("Business has no phone number");
    }
    if (options.requireWebsite && !normalized.websiteUrl) {
      throw new Error("Business has no website");
    }
    if (
      options.minRating !== undefined &&
      normalized.rating !== undefined &&
      normalized.rating < options.minRating
    ) {
      throw new Error(
        `Rating ${normalized.rating} below minimum ${options.minRating}`
      );
    }
    if (
      options.maxRating !== undefined &&
      normalized.rating !== undefined &&
      normalized.rating > options.maxRating
    ) {
      throw new Error(
        `Rating ${normalized.rating} above maximum ${options.maxRating}`
      );
    }

    return normalized;
  }

  /**
   * Normalize business name
   * - Trim whitespace
   * - Normalize unicode
   * - Remove excessive punctuation
   */
  static normalizeBusinessName(name: string): string {
    let normalized = name.trim();

    // Normalize unicode (NFC form)
    normalized = normalized.normalize("NFC");

    // Remove excessive whitespace
    normalized = normalized.replace(/\s+/g, " ");

    // Remove leading/trailing punctuation that's not part of the name
    normalized = normalized.replace(/^[,.\-–—]+\s*/, "");
    normalized = normalized.replace(/\s*[,.\-–—]+$/, "");

    return normalized;
  }

  /**
   * Normalize phone number to consistent format
   * - Handles US phone numbers
   * - Returns format: (XXX) XXX-XXXX or +1 (XXX) XXX-XXXX
   * - Returns null for invalid/foreign numbers
   */
  static normalizePhoneNumber(phone: string): string | undefined {
    // Remove all non-numeric characters except +
    let digits = phone.replace(/[^\d+]/g, "");

    // Handle country codes
    if (digits.startsWith("+1")) {
      digits = digits.slice(2);
    } else if (digits.startsWith("1") && digits.length === 11) {
      digits = digits.slice(1);
    } else if (digits.startsWith("+")) {
      // Non-US international number, return cleaned version
      return phone.replace(/\s+/g, " ").trim();
    }

    // Must be 10 digits for US number
    if (digits.length !== 10) {
      // Try to extract 10 digits if there's extra
      const match = digits.match(/(\d{10})/);
      if (match) {
        digits = match[1]!;
      } else {
        return undefined;
      }
    }

    // Validate area code (first digit can't be 0 or 1)
    if (digits[0] === "0" || digits[0] === "1") {
      return undefined;
    }

    // Format as (XXX) XXX-XXXX
    const areaCode = digits.slice(0, 3);
    const exchange = digits.slice(3, 6);
    const subscriber = digits.slice(6, 10);

    return `(${areaCode}) ${exchange}-${subscriber}`;
  }

  /**
   * Normalize address to consistent format
   * - Standardize abbreviations
   * - Normalize state names to abbreviations
   * - Clean up whitespace and punctuation
   */
  static normalizeAddress(address: string): string {
    let normalized = address.trim();

    // Normalize unicode
    normalized = normalized.normalize("NFC");

    // Remove excessive whitespace
    normalized = normalized.replace(/\s+/g, " ");

    // Standardize state names to abbreviations
    for (const [stateName, abbr] of Object.entries(US_STATES)) {
      const regex = new RegExp(`\\b${stateName}\\b`, "gi");
      normalized = normalized.replace(regex, abbr);
    }

    // Standardize common abbreviations (case-insensitive, word boundaries)
    for (const [full, abbr] of Object.entries(ADDRESS_ABBREVIATIONS)) {
      // Match full word, optionally followed by period
      const regex = new RegExp(`\\b${full}\\.?\\b`, "gi");
      normalized = normalized.replace(regex, abbr);
    }

    // Clean up duplicate spaces after replacements
    normalized = normalized.replace(/\s+/g, " ");

    // Normalize comma spacing: "City , State" -> "City, State"
    normalized = normalized.replace(/\s*,\s*/g, ", ");

    // Remove trailing comma
    normalized = normalized.replace(/,\s*$/, "");

    return normalized;
  }

  /**
   * Normalize website URL
   * - Add protocol if missing
   * - Lowercase domain
   * - Remove trailing slashes
   * - Remove tracking parameters
   */
  static normalizeWebsiteUrl(url: string): string | undefined {
    let normalized = url.trim();

    // Add protocol if missing
    if (!normalized.match(/^https?:\/\//i)) {
      normalized = `https://${normalized}`;
    }

    try {
      const parsed = new URL(normalized);

      // Lowercase hostname
      parsed.hostname = parsed.hostname.toLowerCase();

      // Remove common tracking parameters
      const trackingParams = [
        "utm_source",
        "utm_medium",
        "utm_campaign",
        "utm_term",
        "utm_content",
        "fbclid",
        "gclid",
        "ref",
        "source",
      ];

      for (const param of trackingParams) {
        parsed.searchParams.delete(param);
      }

      // Reconstruct URL
      let result = parsed.toString();

      // Remove trailing slash if it's just the root
      if (result.match(/^https?:\/\/[^\/]+\/$/)) {
        result = result.slice(0, -1);
      }

      return result;
    } catch {
      // Invalid URL
      return undefined;
    }
  }

  /**
   * Validate a business profile against the schema
   */
  static validateBusinessProfile(
    business: DiscoveredBusiness
  ): ValidationResult {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];

    // Validate against Zod schema
    const result = DiscoveredBusinessSchema.safeParse(business);

    if (!result.success) {
      for (const issue of result.error.issues) {
        errors.push({
          field: issue.path.join("."),
          message: issue.message,
          value: issue.path.reduce(
            (obj: unknown, key) =>
              obj && typeof obj === "object"
                ? (obj as Record<string, unknown>)[String(key)]
                : undefined,
            business as unknown
          ),
        });
      }
    }

    // Additional validation checks
    if (!business.businessName || business.businessName.length < 2) {
      errors.push({
        field: "businessName",
        message: "Business name must be at least 2 characters",
        value: business.businessName,
      });
    }

    // Warnings for potential data quality issues
    if (!business.phoneNumber) {
      warnings.push({
        field: "phoneNumber",
        message: "No phone number available",
        value: undefined,
      });
    }

    if (!business.websiteUrl) {
      warnings.push({
        field: "websiteUrl",
        message: "No website available",
        value: undefined,
      });
    }

    if (business.rating !== undefined && business.rating < 3.0) {
      warnings.push({
        field: "rating",
        message: "Low rating may indicate opportunity or problematic business",
        value: business.rating,
      });
    }

    if (business.reviewCount !== undefined && business.reviewCount < 5) {
      warnings.push({
        field: "reviewCount",
        message: "Low review count - business may be new or inactive",
        value: business.reviewCount,
      });
    }

    // Check for suspicious patterns
    if (
      business.businessName &&
      business.businessName.match(/test|demo|example/i)
    ) {
      warnings.push({
        field: "businessName",
        message: "Business name contains test/demo patterns",
        value: business.businessName,
      });
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    };
  }

  /**
   * Extract and validate a batch of businesses
   * Handles errors gracefully, collecting successful and failed extractions
   */
  static extractBatch(
    rawEntities: RawBusinessEntity[],
    options: ExtractionOptions = {}
  ): BatchExtractionResult {
    const successful: DiscoveredBusiness[] = [];
    const failed: FailedExtraction[] = [];

    for (const raw of rawEntities) {
      try {
        const extracted = DataExtractor.extractBusinessData(raw, options);
        const validation = DataExtractor.validateBusinessProfile(extracted);

        if (validation.valid) {
          successful.push(extracted);
        } else {
          failed.push({
            raw,
            errors: validation.errors.map(
              (e) => `${e.field}: ${e.message}`
            ),
          });
        }
      } catch (error) {
        failed.push({
          raw,
          errors: [error instanceof Error ? error.message : String(error)],
        });
      }
    }

    return {
      successful,
      failed,
      totalProcessed: rawEntities.length,
      successCount: successful.length,
      failureCount: failed.length,
    };
  }

  /**
   * Deduplicate businesses by various criteria
   */
  static deduplicateBusinesses(
    businesses: DiscoveredBusiness[]
  ): DiscoveredBusiness[] {
    const seen = new Map<string, DiscoveredBusiness>();

    for (const business of businesses) {
      // Create composite key from multiple fields for better deduplication
      const keys = [
        // Primary: placeId
        business.placeId,
        // Secondary: normalized name + address
        business.address
          ? `${business.businessName.toLowerCase()}-${business.address.toLowerCase()}`
          : null,
        // Tertiary: phone number
        business.phoneNumber,
      ].filter(Boolean) as string[];

      // Check if any key already exists
      let isDuplicate = false;
      for (const key of keys) {
        if (seen.has(key)) {
          isDuplicate = true;
          break;
        }
      }

      if (!isDuplicate) {
        // Add all keys for this business
        for (const key of keys) {
          seen.set(key, business);
        }
      }
    }

    // Return unique businesses
    const uniqueSet = new Set(seen.values());
    return Array.from(uniqueSet);
  }

  /**
   * Enrich business data with derived fields
   */
  static enrichBusinessData(business: DiscoveredBusiness): DiscoveredBusiness {
    const enriched = { ...business };

    // Validate website URL is parseable
    if (enriched.websiteUrl) {
      try {
        new URL(enriched.websiteUrl);
        // URL is valid, could extract domain if needed in future
      } catch {
        // Invalid URL, clear it
        enriched.websiteUrl = undefined;
      }
    }

    // Normalize category for consistency
    if (enriched.businessCategory) {
      enriched.businessCategory = DataExtractor.normalizeCategory(
        enriched.businessCategory
      );
    }

    return enriched;
  }

  /**
   * Normalize category string
   */
  private static normalizeCategory(category: string): string {
    // Convert from Google Maps format (e.g., "restaurant" -> "Restaurant")
    return category
      .split(/[\s_-]+/)
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(" ");
  }

  /**
   * Filter businesses by various criteria
   */
  static filterBusinesses(
    businesses: DiscoveredBusiness[],
    filters: {
      minRating?: number;
      maxRating?: number;
      hasPhone?: boolean;
      hasWebsite?: boolean;
      categories?: string[];
    }
  ): DiscoveredBusiness[] {
    return businesses.filter((business) => {
      // Rating filters
      if (
        filters.minRating !== undefined &&
        (business.rating === undefined || business.rating < filters.minRating)
      ) {
        return false;
      }
      if (
        filters.maxRating !== undefined &&
        business.rating !== undefined &&
        business.rating > filters.maxRating
      ) {
        return false;
      }

      // Contact info filters
      if (filters.hasPhone && !business.phoneNumber) {
        return false;
      }
      if (filters.hasWebsite && !business.websiteUrl) {
        return false;
      }

      // Category filter
      if (filters.categories && filters.categories.length > 0) {
        if (!business.businessCategory) {
          return false;
        }
        const normalizedCategory = business.businessCategory.toLowerCase();
        const matches = filters.categories.some((cat) =>
          normalizedCategory.includes(cat.toLowerCase())
        );
        if (!matches) {
          return false;
        }
      }

      return true;
    });
  }

  /**
   * Sort businesses by quality score
   * Higher score = better lead quality
   */
  static sortByQuality(businesses: DiscoveredBusiness[]): DiscoveredBusiness[] {
    return [...businesses].sort((a, b) => {
      const scoreA = DataExtractor.calculateQualityScore(a);
      const scoreB = DataExtractor.calculateQualityScore(b);
      return scoreB - scoreA; // Descending
    });
  }

  /**
   * Calculate quality score for a business (0-100)
   */
  static calculateQualityScore(business: DiscoveredBusiness): number {
    let score = 50; // Base score

    // Has website (+20)
    if (business.websiteUrl) {
      score += 20;
    }

    // Has phone (+10)
    if (business.phoneNumber) {
      score += 10;
    }

    // Rating factor (-20 to +10)
    if (business.rating !== undefined) {
      // Lower ratings = higher opportunity (bad website likely)
      // Very low ratings might be bad businesses though
      if (business.rating >= 4.0) {
        score -= 5; // Good rating, less likely to need help
      } else if (business.rating >= 3.0) {
        score += 5; // Moderate rating, might need help
      } else if (business.rating >= 2.0) {
        score += 10; // Low rating, likely opportunity
      } else {
        score -= 10; // Very low, might be problematic
      }
    }

    // Review count factor
    if (business.reviewCount !== undefined) {
      if (business.reviewCount >= 100) {
        score += 5; // Established business
      } else if (business.reviewCount >= 20) {
        score += 3; // Active business
      } else if (business.reviewCount < 5) {
        score -= 5; // Might be inactive
      }
    }

    // Has location data (+5)
    if (business.latitude !== undefined && business.longitude !== undefined) {
      score += 5;
    }

    // Has category (+5)
    if (business.businessCategory) {
      score += 5;
    }

    return Math.max(0, Math.min(100, score));
  }
}
