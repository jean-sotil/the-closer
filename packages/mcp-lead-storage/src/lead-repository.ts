import { randomUUID } from "node:crypto";

import { z } from "zod";

import {
  type LeadProfile,
  LeadProfileSchema,
  type ContactStatus,
  ValidationError,
  NotFoundError,
} from "@the-closer/shared";

import { SupabaseClient } from "./supabase/client.js";
import { SupabaseError, mapSupabaseError } from "./supabase/errors.js";
import type { FilterClause } from "./supabase/types.js";

/**
 * Lead filters for searching
 */
export interface LeadFilters {
  status?: ContactStatus | ContactStatus[];
  minRating?: number;
  maxRating?: number;
  minPerformanceScore?: number;
  maxPerformanceScore?: number;
  categories?: string[];
  sourceQuery?: string;
  hasWebsite?: boolean;
  hasPhone?: boolean;
  mobileFriendly?: boolean;
  discoveredAfter?: string;
  discoveredBefore?: string;
}

/**
 * Pagination options
 */
export interface PaginationOptions {
  limit?: number;
  offset?: number;
  cursor?: string;
}

/**
 * Sorting options
 */
export interface SortOptions {
  field: "discoveredAt" | "rating" | "performanceScore" | "businessName" | "updatedAt";
  direction: "asc" | "desc";
}

/**
 * Paginated result
 */
export interface PaginatedResult<T> {
  items: T[];
  total: number;
  limit: number;
  offset: number;
  hasMore: boolean;
}

/**
 * Batch update item
 */
export interface BatchUpdateItem {
  id: string;
  data: Partial<Omit<LeadProfile, "id" | "discoveredAt">>;
}

/**
 * Lead input for creating new leads (without id and timestamps)
 */
export type LeadInput = Omit<LeadProfile, "id" | "discoveredAt" | "updatedAt">;

/**
 * Lead input schema for validation
 */
const LeadInputSchema = LeadProfileSchema.omit({
  id: true,
  discoveredAt: true,
  updatedAt: true,
});

/**
 * Schema for partial lead updates
 */
const LeadUpdateSchema = LeadProfileSchema.omit({
  id: true,
  discoveredAt: true,
}).partial();

/**
 * Lead Repository - Data persistence layer for lead profiles
 *
 * Provides CRUD operations, search functionality, and bulk operations
 * for lead profiles using Supabase as the backend.
 */
export class LeadRepository {
  private readonly client: SupabaseClient;
  private readonly tableName = "lead_profiles";

  constructor(client: SupabaseClient) {
    this.client = client;
  }

  /**
   * Transform database row to LeadProfile
   */
  private mapRowToLead(row: Record<string, unknown>): LeadProfile {
    return {
      id: row["id"] as string,
      businessName: row["business_name"] as string,
      address: row["address"] as string | undefined,
      phoneNumber: row["phone_number"] as string | undefined,
      websiteUrl: row["website_url"] as string | undefined,
      rating: row["rating"] as number | undefined,
      reviewCount: row["review_count"] as number | undefined,
      businessCategory: row["business_category"] as string | undefined,
      painPoints: (row["pain_points"] as LeadProfile["painPoints"]) ?? [],
      performanceScore: row["performance_score"] as number | undefined,
      accessibilityScore: row["accessibility_score"] as number | undefined,
      mobileFriendly: row["mobile_friendly"] as boolean | undefined,
      evidenceUrls: (row["evidence_urls"] as LeadProfile["evidenceUrls"]) ?? [],
      contactStatus: (row["contact_status"] as ContactStatus) ?? "pending",
      lastContactedAt: row["last_contacted_at"] as string | undefined,
      nextFollowupAt: row["next_followup_at"] as string | undefined,
      notes: row["notes"] as string | undefined,
      discoveredAt: row["discovered_at"] as string,
      updatedAt: row["updated_at"] as string,
      sourceQuery: row["source_query"] as string | undefined,
    };
  }

  /**
   * Transform LeadProfile to database row format
   */
  private mapLeadToRow(lead: Partial<LeadProfile>): Record<string, unknown> {
    const row: Record<string, unknown> = {};

    if (lead.id !== undefined) row["id"] = lead.id;
    if (lead.businessName !== undefined) row["business_name"] = lead.businessName;
    if (lead.address !== undefined) row["address"] = lead.address;
    if (lead.phoneNumber !== undefined) row["phone_number"] = lead.phoneNumber;
    if (lead.websiteUrl !== undefined) row["website_url"] = lead.websiteUrl;
    if (lead.rating !== undefined) row["rating"] = lead.rating;
    if (lead.reviewCount !== undefined) row["review_count"] = lead.reviewCount;
    if (lead.businessCategory !== undefined) row["business_category"] = lead.businessCategory;
    if (lead.painPoints !== undefined) row["pain_points"] = lead.painPoints;
    if (lead.performanceScore !== undefined) row["performance_score"] = lead.performanceScore;
    if (lead.accessibilityScore !== undefined) row["accessibility_score"] = lead.accessibilityScore;
    if (lead.mobileFriendly !== undefined) row["mobile_friendly"] = lead.mobileFriendly;
    if (lead.evidenceUrls !== undefined) row["evidence_urls"] = lead.evidenceUrls;
    if (lead.contactStatus !== undefined) row["contact_status"] = lead.contactStatus;
    if (lead.lastContactedAt !== undefined) row["last_contacted_at"] = lead.lastContactedAt;
    if (lead.nextFollowupAt !== undefined) row["next_followup_at"] = lead.nextFollowupAt;
    if (lead.notes !== undefined) row["notes"] = lead.notes;
    if (lead.discoveredAt !== undefined) row["discovered_at"] = lead.discoveredAt;
    if (lead.updatedAt !== undefined) row["updated_at"] = lead.updatedAt;
    if (lead.sourceQuery !== undefined) row["source_query"] = lead.sourceQuery;

    return row;
  }

  /**
   * Normalize URL for duplicate detection
   */
  private normalizeUrl(url: string): string {
    try {
      const parsed = new URL(url.toLowerCase());
      // Remove www prefix
      const hostname = parsed.hostname.replace(/^www\./, "");
      // Remove trailing slash
      const pathname = parsed.pathname.replace(/\/$/, "") || "/";
      // Ignore query params and hash
      return `${parsed.protocol}//${hostname}${pathname}`;
    } catch {
      // Return as-is if not a valid URL
      return url.toLowerCase().trim();
    }
  }

  // ================================
  // CRUD Operations
  // ================================

  /**
   * Save a new lead (with duplicate detection)
   */
  async saveLead(input: LeadInput): Promise<LeadProfile> {
    // Validate input
    const parseResult = LeadInputSchema.safeParse(input);
    if (!parseResult.success) {
      throw new ValidationError("Invalid lead data", {
        context: { issues: parseResult.error.issues },
      });
    }

    const validInput = parseResult.data;

    // Check for duplicate by website URL
    if (validInput.websiteUrl) {
      const existing = await this.findDuplicateByWebsite(validInput.websiteUrl);
      if (existing) {
        // Upsert - update existing record
        return this.updateLead(existing.id, validInput);
      }
    }

    // Create new lead
    const now = new Date().toISOString();
    const lead: LeadProfile = {
      id: randomUUID(),
      ...validInput,
      painPoints: validInput.painPoints ?? [],
      evidenceUrls: validInput.evidenceUrls ?? [],
      contactStatus: validInput.contactStatus ?? "pending",
      discoveredAt: now,
      updatedAt: now,
    };

    try {
      await this.client.insert<Record<string, unknown>>(
        this.tableName,
        this.mapLeadToRow(lead)
      );
      return lead;
    } catch (error) {
      throw mapSupabaseError(error);
    }
  }

  /**
   * Get a lead by ID
   */
  async getLeadById(id: string): Promise<LeadProfile | null> {
    // Validate UUID format
    const uuidResult = z.string().uuid().safeParse(id);
    if (!uuidResult.success) {
      throw new ValidationError(`Invalid lead ID format: ${id}`);
    }

    try {
      const result = await this.client.select<Record<string, unknown>>(
        this.tableName,
        {
          filters: [{ column: "id", operator: "eq", value: id }],
        }
      );

      if (result.data.length === 0) {
        return null;
      }

      return this.mapRowToLead(result.data[0]!);
    } catch (error) {
      throw mapSupabaseError(error);
    }
  }

  /**
   * Update an existing lead
   */
  async updateLead(
    id: string,
    updates: Partial<Omit<LeadProfile, "id" | "discoveredAt">>
  ): Promise<LeadProfile> {
    // Validate ID
    const uuidResult = z.string().uuid().safeParse(id);
    if (!uuidResult.success) {
      throw new ValidationError(`Invalid lead ID format: ${id}`);
    }

    // Check lead exists
    const existing = await this.getLeadById(id);
    if (!existing) {
      throw new NotFoundError(`Lead not found: ${id}`);
    }

    // Validate updates
    const parseResult = LeadUpdateSchema.safeParse(updates);
    if (!parseResult.success) {
      throw new ValidationError("Invalid update data", {
        context: { issues: parseResult.error.issues },
      });
    }

    const validUpdates = parseResult.data;
    const now = new Date().toISOString();

    try {
      // Build update row directly from validated data
      const updateData: Partial<LeadProfile> = { updatedAt: now };

      // Copy only defined fields
      if (validUpdates.businessName !== undefined) updateData.businessName = validUpdates.businessName;
      if (validUpdates.address !== undefined) updateData.address = validUpdates.address;
      if (validUpdates.phoneNumber !== undefined) updateData.phoneNumber = validUpdates.phoneNumber;
      if (validUpdates.websiteUrl !== undefined) updateData.websiteUrl = validUpdates.websiteUrl;
      if (validUpdates.rating !== undefined) updateData.rating = validUpdates.rating;
      if (validUpdates.reviewCount !== undefined) updateData.reviewCount = validUpdates.reviewCount;
      if (validUpdates.businessCategory !== undefined) updateData.businessCategory = validUpdates.businessCategory;
      if (validUpdates.painPoints !== undefined) updateData.painPoints = validUpdates.painPoints;
      if (validUpdates.performanceScore !== undefined) updateData.performanceScore = validUpdates.performanceScore;
      if (validUpdates.accessibilityScore !== undefined) updateData.accessibilityScore = validUpdates.accessibilityScore;
      if (validUpdates.mobileFriendly !== undefined) updateData.mobileFriendly = validUpdates.mobileFriendly;
      if (validUpdates.evidenceUrls !== undefined) updateData.evidenceUrls = validUpdates.evidenceUrls;
      if (validUpdates.contactStatus !== undefined) updateData.contactStatus = validUpdates.contactStatus;
      if (validUpdates.lastContactedAt !== undefined) updateData.lastContactedAt = validUpdates.lastContactedAt;
      if (validUpdates.nextFollowupAt !== undefined) updateData.nextFollowupAt = validUpdates.nextFollowupAt;
      if (validUpdates.notes !== undefined) updateData.notes = validUpdates.notes;
      if (validUpdates.sourceQuery !== undefined) updateData.sourceQuery = validUpdates.sourceQuery;

      const row = this.mapLeadToRow(updateData);

      await this.client.update<Record<string, unknown>>(
        this.tableName,
        id,
        row
      );

      // Return updated lead
      const updated = await this.getLeadById(id);
      if (!updated) {
        throw new SupabaseError("Failed to retrieve updated lead", "QUERY_FAILED");
      }
      return updated;
    } catch (error) {
      if (error instanceof ValidationError || error instanceof NotFoundError) {
        throw error;
      }
      throw mapSupabaseError(error);
    }
  }

  /**
   * Delete a lead
   */
  async deleteLead(id: string): Promise<void> {
    // Validate ID
    const uuidResult = z.string().uuid().safeParse(id);
    if (!uuidResult.success) {
      throw new ValidationError(`Invalid lead ID format: ${id}`);
    }

    // Check lead exists
    const existing = await this.getLeadById(id);
    if (!existing) {
      throw new NotFoundError(`Lead not found: ${id}`);
    }

    try {
      await this.client.delete(this.tableName, id);
    } catch (error) {
      throw mapSupabaseError(error);
    }
  }

  // ================================
  // Search Operations
  // ================================

  /**
   * Search leads with filters and pagination
   */
  async searchLeads(
    filters: LeadFilters = {},
    pagination: PaginationOptions = {},
    sort?: SortOptions
  ): Promise<PaginatedResult<LeadProfile>> {
    const limit = pagination.limit ?? 50;
    const offset = pagination.offset ?? 0;

    // Build filter clauses
    const filterClauses: FilterClause[] = [];

    // Status filter
    if (filters.status) {
      if (Array.isArray(filters.status)) {
        filterClauses.push({
          column: "contact_status",
          operator: "in",
          value: filters.status,
        });
      } else {
        filterClauses.push({
          column: "contact_status",
          operator: "eq",
          value: filters.status,
        });
      }
    }

    // Rating filters
    if (filters.minRating !== undefined) {
      filterClauses.push({
        column: "rating",
        operator: "gte",
        value: filters.minRating,
      });
    }
    if (filters.maxRating !== undefined) {
      filterClauses.push({
        column: "rating",
        operator: "lte",
        value: filters.maxRating,
      });
    }

    // Performance score filters
    if (filters.minPerformanceScore !== undefined) {
      filterClauses.push({
        column: "performance_score",
        operator: "gte",
        value: filters.minPerformanceScore,
      });
    }
    if (filters.maxPerformanceScore !== undefined) {
      filterClauses.push({
        column: "performance_score",
        operator: "lte",
        value: filters.maxPerformanceScore,
      });
    }

    // Category filter
    if (filters.categories && filters.categories.length > 0) {
      filterClauses.push({
        column: "business_category",
        operator: "in",
        value: filters.categories,
      });
    }

    // Source query filter
    if (filters.sourceQuery) {
      filterClauses.push({
        column: "source_query",
        operator: "ilike",
        value: `%${filters.sourceQuery}%`,
      });
    }

    // Date range filters
    if (filters.discoveredAfter) {
      filterClauses.push({
        column: "discovered_at",
        operator: "gte",
        value: filters.discoveredAfter,
      });
    }
    if (filters.discoveredBefore) {
      filterClauses.push({
        column: "discovered_at",
        operator: "lte",
        value: filters.discoveredBefore,
      });
    }

    // Mobile friendly filter
    if (filters.mobileFriendly !== undefined) {
      filterClauses.push({
        column: "mobile_friendly",
        operator: "eq",
        value: filters.mobileFriendly,
      });
    }

    // Map sort field to column name
    const sortFieldMap: Record<string, string> = {
      discoveredAt: "discovered_at",
      rating: "rating",
      performanceScore: "performance_score",
      businessName: "business_name",
      updatedAt: "updated_at",
    };

    try {
      const result = await this.client.select<Record<string, unknown>>(
        this.tableName,
        {
          filters: filterClauses,
          ordering: sort
            ? [
                {
                  column: sortFieldMap[sort.field] ?? "discovered_at",
                  ascending: sort.direction === "asc",
                },
              ]
            : [{ column: "discovered_at", ascending: false }],
          pagination: { limit, offset },
          count: "exact",
        }
      );

      const items = result.data.map((row) => this.mapRowToLead(row));
      const total = result.count ?? items.length;

      return {
        items,
        total,
        limit,
        offset,
        hasMore: offset + items.length < total,
      };
    } catch (error) {
      throw mapSupabaseError(error);
    }
  }

  /**
   * Get leads by status
   */
  async getLeadsByStatus(status: ContactStatus): Promise<LeadProfile[]> {
    const result = await this.searchLeads(
      { status },
      { limit: 1000 }
    );
    return result.items;
  }

  /**
   * Get pending leads ready for outreach
   */
  async getPendingLeads(limit = 100): Promise<LeadProfile[]> {
    const result = await this.searchLeads(
      {
        status: "pending",
        hasWebsite: true,
      },
      { limit },
      { field: "discoveredAt", direction: "asc" }
    );
    return result.items;
  }

  // ================================
  // Bulk Operations
  // ================================

  /**
   * Save multiple leads in batch
   */
  async saveLeadsBatch(inputs: LeadInput[]): Promise<LeadProfile[]> {
    if (inputs.length === 0) {
      return [];
    }

    // Validate all inputs
    const validationErrors: Array<{ index: number; errors: z.ZodIssue[] }> = [];
    const validInputs: LeadInput[] = [];

    for (let i = 0; i < inputs.length; i++) {
      const parseResult = LeadInputSchema.safeParse(inputs[i]);
      if (!parseResult.success) {
        validationErrors.push({ index: i, errors: parseResult.error.issues });
      } else {
        validInputs.push(parseResult.data);
      }
    }

    if (validationErrors.length > 0) {
      throw new ValidationError("Batch contains invalid leads", {
        context: { validationErrors },
      });
    }

    // Check for duplicates within batch and against existing
    const leads: LeadProfile[] = [];
    const now = new Date().toISOString();
    const seenUrls = new Set<string>();

    for (const input of validInputs) {
      // Skip duplicates within batch
      if (input.websiteUrl) {
        const normalized = this.normalizeUrl(input.websiteUrl);
        if (seenUrls.has(normalized)) {
          continue;
        }
        seenUrls.add(normalized);

        // Check against existing
        const existing = await this.findDuplicateByWebsite(input.websiteUrl);
        if (existing) {
          // Update existing instead of creating new
          const updated = await this.updateLead(existing.id, input);
          leads.push(updated);
          continue;
        }
      }

      // Create new lead
      const lead: LeadProfile = {
        id: randomUUID(),
        ...input,
        painPoints: input.painPoints ?? [],
        evidenceUrls: input.evidenceUrls ?? [],
        contactStatus: input.contactStatus ?? "pending",
        discoveredAt: now,
        updatedAt: now,
      };

      leads.push(lead);
    }

    // Insert new leads (those without existing IDs)
    const newLeads = leads.filter((l) => !l.discoveredAt || l.discoveredAt === now);
    if (newLeads.length > 0) {
      const rows = newLeads.map((lead) => this.mapLeadToRow(lead));

      try {
        // Insert in chunks to avoid timeouts
        const chunkSize = 100;
        for (let i = 0; i < rows.length; i += chunkSize) {
          const chunk = rows.slice(i, i + chunkSize);
          for (const row of chunk) {
            await this.client.insert<Record<string, unknown>>(this.tableName, row);
          }
        }
      } catch (error) {
        throw mapSupabaseError(error);
      }
    }

    return leads;
  }

  /**
   * Update multiple leads in batch
   */
  async updateLeadsBatch(updates: BatchUpdateItem[]): Promise<void> {
    if (updates.length === 0) {
      return;
    }

    // Validate all updates
    const validationErrors: Array<{ index: number; id: string; errors: z.ZodIssue[] }> = [];

    for (let i = 0; i < updates.length; i++) {
      const update = updates[i]!;

      // Validate ID
      const uuidResult = z.string().uuid().safeParse(update.id);
      if (!uuidResult.success) {
        validationErrors.push({
          index: i,
          id: update.id,
          errors: uuidResult.error.issues,
        });
        continue;
      }

      // Validate data
      const parseResult = LeadUpdateSchema.safeParse(update.data);
      if (!parseResult.success) {
        validationErrors.push({
          index: i,
          id: update.id,
          errors: parseResult.error.issues,
        });
      }
    }

    if (validationErrors.length > 0) {
      throw new ValidationError("Batch contains invalid updates", {
        context: { validationErrors },
      });
    }

    // Verify all IDs exist
    const ids = updates.map((u) => u.id);
    const existingResult = await this.client.select<Record<string, unknown>>(
      this.tableName,
      {
        filters: [{ column: "id", operator: "in", value: ids }],
        columns: ["id"],
      }
    );

    const existingIds = new Set(existingResult.data.map((r) => r["id"] as string));
    const missingIds = ids.filter((id) => !existingIds.has(id));

    if (missingIds.length > 0) {
      throw new NotFoundError(`Leads not found: ${missingIds.join(", ")}`);
    }

    // Perform updates
    const now = new Date().toISOString();

    try {
      for (const update of updates) {
        const row = this.mapLeadToRow({
          ...update.data,
          updatedAt: now,
        });
        await this.client.update<Record<string, unknown>>(
          this.tableName,
          update.id,
          row
        );
      }
    } catch (error) {
      throw mapSupabaseError(error);
    }
  }

  // ================================
  // Deduplication
  // ================================

  /**
   * Find a duplicate lead by website URL
   */
  async findDuplicateByWebsite(url: string): Promise<LeadProfile | null> {
    const normalized = this.normalizeUrl(url);

    try {
      // Search with normalized URL
      const result = await this.client.select<Record<string, unknown>>(
        this.tableName,
        {
          filters: [
            {
              column: "website_url",
              operator: "ilike",
              value: `%${new URL(normalized).hostname}%`,
            },
          ],
          pagination: { limit: 10 },
        }
      );

      // Check each result for exact match after normalization
      for (const row of result.data) {
        const leadUrl = row["website_url"] as string | null;
        if (leadUrl && this.normalizeUrl(leadUrl) === normalized) {
          return this.mapRowToLead(row);
        }
      }

      return null;
    } catch {
      // On error (like invalid URL), return null
      return null;
    }
  }

  /**
   * Count leads by status
   */
  async countByStatus(): Promise<Record<ContactStatus, number>> {
    const counts: Record<string, number> = {
      pending: 0,
      emailed: 0,
      called: 0,
      booked: 0,
      converted: 0,
      declined: 0,
    };

    const statuses: ContactStatus[] = [
      "pending",
      "emailed",
      "called",
      "booked",
      "converted",
      "declined",
    ];

    for (const status of statuses) {
      const result = await this.searchLeads({ status }, { limit: 1 });
      counts[status] = result.total;
    }

    return counts as Record<ContactStatus, number>;
  }

  /**
   * Get lead statistics
   */
  async getStats(): Promise<{
    total: number;
    byStatus: Record<ContactStatus, number>;
    withWebsite: number;
    withPhone: number;
    averageRating: number | null;
  }> {
    const byStatus = await this.countByStatus();
    const total = Object.values(byStatus).reduce((sum, n) => sum + n, 0);

    // Count with website
    const withWebsiteResult = await this.searchLeads(
      { hasWebsite: true },
      { limit: 1 }
    );

    // Count with phone
    const withPhoneResult = await this.searchLeads(
      { hasPhone: true },
      { limit: 1 }
    );

    // Calculate average rating
    const allLeads = await this.searchLeads(
      { minRating: 0 },
      { limit: 10000 }
    );
    const ratingsSum = allLeads.items
      .filter((l) => l.rating !== undefined)
      .reduce((sum, l) => sum + (l.rating ?? 0), 0);
    const ratingCount = allLeads.items.filter((l) => l.rating !== undefined).length;

    return {
      total,
      byStatus,
      withWebsite: withWebsiteResult.total,
      withPhone: withPhoneResult.total,
      averageRating: ratingCount > 0 ? ratingsSum / ratingCount : null,
    };
  }
}
