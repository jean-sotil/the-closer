import { z } from "zod";

import type { ContactStatus } from "@the-closer/shared";

import { SupabaseClient } from "./supabase/client.js";
import type { FilterClause } from "./supabase/types.js";

// ============================================
// Types and Schemas
// ============================================

/**
 * Date range for analytics queries
 */
export const DateRangeSchema = z.object({
  startDate: z.date(),
  endDate: z.date(),
});

export type DateRange = z.infer<typeof DateRangeSchema>;

/**
 * Time interval for trend grouping
 */
export type TimeInterval = "day" | "week" | "month";

/**
 * Funnel stage counts
 */
export interface FunnelCounts {
  pending: number;
  emailed: number;
  called: number;
  booked: number;
  converted: number;
  declined: number;
}

/**
 * Conversion rates between stages
 */
export interface ConversionRates {
  emailedFromPending: number;
  calledFromEmailed: number;
  bookedFromCalled: number;
  convertedFromBooked: number;
}

/**
 * Complete funnel metrics
 */
export interface FunnelMetrics {
  counts: FunnelCounts;
  conversionRates: ConversionRates;
  totalLeads: number;
  overallConversionRate: number;
}

/**
 * Campaign performance metrics
 */
export interface CampaignMetrics {
  campaignId: string;
  sent: number;
  delivered: number;
  opened: number;
  clicked: number;
  replied: number;
  bounced: number;
  openRate: number;
  clickRate: number;
  replyRate: number;
  bounceRate: number;
}

/**
 * Overall system metrics
 */
export interface OverallMetrics {
  totalLeads: number;
  activeLeads: number;
  auditedLeads: number;
  contactedLeads: number;
  bookedMeetings: number;
  conversions: number;
  emailsSent: number;
  avgResponseRate: number;
  avgPerformanceScore: number | null;
  avgAccessibilityScore: number | null;
}

/**
 * Time series data point
 */
export interface TimeSeriesData {
  date: string;
  value: number;
  label?: string;
}

/**
 * Category performance metrics
 */
export interface CategoryMetrics {
  category: string;
  leadCount: number;
  contactedCount: number;
  bookedCount: number;
  convertedCount: number;
  conversionRate: number;
  avgPerformanceScore: number | null;
}

/**
 * Score distribution bucket
 */
export interface ScoreBucket {
  range: string;
  min: number;
  max: number;
  count: number;
  percentage: number;
}

/**
 * Score distribution across buckets
 */
export interface ScoreDistribution {
  buckets: ScoreBucket[];
  totalWithScore: number;
  totalWithoutScore: number;
  avgScore: number | null;
}

/**
 * Cache entry with TTL
 */
interface CacheEntry<T> {
  data: T;
  expiresAt: number;
}

// ============================================
// Analytics Service
// ============================================

/**
 * AnalyticsService - Aggregation and reporting for lead data
 *
 * Provides funnel metrics, campaign performance, time-series trends,
 * and category analytics with caching for frequently accessed data.
 */
export class AnalyticsService {
  private readonly client: SupabaseClient;
  private readonly cache = new Map<string, CacheEntry<unknown>>();
  private readonly defaultCacheTtlMs = 5 * 60 * 1000; // 5 minutes

  constructor(client: SupabaseClient) {
    this.client = client;
  }

  // ============================================
  // Funnel Metrics
  // ============================================

  /**
   * Get conversion funnel metrics for a date range
   */
  async getConversionFunnel(dateRange: DateRange): Promise<FunnelMetrics> {
    const cacheKey = `funnel:${dateRange.startDate.toISOString()}:${dateRange.endDate.toISOString()}`;

    return this.getCachedOrFetch(cacheKey, async () => {
      // Query lead status distribution
      const filters: FilterClause[] = [
        { column: "discovered_at", operator: "gte", value: dateRange.startDate.toISOString() },
        { column: "discovered_at", operator: "lte", value: dateRange.endDate.toISOString() },
      ];

      const result = await this.client.select<{ contact_status: ContactStatus }>(
        "lead_profiles",
        { filters, columns: ["contact_status"] }
      );

      // Count by status
      const counts: FunnelCounts = {
        pending: 0,
        emailed: 0,
        called: 0,
        booked: 0,
        converted: 0,
        declined: 0,
      };

      for (const row of result.data) {
        const status = row.contact_status as keyof FunnelCounts;
        if (status in counts) {
          counts[status]++;
        }
      }

      const totalLeads = result.data.length;

      // Calculate conversion rates (safe division)
      const conversionRates: ConversionRates = {
        emailedFromPending: this.safePercent(counts.emailed, counts.pending + counts.emailed),
        calledFromEmailed: this.safePercent(counts.called, counts.emailed),
        bookedFromCalled: this.safePercent(counts.booked, counts.called),
        convertedFromBooked: this.safePercent(counts.converted, counts.booked),
      };

      const overallConversionRate = this.safePercent(counts.converted, totalLeads);

      return {
        counts,
        conversionRates,
        totalLeads,
        overallConversionRate,
      };
    });
  }

  // ============================================
  // Campaign Metrics
  // ============================================

  /**
   * Get performance metrics for a specific campaign
   */
  async getCampaignPerformance(campaignId: string): Promise<CampaignMetrics> {
    const cacheKey = `campaign:${campaignId}`;

    return this.getCachedOrFetch(cacheKey, async () => {
      // Query email events for campaign
      const filters: FilterClause[] = [
        { column: "campaign_id", operator: "eq", value: campaignId },
      ];

      const result = await this.client.select<{ event_type: string }>(
        "email_events",
        { filters, columns: ["event_type"] }
      );

      // Count by event type
      let sent = 0;
      let delivered = 0;
      let opened = 0;
      let clicked = 0;
      let replied = 0;
      let bounced = 0;

      for (const row of result.data) {
        const eventType = row.event_type.toLowerCase();
        switch (eventType) {
          case "sent": sent++; break;
          case "delivered": delivered++; break;
          case "opened": opened++; break;
          case "clicked": clicked++; break;
          case "replied": replied++; break;
          case "bounced": bounced++; break;
        }
      }

      return {
        campaignId,
        sent,
        delivered,
        opened,
        clicked,
        replied,
        bounced,
        openRate: this.safePercent(opened, delivered),
        clickRate: this.safePercent(clicked, opened),
        replyRate: this.safePercent(replied, sent),
        bounceRate: this.safePercent(bounced, sent),
      };
    });
  }

  /**
   * Get overall system metrics for a date range
   */
  async getOverallMetrics(dateRange: DateRange): Promise<OverallMetrics> {
    const cacheKey = `overall:${dateRange.startDate.toISOString()}:${dateRange.endDate.toISOString()}`;

    return this.getCachedOrFetch(cacheKey, async () => {
      const filters: FilterClause[] = [
        { column: "discovered_at", operator: "gte", value: dateRange.startDate.toISOString() },
        { column: "discovered_at", operator: "lte", value: dateRange.endDate.toISOString() },
      ];

      // Get lead data
      const leadsResult = await this.client.select<{
        contact_status: ContactStatus;
        performance_score: number | null;
        accessibility_score: number | null;
      }>("lead_profiles", {
        filters,
        columns: ["contact_status", "performance_score", "accessibility_score"],
      });

      const leads = leadsResult.data;
      const totalLeads = leads.length;

      // Count by status
      let activeLeads = 0;
      let auditedLeads = 0;
      let contactedLeads = 0;
      let bookedMeetings = 0;
      let conversions = 0;

      let performanceScoreSum = 0;
      let performanceScoreCount = 0;
      let accessibilityScoreSum = 0;
      let accessibilityScoreCount = 0;

      for (const lead of leads) {
        const status = lead.contact_status;

        if (status !== "declined") {
          activeLeads++;
        }

        if (lead.performance_score !== null) {
          auditedLeads++;
          performanceScoreSum += lead.performance_score;
          performanceScoreCount++;
        }

        if (lead.accessibility_score !== null) {
          accessibilityScoreSum += lead.accessibility_score;
          accessibilityScoreCount++;
        }

        if (status === "emailed" || status === "called" || status === "booked" || status === "converted") {
          contactedLeads++;
        }

        if (status === "booked" || status === "converted") {
          bookedMeetings++;
        }

        if (status === "converted") {
          conversions++;
        }
      }

      // Get email count (simplified - in production would query email_events)
      const emailsSent = contactedLeads; // Approximation

      const avgResponseRate = this.safePercent(bookedMeetings, contactedLeads);
      const avgPerformanceScore = performanceScoreCount > 0
        ? Math.round(performanceScoreSum / performanceScoreCount)
        : null;
      const avgAccessibilityScore = accessibilityScoreCount > 0
        ? Math.round(accessibilityScoreSum / accessibilityScoreCount)
        : null;

      return {
        totalLeads,
        activeLeads,
        auditedLeads,
        contactedLeads,
        bookedMeetings,
        conversions,
        emailsSent,
        avgResponseRate,
        avgPerformanceScore,
        avgAccessibilityScore,
      };
    });
  }

  // ============================================
  // Time Series
  // ============================================

  /**
   * Get leads trend over time
   */
  async getLeadsTrend(
    dateRange: DateRange,
    interval: TimeInterval = "day"
  ): Promise<TimeSeriesData[]> {
    const cacheKey = `leads-trend:${dateRange.startDate.toISOString()}:${dateRange.endDate.toISOString()}:${interval}`;

    return this.getCachedOrFetch(cacheKey, async () => {
      const filters: FilterClause[] = [
        { column: "discovered_at", operator: "gte", value: dateRange.startDate.toISOString() },
        { column: "discovered_at", operator: "lte", value: dateRange.endDate.toISOString() },
      ];

      const result = await this.client.select<{ discovered_at: string }>(
        "lead_profiles",
        { filters, columns: ["discovered_at"] }
      );

      // Group by interval
      const buckets = new Map<string, number>();

      for (const row of result.data) {
        const date = new Date(row.discovered_at);
        const bucketKey = this.getBucketKey(date, interval);

        buckets.set(bucketKey, (buckets.get(bucketKey) ?? 0) + 1);
      }

      // Fill gaps and sort
      const filledBuckets = this.fillDateGaps(
        buckets,
        dateRange.startDate,
        dateRange.endDate,
        interval
      );

      return Array.from(filledBuckets.entries())
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([date, value]) => ({ date, value }));
    });
  }

  /**
   * Get response trend for a campaign
   */
  async getResponseTrend(
    campaignId: string,
    interval: TimeInterval = "day"
  ): Promise<TimeSeriesData[]> {
    const cacheKey = `response-trend:${campaignId}:${interval}`;

    return this.getCachedOrFetch(cacheKey, async () => {
      const filters: FilterClause[] = [
        { column: "campaign_id", operator: "eq", value: campaignId },
        { column: "event_type", operator: "in", value: ["opened", "clicked", "replied"] },
      ];

      const result = await this.client.select<{ created_at: string; event_type: string }>(
        "email_events",
        { filters, columns: ["created_at", "event_type"] }
      );

      // Group by date
      const buckets = new Map<string, number>();

      for (const row of result.data) {
        const date = new Date(row.created_at);
        const bucketKey = this.getBucketKey(date, interval);

        buckets.set(bucketKey, (buckets.get(bucketKey) ?? 0) + 1);
      }

      return Array.from(buckets.entries())
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([date, value]) => ({ date, value }));
    });
  }

  // ============================================
  // Aggregations
  // ============================================

  /**
   * Get top performing business categories
   */
  async getTopPerformingCategories(limit: number = 10): Promise<CategoryMetrics[]> {
    const cacheKey = `top-categories:${limit}`;

    return this.getCachedOrFetch(cacheKey, async () => {
      const result = await this.client.select<{
        business_category: string | null;
        contact_status: ContactStatus;
        performance_score: number | null;
      }>("lead_profiles", {
        columns: ["business_category", "contact_status", "performance_score"],
      });

      // Group by category
      const categoryMap = new Map<string, {
        leadCount: number;
        contactedCount: number;
        bookedCount: number;
        convertedCount: number;
        performanceScoreSum: number;
        performanceScoreCount: number;
      }>();

      for (const row of result.data) {
        const category = row.business_category ?? "Unknown";
        const existing = categoryMap.get(category) ?? {
          leadCount: 0,
          contactedCount: 0,
          bookedCount: 0,
          convertedCount: 0,
          performanceScoreSum: 0,
          performanceScoreCount: 0,
        };

        existing.leadCount++;

        if (["emailed", "called", "booked", "converted"].includes(row.contact_status)) {
          existing.contactedCount++;
        }
        if (["booked", "converted"].includes(row.contact_status)) {
          existing.bookedCount++;
        }
        if (row.contact_status === "converted") {
          existing.convertedCount++;
        }
        if (row.performance_score !== null) {
          existing.performanceScoreSum += row.performance_score;
          existing.performanceScoreCount++;
        }

        categoryMap.set(category, existing);
      }

      // Convert to array and calculate rates
      const categories: CategoryMetrics[] = [];

      for (const [category, data] of categoryMap) {
        categories.push({
          category,
          leadCount: data.leadCount,
          contactedCount: data.contactedCount,
          bookedCount: data.bookedCount,
          convertedCount: data.convertedCount,
          conversionRate: this.safePercent(data.convertedCount, data.leadCount),
          avgPerformanceScore: data.performanceScoreCount > 0
            ? Math.round(data.performanceScoreSum / data.performanceScoreCount)
            : null,
        });
      }

      // Sort by conversion rate descending, then by lead count
      return categories
        .sort((a, b) => {
          if (b.conversionRate !== a.conversionRate) {
            return b.conversionRate - a.conversionRate;
          }
          return b.leadCount - a.leadCount;
        })
        .slice(0, limit);
    });
  }

  /**
   * Get performance score distribution
   */
  async getQualificationDistribution(): Promise<ScoreDistribution> {
    const cacheKey = "score-distribution";

    return this.getCachedOrFetch(cacheKey, async () => {
      const result = await this.client.select<{ performance_score: number | null }>(
        "lead_profiles",
        { columns: ["performance_score"] }
      );

      // Define buckets
      const bucketDefs: Array<{ range: string; min: number; max: number }> = [
        { range: "0-25 (Poor)", min: 0, max: 25 },
        { range: "26-50 (Fair)", min: 26, max: 50 },
        { range: "51-75 (Good)", min: 51, max: 75 },
        { range: "76-100 (Excellent)", min: 76, max: 100 },
      ];

      const bucketCounts: number[] = [0, 0, 0, 0];
      let totalWithScore = 0;
      let totalWithoutScore = 0;
      let scoreSum = 0;

      for (const row of result.data) {
        if (row.performance_score === null) {
          totalWithoutScore++;
          continue;
        }

        totalWithScore++;
        scoreSum += row.performance_score;

        // Find bucket
        for (let i = 0; i < bucketDefs.length; i++) {
          const def = bucketDefs[i];
          if (def && row.performance_score >= def.min && row.performance_score <= def.max) {
            const currentCount = bucketCounts[i];
            if (currentCount !== undefined) {
              bucketCounts[i] = currentCount + 1;
            }
            break;
          }
        }
      }

      const buckets: ScoreBucket[] = bucketDefs.map((def, i) => ({
        range: def.range,
        min: def.min,
        max: def.max,
        count: bucketCounts[i] ?? 0,
        percentage: this.safePercent(bucketCounts[i] ?? 0, totalWithScore),
      }));

      return {
        buckets,
        totalWithScore,
        totalWithoutScore,
        avgScore: totalWithScore > 0 ? Math.round(scoreSum / totalWithScore) : null,
      };
    });
  }

  // ============================================
  // Cache Management
  // ============================================

  /**
   * Invalidate all cached data
   */
  invalidateCache(): void {
    this.cache.clear();
  }

  /**
   * Invalidate cache entries matching a prefix
   */
  invalidateCachePrefix(prefix: string): void {
    for (const key of this.cache.keys()) {
      if (key.startsWith(prefix)) {
        this.cache.delete(key);
      }
    }
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): { size: number; keys: string[] } {
    return {
      size: this.cache.size,
      keys: Array.from(this.cache.keys()),
    };
  }

  // ============================================
  // Private Helpers
  // ============================================

  /**
   * Get from cache or fetch fresh data
   */
  private async getCachedOrFetch<T>(
    key: string,
    fetcher: () => Promise<T>,
    ttlMs: number = this.defaultCacheTtlMs
  ): Promise<T> {
    const now = Date.now();
    const cached = this.cache.get(key) as CacheEntry<T> | undefined;

    if (cached && cached.expiresAt > now) {
      return cached.data;
    }

    const data = await fetcher();

    this.cache.set(key, {
      data,
      expiresAt: now + ttlMs,
    });

    return data;
  }

  /**
   * Calculate percentage safely (handle division by zero)
   */
  private safePercent(numerator: number, denominator: number): number {
    if (denominator === 0) {
      return 0;
    }
    return Math.round((numerator / denominator) * 100 * 10) / 10; // One decimal place
  }

  /**
   * Get bucket key for a date based on interval
   */
  private getBucketKey(date: Date, interval: TimeInterval): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");

    switch (interval) {
      case "day":
        return `${year}-${month}-${day}`;
      case "week": {
        // Get ISO week start (Monday)
        const weekStart = new Date(date);
        const dayOfWeek = date.getDay();
        const diff = date.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1);
        weekStart.setDate(diff);
        const wYear = weekStart.getFullYear();
        const wMonth = String(weekStart.getMonth() + 1).padStart(2, "0");
        const wDay = String(weekStart.getDate()).padStart(2, "0");
        return `${wYear}-${wMonth}-${wDay}`;
      }
      case "month":
        return `${year}-${month}`;
      default:
        return `${year}-${month}-${day}`;
    }
  }

  /**
   * Fill gaps in date buckets with zero values
   */
  private fillDateGaps(
    buckets: Map<string, number>,
    startDate: Date,
    endDate: Date,
    interval: TimeInterval
  ): Map<string, number> {
    const filled = new Map<string, number>();
    const current = new Date(startDate);

    while (current <= endDate) {
      const key = this.getBucketKey(current, interval);
      filled.set(key, buckets.get(key) ?? 0);

      // Increment based on interval
      switch (interval) {
        case "day":
          current.setDate(current.getDate() + 1);
          break;
        case "week":
          current.setDate(current.getDate() + 7);
          break;
        case "month":
          current.setMonth(current.getMonth() + 1);
          break;
      }
    }

    return filled;
  }
}
