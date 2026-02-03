// Audit service (orchestrator)
export {
  AuditService,
  type AuditOptions,
  type BatchAuditOptions,
  type BatchAuditProgress,
  type BatchAuditResult,
  type PartialAuditResult,
  DEFAULT_AUDIT_OPTIONS,
} from "./service.js";

// Performance analyzer
export { PerformanceAnalyzer } from "./performance.js";

// Accessibility scanner
export { AccessibilityScanner } from "./accessibility.js";

// Responsiveness analyzer
export { ResponsivenessAnalyzer } from "./responsive.js";

// Performance types
export {
  type AnalysisOptions,
  type CoreWebVitals,
  type CoverageMetrics,
  type ResourceMetrics,
  type PerformancePainPoint,
  type PerformanceReport,
  AnalysisOptionsSchema,
  PERFORMANCE_THRESHOLDS,
} from "./types.js";

// Accessibility types
export {
  type WCAGLevel,
  type AccessibilityScanOptions,
  type ViolationSeverity,
  type WCAGViolation,
  type WCAGRule,
  type AccessibilityNode,
  type LegalRiskAssessment,
  type AccessibilityReport,
  WCAGLevelSchema,
  AccessibilityScanOptionsSchema,
  WCAG_RULES,
  getRulesForLevel,
  SEVERITY_WEIGHTS,
} from "./accessibility-types.js";

// Evidence capture
export { EvidenceCapture } from "./evidence.js";

// Evidence types
export {
  type ViewportConfig,
  type EvidenceScreenshotOptions,
  type IssueLocation,
  type AnnotationOptions,
  type VideoRecordingOptions,
  type EvidenceCaptureResult,
  type TracingResult,
  ViewportConfigSchema,
  EvidenceScreenshotOptionsSchema,
  AnnotationOptionsSchema,
  VideoRecordingOptionsSchema,
  VIEWPORTS,
} from "./evidence-types.js";

// Responsiveness types
export {
  type ViewportBreakpoint,
  type ResponsiveIssue,
  type ResponsiveIssueType,
  type ResponsiveIssueSeverity,
  type ViewportMeasurements,
  type ViewportScreenshots,
  type ResponsivenessReport,
  type ResponsivenessOptions,
  type ElementDimensions,
  VIEWPORT_BREAKPOINTS,
  SEVERITY_WEIGHTS as RESPONSIVE_SEVERITY_WEIGHTS,
  ResponsivenessOptionsSchema,
  DEFAULT_RESPONSIVENESS_OPTIONS,
} from "./responsive-types.js";

// Resilient audit service
export {
  ResilientAuditService,
  isPartialResult,
  type ResilientAuditConfig,
  type ResilientAuditResult,
  type ResilientBatchResult,
  type PartialAuditResult as ResilientPartialAuditResult,
} from "./resilient-audit.js";
