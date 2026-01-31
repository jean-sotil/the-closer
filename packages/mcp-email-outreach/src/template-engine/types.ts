import { z } from "zod";
import type { LeadProfile, AuditResult, PainPoint } from "@the-closer/shared";

// ============================================
// Email Context
// ============================================

/**
 * Context data used for template rendering
 */
export interface EmailContext {
  lead: LeadProfile;
  audit: AuditResult | null;
  calendarLink: string;
  customVariables?: Record<string, unknown>;
}

/**
 * Flattened variables available in templates
 */
export interface TemplateVariables {
  // Lead variables
  business_name: string;
  address: string;
  phone_number: string;
  website_url: string;
  rating: string;
  review_count: string;
  business_category: string;

  // Audit variables
  performance_score: string;
  accessibility_score: string;
  load_time: string;
  top_issue: string;
  top_issue_description: string;
  total_issues: string;
  evidence_link: string;
  mobile_friendly: string;

  // Action variables
  calendar_link: string;

  // Computed flags for conditionals
  has_audit: boolean;
  slow_load: boolean;
  poor_accessibility: boolean;
  poor_performance: boolean;
  has_mobile_issues: boolean;
  has_critical_issues: boolean;

  // Custom variables
  [key: string]: unknown;
}

// ============================================
// Rendered Email
// ============================================

/**
 * Fully rendered email ready to send
 */
export const RenderedEmailSchema = z.object({
  subject: z.string(),
  html: z.string(),
  text: z.string(),
});

export type RenderedEmail = z.output<typeof RenderedEmailSchema>;

// ============================================
// Template Storage
// ============================================

/**
 * Email template for storage
 */
export const StoredTemplateSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().optional(),
  subject: z.string(),
  htmlBody: z.string(),
  textBody: z.string().optional(),
  variables: z.array(z.string()).default([]),
  category: z.enum(["initial_outreach", "followup", "custom"]).default("custom"),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export type StoredTemplate = z.output<typeof StoredTemplateSchema>;

// ============================================
// Tone Settings
// ============================================

/**
 * Tone severity levels
 */
export type ToneSeverity = "urgent" | "normal" | "friendly";

/**
 * Word replacement map for tone adjustment
 */
export interface ToneReplacements {
  [original: string]: {
    urgent: string;
    normal: string;
    friendly: string;
  };
}

// ============================================
// Template Engine Configuration
// ============================================

/**
 * Configuration for the template engine
 */
export const TemplateEngineConfigSchema = z.object({
  // Storage options
  storageType: z.enum(["memory", "filesystem", "database"]).default("memory"),
  templatesPath: z.string().optional(),

  // Default settings
  defaultTone: z.enum(["urgent", "normal", "friendly"]).default("normal"),
  defaultCalendarLink: z.string().url().optional(),

  // Performance thresholds for conditionals
  slowLoadThresholdMs: z.number().positive().default(3000),
  poorPerformanceThreshold: z.number().int().min(0).max(100).default(50),
  poorAccessibilityThreshold: z.number().int().min(0).max(100).default(70),
});

export type TemplateEngineConfig = z.output<typeof TemplateEngineConfigSchema>;

// ============================================
// Error Types
// ============================================

/**
 * Template engine error codes
 */
export const TemplateEngineErrorCode = {
  TEMPLATE_NOT_FOUND: "TEMPLATE_NOT_FOUND",
  TEMPLATE_EXISTS: "TEMPLATE_EXISTS",
  RENDER_FAILED: "RENDER_FAILED",
  INVALID_TEMPLATE: "INVALID_TEMPLATE",
  MISSING_VARIABLE: "MISSING_VARIABLE",
  STORAGE_ERROR: "STORAGE_ERROR",
} as const;

export type TemplateEngineErrorCodeType =
  (typeof TemplateEngineErrorCode)[keyof typeof TemplateEngineErrorCode];

// ============================================
// Helper Functions
// ============================================

/**
 * Extract the top pain point from an audit
 */
export function getTopPainPoint(painPoints: PainPoint[]): PainPoint | null {
  if (painPoints.length === 0) return null;

  const severityOrder: Record<string, number> = {
    CRITICAL: 4,
    HIGH: 3,
    MEDIUM: 2,
    LOW: 1,
  };

  const sorted = [...painPoints].sort((a, b) => {
    const aScore = severityOrder[a.severity] ?? 0;
    const bScore = severityOrder[b.severity] ?? 0;
    return bScore - aScore;
  });

  return sorted[0] ?? null;
}

/**
 * Format milliseconds as human-readable time
 */
export function formatLoadTime(ms: number | undefined): string {
  if (ms === undefined || ms === null) return "N/A";
  const seconds = ms / 1000;
  return `${seconds.toFixed(1)} seconds`;
}

/**
 * Format a score as a percentage or "N/A"
 */
export function formatScore(score: number | undefined): string {
  if (score === undefined || score === null) return "N/A";
  return `${score}%`;
}
