#!/usr/bin/env node

/**
 * MCP Lead Discovery Server
 *
 * Scrapes Google Maps to discover local businesses
 * using network interception for stealth data extraction.
 */

export { LeadDiscoveryServer } from "./server.js";
export type { DiscoveryQuery, DiscoveredBusiness } from "./types.js";
