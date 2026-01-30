// Types
export {
  type BrowserOptions,
  type ContextOptions,
  type NavigationOptions,
  type ScreenshotOptions,
  type BrowserPoolConfig,
  type StealthOptions,
  type ConnectionState,
  type BrowserMetrics,
  BrowserOptionsSchema,
  ContextOptionsSchema,
  NavigationOptionsSchema,
  ScreenshotOptionsSchema,
  BrowserPoolConfigSchema,
  StealthOptionsSchema,
} from "./types.js";

// Stealth utilities
export { applyStealthEvasions, getDefaultStealthOptions } from "./stealth.js";

// Client
export {
  PuppeteerClient,
  type ClientEventType,
  type ClientEventHandler,
  type ManagedPage,
  type ManagedContext,
} from "./client.js";

// Pool
export { BrowserPool } from "./pool.js";
