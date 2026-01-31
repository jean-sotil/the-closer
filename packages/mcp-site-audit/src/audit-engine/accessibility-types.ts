import { z } from "zod";

/**
 * WCAG conformance levels
 */
export const WCAGLevelSchema = z.enum(["A", "AA", "AAA"]);
export type WCAGLevel = z.output<typeof WCAGLevelSchema>;

/**
 * Accessibility scan options
 */
export const AccessibilityScanOptionsSchema = z.object({
  level: WCAGLevelSchema.default("AA"),
  timeout: z.number().int().positive().default(30000),
  includePassedChecks: z.boolean().default(false),
  checkContrast: z.boolean().default(true),
  checkKeyboardNavigation: z.boolean().default(true),
});

export type AccessibilityScanOptions = z.output<typeof AccessibilityScanOptionsSchema>;

/**
 * WCAG violation severity
 */
export type ViolationSeverity = "critical" | "serious" | "moderate" | "minor";

/**
 * WCAG violation detected during scan
 */
export interface WCAGViolation {
  // WCAG criterion (e.g., "1.1.1", "4.1.2")
  criterion: string;
  // Severity level
  severity: ViolationSeverity;
  // Violation description
  description: string;
  // Remediation recommendation
  recommendation: string;
  // Element selector or path
  elementPath: string | undefined;
  // HTML snippet of the violating element
  htmlSnippet: string | undefined;
  // Node role from accessibility tree
  role: string | undefined;
  // Node name from accessibility tree
  name: string | undefined;
}

/**
 * WCAG rule definition
 */
export interface WCAGRule {
  id: string;
  criterion: string;
  level: WCAGLevel;
  description: string;
  recommendation: string;
  severity: ViolationSeverity;
}

/**
 * Accessibility tree node (simplified from Puppeteer)
 */
export interface AccessibilityNode {
  role: string;
  name: string;
  value?: string;
  description?: string;
  keyshortcuts?: string;
  roledescription?: string;
  valuetext?: string;
  disabled?: boolean;
  expanded?: boolean;
  focused?: boolean;
  modal?: boolean;
  multiline?: boolean;
  multiselectable?: boolean;
  readonly?: boolean;
  required?: boolean;
  selected?: boolean;
  checked?: boolean | "mixed";
  pressed?: boolean | "mixed";
  level?: number;
  valuemin?: number;
  valuemax?: number;
  autocomplete?: string;
  haspopup?: string;
  invalid?: string;
  orientation?: string;
  children?: AccessibilityNode[];
}

/**
 * Legal risk assessment
 */
export interface LegalRiskAssessment {
  // Overall risk score (0-100, higher = more risk)
  score: number;
  // Risk level
  level: "low" | "medium" | "high" | "critical";
  // Number of high-risk violations
  criticalViolationCount: number;
  // ADA/Section 508 compliance issues
  complianceIssues: string[];
  // Recommendation
  recommendation: string;
}

/**
 * Complete accessibility report
 */
export interface AccessibilityReport {
  // URL scanned
  url: string;
  // Overall accessibility score (0-100)
  score: number;
  // WCAG level tested against
  level: WCAGLevel;
  // Detected violations
  violations: WCAGViolation[];
  // Checks that passed (if requested)
  passedChecks: string[];
  // Legal risk assessment
  legalRisk: LegalRiskAssessment;
  // Summary statistics
  summary: {
    totalChecks: number;
    passedChecks: number;
    failedChecks: number;
    criticalViolations: number;
    seriousViolations: number;
    moderateViolations: number;
    minorViolations: number;
  };
  // Scan timestamp
  scannedAt: Date;
  // Scan duration in ms
  durationMs: number;
  // Any errors encountered
  errors: string[];
}

/**
 * WCAG rules database
 * Maps rule IDs to WCAG criteria and metadata
 */
export const WCAG_RULES: Record<string, WCAGRule> = {
  // Level A rules
  "img-alt": {
    id: "img-alt",
    criterion: "1.1.1",
    level: "A",
    description: "Images must have alternate text",
    recommendation: "Add an alt attribute describing the image content, or use alt=\"\" for decorative images",
    severity: "critical",
  },
  "button-name": {
    id: "button-name",
    criterion: "4.1.2",
    level: "A",
    description: "Buttons must have discernible text",
    recommendation: "Add visible text content, aria-label, or aria-labelledby to the button",
    severity: "critical",
  },
  "link-name": {
    id: "link-name",
    criterion: "4.1.2",
    level: "A",
    description: "Links must have discernible text",
    recommendation: "Add visible text content, aria-label, or aria-labelledby to the link",
    severity: "serious",
  },
  "input-label": {
    id: "input-label",
    criterion: "1.3.1",
    level: "A",
    description: "Form inputs must have associated labels",
    recommendation: "Add a <label> element with a for attribute matching the input's id, or use aria-label",
    severity: "critical",
  },
  "html-lang": {
    id: "html-lang",
    criterion: "3.1.1",
    level: "A",
    description: "HTML element must have a valid lang attribute",
    recommendation: "Add a lang attribute to the <html> element with a valid language code (e.g., lang=\"en\")",
    severity: "serious",
  },
  "document-title": {
    id: "document-title",
    criterion: "2.4.2",
    level: "A",
    description: "Document must have a title",
    recommendation: "Add a descriptive <title> element in the document <head>",
    severity: "serious",
  },
  "duplicate-id": {
    id: "duplicate-id",
    criterion: "4.1.1",
    level: "A",
    description: "ID attribute values must be unique",
    recommendation: "Ensure all id attribute values on the page are unique",
    severity: "serious",
  },
  "aria-valid-attr": {
    id: "aria-valid-attr",
    criterion: "4.1.2",
    level: "A",
    description: "ARIA attributes must be valid",
    recommendation: "Use only valid ARIA attributes as defined in the WAI-ARIA specification",
    severity: "serious",
  },
  "aria-required-children": {
    id: "aria-required-children",
    criterion: "4.1.2",
    level: "A",
    description: "ARIA roles must contain required children",
    recommendation: "Ensure elements with ARIA roles contain the required child elements",
    severity: "serious",
  },
  // Level AA rules
  "color-contrast": {
    id: "color-contrast",
    criterion: "1.4.3",
    level: "AA",
    description: "Text must have sufficient color contrast",
    recommendation: "Ensure text has a contrast ratio of at least 4.5:1 (3:1 for large text)",
    severity: "serious",
  },
  "landmark-main": {
    id: "landmark-main",
    criterion: "2.4.1",
    level: "AA",
    description: "Page should contain a main landmark",
    recommendation: "Add a <main> element or role=\"main\" to identify the main content area",
    severity: "moderate",
  },
  "landmark-banner": {
    id: "landmark-banner",
    criterion: "2.4.1",
    level: "AA",
    description: "Page should contain a banner landmark",
    recommendation: "Add a <header> element or role=\"banner\" to identify the page header",
    severity: "minor",
  },
  "heading-order": {
    id: "heading-order",
    criterion: "1.3.1",
    level: "AA",
    description: "Heading levels should not skip levels",
    recommendation: "Use headings in sequential order (h1, h2, h3, etc.) without skipping levels",
    severity: "moderate",
  },
  "focus-visible": {
    id: "focus-visible",
    criterion: "2.4.7",
    level: "AA",
    description: "Focus must be visible on interactive elements",
    recommendation: "Ensure focused elements have a visible focus indicator (outline, border, etc.)",
    severity: "serious",
  },
  "target-size": {
    id: "target-size",
    criterion: "2.5.5",
    level: "AAA",
    description: "Touch targets should be at least 44x44 pixels",
    recommendation: "Increase the size of interactive elements to at least 44x44 CSS pixels",
    severity: "moderate",
  },
} as const;

/**
 * Get rules for a specific WCAG level
 */
export function getRulesForLevel(level: WCAGLevel): WCAGRule[] {
  const levels: WCAGLevel[] =
    level === "A" ? ["A"] : level === "AA" ? ["A", "AA"] : ["A", "AA", "AAA"];

  return Object.values(WCAG_RULES).filter((rule) =>
    levels.includes(rule.level)
  );
}

/**
 * Severity weights for score calculation
 */
export const SEVERITY_WEIGHTS: Record<ViolationSeverity, number> = {
  critical: 25,
  serious: 15,
  moderate: 8,
  minor: 3,
} as const;
