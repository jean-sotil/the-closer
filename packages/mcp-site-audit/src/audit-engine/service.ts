import { randomUUID } from "node:crypto";

import type { Page } from "puppeteer";

import {
  type AuditResult,
  type PainPoint,
  type Severity,
  type LeadProfile,
  type WCAGViolation as SharedWCAGViolation,
  type ResponsiveIssue as SharedResponsiveIssue,
  AppError,
  ErrorCode,
} from "@the-closer/shared";
import type { LeadRepository, EvidenceStore, EvidenceFile } from "@the-closer/mcp-lead-storage";

import { PerformanceAnalyzer } from "./performance.js";
import { AccessibilityScanner } from "./accessibility.js";
import { ResponsivenessAnalyzer } from "./responsive.js";
import { EvidenceCapture } from "./evidence.js";
import type { PerformanceReport } from "./types.js";
import type { AccessibilityReport, WCAGViolation } from "./accessibility-types.js";
import type { ResponsivenessReport, ResponsiveIssue } from "./responsive-types.js";
import { VIEWPORTS } from "./evidence-types.js";
import { BrowserPool, type ManagedPage } from "../browser/index.js";

// ============================================
// Types
// ============================================

/**
 * Options for running a full audit
 */
export interface AuditOptions {
  /** Whether to run performance analysis */
  runPerformance?: boolean;
  /** Whether to run accessibility scan */
  runAccessibility?: boolean;
  /** Whether to run responsiveness analysis */
  runResponsiveness?: boolean;
  /** Whether to capture screenshots */
  captureScreenshots?: boolean;
  /** Whether to capture video on slow loads */
  captureVideoOnSlowLoad?: boolean;
  /** Timeout for each analysis in ms */
  timeout?: number;
  /** WCAG level for accessibility scan */
  wcagLevel?: "A" | "AA" | "AAA";
}

/**
 * Default audit options
 */
export const DEFAULT_AUDIT_OPTIONS: Required<AuditOptions> = {
  runPerformance: true,
  runAccessibility: true,
  runResponsiveness: true,
  captureScreenshots: true,
  captureVideoOnSlowLoad: true,
  timeout: 60000,
  wcagLevel: "AA",
};

/**
 * Options for batch audit processing
 */
export interface BatchAuditOptions extends AuditOptions {
  /** Maximum concurrent audits */
  concurrency?: number;
  /** Progress callback */
  onProgress?: (progress: BatchAuditProgress) => void;
  /** Whether to continue on individual failures */
  continueOnFailure?: boolean;
}

/**
 * Progress information for batch audits
 */
export interface BatchAuditProgress {
  total: number;
  completed: number;
  failed: number;
  current: string | null;
  percentComplete: number;
}

/**
 * Result of a batch audit
 */
export interface BatchAuditResult {
  total: number;
  successful: number;
  failed: number;
  results: Map<string, AuditResult | null>;
  errors: Map<string, Error>;
}

/**
 * Partial audit result for targeted audits
 */
export interface PartialAuditResult {
  leadId: string;
  url: string;
  auditedAt: string;
  performance?: PerformanceReport;
  accessibility?: AccessibilityReport;
  responsiveness?: ResponsivenessReport;
  painPoints: PainPoint[];
  error?: string;
}

/**
 * Audit status for lead tracking
 */
type AuditStatus = "pending" | "auditing" | "audited" | "blocked" | "failed";

// ============================================
// Audit Service
// ============================================

/**
 * AuditService - Orchestrates full audit workflow
 *
 * Integrates all analysis components with data persistence,
 * evidence storage, and lead status management.
 */
export class AuditService {
  private readonly performanceAnalyzer: PerformanceAnalyzer;
  private readonly accessibilityScanner: AccessibilityScanner;
  private readonly responsivenessAnalyzer: ResponsivenessAnalyzer;
  private readonly evidenceCapture: EvidenceCapture;
  private readonly leadRepository: LeadRepository;
  private readonly evidenceStore: EvidenceStore;
  private readonly browserPool: BrowserPool | undefined;

  constructor(dependencies: {
    performanceAnalyzer: PerformanceAnalyzer;
    accessibilityScanner: AccessibilityScanner;
    responsivenessAnalyzer: ResponsivenessAnalyzer;
    evidenceCapture: EvidenceCapture;
    leadRepository: LeadRepository;
    evidenceStore: EvidenceStore;
    browserPool?: BrowserPool;
  }) {
    this.performanceAnalyzer = dependencies.performanceAnalyzer;
    this.accessibilityScanner = dependencies.accessibilityScanner;
    this.responsivenessAnalyzer = dependencies.responsivenessAnalyzer;
    this.evidenceCapture = dependencies.evidenceCapture;
    this.leadRepository = dependencies.leadRepository;
    this.evidenceStore = dependencies.evidenceStore;
    this.browserPool = dependencies.browserPool;
  }

  // ============================================
  // Full Audit Flow
  // ============================================

  /**
   * Run a complete audit for a lead
   *
   * @param leadId - Lead UUID
   * @param page - Puppeteer page instance
   * @param options - Audit options
   * @returns Complete audit result
   */
  async runAudit(
    leadId: string,
    page: Page,
    options: AuditOptions = {}
  ): Promise<AuditResult> {
    const opts = { ...DEFAULT_AUDIT_OPTIONS, ...options };
    const startTime = Date.now();

    // Get lead from repository
    const lead = await this.leadRepository.getLeadById(leadId);
    if (!lead) {
      throw new AppError(`Lead not found: ${leadId}`, {
        code: ErrorCode.NOT_FOUND,
        statusCode: 404,
        context: { leadId },
      });
    }

    if (!lead.websiteUrl) {
      throw new AppError(`Lead has no website URL: ${leadId}`, {
        code: ErrorCode.VALIDATION_ERROR,
        statusCode: 400,
        context: { leadId },
      });
    }

    const url = lead.websiteUrl;
    const auditId = randomUUID();
    const errors: string[] = [];

    // Update lead status to auditing
    await this.updateLeadAuditStatus(leadId, "auditing");

    let performanceReport: PerformanceReport | undefined;
    let accessibilityReport: AccessibilityReport | undefined;
    let responsivenessReport: ResponsivenessReport | undefined;
    const evidenceFiles: EvidenceFile[] = [];

    try {
      // Run performance analysis
      if (opts.runPerformance) {
        try {
          performanceReport = await this.performanceAnalyzer.analyzePerformance(
            page,
            url,
            { timeout: opts.timeout }
          );
        } catch (error) {
          errors.push(`Performance analysis failed: ${error instanceof Error ? error.message : String(error)}`);
        }
      }

      // Run accessibility scan
      if (opts.runAccessibility) {
        try {
          accessibilityReport = await this.accessibilityScanner.scanAccessibility(
            page,
            url,
            { level: opts.wcagLevel, timeout: opts.timeout }
          );
        } catch (error) {
          errors.push(`Accessibility scan failed: ${error instanceof Error ? error.message : String(error)}`);
        }
      }

      // Run responsiveness analysis
      if (opts.runResponsiveness) {
        try {
          responsivenessReport = await this.responsivenessAnalyzer.analyzeResponsiveness(
            page,
            url,
            { timeout: opts.timeout }
          );
        } catch (error) {
          errors.push(`Responsiveness analysis failed: ${error instanceof Error ? error.message : String(error)}`);
        }
      }

      // Capture evidence
      if (opts.captureScreenshots) {
        try {
          const screenshots = await this.captureScreenshotEvidence(page, url);
          evidenceFiles.push(...screenshots);
        } catch (error) {
          errors.push(`Screenshot capture failed: ${error instanceof Error ? error.message : String(error)}`);
        }
      }

      // Capture video if site is slow
      if (opts.captureVideoOnSlowLoad && performanceReport) {
        const loadTime = performanceReport.loadTimeMs;
        if (loadTime > 3000) {
          try {
            const video = await this.evidenceCapture.recordPageLoad(
              page,
              url,
              { duration: Math.min(loadTime + 2000, 15000) }
            );
            if (video && video.data.length > 0) {
              evidenceFiles.push({
                buffer: Buffer.from(video.data),
                type: "video",
                filename: "slow-load.webm",
              });
            }
          } catch (error) {
            errors.push(`Video capture failed: ${error instanceof Error ? error.message : String(error)}`);
          }
        }
      }

      // Upload evidence to storage
      const evidenceUrls = await this.uploadEvidence(leadId, evidenceFiles);

      // Aggregate pain points
      const painPoints = this.aggregatePainPoints(
        performanceReport,
        accessibilityReport,
        responsivenessReport
      );

      // Build audit result
      const auditResult: AuditResult = {
        id: auditId,
        leadId,
        url,
        auditedAt: new Date().toISOString(),
        metrics: this.buildMetrics(performanceReport),
        wcagViolations: accessibilityReport
          ? this.convertWcagViolations(accessibilityReport.violations)
          : [],
        accessibilityScore: accessibilityReport?.score,
        mobileFriendly: responsivenessReport?.score !== undefined ? responsivenessReport.score >= 70 : true,
        responsiveIssues: responsivenessReport
          ? this.convertResponsiveIssues(responsivenessReport.issues)
          : [],
        testedViewports: [
          { width: 375, height: 812, deviceName: "Mobile" },
          { width: 768, height: 1024, deviceName: "Tablet" },
          { width: 1920, height: 1080, deviceName: "Desktop" },
        ],
        painPoints,
        evidence: evidenceUrls.map((ev) => ({
          type: ev.type as "screenshot" | "video" | "report",
          url: ev.url,
          description: ev.filename,
        })),
        durationMs: Date.now() - startTime,
        error: errors.length > 0 ? errors.join("; ") : undefined,
      };

      // Update lead with audit results
      await this.updateLeadWithAuditResult(leadId, auditResult, painPoints);

      return auditResult;
    } catch (error) {
      // Update lead status to failed
      await this.updateLeadAuditStatus(leadId, "failed");

      if (error instanceof AppError) {
        throw error;
      }

      throw new AppError(
        `Audit failed: ${error instanceof Error ? error.message : String(error)}`,
        {
          code: ErrorCode.INTERNAL_ERROR,
          statusCode: 500,
          context: { leadId, url },
          cause: error instanceof Error ? error : undefined,
        }
      );
    }
  }

  // ============================================
  // Partial Audits
  // ============================================

  /**
   * Run performance analysis only
   */
  async runPerformanceOnly(
    leadId: string,
    page: Page,
    options: { timeout?: number } = {}
  ): Promise<PartialAuditResult> {
    const lead = await this.getLeadOrThrow(leadId);
    const url = lead.websiteUrl!;

    try {
      const report = await this.performanceAnalyzer.analyzePerformance(
        page,
        url,
        { timeout: options.timeout ?? 60000 }
      );

      const painPoints = this.performancePainPointsToPainPoints(report.painPoints);

      return {
        leadId,
        url,
        auditedAt: new Date().toISOString(),
        performance: report,
        painPoints,
      };
    } catch (error) {
      return {
        leadId,
        url,
        auditedAt: new Date().toISOString(),
        painPoints: [],
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Run accessibility scan only
   */
  async runAccessibilityOnly(
    leadId: string,
    page: Page,
    options: { wcagLevel?: "A" | "AA" | "AAA"; timeout?: number } = {}
  ): Promise<PartialAuditResult> {
    const lead = await this.getLeadOrThrow(leadId);
    const url = lead.websiteUrl!;

    try {
      const report = await this.accessibilityScanner.scanAccessibility(
        page,
        url,
        { level: options.wcagLevel ?? "AA", timeout: options.timeout ?? 60000 }
      );

      const painPoints = this.accessibilityToPainPoints(report);

      return {
        leadId,
        url,
        auditedAt: new Date().toISOString(),
        accessibility: report,
        painPoints,
      };
    } catch (error) {
      return {
        leadId,
        url,
        auditedAt: new Date().toISOString(),
        painPoints: [],
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Run responsiveness analysis only
   */
  async runResponsivenessOnly(
    leadId: string,
    page: Page,
    options: { timeout?: number } = {}
  ): Promise<PartialAuditResult> {
    const lead = await this.getLeadOrThrow(leadId);
    const url = lead.websiteUrl!;

    try {
      const report = await this.responsivenessAnalyzer.analyzeResponsiveness(
        page,
        url,
        { timeout: options.timeout ?? 60000 }
      );

      const painPoints = this.responsivenessToPainPoints(report);

      return {
        leadId,
        url,
        auditedAt: new Date().toISOString(),
        responsiveness: report,
        painPoints,
      };
    } catch (error) {
      return {
        leadId,
        url,
        auditedAt: new Date().toISOString(),
        painPoints: [],
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  // ============================================
  // Batch Processing
  // ============================================

  /**
   * Run audits on multiple leads in parallel
   */
  async runBatchAudit(
    leadIds: string[],
    options: BatchAuditOptions = {}
  ): Promise<BatchAuditResult> {
    const concurrency = options.concurrency ?? 3;
    const continueOnFailure = options.continueOnFailure ?? true;
    const onProgress = options.onProgress;

    const results = new Map<string, AuditResult | null>();
    const errors = new Map<string, Error>();
    let completed = 0;
    let failed = 0;

    // Create a semaphore for concurrency control
    const semaphore = new Semaphore(concurrency);

    const reportProgress = (current: string | null) => {
      if (onProgress) {
        onProgress({
          total: leadIds.length,
          completed,
          failed,
          current,
          percentComplete: Math.round(((completed + failed) / leadIds.length) * 100),
        });
      }
    };

    // Process leads in parallel with concurrency limit
    const promises = leadIds.map(async (leadId) => {
      await semaphore.acquire();

      try {
        reportProgress(leadId);

        // Get a page from the pool or create one
        const page = await this.getPageForAudit();

        try {
          const result = await this.runAudit(leadId, page.page, options);
          results.set(leadId, result);
          completed++;
        } finally {
          await this.releasePage(page);
        }
      } catch (error) {
        failed++;
        errors.set(leadId, error instanceof Error ? error : new Error(String(error)));
        results.set(leadId, null);

        if (!continueOnFailure) {
          throw error;
        }
      } finally {
        semaphore.release();
        reportProgress(null);
      }
    });

    await Promise.allSettled(promises);

    return {
      total: leadIds.length,
      successful: completed,
      failed,
      results,
      errors,
    };
  }

  // ============================================
  // Pain Point Aggregation
  // ============================================

  /**
   * Aggregate pain points from all analysis results
   */
  aggregatePainPoints(
    performance?: PerformanceReport,
    accessibility?: AccessibilityReport,
    responsiveness?: ResponsivenessReport
  ): PainPoint[] {
    const painPoints: PainPoint[] = [];

    // Performance pain points
    if (performance) {
      painPoints.push(...this.performancePainPointsToPainPoints(performance.painPoints));
    }

    // Accessibility pain points
    if (accessibility) {
      painPoints.push(...this.accessibilityToPainPoints(accessibility));
    }

    // Responsiveness pain points
    if (responsiveness) {
      painPoints.push(...this.responsivenessToPainPoints(responsiveness));
    }

    // Sort by severity (critical first)
    return painPoints.sort((a, b) => {
      const severityOrder: Record<Severity, number> = {
        CRITICAL: 0,
        HIGH: 1,
        MEDIUM: 2,
        LOW: 3,
      };
      return severityOrder[a.severity] - severityOrder[b.severity];
    });
  }

  // ============================================
  // Private Helpers
  // ============================================

  private async getLeadOrThrow(leadId: string): Promise<LeadProfile> {
    const lead = await this.leadRepository.getLeadById(leadId);
    if (!lead) {
      throw new AppError(`Lead not found: ${leadId}`, {
        code: ErrorCode.NOT_FOUND,
        statusCode: 404,
        context: { leadId },
      });
    }
    if (!lead.websiteUrl) {
      throw new AppError(`Lead has no website URL: ${leadId}`, {
        code: ErrorCode.VALIDATION_ERROR,
        statusCode: 400,
        context: { leadId },
      });
    }
    return lead;
  }

  private async updateLeadAuditStatus(leadId: string, status: AuditStatus): Promise<void> {
    // Map audit status to notes or another field
    // Since we don't have a direct auditStatus field, we'll use notes
    await this.leadRepository.updateLead(leadId, {
      notes: `Audit status: ${status} at ${new Date().toISOString()}`,
    });
  }

  private async updateLeadWithAuditResult(
    leadId: string,
    audit: AuditResult,
    painPoints: PainPoint[]
  ): Promise<void> {
    await this.leadRepository.updateLead(leadId, {
      performanceScore: audit.metrics.performanceScore,
      accessibilityScore: audit.accessibilityScore,
      mobileFriendly: audit.mobileFriendly,
      painPoints,
      evidenceUrls: audit.evidence,
    });
  }

  private async captureScreenshotEvidence(page: Page, url: string): Promise<EvidenceFile[]> {
    const files: EvidenceFile[] = [];

    // Mobile screenshot
    try {
      const mobileResult = await this.evidenceCapture.captureScreenshot(
        page,
        url,
        { viewport: VIEWPORTS.MOBILE_IPHONE_X, format: "png", fullPage: true }
      );
      if (mobileResult && mobileResult.data.length > 0) {
        files.push({
          buffer: Buffer.from(mobileResult.data),
          type: "screenshot",
          filename: "mobile-screenshot.png",
        });
      }
    } catch {
      // Ignore individual screenshot failures
    }

    // Desktop screenshot
    try {
      const desktopResult = await this.evidenceCapture.captureScreenshot(
        page,
        url,
        { viewport: VIEWPORTS.DESKTOP_HD, format: "png", fullPage: true }
      );
      if (desktopResult && desktopResult.data.length > 0) {
        files.push({
          buffer: Buffer.from(desktopResult.data),
          type: "screenshot",
          filename: "desktop-screenshot.png",
        });
      }
    } catch {
      // Ignore individual screenshot failures
    }

    return files;
  }

  private async uploadEvidence(
    leadId: string,
    files: EvidenceFile[]
  ): Promise<Array<{ type: string; url: string; filename: string }>> {
    if (files.length === 0) {
      return [];
    }

    const uploaded = await this.evidenceStore.storeMultipleEvidence(leadId, files);
    return uploaded.map((ev) => ({
      type: ev.type,
      url: ev.url,
      filename: ev.filename,
    }));
  }

  private buildMetrics(
    performance?: PerformanceReport
  ): AuditResult["metrics"] {
    if (!performance) {
      return {
        performanceScore: 0,
        firstContentfulPaint: undefined,
        largestContentfulPaint: undefined,
        cumulativeLayoutShift: undefined,
      };
    }

    return {
      performanceScore: performance.score,
      firstContentfulPaint: performance.vitals.fcp ?? undefined,
      largestContentfulPaint: performance.vitals.lcp ?? undefined,
      cumulativeLayoutShift: performance.vitals.cls ?? undefined,
      timeToInteractive: performance.vitals.tti ?? undefined,
      loadComplete: performance.loadTimeMs,
      unusedJsBytes: performance.coverage?.unusedJsBytes,
      unusedCssBytes: performance.coverage?.unusedCssBytes,
      unusedJsPercent: performance.coverage?.unusedJsPercent,
      unusedCssPercent: performance.coverage?.unusedCssPercent,
      totalResourceSize: performance.resources.totalTransferSize,
      totalRequests: performance.resources.resourceCount,
    };
  }

  private performancePainPointsToPainPoints(
    performancePainPoints: PerformanceReport["painPoints"]
  ): PainPoint[] {
    return performancePainPoints.map((pp) => ({
      type: pp.type,
      value: pp.value,
      severity: this.mapSeverity(pp.severity),
      description: pp.description,
    }));
  }

  private accessibilityToPainPoints(report: AccessibilityReport): PainPoint[] {
    const painPoints: PainPoint[] = [];

    // Add pain point for critical violations
    const criticalCount = report.violations.filter((v) => v.severity === "critical").length;
    if (criticalCount > 0) {
      painPoints.push({
        type: "WCAG_VIOLATION",
        value: `${criticalCount} critical violations`,
        severity: "CRITICAL",
        description: `Found ${criticalCount} critical WCAG violations affecting accessibility`,
      });
    }

    // Add pain point for high legal risk
    if (report.legalRisk.score >= 75) {
      painPoints.push({
        type: "WCAG_VIOLATION",
        value: `Legal risk score: ${report.legalRisk.score}`,
        severity: "HIGH",
        description: report.legalRisk.recommendation,
      });
    }

    // Add pain point for low accessibility score
    if (report.score < 50) {
      painPoints.push({
        type: "WCAG_VIOLATION",
        value: `Accessibility score: ${report.score}`,
        severity: "HIGH",
        description: `Website accessibility score is below acceptable threshold`,
      });
    }

    return painPoints;
  }

  private responsivenessToPainPoints(report: ResponsivenessReport): PainPoint[] {
    const painPoints: PainPoint[] = [];

    // Check for horizontal overflow
    const overflowIssues = report.issues.filter(
      (i) => i.type === "HORIZONTAL_OVERFLOW" || i.type === "CONTENT_CLIPPED"
    );
    if (overflowIssues.length > 0) {
      painPoints.push({
        type: "BROKEN_MOBILE_UX",
        value: `Horizontal overflow on ${overflowIssues.length} viewport(s)`,
        severity: "HIGH",
        description: "Website content overflows horizontally on mobile devices",
      });
    }

    // Check for touch target issues
    const touchIssues = report.issues.filter((i) => i.type === "TOUCH_TARGET_TOO_SMALL");
    if (touchIssues.length > 0) {
      painPoints.push({
        type: "BROKEN_MOBILE_UX",
        value: `${touchIssues.length} small touch targets`,
        severity: "MEDIUM",
        description: "Interactive elements are too small for touch on mobile",
      });
    }

    // Check for text size issues
    const textIssues = report.issues.filter((i) => i.type === "TEXT_TOO_SMALL");
    if (textIssues.length > 0) {
      painPoints.push({
        type: "BROKEN_MOBILE_UX",
        value: `${textIssues.length} text readability issues`,
        severity: "MEDIUM",
        description: "Text is too small to read on mobile devices",
      });
    }

    // Overall responsiveness score
    if (report.score < 50) {
      painPoints.push({
        type: "BROKEN_MOBILE_UX",
        value: `Responsiveness score: ${report.score}`,
        severity: "HIGH",
        description: "Website has significant mobile responsiveness issues",
      });
    }

    return painPoints;
  }

  private mapSeverity(severity: "low" | "medium" | "high" | "critical"): Severity {
    const map: Record<string, Severity> = {
      low: "LOW",
      medium: "MEDIUM",
      high: "HIGH",
      critical: "CRITICAL",
    };
    return map[severity] ?? "MEDIUM";
  }

  /**
   * Convert internal WCAG violations to shared format
   */
  private convertWcagViolations(violations: WCAGViolation[]): SharedWCAGViolation[] {
    return violations.map((v) => ({
      ruleId: v.criterion ?? "unknown",
      severity: v.severity,
      description: v.description,
      elementSelector: v.elementPath ?? undefined,
      htmlSnippet: v.htmlSnippet ?? undefined,
      recommendation: v.recommendation,
      wcagCriteria: v.criterion ?? undefined,
      impact: v.role ?? undefined,
    }));
  }

  /**
   * Convert internal responsive issues to shared format
   */
  private convertResponsiveIssues(issues: ResponsiveIssue[]): SharedResponsiveIssue[] {
    // Map internal types to shared types
    const typeMap: Record<string, SharedResponsiveIssue["type"]> = {
      HORIZONTAL_OVERFLOW: "HORIZONTAL_SCROLL",
      TOUCH_TARGET_TOO_SMALL: "TOUCH_TARGET_TOO_SMALL",
      TEXT_TOO_SMALL: "TEXT_TOO_SMALL",
      OVERLAPPING_ELEMENTS: "CONTENT_OVERFLOW",
      FIXED_WIDTH_ELEMENTS: "FIXED_WIDTH_ELEMENTS",
      MISSING_VIEWPORT_META: "MISSING_VIEWPORT",
      LAYOUT_SHIFT: "CONTENT_OVERFLOW",
      CONTENT_CLIPPED: "CONTENT_OVERFLOW",
    };

    return issues
      .filter((i) => typeMap[i.type] !== undefined)
      .map((i) => {
        const viewportWidth = i.details?.["viewportWidth"];
        const actualWidth = i.details?.["actualWidth"];
        return {
          type: typeMap[i.type]!,
          description: i.description,
          elementSelector: i.elementSelector ?? undefined,
          viewportWidth: typeof viewportWidth === "number" ? viewportWidth : undefined,
          actualWidth: typeof actualWidth === "number" ? actualWidth : undefined,
          recommendation: i.recommendation,
        };
      });
  }

  private async getPageForAudit(): Promise<ManagedPage> {
    if (this.browserPool) {
      return this.browserPool.acquirePage();
    }

    // If no pool, throw an error
    throw new AppError(
      "Browser pool not available for batch processing",
      { code: ErrorCode.INTERNAL_ERROR, statusCode: 500 }
    );
  }

  private async releasePage(page: ManagedPage): Promise<void> {
    // The ManagedPage.close() method is wrapped to handle cleanup
    await page.close();
  }
}

// ============================================
// Utility Classes
// ============================================

/**
 * Simple semaphore for concurrency control
 */
class Semaphore {
  private permits: number;
  private waiting: Array<() => void> = [];

  constructor(permits: number) {
    this.permits = permits;
  }

  async acquire(): Promise<void> {
    if (this.permits > 0) {
      this.permits--;
      return;
    }

    return new Promise<void>((resolve) => {
      this.waiting.push(resolve);
    });
  }

  release(): void {
    const next = this.waiting.shift();
    if (next) {
      next();
    } else {
      this.permits++;
    }
  }
}
