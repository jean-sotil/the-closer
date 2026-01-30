import { z } from "zod";

import type { PainPointType } from "@the-closer/shared";

/**
 * Performance analysis options
 */
export const AnalysisOptionsSchema = z.object({
  viewport: z.enum(["mobile", "desktop"]).default("mobile"),
  throttling: z.boolean().default(false),
  timeout: z.number().int().positive().default(60000),
  collectCoverage: z.boolean().default(true),
});

export type AnalysisOptions = z.output<typeof AnalysisOptionsSchema>;

/**
 * Core Web Vitals metrics
 */
export interface CoreWebVitals {
  // First Contentful Paint (ms)
  fcp: number | null;
  // Largest Contentful Paint (ms)
  lcp: number | null;
  // Cumulative Layout Shift (unitless)
  cls: number | null;
  // Interaction to Next Paint (ms) - replaces FID
  inp: number | null;
  // Time to Interactive (ms)
  tti: number | null;
  // Total Blocking Time (ms)
  tbt: number | null;
}

/**
 * Code coverage metrics
 */
export interface CoverageMetrics {
  // Unused JavaScript percentage (0-100)
  unusedJsPercent: number;
  // Unused CSS percentage (0-100)
  unusedCssPercent: number;
  // Unused JavaScript bytes
  unusedJsBytes: number;
  // Unused CSS bytes
  unusedCssBytes: number;
  // Total JavaScript bytes
  totalJsBytes: number;
  // Total CSS bytes
  totalCssBytes: number;
}

/**
 * Resource metrics
 */
export interface ResourceMetrics {
  // Total number of resources loaded
  resourceCount: number;
  // Total transfer size in bytes
  totalTransferSize: number;
  // Total decoded size in bytes
  totalDecodedSize: number;
  // Breakdown by resource type
  byType: {
    scripts: number;
    stylesheets: number;
    images: number;
    fonts: number;
    other: number;
  };
}

/**
 * Pain point detected during performance analysis
 */
export interface PerformancePainPoint {
  type: PainPointType;
  severity: "low" | "medium" | "high" | "critical";
  value: string;
  description: string;
  metric: string | undefined;
}

/**
 * Complete performance report
 */
export interface PerformanceReport {
  // URL analyzed
  url: string;
  // Overall performance score (0-100)
  score: number;
  // Core Web Vitals
  vitals: CoreWebVitals;
  // Code coverage (if collected)
  coverage: CoverageMetrics | undefined;
  // Resource metrics
  resources: ResourceMetrics;
  // Total page load time in ms
  loadTimeMs: number;
  // Detected pain points
  painPoints: PerformancePainPoint[];
  // Analysis timestamp
  analyzedAt: Date;
  // Analysis duration in ms
  durationMs: number;
  // Any errors encountered during analysis
  errors: string[];
}

/**
 * Thresholds for detecting performance issues
 */
export const PERFORMANCE_THRESHOLDS = {
  // LCP > 2.5s is poor
  LCP_POOR: 2500,
  // LCP > 4s is critical
  LCP_CRITICAL: 4000,
  // CLS > 0.1 is poor
  CLS_POOR: 0.1,
  // CLS > 0.25 is critical
  CLS_CRITICAL: 0.25,
  // FCP > 1.8s is poor
  FCP_POOR: 1800,
  // FCP > 3s is critical
  FCP_CRITICAL: 3000,
  // TTI > 3.8s is poor
  TTI_POOR: 3800,
  // TBT > 200ms is poor
  TBT_POOR: 200,
  // TBT > 600ms is critical
  TBT_CRITICAL: 600,
  // Unused code > 50% is poor
  UNUSED_CODE_POOR: 50,
  // Unused code > 70% is critical
  UNUSED_CODE_CRITICAL: 70,
  // Overall score thresholds
  SCORE_POOR: 50,
  SCORE_CRITICAL: 25,
} as const;
