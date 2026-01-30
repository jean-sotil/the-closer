#!/usr/bin/env node

/**
 * MCP Lead Storage Server
 *
 * Handles all Supabase database operations for
 * lead profiles and campaign data.
 */

export { LeadStorageServer } from "./server.js";
export type { LeadQuery, LeadUpdateInput } from "./types.js";
