#!/usr/bin/env node

/**
 * MCP Site Audit Server
 *
 * Performs comprehensive website audits including:
 * - Mobile responsiveness
 * - Performance metrics
 * - Accessibility compliance
 * - Code coverage analysis
 */

export { SiteAuditServer } from "./server.js";
export type { AuditConfig, AuditResult } from "./types.js";
