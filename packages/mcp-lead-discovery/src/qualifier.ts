import { z } from "zod";

import type { DiscoveredBusiness } from "./types.js";

/**
 * Qualification rules schema with configurable thresholds
 */
export const QualificationRulesSchema = z.object({
  /** Minimum score required to qualify (default: 50) */
  minScore: z.number().int().min(0).max(100).default(50),

  /** Rating threshold - businesses below this get points (default: 4.0) */
  ratingThreshold: z.number().min(0).max(5).default(4.0),

  /** Review threshold - businesses below this get points (default: 20) */
  reviewThreshold: z.number().int().nonnegative().default(20),

  /** Points for low rating */
  lowRatingPoints: z.number().int().default(20),

  /** Points for low review count */
  lowReviewPoints: z.number().int().default(10),

  /** Points for non-HTTPS website */
  noHttpsPoints: z.number().int().default(15),

  /** Points for old website tech patterns */
  oldTechPoints: z.number().int().default(10),

  /** Base score for qualified prospects */
  baseScore: z.number().int().min(0).max(100).default(50),

  /** Require website to qualify */
  requireWebsite: z.boolean().default(true),

  /** Require phone to qualify */
  requirePhone: z.boolean().default(false),
});

export type QualificationRules = z.output<typeof QualificationRulesSchema>;

/**
 * Disqualification reason codes
 */
export type DisqualificationReason =
  | "no_website"
  | "no_phone"
  | "insufficient_score";

/**
 * Qualification reason codes
 */
export type QualificationReason =
  | "low_rating"
  | "low_reviews"
  | "no_https"
  | "old_tech"
  | "base_qualified";

/**
 * Detailed reason with description
 */
export interface QualificationReasonDetail {
  code: QualificationReason | DisqualificationReason;
  description: string;
  pointsAwarded: number;
}

/**
 * Result of prospect qualification
 */
export interface QualificationResult {
  /** Whether the prospect qualifies */
  qualified: boolean;

  /** Total score (0-100+) */
  score: number;

  /** Human-readable reasons for qualification/disqualification */
  reasons: QualificationReasonDetail[];

  /** The prospect's business data */
  business: DiscoveredBusiness;
}

/**
 * Batch qualification summary
 */
export interface BatchQualificationSummary {
  totalProcessed: number;
  qualifiedCount: number;
  disqualifiedCount: number;
  averageScore: number;
  reasonCounts: Record<string, number>;
}

/**
 * Old/outdated website technology patterns
 */
const OLD_TECH_PATTERNS: RegExp[] = [
  /\.htm$/i, // .htm instead of .html
  /frameset/i, // Framesets
  /geocities/i, // GeoCities remnants
  /tripod\./i, // Tripod hosting
  /angelfire/i, // Angelfire
  /\.asp$/i, // Classic ASP
  /\.cgi$/i, // CGI scripts
  /\?.*=.*&.*=.*&.*=/i, // Excessive query params (often old CMS)
  /\/~\w+\//i, // Tilde URLs (old Unix hosting)
  /index\d+\.html?$/i, // index1.html, index2.html patterns
  /\.php\?/i, // PHP with query params (often old)
  /wix\.com/i, // Wix (opportunity for custom)
  /weebly\.com/i, // Weebly
  /squarespace\.com/i, // Squarespace (can be outdated)
  /wordpress\.com/i, // Free WordPress.com (opportunity for self-hosted)
  /blogspot\.com/i, // Blogger
  /site123/i, // Site123
  /webnode/i, // Webnode
];

/**
 * ProspectQualifier - Scores and filters prospects based on technical debt indicators
 *
 * Uses a configurable rules engine to evaluate businesses for outreach potential.
 * Higher scores indicate better opportunities for web services.
 */
export class ProspectQualifier {
  private readonly rules: QualificationRules;

  /**
   * Create a new ProspectQualifier
   * @param rules - Custom qualification rules (uses defaults if not provided)
   */
  constructor(rules: Partial<QualificationRules> = {}) {
    this.rules = QualificationRulesSchema.parse(rules);
  }

  /**
   * Get the current qualification rules
   */
  getRules(): QualificationRules {
    return { ...this.rules };
  }

  /**
   * Qualify a single prospect
   * @param business - The business to evaluate
   * @returns Qualification result with score and reasons
   */
  qualifyProspect(business: DiscoveredBusiness): QualificationResult {
    const reasons: QualificationReasonDetail[] = [];
    let score = this.rules.baseScore;
    let disqualified = false;

    // Check website requirement
    if (this.rules.requireWebsite && !business.websiteUrl) {
      score = 0;
      disqualified = true;
      reasons.push({
        code: "no_website",
        description: "Business has no website - cannot audit",
        pointsAwarded: -this.rules.baseScore,
      });
    }

    // Check phone requirement
    if (this.rules.requirePhone && !business.phoneNumber && !disqualified) {
      score = 0;
      disqualified = true;
      reasons.push({
        code: "no_phone",
        description: "Business has no phone number",
        pointsAwarded: -this.rules.baseScore,
      });
    }

    // Only evaluate scoring rules if not disqualified
    if (!disqualified) {
      // Low rating = opportunity
      if (
        business.rating !== undefined &&
        business.rating < this.rules.ratingThreshold
      ) {
        score += this.rules.lowRatingPoints;
        reasons.push({
          code: "low_rating",
          description: `Rating ${business.rating.toFixed(1)} below ${this.rules.ratingThreshold} - may need website improvements`,
          pointsAwarded: this.rules.lowRatingPoints,
        });
      }

      // Low review count = less competition / newer business
      if (
        business.reviewCount !== undefined &&
        business.reviewCount < this.rules.reviewThreshold
      ) {
        score += this.rules.lowReviewPoints;
        reasons.push({
          code: "low_reviews",
          description: `Only ${business.reviewCount} reviews - may benefit from better web presence`,
          pointsAwarded: this.rules.lowReviewPoints,
        });
      }

      // Non-HTTPS website = security concern
      if (business.websiteUrl && !business.websiteUrl.startsWith("https://")) {
        score += this.rules.noHttpsPoints;
        reasons.push({
          code: "no_https",
          description: "Website not using HTTPS - security opportunity",
          pointsAwarded: this.rules.noHttpsPoints,
        });
      }

      // Old technology patterns in URL
      if (business.websiteUrl && this.hasOldTechPatterns(business.websiteUrl)) {
        score += this.rules.oldTechPoints;
        reasons.push({
          code: "old_tech",
          description: "URL patterns suggest outdated website technology",
          pointsAwarded: this.rules.oldTechPoints,
        });
      }

      // Add base qualification reason if qualified
      if (score >= this.rules.minScore && reasons.length === 0) {
        reasons.push({
          code: "base_qualified",
          description: "Meets minimum qualification criteria",
          pointsAwarded: 0,
        });
      }
    }

    // Check if score meets minimum
    const qualified = !disqualified && score >= this.rules.minScore;

    if (!qualified && !disqualified) {
      reasons.push({
        code: "insufficient_score",
        description: `Score ${score} below minimum ${this.rules.minScore}`,
        pointsAwarded: 0,
      });
    }

    return {
      qualified,
      score,
      reasons,
      business,
    };
  }

  /**
   * Check if URL has patterns indicating old/outdated technology
   */
  private hasOldTechPatterns(url: string): boolean {
    return OLD_TECH_PATTERNS.some((pattern) => pattern.test(url));
  }

  /**
   * Qualify a batch of prospects
   * @param businesses - Array of businesses to evaluate
   * @returns Array of qualification results
   */
  qualifyBatch(businesses: DiscoveredBusiness[]): QualificationResult[] {
    return businesses.map((business) => this.qualifyProspect(business));
  }

  /**
   * Filter to only qualified prospects
   * @param businesses - Array of businesses to filter
   * @returns Only the businesses that qualify
   */
  filterQualified(businesses: DiscoveredBusiness[]): DiscoveredBusiness[] {
    return businesses.filter(
      (business) => this.qualifyProspect(business).qualified
    );
  }

  /**
   * Filter to only disqualified prospects (for review/debugging)
   * @param businesses - Array of businesses to filter
   * @returns Only the businesses that don't qualify
   */
  filterDisqualified(businesses: DiscoveredBusiness[]): DiscoveredBusiness[] {
    return businesses.filter(
      (business) => !this.qualifyProspect(business).qualified
    );
  }

  /**
   * Get qualification results sorted by score (highest first)
   * @param businesses - Array of businesses to evaluate
   * @returns Sorted qualification results
   */
  sortByScore(businesses: DiscoveredBusiness[]): QualificationResult[] {
    return this.qualifyBatch(businesses).sort((a, b) => b.score - a.score);
  }

  /**
   * Get summary statistics for a batch qualification
   * @param results - Qualification results to summarize
   * @returns Summary statistics
   */
  summarizeBatch(results: QualificationResult[]): BatchQualificationSummary {
    const qualifiedResults = results.filter((r) => r.qualified);
    const reasonCounts: Record<string, number> = {};

    // Count all reasons
    for (const result of results) {
      for (const reason of result.reasons) {
        reasonCounts[reason.code] = (reasonCounts[reason.code] ?? 0) + 1;
      }
    }

    // Calculate average score (only for qualified)
    const averageScore =
      qualifiedResults.length > 0
        ? qualifiedResults.reduce((sum, r) => sum + r.score, 0) /
          qualifiedResults.length
        : 0;

    return {
      totalProcessed: results.length,
      qualifiedCount: qualifiedResults.length,
      disqualifiedCount: results.length - qualifiedResults.length,
      averageScore: Math.round(averageScore * 10) / 10,
      reasonCounts,
    };
  }

  /**
   * Create a qualifier with strict rules (requires website and phone)
   */
  static createStrict(): ProspectQualifier {
    return new ProspectQualifier({
      requireWebsite: true,
      requirePhone: true,
      minScore: 60,
    });
  }

  /**
   * Create a qualifier with lenient rules (only requires website)
   */
  static createLenient(): ProspectQualifier {
    return new ProspectQualifier({
      requireWebsite: true,
      requirePhone: false,
      minScore: 40,
    });
  }

  /**
   * Create a qualifier focused on finding problematic websites
   */
  static createOpportunityFinder(): ProspectQualifier {
    return new ProspectQualifier({
      requireWebsite: true,
      requirePhone: false,
      minScore: 50,
      ratingThreshold: 4.5, // Higher threshold = more opportunities
      reviewThreshold: 50,
      lowRatingPoints: 25,
      lowReviewPoints: 15,
      noHttpsPoints: 20,
      oldTechPoints: 15,
    });
  }
}

/**
 * Default qualification rules (convenience export)
 */
export const DEFAULT_QUALIFICATION_RULES: QualificationRules =
  QualificationRulesSchema.parse({});
