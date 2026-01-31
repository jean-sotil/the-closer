/* eslint-disable @typescript-eslint/no-explicit-any */
import type { Page } from "puppeteer";

import {
  type AccessibilityScanOptions,
  type AccessibilityReport,
  type AccessibilityNode,
  type WCAGViolation,
  type LegalRiskAssessment,
  type WCAGLevel,
  AccessibilityScanOptionsSchema,
  WCAG_RULES,
  getRulesForLevel,
  SEVERITY_WEIGHTS,
} from "./accessibility-types.js";

// Browser globals for page.evaluate()
declare const document: any;
declare const window: any;

/**
 * Accessibility scanner using Chrome's accessibility tree
 *
 * Detects WCAG violations by inspecting the accessibility tree
 * and performing automated accessibility checks.
 */
export class AccessibilityScanner {
  /**
   * Scan a page for accessibility violations
   */
  async scanAccessibility(
    page: Page,
    url: string,
    options: Partial<AccessibilityScanOptions> = {}
  ): Promise<AccessibilityReport> {
    const opts = AccessibilityScanOptionsSchema.parse(options);
    const startTime = Date.now();
    const errors: string[] = [];
    const violations: WCAGViolation[] = [];
    const passedChecks: string[] = [];

    try {
      // Navigate to the URL
      await page.goto(url, {
        waitUntil: "networkidle2",
        timeout: opts.timeout,
      });

      // Get the accessibility tree
      const tree = await this.getAccessibilityTree(page);

      if (tree) {
        // Run violation detectors
        this.detectViolations(tree, violations, opts.level);
      }

      // Run page-level checks
      await this.runPageLevelChecks(page, violations, passedChecks, opts);

      // Check contrast if enabled
      if (opts.checkContrast) {
        await this.checkColorContrast(page, violations);
      }

      // Check keyboard navigation if enabled
      if (opts.checkKeyboardNavigation) {
        await this.checkKeyboardNavigation(page, violations);
      }
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Unknown error during accessibility scan";
      errors.push(message);
    }

    // Calculate score
    const score = this.calculateScore(violations);

    // Assess legal risk
    const legalRisk = this.assessLegalRisk(violations);

    // Build summary
    const summary = this.buildSummary(violations, passedChecks);

    return {
      url,
      score,
      level: opts.level,
      violations,
      passedChecks: opts.includePassedChecks ? passedChecks : [],
      legalRisk,
      summary,
      scannedAt: new Date(),
      durationMs: Date.now() - startTime,
      errors,
    };
  }

  /**
   * Get the accessibility tree from the page
   */
  private async getAccessibilityTree(
    page: Page
  ): Promise<AccessibilityNode | null> {
    try {
      const snapshot = await page.accessibility.snapshot();
      return snapshot as AccessibilityNode | null;
    } catch {
      return null;
    }
  }

  /**
   * Traverse the accessibility tree and call callback for each node
   */
  private traverseTree(
    node: AccessibilityNode,
    callback: (node: AccessibilityNode, path: string) => void,
    path: string = ""
  ): void {
    const currentPath = path ? `${path} > ${node.role}` : node.role;
    callback(node, currentPath);

    if (node.children) {
      for (const child of node.children) {
        this.traverseTree(child, callback, currentPath);
      }
    }
  }

  /**
   * Detect violations by traversing the accessibility tree
   */
  private detectViolations(
    tree: AccessibilityNode,
    violations: WCAGViolation[],
    level: WCAGLevel
  ): void {
    const rules = getRulesForLevel(level);
    const ruleIds = new Set(rules.map((r) => r.id));

    this.traverseTree(tree, (node, path) => {
      // Check for images without alt text
      if (ruleIds.has("img-alt") && this.isImageWithoutAlt(node)) {
        violations.push(this.createViolation("img-alt", node, path));
      }

      // Check for buttons without labels
      if (ruleIds.has("button-name") && this.isButtonWithoutLabel(node)) {
        violations.push(this.createViolation("button-name", node, path));
      }

      // Check for links without labels
      if (ruleIds.has("link-name") && this.isLinkWithoutLabel(node)) {
        violations.push(this.createViolation("link-name", node, path));
      }

      // Check for form inputs without labels
      if (ruleIds.has("input-label") && this.isInputWithoutLabel(node)) {
        violations.push(this.createViolation("input-label", node, path));
      }
    });

    // Check for landmark presence
    if (ruleIds.has("landmark-main") && !this.hasMainLandmark(tree)) {
      violations.push({
        ...WCAG_RULES["landmark-main"]!,
        elementPath: undefined,
        htmlSnippet: undefined,
        role: undefined,
        name: undefined,
      });
    }
  }

  /**
   * Check if node is an image without alt text
   */
  private isImageWithoutAlt(node: AccessibilityNode): boolean {
    if (node.role !== "img" && node.role !== "image") {
      return false;
    }
    // Image has no accessible name
    return !node.name || node.name.trim() === "";
  }

  /**
   * Check if node is a button without label
   */
  private isButtonWithoutLabel(node: AccessibilityNode): boolean {
    if (node.role !== "button") {
      return false;
    }
    return !node.name || node.name.trim() === "";
  }

  /**
   * Check if node is a link without label
   */
  private isLinkWithoutLabel(node: AccessibilityNode): boolean {
    if (node.role !== "link") {
      return false;
    }
    return !node.name || node.name.trim() === "";
  }

  /**
   * Check if node is a form input without label
   */
  private isInputWithoutLabel(node: AccessibilityNode): boolean {
    const inputRoles = [
      "textbox",
      "searchbox",
      "combobox",
      "listbox",
      "spinbutton",
      "slider",
      "checkbox",
      "radio",
      "switch",
    ];

    if (!inputRoles.includes(node.role)) {
      return false;
    }

    return !node.name || node.name.trim() === "";
  }

  /**
   * Check if tree has a main landmark
   */
  private hasMainLandmark(tree: AccessibilityNode): boolean {
    let found = false;

    this.traverseTree(tree, (node) => {
      if (node.role === "main") {
        found = true;
      }
    });

    return found;
  }

  /**
   * Create a violation object from a rule and node
   */
  private createViolation(
    ruleId: string,
    node: AccessibilityNode,
    path: string
  ): WCAGViolation {
    const rule = WCAG_RULES[ruleId]!;

    return {
      criterion: rule.criterion,
      severity: rule.severity,
      description: rule.description,
      recommendation: rule.recommendation,
      elementPath: path,
      htmlSnippet: undefined, // Would need page.evaluate to get HTML
      role: node.role,
      name: node.name || undefined,
    };
  }

  /**
   * Run page-level accessibility checks
   */
  private async runPageLevelChecks(
    page: Page,
    violations: WCAGViolation[],
    passedChecks: string[],
    opts: AccessibilityScanOptions
  ): Promise<void> {
    const rules = getRulesForLevel(opts.level);
    const ruleIds = new Set(rules.map((r) => r.id));

    // Check for html lang attribute
    if (ruleIds.has("html-lang")) {
      const hasLang = await page.evaluate(() => {
        const html = document.documentElement;
        const lang = html.getAttribute("lang");
        return lang && lang.trim().length > 0;
      });

      if (!hasLang) {
        violations.push({
          ...WCAG_RULES["html-lang"]!,
          elementPath: "html",
          htmlSnippet: undefined,
          role: undefined,
          name: undefined,
        });
      } else {
        passedChecks.push("html-lang");
      }
    }

    // Check for document title
    if (ruleIds.has("document-title")) {
      const hasTitle = await page.evaluate(() => {
        return document.title && document.title.trim().length > 0;
      });

      if (!hasTitle) {
        violations.push({
          ...WCAG_RULES["document-title"]!,
          elementPath: "head > title",
          htmlSnippet: undefined,
          role: undefined,
          name: undefined,
        });
      } else {
        passedChecks.push("document-title");
      }
    }

    // Check for duplicate IDs
    if (ruleIds.has("duplicate-id")) {
      const duplicateIds = await page.evaluate(() => {
        const ids = Array.from(document.querySelectorAll("[id]")).map(
          (el: any) => el.id
        );
        const seen = new Set<string>();
        const duplicates: string[] = [];

        for (const id of ids) {
          if (seen.has(id)) {
            duplicates.push(id);
          }
          seen.add(id);
        }

        return duplicates;
      });

      if (duplicateIds.length > 0) {
        for (const id of duplicateIds) {
          violations.push({
            ...WCAG_RULES["duplicate-id"]!,
            elementPath: `#${id}`,
            htmlSnippet: undefined,
            role: undefined,
            name: `Duplicate ID: ${id}`,
          });
        }
      } else {
        passedChecks.push("duplicate-id");
      }
    }

    // Check heading order
    if (ruleIds.has("heading-order")) {
      const headingIssues = await page.evaluate(() => {
        const headings = Array.from(
          document.querySelectorAll("h1, h2, h3, h4, h5, h6")
        ) as any[];
        const issues: string[] = [];
        let lastLevel = 0;

        for (const heading of headings) {
          const level = parseInt(heading.tagName[1], 10);
          if (lastLevel > 0 && level > lastLevel + 1) {
            issues.push(
              `Heading jumps from h${lastLevel} to h${level}: "${heading.textContent?.slice(0, 50)}"`
            );
          }
          lastLevel = level;
        }

        return issues;
      });

      if (headingIssues.length > 0) {
        for (const issue of headingIssues) {
          violations.push({
            ...WCAG_RULES["heading-order"]!,
            elementPath: undefined,
            htmlSnippet: undefined,
            role: "heading",
            name: issue,
          });
        }
      } else {
        passedChecks.push("heading-order");
      }
    }
  }

  /**
   * Check color contrast (simplified check)
   */
  private async checkColorContrast(
    page: Page,
    violations: WCAGViolation[]
  ): Promise<void> {
    try {
      // Get text elements with potential contrast issues
      const contrastIssues = await page.evaluate(() => {
        const issues: Array<{ selector: string; text: string }> = [];

        // Check text elements
        const textElements = document.querySelectorAll(
          "p, span, a, h1, h2, h3, h4, h5, h6, li, td, th, label"
        );

        for (const el of textElements) {
          const style = window.getComputedStyle(el);
          const color = style.color;
          const bgColor = style.backgroundColor;

          // Simple check: if both colors are very similar, flag it
          // This is a simplified check - real contrast calculation is more complex
          if (color === bgColor && color !== "rgba(0, 0, 0, 0)") {
            const text = el.textContent?.trim().slice(0, 30) || "";
            if (text) {
              issues.push({
                selector: el.tagName.toLowerCase(),
                text,
              });
            }
          }
        }

        return issues.slice(0, 10); // Limit to 10 issues
      });

      for (const issue of contrastIssues) {
        violations.push({
          ...WCAG_RULES["color-contrast"]!,
          elementPath: issue.selector,
          htmlSnippet: undefined,
          role: undefined,
          name: `Text: "${issue.text}"`,
        });
      }
    } catch {
      // Ignore contrast check errors
    }
  }

  /**
   * Check keyboard navigation (basic check)
   */
  private async checkKeyboardNavigation(
    page: Page,
    violations: WCAGViolation[]
  ): Promise<void> {
    try {
      // Check for focusable elements without visible focus styles
      const focusIssues = await page.evaluate(() => {
        const issues: string[] = [];
        const focusableSelectors =
          'a[href], button, input, select, textarea, [tabindex]:not([tabindex="-1"])';
        const focusableElements = document.querySelectorAll(focusableSelectors);

        for (const el of focusableElements as any) {
          // Check if element has outline: none without alternative focus style
          const style = window.getComputedStyle(el);

          if (
            style.outline === "none" ||
            style.outline === "0px" ||
            style.outlineStyle === "none"
          ) {
            // Element might have no visible focus indicator
            // This is a simplified check
            const tag = el.tagName.toLowerCase();
            const text =
              el.textContent?.trim().slice(0, 20) ||
              el.placeholder ||
              "";
            if (issues.length < 5) {
              issues.push(`${tag}: "${text}"`);
            }
          }
        }

        return issues;
      });

      // Only report if there are many elements with no focus style
      if (focusIssues.length >= 3) {
        violations.push({
          ...WCAG_RULES["focus-visible"]!,
          elementPath: undefined,
          htmlSnippet: undefined,
          role: undefined,
          name: `${focusIssues.length} elements may lack visible focus indicators`,
        });
      }
    } catch {
      // Ignore keyboard navigation check errors
    }
  }

  /**
   * Calculate accessibility score (0-100)
   */
  private calculateScore(violations: WCAGViolation[]): number {
    let totalPenalty = 0;

    for (const violation of violations) {
      totalPenalty += SEVERITY_WEIGHTS[violation.severity];
    }

    // Score starts at 100 and decreases based on violations
    // Cap penalty at 100
    const score = Math.max(0, 100 - Math.min(totalPenalty, 100));

    return Math.round(score);
  }

  /**
   * Assess legal risk based on violations
   */
  private assessLegalRisk(violations: WCAGViolation[]): LegalRiskAssessment {
    const criticalViolations = violations.filter(
      (v) => v.severity === "critical"
    );
    const seriousViolations = violations.filter((v) => v.severity === "serious");

    // Calculate risk score
    const criticalCount = criticalViolations.length;
    const seriousCount = seriousViolations.length;
    const riskScore = Math.min(
      100,
      criticalCount * 25 + seriousCount * 10
    );

    // Determine risk level
    let level: "low" | "medium" | "high" | "critical";
    if (riskScore >= 75) {
      level = "critical";
    } else if (riskScore >= 50) {
      level = "high";
    } else if (riskScore >= 25) {
      level = "medium";
    } else {
      level = "low";
    }

    // Build compliance issues list
    const complianceIssues: string[] = [];

    if (criticalCount > 0) {
      complianceIssues.push(
        `${criticalCount} critical accessibility barrier(s) may violate ADA Title III`
      );
    }

    if (seriousCount > 0) {
      complianceIssues.push(
        `${seriousCount} serious issue(s) may affect Section 508 compliance`
      );
    }

    // Specific WCAG criteria issues
    const criteria = new Set(violations.map((v) => v.criterion));
    if (criteria.has("1.1.1")) {
      complianceIssues.push("Missing alt text violates WCAG 1.1.1");
    }
    if (criteria.has("4.1.2")) {
      complianceIssues.push(
        "Unlabeled interactive elements violate WCAG 4.1.2"
      );
    }

    // Generate recommendation
    let recommendation: string;
    if (level === "critical") {
      recommendation =
        "Immediate remediation required. Site has significant accessibility barriers that may expose the business to legal action.";
    } else if (level === "high") {
      recommendation =
        "Priority remediation recommended. Multiple accessibility issues should be addressed promptly.";
    } else if (level === "medium") {
      recommendation =
        "Remediation recommended. Some accessibility improvements would benefit users and reduce risk.";
    } else {
      recommendation =
        "Minor improvements suggested. Site has reasonable accessibility but could be enhanced.";
    }

    return {
      score: riskScore,
      level,
      criticalViolationCount: criticalCount,
      complianceIssues,
      recommendation,
    };
  }

  /**
   * Build summary statistics
   */
  private buildSummary(
    violations: WCAGViolation[],
    passedChecks: string[]
  ): AccessibilityReport["summary"] {
    const criticalViolations = violations.filter(
      (v) => v.severity === "critical"
    ).length;
    const seriousViolations = violations.filter(
      (v) => v.severity === "serious"
    ).length;
    const moderateViolations = violations.filter(
      (v) => v.severity === "moderate"
    ).length;
    const minorViolations = violations.filter(
      (v) => v.severity === "minor"
    ).length;

    const totalChecks = passedChecks.length + violations.length;

    return {
      totalChecks,
      passedChecks: passedChecks.length,
      failedChecks: violations.length,
      criticalViolations,
      seriousViolations,
      moderateViolations,
      minorViolations,
    };
  }
}
