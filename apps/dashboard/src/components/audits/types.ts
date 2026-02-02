import type {
  AuditResult,
  PerformanceMetrics,
  WCAGViolation,
  ResponsiveIssue,
  EvidenceItem,
  WCAGSeverity,
} from "@the-closer/shared";

/**
 * Score threshold levels for color coding
 */
export type ScoreLevel = "good" | "needs-improvement" | "poor";

/**
 * Lucide icon type (compatible with exactOptionalPropertyTypes)
 */
export type LucideIcon = React.ComponentType<{ className?: string | undefined }>;

/**
 * Score card data for summary display
 */
export interface ScoreCardData {
  label: string;
  score: number | undefined;
  level: ScoreLevel;
  icon: LucideIcon;
}

/**
 * Core Web Vital metric with threshold data
 */
export interface WebVitalMetric {
  name: string;
  value: number | undefined;
  unit: string;
  thresholds: {
    good: number;
    needsImprovement: number;
  };
}

/**
 * Grouped violations by severity
 */
export interface GroupedViolations {
  critical: WCAGViolation[];
  serious: WCAGViolation[];
  moderate: WCAGViolation[];
  minor: WCAGViolation[];
}

/**
 * Evidence item with metadata for gallery
 */
export interface GalleryItem {
  id: string;
  type: "screenshot" | "video" | "report" | "trace";
  url: string;
  thumbnail: string | undefined;
  description: string | undefined;
  deviceName: string | undefined;
  viewport: { width: number; height: number } | undefined;
}

/**
 * Comparison delta between two audits
 */
export interface AuditDelta {
  performanceScore: number | undefined;
  accessibilityScore: number | undefined;
  painPointsDelta: number;
  improvementAreas: string[];
  regressionAreas: string[];
}

/**
 * Props for AuditReport component
 */
export interface AuditReportProps {
  audit: AuditResult;
  onExportPdf: () => void;
  onCompare: (() => void) | undefined;
}

/**
 * Props for PerformanceSection component
 */
export interface PerformanceSectionProps {
  metrics: PerformanceMetrics;
}

/**
 * Props for AccessibilitySection component
 */
export interface AccessibilitySectionProps {
  violations: WCAGViolation[];
  score: number | undefined;
}

/**
 * Props for ResponsivenessSection component
 */
export interface ResponsivenessSectionProps {
  issues: ResponsiveIssue[];
  mobileFriendly: boolean;
  viewports: Array<{ width: number; height: number; deviceName?: string | undefined }>;
  evidence: EvidenceItem[];
}

/**
 * Props for EvidenceGallery component
 */
export interface EvidenceGalleryProps {
  items: EvidenceItem[];
  onItemClick: (item: EvidenceItem) => void;
}

/**
 * Props for CompareView component
 */
export interface CompareViewProps {
  auditA: AuditResult;
  auditB: AuditResult;
  onClose: () => void;
}

/**
 * Get score level from numeric score
 */
export function getScoreLevel(score: number | undefined): ScoreLevel {
  if (score === undefined) return "poor";
  if (score >= 90) return "good";
  if (score >= 50) return "needs-improvement";
  return "poor";
}

/**
 * Get color classes for score level
 */
export function getScoreLevelColor(level: ScoreLevel): {
  text: string;
  bg: string;
  ring: string;
} {
  switch (level) {
    case "good":
      return {
        text: "text-green-600",
        bg: "bg-green-100",
        ring: "ring-green-500",
      };
    case "needs-improvement":
      return {
        text: "text-yellow-600",
        bg: "bg-yellow-100",
        ring: "ring-yellow-500",
      };
    case "poor":
      return {
        text: "text-red-600",
        bg: "bg-red-100",
        ring: "ring-red-500",
      };
  }
}

/**
 * Get color for WCAG severity
 */
export function getSeverityColor(severity: WCAGSeverity): {
  text: string;
  bg: string;
  border: string;
} {
  switch (severity) {
    case "critical":
      return {
        text: "text-red-700",
        bg: "bg-red-50",
        border: "border-red-200",
      };
    case "serious":
      return {
        text: "text-orange-700",
        bg: "bg-orange-50",
        border: "border-orange-200",
      };
    case "moderate":
      return {
        text: "text-yellow-700",
        bg: "bg-yellow-50",
        border: "border-yellow-200",
      };
    case "minor":
      return {
        text: "text-blue-700",
        bg: "bg-blue-50",
        border: "border-blue-200",
      };
  }
}

/**
 * Group violations by severity
 */
export function groupViolationsBySeverity(
  violations: WCAGViolation[]
): GroupedViolations {
  return {
    critical: violations.filter((v) => v.severity === "critical"),
    serious: violations.filter((v) => v.severity === "serious"),
    moderate: violations.filter((v) => v.severity === "moderate"),
    minor: violations.filter((v) => v.severity === "minor"),
  };
}

/**
 * Format milliseconds to human-readable time
 */
export function formatTime(ms: number | undefined): string {
  if (ms === undefined) return "—";
  if (ms < 1000) return `${Math.round(ms)}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

/**
 * Format bytes to human-readable size
 */
export function formatBytes(bytes: number | undefined): string {
  if (bytes === undefined) return "—";
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)}MB`;
}
