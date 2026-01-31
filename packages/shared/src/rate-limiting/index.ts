// Token Bucket
export {
  TokenBucket,
  TOKEN_BUCKET_PRESETS,
  createTokenBucket,
  type TokenBucketConfig,
  type TokenConsumptionResult,
} from "./token-bucket.js";

// Rate Limiter
export {
  RateLimiter,
  RateLimiterFactory,
  createRateLimiter,
  globalRateLimiterFactory,
  type RateLimiterConfig,
  type RateLimiterCategory,
  type RateLimiterStats,
} from "./rate-limiter.js";

// Anti-Detection
export {
  UserAgentRotator,
  PatternAvoider,
  USER_AGENT_POOL,
  SCREEN_RESOLUTIONS,
  generateRandomViewport,
  randomDelay,
  sleepRandom,
  humanScrollDistance,
  generateMousePath,
  humanTypingDelay,
  generateTypingDelays,
  shouldReverseScroll,
  getRandomTimezone,
  getRandomWebGLRenderer,
  globalPatternAvoider,
  type ViewportConfig,
  type UserAgentInfo,
} from "./anti-detection.js";

// Request Monitor
export {
  RequestMonitor,
  createRequestMonitor,
  globalRequestMonitor,
  type RequestMonitorConfig,
  type RequestEntry,
  type RequestOutcome,
  type MonitorStats,
  type WindowStats,
  type MonitorAlert,
  type AlertCallback,
} from "./request-monitor.js";

// Session Manager
export {
  SessionManager,
  BackoffCalculator,
  createSessionManager,
  createBackoff,
  globalSessionManager,
  parseRobotsTxt,
  isPathAllowed,
  type SessionConfig,
  type SessionState,
  type RobotsTxtRules,
} from "./session-manager.js";
