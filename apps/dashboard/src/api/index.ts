import { supabase } from "../contexts/AuthContext";
import type { LeadProfile, ContactStatus, CampaignConfig, CampaignStatus } from "@the-closer/shared";
import type { LeadFilterState, SortConfig, PaginationState } from "../components/leads/types";
import { secureApiCall, sanitizeObject } from "./secureApi";
import { RATE_LIMIT_CONFIG } from "../config/security";

/**
 * Paginated result type
 */
export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}

/**
 * Lead query parameters
 */
export interface LeadQueryParams {
  filters?: Partial<LeadFilterState>;
  sort?: SortConfig;
  pagination?: Partial<PaginationState>;
}

/**
 * Lead API functions
 */
export const leadsApi = {
  /**
   * Fetch leads with filtering, sorting, and pagination
   */
  async getLeads(params: LeadQueryParams = {}): Promise<PaginatedResult<LeadProfile>> {
    return secureApiCall(
      'leads:getLeads',
      async () => {
        const { filters = {}, sort, pagination = {} } = params;
        const page = pagination.page ?? 1;
        const pageSize = pagination.pageSize ?? 25;
        const offset = (page - 1) * pageSize;

    // Build the query
    let query = supabase.from("lead_profiles").select("*", { count: "exact" });

    // Apply search filter
    if (filters.search) {
      query = query.ilike("business_name", `%${filters.search}%`);
    }

    // Apply status filter
    if (filters.status && filters.status.length > 0) {
      query = query.in("contact_status", filters.status);
    }

    // Apply category filter
    if (filters.categories && filters.categories.length > 0) {
      query = query.in("business_category", filters.categories);
    }

    // Apply rating range filter
    if (filters.ratingRange) {
      const [minRating, maxRating] = filters.ratingRange;
      if (minRating > 0) {
        query = query.gte("rating", minRating);
      }
      if (maxRating < 5) {
        query = query.lte("rating", maxRating);
      }
    }

    // Apply date range filter
    if (filters.dateRange?.start) {
      query = query.gte("discovered_at", filters.dateRange.start);
    }
    if (filters.dateRange?.end) {
      query = query.lte("discovered_at", filters.dateRange.end);
    }

    // Apply sorting
    if (sort) {
      // Map frontend field names to database column names
      const fieldMap: Record<string, string> = {
        businessName: "business_name",
        businessCategory: "business_category",
        contactStatus: "contact_status",
        discoveredAt: "discovered_at",
        lastContactedAt: "last_contacted_at",
        rating: "rating",
        performanceScore: "performance_score",
        qualificationScore: "performance_score", // Use performance_score as proxy
      };
      const column = fieldMap[sort.field] ?? sort.field;
      query = query.order(column, { ascending: sort.direction === "asc" });
    } else {
      // Default sort by discovered_at descending
      query = query.order("discovered_at", { ascending: false });
    }

    // Apply pagination
    query = query.range(offset, offset + pageSize - 1);

        const { data, error, count } = await query;

        if (error) throw error;

        return {
          data: (data ?? []) as LeadProfile[],
          total: count ?? 0,
          page,
          pageSize,
          hasMore: (count ?? 0) > offset + pageSize,
        };
      },
      {
        maxRequests: RATE_LIMIT_CONFIG.api.max,
        windowMs: RATE_LIMIT_CONFIG.api.windowMs,
      }
    );
  },

  /**
   * Fetch all leads without pagination (for legacy compatibility)
   */
  async getAllLeads(filters?: {
    status?: ContactStatus;
    limit?: number;
    offset?: number;
  }): Promise<LeadProfile[]> {
    let query = supabase
      .from("lead_profiles")
      .select("*")
      .order("discovered_at", { ascending: false });

    if (filters?.status) {
      query = query.eq("contact_status", filters.status);
    }

    if (filters?.limit) {
      query = query.limit(filters.limit);
    }

    if (filters?.offset) {
      query = query.range(filters.offset, filters.offset + (filters.limit ?? 50) - 1);
    }

    const { data, error } = await query;

    if (error) throw error;
    return data as LeadProfile[];
  },

  /**
   * Fetch a single lead by ID
   */
  async getLeadById(id: string): Promise<LeadProfile | null> {
    const { data, error } = await supabase
      .from("lead_profiles")
      .select("*")
      .eq("id", id)
      .single();

    if (error) {
      if (error.code === "PGRST116") return null;
      throw error;
    }
    return data as LeadProfile;
  },

  /**
   * Update a lead
   */
  async updateLead(id: string, updates: Partial<LeadProfile>): Promise<LeadProfile> {
    return secureApiCall(
      `leads:updateLead:${id}`,
      async () => {
        // Sanitize input to prevent XSS
        const sanitizedUpdates = sanitizeObject(updates);

        const { data, error } = await supabase
          .from("lead_profiles")
          .update({ ...sanitizedUpdates, updated_at: new Date().toISOString() })
          .eq("id", id)
          .select()
          .single();

        if (error) throw error;
        return data as LeadProfile;
      }
    );
  },

  /**
   * Bulk update leads status
   */
  async bulkUpdateStatus(ids: string[], status: ContactStatus): Promise<void> {
    return secureApiCall(
      'leads:bulkUpdateStatus',
      async () => {
        const { error } = await supabase
          .from("lead_profiles")
          .update({
            contact_status: status,
            updated_at: new Date().toISOString(),
          })
          .in("id", ids);

        if (error) throw error;
      },
      {
        maxRequests: 20, // More restrictive for bulk operations
        windowMs: RATE_LIMIT_CONFIG.api.windowMs,
      }
    );
  },

  /**
   * Bulk delete leads
   */
  async bulkDelete(ids: string[]): Promise<void> {
    const { error } = await supabase.from("lead_profiles").delete().in("id", ids);

    if (error) throw error;
  },

  /**
   * Get unique categories from leads
   */
  async getCategories(): Promise<string[]> {
    const { data, error } = await supabase
      .from("lead_profiles")
      .select("business_category")
      .not("business_category", "is", null);

    if (error) throw error;

    const categories = new Set<string>();
    for (const row of data) {
      if (row.business_category) {
        categories.add(row.business_category);
      }
    }
    return Array.from(categories).sort();
  },

  /**
   * Get lead statistics
   */
  async getStats(): Promise<{
    total: number;
    pending: number;
    contacted: number;
    converted: number;
  }> {
    const { data, error } = await supabase.from("lead_profiles").select("contact_status");

    if (error) throw error;

    const stats = {
      total: data.length,
      pending: data.filter((l) => l.contact_status === "pending").length,
      contacted: data.filter((l) => ["emailed", "called"].includes(l.contact_status)).length,
      converted: data.filter((l) => l.contact_status === "converted").length,
    };

    return stats;
  },
};

/**
 * Audit API functions
 */
export const auditsApi = {
  /**
   * Fetch audits for a lead
   */
  async getAuditsForLead(leadId: string): Promise<unknown[]> {
    const { data, error } = await supabase
      .from("audit_results")
      .select("*")
      .eq("lead_id", leadId)
      .order("audited_at", { ascending: false });

    if (error) throw error;
    return data;
  },
};

/**
 * Campaign API functions
 */
export const campaignsApi = {
  /**
   * Fetch all campaigns
   */
  async getCampaigns(): Promise<CampaignConfig[]> {
    const { data, error } = await supabase
      .from("campaigns")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) throw error;
    return (data ?? []) as CampaignConfig[];
  },

  /**
   * Update campaign status
   */
  async updateCampaignStatus(id: string, status: CampaignStatus): Promise<CampaignConfig> {
    const { data, error } = await supabase
      .from("campaigns")
      .update({
        status,
        updated_at: new Date().toISOString(),
        ...(status === "active" ? { started_at: new Date().toISOString() } : {}),
        ...(status === "completed" ? { completed_at: new Date().toISOString() } : {}),
      })
      .eq("id", id)
      .select()
      .single();

    if (error) throw error;
    return data as CampaignConfig;
  },
};
