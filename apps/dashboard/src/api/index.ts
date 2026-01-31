import { supabase } from "../contexts/AuthContext";
import type { LeadProfile, ContactStatus } from "@the-closer/shared";

/**
 * Lead API functions
 */
export const leadsApi = {
  /**
   * Fetch all leads with optional filters
   */
  async getLeads(filters?: {
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
    const { data, error } = await supabase
      .from("lead_profiles")
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq("id", id)
      .select()
      .single();

    if (error) throw error;
    return data as LeadProfile;
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
  async getCampaigns(): Promise<unknown[]> {
    const { data, error } = await supabase
      .from("campaigns")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) throw error;
    return data;
  },
};
