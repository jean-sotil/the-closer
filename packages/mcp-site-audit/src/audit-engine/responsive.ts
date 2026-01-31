/* eslint-disable @typescript-eslint/no-explicit-any */
import type { Page } from "puppeteer";

import { BrowserError } from "@the-closer/shared";

import {
  type ViewportBreakpoint,
  type ResponsiveIssue,
  type ViewportMeasurements,
  type ViewportScreenshots,
  type ResponsivenessReport,
  type ResponsivenessOptions,
  type ElementDimensions,
  VIEWPORT_BREAKPOINTS,
  SEVERITY_WEIGHTS,
  ResponsivenessOptionsSchema,
} from "./responsive-types.js";

// Browser globals for page.evaluate
declare const document: any;
declare const window: any;
declare const Text: any;
declare const Array: any;

/**
 * ResponsivenessAnalyzer - Tests website layouts across device viewports
 *
 * Identifies responsive design failures including horizontal overflow,
 * touch target sizes, text readability, and layout shifts.
 */
export class ResponsivenessAnalyzer {
  /**
   * Analyze responsiveness across multiple viewports
   */
  async analyzeResponsiveness(
    page: Page,
    url: string,
    options: Partial<ResponsivenessOptions> = {}
  ): Promise<ResponsivenessReport> {
    const startTime = Date.now();
    const opts = ResponsivenessOptionsSchema.parse(options);

    const issues: ResponsiveIssue[] = [];
    const issuesByViewport: Record<string, ResponsiveIssue[]> = {};
    const measurements: Record<string, ViewportMeasurements> = {};
    const screenshots: ViewportScreenshots = {
      mobile: null,
      tablet: null,
      desktop: null,
    };

    try {
      // Test each viewport
      for (const viewportName of opts.viewports) {
        const viewport = VIEWPORT_BREAKPOINTS[viewportName];
        if (!viewport) continue;

        issuesByViewport[viewportName] = [];

        // Set viewport
        await page.setViewport({
          width: viewport.width,
          height: viewport.height,
          isMobile: viewport.isMobile,
          hasTouch: viewport.hasTouch,
          deviceScaleFactor: viewport.deviceScaleFactor,
        });

        // Navigate to URL
        await page.goto(url, {
          waitUntil: "networkidle2",
          timeout: opts.timeout,
        });

        // Wait for any animations/lazy loading
        await this.delay(opts.waitAfterLoad);

        // Take measurements
        const viewportMeasurements = await this.measureViewport(page, viewport);
        measurements[viewportName] = viewportMeasurements;

        // Detect issues for this viewport
        const viewportIssues = await this.detectIssues(
          page,
          viewport,
          viewportMeasurements,
          opts
        );

        issues.push(...viewportIssues);
        issuesByViewport[viewportName] = viewportIssues;

        // Capture screenshot
        if (opts.captureScreenshots) {
          const screenshot = await page.screenshot({
            type: "png",
            fullPage: false,
          });
          screenshots[viewportName as keyof ViewportScreenshots] = screenshot;
        }
      }

      // Calculate score
      const score = this.calculateScore(issues);
      const isMobileFriendly = this.isMobileFriendly(issues, measurements);

      // Build summary
      const summary = this.buildSummary(issues, opts.viewports.length);

      return {
        url,
        analyzedAt: new Date().toISOString(),
        score,
        isMobileFriendly,
        issues,
        issuesByViewport,
        measurements,
        screenshots,
        durationMs: Date.now() - startTime,
        summary,
      };
    } catch (error) {
      throw new BrowserError(
        `Responsiveness analysis failed: ${error instanceof Error ? error.message : String(error)}`,
        { cause: error instanceof Error ? error : undefined }
      );
    }
  }

  /**
   * Measure viewport dimensions and overflow
   */
  private async measureViewport(
    page: Page,
    viewport: ViewportBreakpoint
  ): Promise<ViewportMeasurements> {
    return page.evaluate((vp: ViewportBreakpoint) => {
      const viewportMeta = document.querySelector('meta[name="viewport"]');

      return {
        viewportWidth: vp.width,
        viewportHeight: vp.height,
        documentWidth: document.documentElement.scrollWidth,
        documentHeight: document.documentElement.scrollHeight,
        hasHorizontalOverflow: document.documentElement.scrollWidth > vp.width,
        overflowAmount: Math.max(0, document.documentElement.scrollWidth - vp.width),
        hasViewportMeta: viewportMeta !== null,
        viewportMetaContent: viewportMeta?.getAttribute("content") ?? null,
      };
    }, viewport);
  }

  /**
   * Detect responsive issues for a viewport
   */
  private async detectIssues(
    page: Page,
    viewport: ViewportBreakpoint,
    measurements: ViewportMeasurements,
    opts: ResponsivenessOptions
  ): Promise<ResponsiveIssue[]> {
    const issues: ResponsiveIssue[] = [];

    // Check for missing viewport meta (mobile only)
    if (viewport.isMobile && !measurements.hasViewportMeta) {
      issues.push({
        type: "MISSING_VIEWPORT_META",
        severity: "high",
        viewport: viewport.name,
        description: "Missing viewport meta tag for mobile devices",
        elementSelector: "head",
        elementHtml: null,
        recommendation:
          'Add <meta name="viewport" content="width=device-width, initial-scale=1"> to the document head',
      });
    }

    // Check for horizontal overflow
    if (measurements.hasHorizontalOverflow) {
      const overflowingElements = await this.findOverflowingElements(page, viewport.width);

      issues.push({
        type: "HORIZONTAL_OVERFLOW",
        severity: measurements.overflowAmount > 100 ? "critical" : "high",
        viewport: viewport.name,
        description: `Page content overflows by ${measurements.overflowAmount}px horizontally`,
        elementSelector: overflowingElements[0]?.selector ?? null,
        elementHtml: overflowingElements[0]?.tagName ?? null,
        recommendation:
          "Fix fixed-width elements or add overflow handling. Consider using max-width: 100% on images and containers.",
        details: {
          overflowAmount: measurements.overflowAmount,
          overflowingElements: overflowingElements.slice(0, 5),
        },
      });
    }

    // Check touch targets (mobile only)
    if (viewport.isMobile) {
      const smallTargets = await this.findSmallTouchTargets(page, opts.minTouchTargetSize);

      for (const target of smallTargets.slice(0, 10)) {
        issues.push({
          type: "TOUCH_TARGET_TOO_SMALL",
          severity: "medium",
          viewport: viewport.name,
          description: `Touch target is ${target.width}x${target.height}px, below minimum ${opts.minTouchTargetSize}x${opts.minTouchTargetSize}px`,
          elementSelector: target.selector,
          elementHtml: target.tagName,
          recommendation: `Increase the size of clickable elements to at least ${opts.minTouchTargetSize}x${opts.minTouchTargetSize}px for better touch accessibility`,
          details: {
            width: target.width,
            height: target.height,
            minRequired: opts.minTouchTargetSize,
          },
        });
      }

      // Check text size
      const smallTextElements = await this.findSmallText(page, opts.minMobileFontSize);

      if (smallTextElements.length > 0) {
        issues.push({
          type: "TEXT_TOO_SMALL",
          severity: "medium",
          viewport: viewport.name,
          description: `Found ${smallTextElements.length} text elements with font size below ${opts.minMobileFontSize}px`,
          elementSelector: smallTextElements[0]?.selector ?? null,
          elementHtml: smallTextElements[0]?.tagName ?? null,
          recommendation: `Increase font size to at least ${opts.minMobileFontSize}px for mobile readability`,
          details: {
            count: smallTextElements.length,
            examples: smallTextElements.slice(0, 5),
          },
        });
      }
    }

    // Check for fixed-width elements
    const fixedWidthElements = await this.findFixedWidthElements(page, viewport.width);

    if (fixedWidthElements.length > 0) {
      issues.push({
        type: "FIXED_WIDTH_ELEMENTS",
        severity: "medium",
        viewport: viewport.name,
        description: `Found ${fixedWidthElements.length} elements with fixed widths larger than viewport`,
        elementSelector: fixedWidthElements[0]?.selector ?? null,
        elementHtml: fixedWidthElements[0]?.tagName ?? null,
        recommendation:
          "Use relative units (%, vw) or max-width instead of fixed pixel widths",
        details: {
          count: fixedWidthElements.length,
          elements: fixedWidthElements.slice(0, 5),
        },
      });
    }

    return issues;
  }

  /**
   * Find elements causing horizontal overflow
   */
  private async findOverflowingElements(
    page: Page,
    viewportWidth: number
  ): Promise<ElementDimensions[]> {
    return page.evaluate((vpWidth: number) => {
      const elements: ElementDimensions[] = [];
      const allElements = document.querySelectorAll("*");

      for (const el of allElements) {
        const rect = el.getBoundingClientRect();
        if (rect.right > vpWidth && rect.width > 0) {
          elements.push({
            selector: el.tagName.toLowerCase() + (el.id ? `#${el.id}` : "") + (el.className ? `.${el.className.split(" ")[0]}` : ""),
            tagName: el.tagName.toLowerCase(),
            x: rect.x,
            y: rect.y,
            width: rect.width,
            height: rect.height,
            fontSize: null,
            isClickable: false,
          });
        }
      }

      return elements.slice(0, 20);
    }, viewportWidth);
  }

  /**
   * Find touch targets that are too small
   */
  private async findSmallTouchTargets(
    page: Page,
    minSize: number
  ): Promise<ElementDimensions[]> {
    return page.evaluate((min: number) => {
      const elements: ElementDimensions[] = [];
      const clickables = document.querySelectorAll(
        'a, button, input, select, textarea, [role="button"], [onclick]'
      );

      for (const el of clickables) {
        const rect = el.getBoundingClientRect();
        const style = window.getComputedStyle(el);

        // Skip hidden elements
        if (style.display === "none" || style.visibility === "hidden") continue;
        if (rect.width === 0 || rect.height === 0) continue;

        if (rect.width < min || rect.height < min) {
          elements.push({
            selector: el.tagName.toLowerCase() + (el.id ? `#${el.id}` : "") + (el.className ? `.${el.className.split(" ")[0]}` : ""),
            tagName: el.tagName.toLowerCase(),
            x: rect.x,
            y: rect.y,
            width: Math.round(rect.width),
            height: Math.round(rect.height),
            fontSize: null,
            isClickable: true,
          });
        }
      }

      return elements;
    }, minSize);
  }

  /**
   * Find text elements with font size too small
   */
  private async findSmallText(
    page: Page,
    minFontSize: number
  ): Promise<ElementDimensions[]> {
    return page.evaluate((min: number) => {
      const elements: ElementDimensions[] = [];
      const textElements = document.querySelectorAll("p, span, a, li, td, th, label, div");

      for (const el of textElements) {
        const style = window.getComputedStyle(el);
        const fontSize = parseFloat(style.fontSize);

        // Skip hidden elements
        if (style.display === "none" || style.visibility === "hidden") continue;

        // Only check elements with actual text content
        const hasText = el.textContent?.trim().length > 0;
        if (!hasText) continue;

        // Check if this element has its own text (not just child text)
        const hasDirectText = Array.from(el.childNodes).some(
          (node: any) => node.nodeType === 3 && node.textContent?.trim()
        );
        if (!hasDirectText) continue;

        if (fontSize < min) {
          const rect = el.getBoundingClientRect();
          elements.push({
            selector: el.tagName.toLowerCase() + (el.id ? `#${el.id}` : "") + (el.className ? `.${el.className.split(" ")[0]}` : ""),
            tagName: el.tagName.toLowerCase(),
            x: rect.x,
            y: rect.y,
            width: rect.width,
            height: rect.height,
            fontSize,
            isClickable: false,
          });
        }
      }

      return elements.slice(0, 20);
    }, minFontSize);
  }

  /**
   * Find elements with fixed widths larger than viewport
   */
  private async findFixedWidthElements(
    page: Page,
    viewportWidth: number
  ): Promise<ElementDimensions[]> {
    return page.evaluate((vpWidth: number) => {
      const elements: ElementDimensions[] = [];
      const allElements = document.querySelectorAll("*");

      for (const el of allElements) {
        const style = window.getComputedStyle(el);
        const width = style.width;

        // Check for fixed pixel widths
        if (width.endsWith("px")) {
          const pxWidth = parseFloat(width);
          if (pxWidth > vpWidth) {
            const rect = el.getBoundingClientRect();
            elements.push({
              selector: el.tagName.toLowerCase() + (el.id ? `#${el.id}` : "") + (el.className ? `.${el.className.split(" ")[0]}` : ""),
              tagName: el.tagName.toLowerCase(),
              x: rect.x,
              y: rect.y,
              width: pxWidth,
              height: rect.height,
              fontSize: null,
              isClickable: false,
            });
          }
        }
      }

      return elements.slice(0, 10);
    }, viewportWidth);
  }

  /**
   * Calculate responsiveness score (0-100)
   */
  private calculateScore(issues: ResponsiveIssue[]): number {
    if (issues.length === 0) return 100;

    let deductions = 0;

    for (const issue of issues) {
      deductions += SEVERITY_WEIGHTS[issue.severity];
    }

    // Cap deductions at 100
    return Math.max(0, 100 - Math.min(100, deductions));
  }

  /**
   * Determine if site is mobile-friendly
   */
  private isMobileFriendly(
    issues: ResponsiveIssue[],
    measurements: Record<string, ViewportMeasurements>
  ): boolean {
    // Not mobile-friendly if:
    // 1. Missing viewport meta
    // 2. Horizontal overflow on mobile
    // 3. Has critical issues

    const mobileIssues = issues.filter((i) => i.viewport === "mobile");
    const hasCritical = mobileIssues.some((i) => i.severity === "critical");
    const hasMissingViewport = mobileIssues.some(
      (i) => i.type === "MISSING_VIEWPORT_META"
    );
    const hasOverflow = measurements["mobile"]?.hasHorizontalOverflow ?? false;

    return !hasCritical && !hasMissingViewport && !hasOverflow;
  }

  /**
   * Build summary statistics
   */
  private buildSummary(
    issues: ResponsiveIssue[],
    viewportCount: number
  ): ResponsivenessReport["summary"] {
    return {
      totalIssues: issues.length,
      criticalIssues: issues.filter((i) => i.severity === "critical").length,
      highIssues: issues.filter((i) => i.severity === "high").length,
      mediumIssues: issues.filter((i) => i.severity === "medium").length,
      lowIssues: issues.filter((i) => i.severity === "low").length,
      viewportsTested: viewportCount,
    };
  }

  /**
   * Generate side-by-side comparison image
   * Note: This is a placeholder - actual implementation would use sharp or canvas
   */
  async generateComparisonImage(
    mobileScreenshot: Uint8Array,
    _desktopScreenshot: Uint8Array
  ): Promise<Uint8Array> {
    // In a real implementation, we would use sharp or canvas to combine images
    // For now, return the mobile screenshot as placeholder
    return mobileScreenshot;
  }

  /**
   * Delay helper
   */
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
