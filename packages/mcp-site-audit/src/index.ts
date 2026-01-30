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

// Browser client and utilities
export {
  PuppeteerClient,
  BrowserPool,
  applyStealthEvasions,
  getDefaultStealthOptions,
  type BrowserOptions,
  type ContextOptions,
  type NavigationOptions,
  type ScreenshotOptions,
  type BrowserPoolConfig,
  type StealthOptions,
  type ConnectionState,
  type BrowserMetrics,
  type ManagedPage,
  type ManagedContext,
} from "./browser/index.js";

// Performance analysis
export {
  PerformanceAnalyzer,
  type AnalysisOptions,
  type CoreWebVitals,
  type CoverageMetrics,
  type ResourceMetrics,
  type PerformancePainPoint,
  type PerformanceReport,
  AnalysisOptionsSchema,
  PERFORMANCE_THRESHOLDS,
} from "./audit-engine/index.js";
