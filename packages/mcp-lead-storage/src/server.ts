import type { LeadProfile, CreateLeadInput } from "@the-closer/shared";

import type { LeadQuery, LeadUpdateInput } from "./types.js";

/**
 * MCP Lead Storage Server
 *
 * Manages lead data in Supabase PostgreSQL.
 */
export class LeadStorageServer {
  constructor() {
    // Server initialization will be implemented in Phase 3
  }

  /**
   * Create a new lead
   */
  async createLead(_input: CreateLeadInput): Promise<LeadProfile> {
    // Implementation will use Supabase client
    throw new Error("Not implemented - Phase 3");
  }

  /**
   * Query leads
   */
  async queryLeads(_query: LeadQuery): Promise<LeadProfile[]> {
    // Implementation will use Supabase client
    throw new Error("Not implemented - Phase 3");
  }

  /**
   * Update a lead
   */
  async updateLead(_input: LeadUpdateInput): Promise<LeadProfile> {
    // Implementation will use Supabase client
    throw new Error("Not implemented - Phase 3");
  }

  /**
   * Start the MCP server
   */
  async start(): Promise<void> {
    // MCP server startup will be implemented
    throw new Error("Not implemented - Phase 3");
  }
}
