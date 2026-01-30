import { z } from "zod";

/**
 * Browser launch options
 */
export const BrowserOptionsSchema = z.object({
  headless: z.boolean().default(true),
  timeout: z.number().int().positive().default(30000),
  slowMo: z.number().int().nonnegative().default(0),
  userAgent: z.string().optional(),
  proxyServer: z.string().optional(),
  executablePath: z.string().optional(),
});

export type BrowserOptions = z.infer<typeof BrowserOptionsSchema>;

/**
 * Context options for isolated browser sessions
 */
export const ContextOptionsSchema = z.object({
  viewport: z
    .object({
      width: z.number().int().positive(),
      height: z.number().int().positive(),
      deviceScaleFactor: z.number().positive().default(1),
      isMobile: z.boolean().default(false),
      hasTouch: z.boolean().default(false),
    })
    .default({
      width: 1920,
      height: 1080,
      deviceScaleFactor: 1,
      isMobile: false,
      hasTouch: false,
    }),
  userAgent: z.string().optional(),
  locale: z.string().default("en-US"),
  timezoneId: z.string().default("America/New_York"),
  geolocation: z
    .object({
      latitude: z.number(),
      longitude: z.number(),
      accuracy: z.number().optional(),
    })
    .optional(),
  permissions: z.array(z.string()).default([]),
  offline: z.boolean().default(false),
  httpCredentials: z
    .object({
      username: z.string(),
      password: z.string(),
    })
    .optional(),
});

export type ContextOptions = z.infer<typeof ContextOptionsSchema>;

/**
 * Navigation options
 */
export const NavigationOptionsSchema = z.object({
  timeout: z.number().int().positive().default(30000),
  waitUntil: z
    .enum(["load", "domcontentloaded", "networkidle0", "networkidle2"])
    .default("networkidle2"),
  referer: z.string().optional(),
});

export type NavigationOptions = z.infer<typeof NavigationOptionsSchema>;

/**
 * Screenshot options
 */
export const ScreenshotOptionsSchema = z.object({
  path: z.string().optional(),
  type: z.enum(["png", "jpeg", "webp"]).default("png"),
  quality: z.number().int().min(0).max(100).optional(),
  fullPage: z.boolean().default(false),
  clip: z
    .object({
      x: z.number(),
      y: z.number(),
      width: z.number(),
      height: z.number(),
    })
    .optional(),
  encoding: z.enum(["base64", "binary"]).default("binary"),
  captureBeyondViewport: z.boolean().default(true),
});

export type ScreenshotOptions = z.infer<typeof ScreenshotOptionsSchema>;

/**
 * Browser pool configuration
 */
export const BrowserPoolConfigSchema = z.object({
  maxBrowsers: z.number().int().positive().default(1),
  maxContextsPerBrowser: z.number().int().positive().default(10),
  browserIdleTimeout: z.number().int().positive().default(300000), // 5 minutes
  contextIdleTimeout: z.number().int().positive().default(60000), // 1 minute
  healthCheckInterval: z.number().int().positive().default(30000), // 30 seconds
});

export type BrowserPoolConfig = z.infer<typeof BrowserPoolConfigSchema>;

/**
 * Stealth mode options
 */
export const StealthOptionsSchema = z.object({
  enabled: z.boolean().default(true),
  evasions: z
    .object({
      webdriver: z.boolean().default(true),
      chromeApp: z.boolean().default(true),
      chromeRuntime: z.boolean().default(true),
      navigatorLanguages: z.boolean().default(true),
      navigatorPermissions: z.boolean().default(true),
      navigatorPlugins: z.boolean().default(true),
      webglVendor: z.boolean().default(true),
      windowOuterDimensions: z.boolean().default(true),
      consoleDebug: z.boolean().default(true),
    })
    .default({}),
});

export type StealthOptions = z.infer<typeof StealthOptionsSchema>;

/**
 * Connection state
 */
export type ConnectionState =
  | "disconnected"
  | "connecting"
  | "connected"
  | "reconnecting"
  | "error";

/**
 * Browser metrics
 */
export interface BrowserMetrics {
  contextsActive: number;
  pagesActive: number;
  memoryUsageBytes: number | undefined;
  uptime: number;
  requestsCompleted: number;
  errorsCount: number;
}
