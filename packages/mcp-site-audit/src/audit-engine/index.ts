// Performance analyzer
export { PerformanceAnalyzer } from "./performance.js";

// Accessibility scanner
export { AccessibilityScanner } from "./accessibility.js";

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
