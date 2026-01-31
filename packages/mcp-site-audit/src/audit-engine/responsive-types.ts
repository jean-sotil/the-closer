import { z } from "zod";

/**
 * Viewport breakpoint configuration
 */
export interface ViewportBreakpoint {
  name: string;
  width: number;
  height: number;
  isMobile: boolean;
  hasTouch: boolean;
  deviceScaleFactor: number;
}

/**
 * Standard viewport breakpoints for testing
 */
export const VIEWPORT_BREAKPOINTS: Record<string, ViewportBreakpoint> = {
  mobile: {
    name: "mobile",
    width: 375,
    height: 812,
    isMobile: true,
    hasTouch: true,
    deviceScaleFactor: 2,
  },
  tablet: {
    name: "tablet",
    width: 768,
    height: 1024,
    isMobile: true,
    hasTouch: true,
    deviceScaleFactor: 2,
  },
  desktop: {
    name: "desktop",
    width: 1920,
    height: 1080,
    isMobile: false,
    hasTouch: false,
    deviceScaleFactor: 1,
  },
};

/**
 * Responsive issue types
 */
export type ResponsiveIssueType =
  | "HORIZONTAL_OVERFLOW"
  | "TOUCH_TARGET_TOO_SMALL"
  | "TEXT_TOO_SMALL"
  | "OVERLAPPING_ELEMENTS"
  | "FIXED_WIDTH_ELEMENTS"
  | "MISSING_VIEWPORT_META"
  | "LAYOUT_SHIFT"
  | "CONTENT_CLIPPED";

/**
 * Issue severity levels
 */
export type ResponsiveIssueSeverity = "low" | "medium" | "high" | "critical";

/**
 * Severity weights for scoring
 */
export const SEVERITY_WEIGHTS: Record<ResponsiveIssueSeverity, number> = {
  low: 2,
  medium: 5,
  high: 10,
  critical: 20,
};

/**
 * Single responsive issue
 */
export interface ResponsiveIssue {
  type: ResponsiveIssueType;
  severity: ResponsiveIssueSeverity;
  viewport: string;
  description: string;
  elementSelector: string | null;
  elementHtml: string | null;
  recommendation: string;
  details?: Record<string, unknown>;
}

/**
 * Element dimensions for analysis
 */
export interface ElementDimensions {
  selector: string;
  tagName: string;
  x: number;
  y: number;
  width: number;
  height: number;
  fontSize: number | null;
  isClickable: boolean;
}

/**
 * Viewport measurement results
 */
export interface ViewportMeasurements {
  viewportWidth: number;
  viewportHeight: number;
  documentWidth: number;
  documentHeight: number;
  hasHorizontalOverflow: boolean;
  overflowAmount: number;
  hasViewportMeta: boolean;
  viewportMetaContent: string | null;
}

/**
 * Screenshot by viewport
 */
export interface ViewportScreenshots {
  mobile: Uint8Array | null;
  tablet: Uint8Array | null;
  desktop: Uint8Array | null;
}

/**
 * Responsiveness report
 */
export interface ResponsivenessReport {
  url: string;
  analyzedAt: string;

  /** Overall responsiveness score (0-100) */
  score: number;

  /** Is the site mobile-friendly overall? */
  isMobileFriendly: boolean;

  /** All detected issues */
  issues: ResponsiveIssue[];

  /** Issues by viewport */
  issuesByViewport: Record<string, ResponsiveIssue[]>;

  /** Measurements per viewport */
  measurements: Record<string, ViewportMeasurements>;

  /** Screenshots per viewport */
  screenshots: ViewportScreenshots;

  /** Analysis duration in ms */
  durationMs: number;

  /** Summary statistics */
  summary: {
    totalIssues: number;
    criticalIssues: number;
    highIssues: number;
    mediumIssues: number;
    lowIssues: number;
    viewportsTested: number;
  };
}

/**
 * Responsiveness analysis options
 */
export const ResponsivenessOptionsSchema = z.object({
  /** Viewports to test */
  viewports: z.array(z.enum(["mobile", "tablet", "desktop"])).default(["mobile", "tablet", "desktop"]),

  /** Capture screenshots */
  captureScreenshots: z.boolean().default(true),

  /** Minimum touch target size (pixels) */
  minTouchTargetSize: z.number().int().positive().default(44),

  /** Minimum font size for mobile (pixels) */
  minMobileFontSize: z.number().positive().default(12),

  /** Navigation timeout */
  timeout: z.number().int().positive().default(30000),

  /** Wait after page load before analysis */
  waitAfterLoad: z.number().int().nonnegative().default(1000),
});

export type ResponsivenessOptions = z.output<typeof ResponsivenessOptionsSchema>;

/**
 * Default responsiveness options
 */
export const DEFAULT_RESPONSIVENESS_OPTIONS: ResponsivenessOptions = {
  viewports: ["mobile", "tablet", "desktop"],
  captureScreenshots: true,
  minTouchTargetSize: 44,
  minMobileFontSize: 12,
  timeout: 30000,
  waitAfterLoad: 1000,
};
