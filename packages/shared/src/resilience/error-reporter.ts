import { z } from "zod";

/**
 * Error severity levels
 */
export type ErrorSeverity = "low" | "medium" | "high" | "critical";

/**
 * Structured error context
 */
export interface ErrorContext {
  component?: string;
  operation?: string;
  userId?: string;
  requestId?: string;
  url?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Error report entry
 */
export interface ErrorReport {
  id: string;
  timestamp: Date;
  error: Error;
  severity: ErrorSeverity;
  context: ErrorContext;
  fingerprint: string;
  count: number;
  firstSeen: Date;
  lastSeen: Date;
}

/**
 * Error aggregation bucket
 */
interface ErrorBucket {
  fingerprint: string;
  error: Error;
  severity: ErrorSeverity;
  context: ErrorContext;
  count: number;
  firstSeen: Date;
  lastSeen: Date;
  samples: Array<{ timestamp: Date; context: ErrorContext }>;
}

/**
 * Error reporter configuration
 */
export const ErrorReporterConfigSchema = z.object({
  maxBuckets: z.number().int().positive().default(100),
  maxSamplesPerBucket: z.number().int().positive().default(10),
  flushIntervalMs: z.number().int().positive().default(60000), // 1 minute
  alertThreshold: z.number().positive().default(0.05), // 5% error rate
  windowMs: z.number().int().positive().default(300000), // 5 minutes
});

export type ErrorReporterConfig = z.infer<typeof ErrorReporterConfigSchema>;

/**
 * Error rate alert
 */
export interface ErrorRateAlert {
  errorRate: number;
  threshold: number;
  totalRequests: number;
  totalErrors: number;
  topErrors: Array<{
    fingerprint: string;
    message: string;
    count: number;
  }>;
}

/**
 * Error alert callback type
 */
export type ErrorAlertCallback = (alert: ErrorRateAlert) => void;

/**
 * Generate error fingerprint for grouping similar errors
 */
function generateFingerprint(error: Error, context: ErrorContext): string {
  const parts = [
    error.name,
    error.message.replace(/\d+/g, "N").substring(0, 100), // Normalize numbers
    context.component ?? "unknown",
    context.operation ?? "unknown",
  ];
  return parts.join("::");
}

/**
 * Determine error severity based on error type and context
 */
function determineSeverity(error: Error, context: ErrorContext): ErrorSeverity {
  // Critical: auth, data corruption, system failures
  if (
    error.message.toLowerCase().includes("authentication") ||
    error.message.toLowerCase().includes("corruption") ||
    error.name === "SystemError"
  ) {
    return "critical";
  }

  // High: payment, data loss, security
  if (
    error.message.toLowerCase().includes("payment") ||
    error.message.toLowerCase().includes("security") ||
    context.component === "payment" ||
    context.component === "auth"
  ) {
    return "high";
  }

  // Medium: API errors, timeouts
  if (
    error.name === "TimeoutError" ||
    error.message.toLowerCase().includes("timeout") ||
    error.message.toLowerCase().includes("api")
  ) {
    return "medium";
  }

  // Low: validation, user errors
  return "low";
}

/**
 * Error reporter with aggregation and alerting
 */
export class ErrorReporter {
  private readonly buckets = new Map<string, ErrorBucket>();
  private readonly config: ErrorReporterConfig;
  private readonly alertCallbacks: ErrorAlertCallback[] = [];
  private requestCount = 0;
  private errorCount = 0;
  private windowStart = Date.now();
  private flushTimer: ReturnType<typeof setInterval> | null = null;

  constructor(config: Partial<ErrorReporterConfig> = {}) {
    this.config = ErrorReporterConfigSchema.parse(config);
    this.startFlushInterval();
  }

  /**
   * Start the flush interval
   */
  private startFlushInterval(): void {
    this.flushTimer = setInterval(() => {
      this.checkAlertThreshold();
      this.resetWindow();
    }, this.config.flushIntervalMs);
  }

  /**
   * Stop the reporter
   */
  stop(): void {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
      this.flushTimer = null;
    }
  }

  /**
   * Register an alert callback
   */
  onAlert(callback: ErrorAlertCallback): () => void {
    this.alertCallbacks.push(callback);
    return () => {
      const index = this.alertCallbacks.indexOf(callback);
      if (index !== -1) {
        this.alertCallbacks.splice(index, 1);
      }
    };
  }

  /**
   * Record a request (for rate calculation)
   */
  recordRequest(): void {
    this.requestCount++;
  }

  /**
   * Report an error
   */
  report(
    error: Error,
    context: ErrorContext = {},
    severity?: ErrorSeverity
  ): ErrorReport {
    this.errorCount++;

    const fingerprint = generateFingerprint(error, context);
    const resolvedSeverity = severity ?? determineSeverity(error, context);
    const now = new Date();

    let bucket = this.buckets.get(fingerprint);

    if (bucket) {
      // Update existing bucket
      bucket.count++;
      bucket.lastSeen = now;
      if (bucket.samples.length < this.config.maxSamplesPerBucket) {
        bucket.samples.push({ timestamp: now, context });
      }
    } else {
      // Create new bucket
      bucket = {
        fingerprint,
        error,
        severity: resolvedSeverity,
        context,
        count: 1,
        firstSeen: now,
        lastSeen: now,
        samples: [{ timestamp: now, context }],
      };
      this.buckets.set(fingerprint, bucket);

      // Evict oldest bucket if at capacity
      if (this.buckets.size > this.config.maxBuckets) {
        this.evictOldest();
      }
    }

    // Log the error
    this.logError(error, resolvedSeverity, context);

    return {
      id: crypto.randomUUID(),
      timestamp: now,
      error,
      severity: resolvedSeverity,
      context,
      fingerprint,
      count: bucket.count,
      firstSeen: bucket.firstSeen,
      lastSeen: bucket.lastSeen,
    };
  }

  /**
   * Log error with structured context
   */
  private logError(
    error: Error,
    severity: ErrorSeverity,
    context: ErrorContext
  ): void {
    const logData = {
      severity,
      error: {
        name: error.name,
        message: error.message,
        stack: error.stack,
      },
      context,
      timestamp: new Date().toISOString(),
    };

    switch (severity) {
      case "critical":
      case "high":
        console.error("[ERROR]", JSON.stringify(logData));
        break;
      case "medium":
        console.warn("[WARN]", JSON.stringify(logData));
        break;
      default:
        console.log("[INFO]", JSON.stringify(logData));
    }
  }

  /**
   * Evict the oldest bucket
   */
  private evictOldest(): void {
    let oldest: string | null = null;
    let oldestTime = Infinity;

    for (const [fingerprint, bucket] of this.buckets) {
      if (bucket.lastSeen.getTime() < oldestTime) {
        oldest = fingerprint;
        oldestTime = bucket.lastSeen.getTime();
      }
    }

    if (oldest) {
      this.buckets.delete(oldest);
    }
  }

  /**
   * Check if error rate exceeds threshold
   */
  private checkAlertThreshold(): void {
    if (this.requestCount === 0) return;

    const errorRate = this.errorCount / this.requestCount;

    if (errorRate >= this.config.alertThreshold) {
      const topErrors = Array.from(this.buckets.values())
        .sort((a, b) => b.count - a.count)
        .slice(0, 5)
        .map((b) => ({
          fingerprint: b.fingerprint,
          message: b.error.message,
          count: b.count,
        }));

      const alert: ErrorRateAlert = {
        errorRate,
        threshold: this.config.alertThreshold,
        totalRequests: this.requestCount,
        totalErrors: this.errorCount,
        topErrors,
      };

      for (const callback of this.alertCallbacks) {
        try {
          callback(alert);
        } catch {
          // Ignore callback errors
        }
      }
    }
  }

  /**
   * Reset the monitoring window
   */
  private resetWindow(): void {
    this.requestCount = 0;
    this.errorCount = 0;
    this.windowStart = Date.now();
  }

  /**
   * Get aggregated error reports
   */
  getReports(): ErrorReport[] {
    return Array.from(this.buckets.values()).map((bucket) => ({
      id: bucket.fingerprint,
      timestamp: bucket.lastSeen,
      error: bucket.error,
      severity: bucket.severity,
      context: bucket.context,
      fingerprint: bucket.fingerprint,
      count: bucket.count,
      firstSeen: bucket.firstSeen,
      lastSeen: bucket.lastSeen,
    }));
  }

  /**
   * Get error rate statistics
   */
  getStats(): {
    errorRate: number;
    totalRequests: number;
    totalErrors: number;
    uniqueErrors: number;
    windowStarted: Date;
  } {
    return {
      errorRate: this.requestCount > 0 ? this.errorCount / this.requestCount : 0,
      totalRequests: this.requestCount,
      totalErrors: this.errorCount,
      uniqueErrors: this.buckets.size,
      windowStarted: new Date(this.windowStart),
    };
  }

  /**
   * Clear all error data
   */
  clear(): void {
    this.buckets.clear();
    this.resetWindow();
  }
}

// Global error reporter instance
export const errorReporter = new ErrorReporter();
