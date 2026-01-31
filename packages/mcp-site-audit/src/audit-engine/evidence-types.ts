import { z } from "zod";

/**
 * Viewport configuration for screenshots
 */
export const ViewportConfigSchema = z.object({
  width: z.number().int().positive(),
  height: z.number().int().positive(),
  deviceScaleFactor: z.number().positive().default(1),
  isMobile: z.boolean().default(false),
  hasTouch: z.boolean().default(false),
  isLandscape: z.boolean().default(false),
});

export type ViewportConfig = z.output<typeof ViewportConfigSchema>;

/**
 * Predefined viewport configurations
 */
export const VIEWPORTS = {
  // Mobile devices
  MOBILE_IPHONE_X: {
    width: 375,
    height: 812,
    deviceScaleFactor: 3,
    isMobile: true,
    hasTouch: true,
    isLandscape: false,
  },
  MOBILE_IPHONE_SE: {
    width: 375,
    height: 667,
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
    isLandscape: false,
  },
  MOBILE_ANDROID: {
    width: 360,
    height: 800,
    deviceScaleFactor: 3,
    isMobile: true,
    hasTouch: true,
    isLandscape: false,
  },
  // Tablets
  TABLET_IPAD: {
    width: 768,
    height: 1024,
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
    isLandscape: false,
  },
  TABLET_IPAD_LANDSCAPE: {
    width: 1024,
    height: 768,
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
    isLandscape: true,
  },
  // Desktop
  DESKTOP_HD: {
    width: 1920,
    height: 1080,
    deviceScaleFactor: 1,
    isMobile: false,
    hasTouch: false,
    isLandscape: false,
  },
  DESKTOP_LAPTOP: {
    width: 1366,
    height: 768,
    deviceScaleFactor: 1,
    isMobile: false,
    hasTouch: false,
    isLandscape: false,
  },
} as const;

/**
 * Evidence screenshot options
 */
export const EvidenceScreenshotOptionsSchema = z.object({
  viewport: ViewportConfigSchema.optional(),
  fullPage: z.boolean().default(true),
  format: z.enum(["png", "jpeg", "webp"]).default("png"),
  quality: z.number().int().min(0).max(100).default(90),
  timeout: z.number().int().positive().default(30000),
  waitForSelector: z.string().optional(),
  delay: z.number().int().nonnegative().default(0),
});

export type EvidenceScreenshotOptions = z.output<typeof EvidenceScreenshotOptionsSchema>;

/**
 * Issue location for annotation
 */
export interface IssueLocation {
  // Element selector or XPath
  selector: string | undefined;
  // Bounding box coordinates
  boundingBox: {
    x: number;
    y: number;
    width: number;
    height: number;
  } | undefined;
  // Issue description
  description: string;
  // Severity affects annotation color
  severity: "critical" | "serious" | "moderate" | "minor";
}

/**
 * Annotation options
 */
export const AnnotationOptionsSchema = z.object({
  boxColor: z.string().default("#FF0000"),
  boxWidth: z.number().int().positive().default(3),
  showLabels: z.boolean().default(true),
  labelFontSize: z.number().int().positive().default(14),
  arrowLength: z.number().int().positive().default(50),
});

export type AnnotationOptions = z.output<typeof AnnotationOptionsSchema>;

/**
 * Video recording options
 */
export const VideoRecordingOptionsSchema = z.object({
  viewport: ViewportConfigSchema.optional(),
  duration: z.number().int().positive().default(10000),
  frameRate: z.number().int().positive().default(10),
  timeout: z.number().int().positive().default(60000),
  captureOnlyIfSlow: z.boolean().default(true),
  slowThresholdMs: z.number().int().positive().default(3000),
});

export type VideoRecordingOptions = z.output<typeof VideoRecordingOptionsSchema>;

/**
 * Evidence capture result
 */
export interface EvidenceCaptureResult {
  // Type of evidence
  type: "screenshot" | "video" | "trace";
  // Data buffer
  data: Uint8Array;
  // MIME type
  mimeType: string;
  // File extension
  extension: string;
  // Viewport used
  viewport: ViewportConfig;
  // Capture timestamp
  capturedAt: Date;
  // Page URL
  url: string;
  // Duration (for video)
  durationMs: number | undefined;
  // Load time measured
  loadTimeMs: number | undefined;
  // Whether this was a slow load capture
  isSlowLoadCapture: boolean;
}

/**
 * Tracing result with performance data
 */
export interface TracingResult {
  // Trace data (JSON)
  traceData: unknown;
  // Screenshot frames captured during trace
  frames: Array<{
    timestamp: number;
    data: Uint8Array;
  }>;
  // Total trace duration
  durationMs: number;
}
