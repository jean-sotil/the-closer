/**
 * Application Constants
 *
 * Rate limits, thresholds, and default values for The Closer.
 */

// ============================================
// Rate Limiting
// ============================================

/**
 * Delay between Google Maps requests to avoid detection (ms)
 */
export const MAPS_REQUEST_DELAY_MS = 2000;

/**
 * Delay between website audit requests (ms)
 */
export const AUDIT_REQUEST_DELAY_MS = 3000;

/**
 * Maximum concurrent browser contexts for parallel auditing
 */
export const MAX_CONCURRENT_AUDITS = 5;

/**
 * Daily email send limit per campaign
 */
export const DEFAULT_DAILY_EMAIL_LIMIT = 50;

/**
 * Delay between email sends (ms)
 */
export const EMAIL_SEND_DELAY_MS = 1000;

// ============================================
// Lighthouse & Performance Thresholds
// ============================================

/**
 * Sites below this score are flagged as opportunities
 */
export const PERFORMANCE_SCORE_THRESHOLD = 50;

/**
 * Sites below this score have accessibility issues worth mentioning
 */
export const ACCESSIBILITY_SCORE_THRESHOLD = 70;

/**
 * Maximum acceptable page load time (ms)
 */
export const MAX_LOAD_TIME_MS = 3000;

/**
 * Maximum acceptable Largest Contentful Paint (ms)
 */
export const MAX_LCP_MS = 2500;

/**
 * Maximum acceptable First Contentful Paint (ms)
 */
export const MAX_FCP_MS = 1800;

/**
 * Maximum acceptable Cumulative Layout Shift
 */
export const MAX_CLS = 0.1;

/**
 * Percentage of unused code that indicates bloat
 */
export const UNUSED_CODE_THRESHOLD_PERCENT = 50;

// ============================================
// Lead Qualification Thresholds
// ============================================

/**
 * Businesses with ratings below this are prime targets
 */
export const MAX_RATING_FOR_OPPORTUNITY = 4.0;

/**
 * Minimum review count to consider a business established
 */
export const MIN_REVIEW_COUNT = 5;

/**
 * Minimum pain points to qualify as a lead
 */
export const MIN_PAIN_POINTS_FOR_QUALIFICATION = 2;

// ============================================
// Email Sequence Defaults
// ============================================

/**
 * Default email sequence timing
 */
export const DEFAULT_EMAIL_SEQUENCE = [
  { stepNumber: 1, delayDays: 0, delayHours: 0 }, // Initial outreach
  { stepNumber: 2, delayDays: 3, delayHours: 0 }, // First follow-up
  { stepNumber: 3, delayDays: 7, delayHours: 0 }, // Second follow-up
  { stepNumber: 4, delayDays: 14, delayHours: 0 }, // Final follow-up
] as const;

/**
 * Default send time window (business hours)
 */
export const SEND_TIME_WINDOW = {
  startHour: 9,
  endHour: 17,
  timezone: "America/New_York",
} as const;

// ============================================
// Browser & Viewport Settings
// ============================================

/**
 * Default mobile viewport (iPhone X)
 */
export const MOBILE_VIEWPORT = {
  width: 375,
  height: 812,
  deviceName: "iPhone X",
  isMobile: true,
  hasTouch: true,
} as const;

/**
 * Default desktop viewport
 */
export const DESKTOP_VIEWPORT = {
  width: 1920,
  height: 1080,
  deviceName: "Desktop",
  isMobile: false,
  hasTouch: false,
} as const;

/**
 * Default page navigation timeout (ms)
 */
export const PAGE_TIMEOUT_MS = 30000;

/**
 * Default wait for network idle timeout (ms)
 */
export const NETWORK_IDLE_TIMEOUT_MS = 5000;

// ============================================
// Evidence & Storage
// ============================================

/**
 * Maximum screenshot file size (bytes)
 */
export const MAX_SCREENSHOT_SIZE_BYTES = 5 * 1024 * 1024; // 5MB

/**
 * Maximum video recording duration (ms)
 */
export const MAX_VIDEO_DURATION_MS = 30000; // 30 seconds

/**
 * Screenshot quality (0-100)
 */
export const SCREENSHOT_QUALITY = 80;
