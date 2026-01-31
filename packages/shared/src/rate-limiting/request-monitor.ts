/**
 * Request Monitor
 *
 * Tracks request success/failure rates and provides:
 * - Success rate monitoring
 * - Block detection
 * - Alert triggering
 * - Request logging
 */

/**
 * Request outcome types
 */
export type RequestOutcome = "success" | "failure" | "blocked" | "timeout" | "error";

/**
 * Recorded request entry
 */
export interface RequestEntry {
  timestamp: number;
  outcome: RequestOutcome;
  url?: string;
  statusCode?: number;
  errorMessage?: string;
  durationMs?: number;
  metadata?: Record<string, unknown>;
}

/**
 * Monitor configuration
 */
export interface RequestMonitorConfig {
  /** Window size for rate calculations (ms) */
  windowMs: number;

  /** Maximum entries to keep in history */
  maxHistorySize: number;

  /** Block rate threshold for alerts (0-1) */
  blockAlertThreshold: number;

  /** Failure rate threshold for alerts (0-1) */
  failureAlertThreshold: number;

  /** Minimum requests before calculating rates */
  minRequestsForRates: number;
}

/**
 * Monitor statistics
 */
export interface MonitorStats {
  totalRequests: number;
  successCount: number;
  failureCount: number;
  blockedCount: number;
  timeoutCount: number;
  errorCount: number;
  successRate: number;
  failureRate: number;
  blockRate: number;
  averageDurationMs: number;
  requestsPerMinute: number;
  windowStats: WindowStats;
}

/**
 * Statistics for the current window
 */
export interface WindowStats {
  requests: number;
  successes: number;
  failures: number;
  blocks: number;
  successRate: number;
  blockRate: number;
}

/**
 * Alert payload
 */
export interface MonitorAlert {
  type: "block_rate_high" | "failure_rate_high" | "consecutive_failures";
  message: string;
  currentRate: number;
  threshold: number;
  timestamp: number;
  recentRequests: RequestEntry[];
}

/**
 * Alert callback type
 */
export type AlertCallback = (alert: MonitorAlert) => void;

/**
 * Default monitor configuration
 */
const DEFAULT_CONFIG: RequestMonitorConfig = {
  windowMs: 60000, // 1 minute
  maxHistorySize: 1000,
  blockAlertThreshold: 0.2, // Alert if >20% blocked
  failureAlertThreshold: 0.3, // Alert if >30% failures
  minRequestsForRates: 10,
};

/**
 * Block detection patterns in responses
 */
const BLOCK_PATTERNS = [
  /captcha/i,
  /blocked/i,
  /rate.?limit/i,
  /too.?many.?requests/i,
  /access.?denied/i,
  /forbidden/i,
  /unusual.?traffic/i,
  /automated.?behavior/i,
  /verify.?human/i,
  /robot/i,
  /bot.?detection/i,
];

/**
 * Request monitor for tracking and alerting
 */
export class RequestMonitor {
  private readonly config: RequestMonitorConfig;
  private history: RequestEntry[] = [];
  private alertCallbacks: AlertCallback[] = [];
  private consecutiveFailures = 0;
  private lastAlertTime: Record<string, number> = {};

  constructor(config: Partial<RequestMonitorConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Record a request outcome
   */
  record(entry: Omit<RequestEntry, "timestamp">): void {
    const fullEntry: RequestEntry = {
      ...entry,
      timestamp: Date.now(),
    };

    this.history.push(fullEntry);

    // Trim history if needed
    if (this.history.length > this.config.maxHistorySize) {
      this.history = this.history.slice(-this.config.maxHistorySize);
    }

    // Track consecutive failures
    if (entry.outcome === "failure" || entry.outcome === "blocked") {
      this.consecutiveFailures++;
    } else if (entry.outcome === "success") {
      this.consecutiveFailures = 0;
    }

    // Check for alerts
    this.checkAlerts();
  }

  /**
   * Record a successful request
   */
  recordSuccess(url?: string, durationMs?: number): void {
    const entry: Omit<RequestEntry, "timestamp"> = { outcome: "success" };
    if (url !== undefined) entry.url = url;
    if (durationMs !== undefined) entry.durationMs = durationMs;
    this.record(entry);
  }

  /**
   * Record a failed request
   */
  recordFailure(
    url?: string,
    statusCode?: number,
    errorMessage?: string
  ): void {
    const entry: Omit<RequestEntry, "timestamp"> = { outcome: "failure" };
    if (url !== undefined) entry.url = url;
    if (statusCode !== undefined) entry.statusCode = statusCode;
    if (errorMessage !== undefined) entry.errorMessage = errorMessage;
    this.record(entry);
  }

  /**
   * Record a blocked request
   */
  recordBlocked(url?: string, statusCode?: number): void {
    const entry: Omit<RequestEntry, "timestamp"> = { outcome: "blocked" };
    if (url !== undefined) entry.url = url;
    if (statusCode !== undefined) entry.statusCode = statusCode;
    this.record(entry);
  }

  /**
   * Record a timeout
   */
  recordTimeout(url?: string): void {
    const entry: Omit<RequestEntry, "timestamp"> = { outcome: "timeout" };
    if (url !== undefined) entry.url = url;
    this.record(entry);
  }

  /**
   * Detect if a response indicates blocking
   */
  detectBlock(
    responseText: string,
    statusCode?: number
  ): { isBlocked: boolean; pattern?: string } {
    // Check status codes that typically indicate blocking
    if (statusCode === 403 || statusCode === 429 || statusCode === 503) {
      return { isBlocked: true, pattern: `status_${statusCode}` };
    }

    // Check response content for block patterns
    for (const pattern of BLOCK_PATTERNS) {
      if (pattern.test(responseText)) {
        return { isBlocked: true, pattern: pattern.source };
      }
    }

    return { isBlocked: false };
  }

  /**
   * Get entries within the current window
   */
  private getWindowEntries(): RequestEntry[] {
    const cutoff = Date.now() - this.config.windowMs;
    return this.history.filter((e) => e.timestamp > cutoff);
  }

  /**
   * Calculate window statistics
   */
  private calculateWindowStats(): WindowStats {
    const entries = this.getWindowEntries();
    const total = entries.length;

    if (total === 0) {
      return {
        requests: 0,
        successes: 0,
        failures: 0,
        blocks: 0,
        successRate: 1,
        blockRate: 0,
      };
    }

    const successes = entries.filter((e) => e.outcome === "success").length;
    const failures = entries.filter((e) => e.outcome === "failure").length;
    const blocks = entries.filter((e) => e.outcome === "blocked").length;

    return {
      requests: total,
      successes,
      failures,
      blocks,
      successRate: successes / total,
      blockRate: blocks / total,
    };
  }

  /**
   * Get comprehensive statistics
   */
  getStats(): MonitorStats {
    const total = this.history.length;

    if (total === 0) {
      return {
        totalRequests: 0,
        successCount: 0,
        failureCount: 0,
        blockedCount: 0,
        timeoutCount: 0,
        errorCount: 0,
        successRate: 1,
        failureRate: 0,
        blockRate: 0,
        averageDurationMs: 0,
        requestsPerMinute: 0,
        windowStats: this.calculateWindowStats(),
      };
    }

    const successCount = this.history.filter(
      (e) => e.outcome === "success"
    ).length;
    const failureCount = this.history.filter(
      (e) => e.outcome === "failure"
    ).length;
    const blockedCount = this.history.filter(
      (e) => e.outcome === "blocked"
    ).length;
    const timeoutCount = this.history.filter(
      (e) => e.outcome === "timeout"
    ).length;
    const errorCount = this.history.filter(
      (e) => e.outcome === "error"
    ).length;

    // Calculate average duration
    const durationsWithValue = this.history.filter(
      (e) => e.durationMs !== undefined
    );
    const averageDurationMs =
      durationsWithValue.length > 0
        ? durationsWithValue.reduce((sum, e) => sum + (e.durationMs ?? 0), 0) /
          durationsWithValue.length
        : 0;

    // Calculate requests per minute
    const windowEntries = this.getWindowEntries();
    const requestsPerMinute =
      windowEntries.length * (60000 / this.config.windowMs);

    return {
      totalRequests: total,
      successCount,
      failureCount,
      blockedCount,
      timeoutCount,
      errorCount,
      successRate: successCount / total,
      failureRate: failureCount / total,
      blockRate: blockedCount / total,
      averageDurationMs,
      requestsPerMinute,
      windowStats: this.calculateWindowStats(),
    };
  }

  /**
   * Check and trigger alerts if thresholds exceeded
   */
  private checkAlerts(): void {
    const windowStats = this.calculateWindowStats();

    // Don't alert if not enough requests
    if (windowStats.requests < this.config.minRequestsForRates) {
      return;
    }

    // Check block rate
    if (windowStats.blockRate > this.config.blockAlertThreshold) {
      this.triggerAlert({
        type: "block_rate_high",
        message: `Block rate ${(windowStats.blockRate * 100).toFixed(1)}% exceeds threshold ${(this.config.blockAlertThreshold * 100).toFixed(1)}%`,
        currentRate: windowStats.blockRate,
        threshold: this.config.blockAlertThreshold,
        timestamp: Date.now(),
        recentRequests: this.getWindowEntries().slice(-10),
      });
    }

    // Check failure rate
    const failureRate =
      (windowStats.failures + windowStats.blocks) / windowStats.requests;
    if (failureRate > this.config.failureAlertThreshold) {
      this.triggerAlert({
        type: "failure_rate_high",
        message: `Failure rate ${(failureRate * 100).toFixed(1)}% exceeds threshold ${(this.config.failureAlertThreshold * 100).toFixed(1)}%`,
        currentRate: failureRate,
        threshold: this.config.failureAlertThreshold,
        timestamp: Date.now(),
        recentRequests: this.getWindowEntries().slice(-10),
      });
    }

    // Check consecutive failures
    if (this.consecutiveFailures >= 5) {
      this.triggerAlert({
        type: "consecutive_failures",
        message: `${this.consecutiveFailures} consecutive failures detected`,
        currentRate: this.consecutiveFailures,
        threshold: 5,
        timestamp: Date.now(),
        recentRequests: this.history.slice(-this.consecutiveFailures),
      });
    }
  }

  /**
   * Trigger an alert (with debouncing)
   */
  private triggerAlert(alert: MonitorAlert): void {
    const debounceMs = 30000; // 30 second debounce per alert type
    const lastTime = this.lastAlertTime[alert.type] ?? 0;

    if (Date.now() - lastTime < debounceMs) {
      return; // Debounce
    }

    this.lastAlertTime[alert.type] = Date.now();

    for (const callback of this.alertCallbacks) {
      try {
        callback(alert);
      } catch (error) {
        console.error("Alert callback error:", error);
      }
    }
  }

  /**
   * Register an alert callback
   */
  onAlert(callback: AlertCallback): () => void {
    this.alertCallbacks.push(callback);
    return () => {
      const index = this.alertCallbacks.indexOf(callback);
      if (index >= 0) {
        this.alertCallbacks.splice(index, 1);
      }
    };
  }

  /**
   * Get recent request history
   */
  getHistory(limit?: number): RequestEntry[] {
    const entries = [...this.history];
    if (limit !== undefined && limit > 0) {
      return entries.slice(-limit);
    }
    return entries;
  }

  /**
   * Clear history
   */
  clearHistory(): void {
    this.history = [];
    this.consecutiveFailures = 0;
  }

  /**
   * Export history as JSON
   */
  exportHistory(): string {
    return JSON.stringify(this.history, null, 2);
  }

  /**
   * Check if currently experiencing high block rate
   */
  isBlocked(): boolean {
    const stats = this.calculateWindowStats();
    return (
      stats.requests >= this.config.minRequestsForRates &&
      stats.blockRate > this.config.blockAlertThreshold
    );
  }

  /**
   * Suggest backoff duration based on current state
   */
  suggestBackoff(): number {
    if (this.consecutiveFailures >= 10) {
      return 300000; // 5 minutes
    }
    if (this.consecutiveFailures >= 5) {
      return 60000; // 1 minute
    }
    if (this.isBlocked()) {
      return 30000; // 30 seconds
    }
    return 0;
  }
}

/**
 * Create a request monitor with default config
 */
export function createRequestMonitor(
  config?: Partial<RequestMonitorConfig>
): RequestMonitor {
  return new RequestMonitor(config);
}

/**
 * Global request monitor instance
 */
export const globalRequestMonitor = new RequestMonitor();
