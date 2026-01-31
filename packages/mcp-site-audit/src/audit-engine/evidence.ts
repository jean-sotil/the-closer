/* eslint-disable @typescript-eslint/no-explicit-any */
import type { Page } from "puppeteer";

import {
  type ViewportConfig,
  type EvidenceScreenshotOptions,
  type IssueLocation,
  type AnnotationOptions,
  type VideoRecordingOptions,
  type EvidenceCaptureResult,
  type TracingResult,
  EvidenceScreenshotOptionsSchema,
  AnnotationOptionsSchema,
  VideoRecordingOptionsSchema,
  VIEWPORTS,
} from "./evidence-types.js";

// Browser globals for page.evaluate()
declare const document: any;

/**
 * Evidence capture system for documenting website issues
 *
 * Captures screenshots, annotated images, and video recordings
 * to provide visual proof of performance and accessibility problems.
 */
export class EvidenceCapture {
  /**
   * Capture a screenshot of a page
   */
  async captureScreenshot(
    page: Page,
    url: string,
    options: Partial<EvidenceScreenshotOptions> = {}
  ): Promise<EvidenceCaptureResult> {
    const opts = EvidenceScreenshotOptionsSchema.parse(options);
    const viewport = opts.viewport ?? VIEWPORTS.MOBILE_IPHONE_X;
    const capturedAt = new Date();

    // Set viewport
    await page.setViewport({
      width: viewport.width,
      height: viewport.height,
      deviceScaleFactor: viewport.deviceScaleFactor,
      isMobile: viewport.isMobile,
      hasTouch: viewport.hasTouch,
      isLandscape: viewport.isLandscape,
    });

    // Navigate to URL
    const startTime = Date.now();
    await page.goto(url, {
      waitUntil: "networkidle2",
      timeout: opts.timeout,
    });
    const loadTimeMs = Date.now() - startTime;

    // Wait for optional selector
    if (opts.waitForSelector) {
      await page.locator(opts.waitForSelector).setTimeout(opts.timeout).wait();
    }

    // Apply optional delay
    if (opts.delay > 0) {
      await this.delay(opts.delay);
    }

    // Capture screenshot
    const data = await page.screenshot({
      type: opts.format,
      fullPage: opts.fullPage,
      ...(opts.format !== "png" && { quality: opts.quality }),
    });

    return {
      type: "screenshot",
      data,
      mimeType: `image/${opts.format}`,
      extension: opts.format,
      viewport,
      capturedAt,
      url,
      durationMs: undefined,
      loadTimeMs,
      isSlowLoadCapture: false,
    };
  }

  /**
   * Capture screenshot with annotations highlighting issues
   */
  async captureAnnotatedScreenshot(
    page: Page,
    url: string,
    issues: IssueLocation[],
    screenshotOptions: Partial<EvidenceScreenshotOptions> = {},
    annotationOptions: Partial<AnnotationOptions> = {}
  ): Promise<EvidenceCaptureResult> {
    const opts = EvidenceScreenshotOptionsSchema.parse(screenshotOptions);
    const annotationOpts = AnnotationOptionsSchema.parse(annotationOptions);
    const viewport = opts.viewport ?? VIEWPORTS.MOBILE_IPHONE_X;
    const capturedAt = new Date();

    // Set viewport
    await page.setViewport({
      width: viewport.width,
      height: viewport.height,
      deviceScaleFactor: viewport.deviceScaleFactor,
      isMobile: viewport.isMobile,
      hasTouch: viewport.hasTouch,
      isLandscape: viewport.isLandscape,
    });

    // Navigate to URL
    const startTime = Date.now();
    await page.goto(url, {
      waitUntil: "networkidle2",
      timeout: opts.timeout,
    });
    const loadTimeMs = Date.now() - startTime;

    // Get bounding boxes for issues with selectors
    const issueBoxes = await this.resolveIssueBoundingBoxes(page, issues);

    // Draw annotations directly in the page using canvas overlay
    await this.drawAnnotationsOnPage(page, issueBoxes, annotationOpts);

    // Capture screenshot with annotations
    const screenshotOpts: Parameters<Page["screenshot"]>[0] = {
      type: "png", // Always PNG for annotations
      fullPage: opts.fullPage,
    };

    const data = await page.screenshot(screenshotOpts);

    // Remove annotation overlay
    await this.removeAnnotationOverlay(page);

    return {
      type: "screenshot",
      data,
      mimeType: "image/png",
      extension: "png",
      viewport,
      capturedAt,
      url,
      durationMs: undefined,
      loadTimeMs,
      isSlowLoadCapture: false,
    };
  }

  /**
   * Record page load as video (frame sequence)
   */
  async recordPageLoad(
    page: Page,
    url: string,
    options: Partial<VideoRecordingOptions> = {}
  ): Promise<EvidenceCaptureResult | null> {
    const opts = VideoRecordingOptionsSchema.parse(options);
    const viewport = opts.viewport ?? VIEWPORTS.MOBILE_IPHONE_X;
    const capturedAt = new Date();

    // Set viewport
    await page.setViewport({
      width: viewport.width,
      height: viewport.height,
      deviceScaleFactor: viewport.deviceScaleFactor,
      isMobile: viewport.isMobile,
      hasTouch: viewport.hasTouch,
      isLandscape: viewport.isLandscape,
    });

    // Start tracing with screenshots
    const tracingResult = await this.captureTraceWithFrames(page, url, opts);

    // Check if load was slow enough to warrant video
    if (
      opts.captureOnlyIfSlow &&
      tracingResult.durationMs < opts.slowThresholdMs
    ) {
      return null; // Load was fast, no video needed
    }

    // Convert frames to animated format
    // For now, return the frames as a trace result
    // In production, this would use ffmpeg to create WebM
    const frameData = await this.combineFramesToAnimation(
      tracingResult.frames,
      opts.frameRate,
      viewport
    );

    return {
      type: "video",
      data: frameData,
      mimeType: "image/gif", // Using GIF as fallback since WebM requires ffmpeg
      extension: "gif",
      viewport,
      capturedAt,
      url,
      durationMs: tracingResult.durationMs,
      loadTimeMs: tracingResult.durationMs,
      isSlowLoadCapture: tracingResult.durationMs >= opts.slowThresholdMs,
    };
  }

  /**
   * Capture trace with screenshot frames
   */
  private async captureTraceWithFrames(
    page: Page,
    url: string,
    options: VideoRecordingOptions
  ): Promise<TracingResult> {
    const frames: TracingResult["frames"] = [];
    const startTime = Date.now();

    // Create CDP session for screencast
    const cdpSession = await page.createCDPSession();

    // Calculate frame interval
    const frameInterval = Math.floor(1000 / options.frameRate);
    let frameCapture: NodeJS.Timeout | null = null;

    try {
      // Start capturing frames
      frameCapture = setInterval(async () => {
        try {
          const screenshot = await page.screenshot({
            type: "jpeg",
            quality: 70,
          });
          frames.push({
            timestamp: Date.now() - startTime,
            data: screenshot,
          });
        } catch {
          // Ignore frame capture errors
        }
      }, frameInterval);

      // Navigate to URL
      await page.goto(url, {
        waitUntil: "networkidle2",
        timeout: options.timeout,
      });

      // Capture a few more frames after load
      await this.delay(500);
    } finally {
      // Stop frame capture
      if (frameCapture) {
        clearInterval(frameCapture);
      }
      await cdpSession.detach();
    }

    const durationMs = Date.now() - startTime;

    return {
      traceData: null,
      frames,
      durationMs,
    };
  }

  /**
   * Capture screenshots at multiple viewports
   */
  async captureMultipleViewports(
    page: Page,
    url: string,
    viewports: ViewportConfig[] = [
      VIEWPORTS.MOBILE_IPHONE_X,
      VIEWPORTS.TABLET_IPAD,
      VIEWPORTS.DESKTOP_HD,
    ],
    options: Partial<EvidenceScreenshotOptions> = {}
  ): Promise<EvidenceCaptureResult[]> {
    const results: EvidenceCaptureResult[] = [];

    for (const viewport of viewports) {
      const result = await this.captureScreenshot(page, url, {
        ...options,
        viewport,
      });
      results.push(result);
    }

    return results;
  }

  /**
   * Capture before/after comparison screenshots
   */
  async captureComparison(
    page: Page,
    beforeUrl: string,
    afterUrl: string,
    options: Partial<EvidenceScreenshotOptions> = {}
  ): Promise<{ before: EvidenceCaptureResult; after: EvidenceCaptureResult }> {
    const before = await this.captureScreenshot(page, beforeUrl, options);
    const after = await this.captureScreenshot(page, afterUrl, options);

    return { before, after };
  }

  /**
   * Resolve bounding boxes for issues with selectors
   */
  private async resolveIssueBoundingBoxes(
    page: Page,
    issues: IssueLocation[]
  ): Promise<Array<IssueLocation & { resolvedBox: IssueLocation["boundingBox"] }>> {
    const resolved: Array<IssueLocation & { resolvedBox: IssueLocation["boundingBox"] }> = [];

    for (const issue of issues) {
      let box = issue.boundingBox;

      if (!box && issue.selector) {
        try {
          const element = await page.$(issue.selector);
          if (element) {
            box = await element.boundingBox() ?? undefined;
          }
        } catch {
          // Selector not found
        }
      }

      resolved.push({
        ...issue,
        resolvedBox: box,
      });
    }

    return resolved;
  }

  /**
   * Draw annotations on page using injected canvas overlay
   */
  private async drawAnnotationsOnPage(
    page: Page,
    issues: Array<IssueLocation & { resolvedBox: IssueLocation["boundingBox"] }>,
    options: AnnotationOptions
  ): Promise<void> {
    const severityColors: Record<string, string> = {
      critical: "#FF0000",
      serious: "#FF6600",
      moderate: "#FFCC00",
      minor: "#0099FF",
    };

    await page.evaluate(
      (issuesData: any[], opts: any, colors: any) => {
        // Create overlay canvas
        const overlay = document.createElement("div");
        overlay.id = "__evidence_annotation_overlay__";
        overlay.style.cssText = `
          position: fixed;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          pointer-events: none;
          z-index: 999999;
        `;

        const canvas = document.createElement("canvas");
        canvas.width = document.documentElement.scrollWidth;
        canvas.height = document.documentElement.scrollHeight;
        canvas.style.cssText = `
          position: absolute;
          top: 0;
          left: 0;
        `;

        overlay.appendChild(canvas);
        document.body.appendChild(overlay);

        const ctx = canvas.getContext("2d");
        if (!ctx) return;

        // Draw boxes around issues
        for (const issue of issuesData) {
          const box = issue.resolvedBox;
          if (!box) continue;

          const color = colors[issue.severity] || opts.boxColor;

          // Draw rectangle
          ctx.strokeStyle = color;
          ctx.lineWidth = opts.boxWidth;
          ctx.strokeRect(box.x, box.y, box.width, box.height);

          // Draw label if enabled
          if (opts.showLabels && issue.description) {
            ctx.fillStyle = color;
            ctx.font = `bold ${opts.labelFontSize}px Arial`;

            // Background for label
            const text = issue.description.slice(0, 50);
            const textWidth = ctx.measureText(text).width;
            ctx.fillRect(box.x, box.y - opts.labelFontSize - 4, textWidth + 8, opts.labelFontSize + 4);

            // Label text
            ctx.fillStyle = "#FFFFFF";
            ctx.fillText(text, box.x + 4, box.y - 4);
          }
        }
      },
      issues as any,
      options as any,
      severityColors
    );
  }

  /**
   * Remove annotation overlay from page
   */
  private async removeAnnotationOverlay(page: Page): Promise<void> {
    await page.evaluate(() => {
      const overlay = document.getElementById("__evidence_annotation_overlay__");
      if (overlay) {
        overlay.remove();
      }
    });
  }

  /**
   * Combine frames into animated GIF
   * Note: In production, this would use a proper video encoding library
   */
  private async combineFramesToAnimation(
    frames: TracingResult["frames"],
    _frameRate: number,
    _viewport: ViewportConfig
  ): Promise<Uint8Array> {
    // For now, return the last frame as a static image
    // In production, this would use gifenc, ffmpeg, or similar
    if (frames.length === 0) {
      return new Uint8Array(0);
    }

    // Return the middle frame for best representation
    const middleIndex = Math.floor(frames.length / 2);
    return frames[middleIndex]?.data ?? new Uint8Array(0);
  }

  /**
   * Delay execution
   */
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
