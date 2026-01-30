/* eslint-disable @typescript-eslint/no-explicit-any */
import type { Page, CDPSession, CoverageEntry } from "puppeteer";

// Browser globals for page.evaluate()
declare const performance: any;
declare const PerformanceObserver: any;

import {
  type AnalysisOptions,
  type PerformanceReport,
  type CoreWebVitals,
  type CoverageMetrics,
  type ResourceMetrics,
  type PerformancePainPoint,
  AnalysisOptionsSchema,
  PERFORMANCE_THRESHOLDS,
} from "./types.js";

/**
 * Performance analyzer using Chrome DevTools Protocol
 *
 * Collects Core Web Vitals, code coverage, and resource metrics
 * to generate a comprehensive performance report.
 */
export class PerformanceAnalyzer {
  /**
   * Analyze performance of a URL
   */
  async analyzePerformance(
    page: Page,
    url: string,
    options: Partial<AnalysisOptions> = {}
  ): Promise<PerformanceReport> {
    const opts = AnalysisOptionsSchema.parse(options);
    const startTime = Date.now();
    const errors: string[] = [];

    // Initialize report structure
    let vitals: CoreWebVitals = {
      fcp: null,
      lcp: null,
      cls: null,
      inp: null,
      tti: null,
      tbt: null,
    };
    let coverage: CoverageMetrics | undefined;
    let resources: ResourceMetrics = {
      resourceCount: 0,
      totalTransferSize: 0,
      totalDecodedSize: 0,
      byType: { scripts: 0, stylesheets: 0, images: 0, fonts: 0, other: 0 },
    };
    let loadTimeMs = 0;

    try {
      // Set viewport based on options
      await this.setViewport(page, opts.viewport);

      // Create CDP session for performance metrics
      const cdpSession = await page.createCDPSession();

      // Enable performance domain
      await cdpSession.send("Performance.enable");

      // Start coverage collection if enabled
      if (opts.collectCoverage) {
        await page.coverage.startJSCoverage();
        await page.coverage.startCSSCoverage();
      }

      // Enable network domain for resource tracking
      await cdpSession.send("Network.enable");

      // Navigate and measure load time
      const navigationStart = Date.now();
      await page.goto(url, {
        waitUntil: "networkidle0",
        timeout: opts.timeout,
      });
      loadTimeMs = Date.now() - navigationStart;

      // Collect Core Web Vitals
      vitals = await this.collectWebVitals(page, cdpSession);

      // Collect coverage metrics
      if (opts.collectCoverage) {
        coverage = await this.collectCoverage(page);
      }

      // Collect resource metrics
      resources = await this.collectResourceMetrics(page, cdpSession);

      // Clean up CDP session
      await cdpSession.detach();
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Unknown error during performance analysis";
      errors.push(message);
    }

    // Calculate overall score
    const score = this.calculateScore(vitals, coverage);

    // Detect pain points
    const painPoints = this.detectPainPoints(vitals, coverage, loadTimeMs);

    return {
      url,
      score,
      vitals,
      coverage,
      resources,
      loadTimeMs,
      painPoints,
      analyzedAt: new Date(),
      durationMs: Date.now() - startTime,
      errors,
    };
  }

  /**
   * Set viewport based on analysis options
   */
  private async setViewport(
    page: Page,
    viewport: "mobile" | "desktop"
  ): Promise<void> {
    if (viewport === "mobile") {
      await page.setViewport({
        width: 375,
        height: 812,
        deviceScaleFactor: 3,
        isMobile: true,
        hasTouch: true,
      });
    } else {
      await page.setViewport({
        width: 1920,
        height: 1080,
        deviceScaleFactor: 1,
        isMobile: false,
        hasTouch: false,
      });
    }
  }

  /**
   * Collect Core Web Vitals using Performance API and CDP
   */
  private async collectWebVitals(
    page: Page,
    cdpSession: CDPSession
  ): Promise<CoreWebVitals> {
    const vitals: CoreWebVitals = {
      fcp: null,
      lcp: null,
      cls: null,
      inp: null,
      tti: null,
      tbt: null,
    };

    try {
      // Get performance metrics from CDP
      const { metrics } = await cdpSession.send("Performance.getMetrics");
      const metricsMap = new Map(metrics.map((m) => [m.name, m.value]));

      // Extract available metrics
      const firstContentfulPaint = metricsMap.get("FirstContentfulPaint");
      const domContentLoaded = metricsMap.get("DomContentLoaded");
      const taskDuration = metricsMap.get("TaskDuration");

      if (firstContentfulPaint !== undefined) {
        // CDP returns values in seconds, convert to ms
        const navigationStart = metricsMap.get("NavigationStart") ?? 0;
        vitals.fcp = Math.round(
          (firstContentfulPaint - navigationStart) * 1000
        );
      }

      // Estimate TBT from task duration (rough approximation)
      if (taskDuration !== undefined) {
        // TBT is blocking time over 50ms threshold
        vitals.tbt = Math.round(Math.max(0, taskDuration * 1000 - 50));
      }

      // Get LCP, CLS from browser performance observer
      const lcpCls = await page.evaluate(() => {
        return new Promise<{ lcp: number | null; cls: number | null }>(
          (resolve) => {
            let lcp: number | null = null;
            let cls = 0;

            // LCP observer
            const lcpObserver = new PerformanceObserver((list: any) => {
              const entries = list.getEntries();
              const lastEntry = entries[entries.length - 1];
              if (lastEntry) {
                lcp = lastEntry.startTime;
              }
            });

            // CLS observer
            const clsObserver = new PerformanceObserver((list: any) => {
              for (const entry of list.getEntries()) {
                if (!entry.hadRecentInput) {
                  cls += entry.value;
                }
              }
            });

            try {
              lcpObserver.observe({
                type: "largest-contentful-paint" as any,
                buffered: true,
              });
            } catch {
              // LCP not supported
            }

            try {
              clsObserver.observe({ type: "layout-shift" as any, buffered: true });
            } catch {
              // CLS not supported
            }

            // Wait a bit for observers to collect data
            setTimeout(() => {
              lcpObserver.disconnect();
              clsObserver.disconnect();
              resolve({ lcp, cls });
            }, 500);
          }
        );
      });

      if (lcpCls.lcp !== null) {
        vitals.lcp = Math.round(lcpCls.lcp);
      }

      vitals.cls = lcpCls.cls;

      // TTI approximation using domContentLoaded
      if (domContentLoaded !== undefined) {
        const navigationStart = metricsMap.get("NavigationStart") ?? 0;
        vitals.tti = Math.round((domContentLoaded - navigationStart) * 1000);
      }
    } catch (error) {
      // Silently handle errors - some metrics may not be available
    }

    return vitals;
  }

  /**
   * Collect code coverage metrics
   */
  private async collectCoverage(page: Page): Promise<CoverageMetrics> {
    const jsCoverage = await page.coverage.stopJSCoverage();
    const cssCoverage = await page.coverage.stopCSSCoverage();

    const jsMetrics = this.calculateCoverageStats(jsCoverage);
    const cssMetrics = this.calculateCoverageStats(cssCoverage);

    return {
      unusedJsPercent: jsMetrics.unusedPercent,
      unusedCssPercent: cssMetrics.unusedPercent,
      unusedJsBytes: jsMetrics.unusedBytes,
      unusedCssBytes: cssMetrics.unusedBytes,
      totalJsBytes: jsMetrics.totalBytes,
      totalCssBytes: cssMetrics.totalBytes,
    };
  }

  /**
   * Calculate coverage statistics from coverage entries
   */
  private calculateCoverageStats(entries: CoverageEntry[]): {
    unusedPercent: number;
    unusedBytes: number;
    totalBytes: number;
  } {
    let totalBytes = 0;
    let usedBytes = 0;

    for (const entry of entries) {
      totalBytes += entry.text.length;

      for (const range of entry.ranges) {
        usedBytes += range.end - range.start;
      }
    }

    const unusedBytes = totalBytes - usedBytes;
    const unusedPercent =
      totalBytes > 0 ? Math.round((unusedBytes / totalBytes) * 100) : 0;

    return { unusedPercent, unusedBytes, totalBytes };
  }

  /**
   * Collect resource metrics
   */
  private async collectResourceMetrics(
    page: Page,
    _cdpSession: CDPSession
  ): Promise<ResourceMetrics> {
    // Get resource timing entries from the page
    const resourceData = await page.evaluate(() => {
      const entries = performance.getEntriesByType("resource") as any[];
      let scripts = 0,
        stylesheets = 0,
        images = 0,
        fonts = 0,
        other = 0;
      let totalTransfer = 0;
      let totalDecoded = 0;

      for (const entry of entries) {
        totalTransfer += entry.transferSize || 0;
        totalDecoded += entry.decodedBodySize || 0;

        if (entry.initiatorType === "script") scripts++;
        else if (entry.initiatorType === "link" || entry.initiatorType === "css")
          stylesheets++;
        else if (entry.initiatorType === "img") images++;
        else if (entry.name.match(/\.(woff2?|ttf|otf|eot)$/i)) fonts++;
        else other++;
      }

      return {
        count: entries.length,
        totalTransfer,
        totalDecoded,
        byType: { scripts, stylesheets, images, fonts, other },
      };
    });

    return {
      resourceCount: resourceData.count,
      totalTransferSize: resourceData.totalTransfer,
      totalDecodedSize: resourceData.totalDecoded,
      byType: resourceData.byType,
    };
  }

  /**
   * Calculate overall performance score (0-100)
   */
  private calculateScore(
    vitals: CoreWebVitals,
    coverage: CoverageMetrics | undefined
  ): number {
    let score = 100;
    const penalties: number[] = [];

    // LCP penalty
    if (vitals.lcp !== null) {
      if (vitals.lcp > PERFORMANCE_THRESHOLDS.LCP_CRITICAL) {
        penalties.push(40);
      } else if (vitals.lcp > PERFORMANCE_THRESHOLDS.LCP_POOR) {
        penalties.push(20);
      }
    }

    // CLS penalty
    if (vitals.cls !== null) {
      if (vitals.cls > PERFORMANCE_THRESHOLDS.CLS_CRITICAL) {
        penalties.push(30);
      } else if (vitals.cls > PERFORMANCE_THRESHOLDS.CLS_POOR) {
        penalties.push(15);
      }
    }

    // FCP penalty
    if (vitals.fcp !== null) {
      if (vitals.fcp > PERFORMANCE_THRESHOLDS.FCP_CRITICAL) {
        penalties.push(25);
      } else if (vitals.fcp > PERFORMANCE_THRESHOLDS.FCP_POOR) {
        penalties.push(10);
      }
    }

    // TBT penalty
    if (vitals.tbt !== null) {
      if (vitals.tbt > PERFORMANCE_THRESHOLDS.TBT_CRITICAL) {
        penalties.push(25);
      } else if (vitals.tbt > PERFORMANCE_THRESHOLDS.TBT_POOR) {
        penalties.push(10);
      }
    }

    // Coverage penalty
    if (coverage) {
      const avgUnused = (coverage.unusedJsPercent + coverage.unusedCssPercent) / 2;
      if (avgUnused > PERFORMANCE_THRESHOLDS.UNUSED_CODE_CRITICAL) {
        penalties.push(20);
      } else if (avgUnused > PERFORMANCE_THRESHOLDS.UNUSED_CODE_POOR) {
        penalties.push(10);
      }
    }

    // Apply penalties (diminishing returns)
    for (const penalty of penalties) {
      score = Math.max(0, score - penalty * (score / 100));
    }

    return Math.round(score);
  }

  /**
   * Detect pain points from performance data
   */
  private detectPainPoints(
    vitals: CoreWebVitals,
    coverage: CoverageMetrics | undefined,
    loadTimeMs: number
  ): PerformancePainPoint[] {
    const painPoints: PerformancePainPoint[] = [];

    // Slow load (LCP)
    if (vitals.lcp !== null) {
      if (vitals.lcp > PERFORMANCE_THRESHOLDS.LCP_CRITICAL) {
        painPoints.push({
          type: "SLOW_LOAD",
          severity: "critical",
          value: `${(vitals.lcp / 1000).toFixed(1)}s`,
          description: `Page takes ${(vitals.lcp / 1000).toFixed(1)} seconds to render main content`,
          metric: "LCP",
        });
      } else if (vitals.lcp > PERFORMANCE_THRESHOLDS.LCP_POOR) {
        painPoints.push({
          type: "SLOW_LOAD",
          severity: "high",
          value: `${(vitals.lcp / 1000).toFixed(1)}s`,
          description: `Page takes ${(vitals.lcp / 1000).toFixed(1)} seconds to render main content`,
          metric: "LCP",
        });
      }
    }

    // Layout shift (CLS)
    if (vitals.cls !== null) {
      if (vitals.cls > PERFORMANCE_THRESHOLDS.CLS_CRITICAL) {
        painPoints.push({
          type: "LAYOUT_SHIFT",
          severity: "critical",
          value: vitals.cls.toFixed(3),
          description: `Significant layout instability detected (CLS: ${vitals.cls.toFixed(3)})`,
          metric: "CLS",
        });
      } else if (vitals.cls > PERFORMANCE_THRESHOLDS.CLS_POOR) {
        painPoints.push({
          type: "LAYOUT_SHIFT",
          severity: "high",
          value: vitals.cls.toFixed(3),
          description: `Layout instability detected (CLS: ${vitals.cls.toFixed(3)})`,
          metric: "CLS",
        });
      }
    }

    // Code bloat (unused code)
    if (coverage) {
      if (coverage.unusedJsPercent > PERFORMANCE_THRESHOLDS.UNUSED_CODE_CRITICAL) {
        painPoints.push({
          type: "CODE_BLOAT",
          severity: "critical",
          value: `${coverage.unusedJsPercent}%`,
          description: `${coverage.unusedJsPercent}% of JavaScript is never executed`,
          metric: "JS Coverage",
        });
      } else if (coverage.unusedJsPercent > PERFORMANCE_THRESHOLDS.UNUSED_CODE_POOR) {
        painPoints.push({
          type: "CODE_BLOAT",
          severity: "high",
          value: `${coverage.unusedJsPercent}%`,
          description: `${coverage.unusedJsPercent}% of JavaScript is never executed`,
          metric: "JS Coverage",
        });
      }

      if (coverage.unusedCssPercent > PERFORMANCE_THRESHOLDS.UNUSED_CODE_CRITICAL) {
        painPoints.push({
          type: "CODE_BLOAT",
          severity: "critical",
          value: `${coverage.unusedCssPercent}%`,
          description: `${coverage.unusedCssPercent}% of CSS is unused`,
          metric: "CSS Coverage",
        });
      } else if (coverage.unusedCssPercent > PERFORMANCE_THRESHOLDS.UNUSED_CODE_POOR) {
        painPoints.push({
          type: "CODE_BLOAT",
          severity: "high",
          value: `${coverage.unusedCssPercent}%`,
          description: `${coverage.unusedCssPercent}% of CSS is unused`,
          metric: "CSS Coverage",
        });
      }
    }

    // Blocking time (TBT)
    if (vitals.tbt !== null && vitals.tbt > PERFORMANCE_THRESHOLDS.TBT_CRITICAL) {
      painPoints.push({
        type: "RENDER_BLOCKING",
        severity: "high",
        value: `${vitals.tbt}ms`,
        description: `${vitals.tbt}ms of blocking time affects interactivity`,
        metric: "TBT",
      });
    }

    // Overall slow load time
    if (loadTimeMs > 5000) {
      painPoints.push({
        type: "SLOW_LOAD",
        severity: loadTimeMs > 10000 ? "critical" : "high",
        value: `${(loadTimeMs / 1000).toFixed(1)}s`,
        description: `Total page load time is ${(loadTimeMs / 1000).toFixed(1)} seconds`,
        metric: "Load Time",
      });
    }

    return painPoints;
  }
}
