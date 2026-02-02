// Main components
export { AuditReport } from "./AuditReport";
export { CompareView } from "./CompareView";
export { ScoreCard } from "./ScoreCard";

// Section components
export { PerformanceSection } from "./PerformanceSection";
export { AccessibilitySection } from "./AccessibilitySection";
export { ResponsivenessSection } from "./ResponsivenessSection";
export { EvidenceGallery } from "./EvidenceGallery";

// Types and utilities
export type {
  ScoreLevel,
  ScoreCardData,
  WebVitalMetric,
  GroupedViolations,
  GalleryItem,
  AuditDelta,
  AuditReportProps,
  PerformanceSectionProps,
  AccessibilitySectionProps,
  ResponsivenessSectionProps,
  EvidenceGalleryProps,
  CompareViewProps,
  LucideIcon,
} from "./types";

export {
  getScoreLevel,
  getScoreLevelColor,
  getSeverityColor,
  groupViolationsBySeverity,
  formatTime,
  formatBytes,
} from "./types";
