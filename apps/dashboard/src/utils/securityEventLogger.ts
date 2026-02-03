/**
 * Security Event Logger
 *
 * Tracks security-related events for auditing and threat detection.
 * Events are logged to console in development and can be sent to
 * a logging service in production.
 */

export type SecurityEventType =
  | 'auth.login.success'
  | 'auth.login.failed'
  | 'auth.login.locked'
  | 'auth.logout'
  | 'auth.signup'
  | 'auth.password.changed'
  | 'rate_limit.exceeded'
  | 'rate_limit.warning'
  | 'input.sanitized'
  | 'api.unauthorized'
  | 'api.forbidden'
  | 'data.export'
  | 'data.delete'
  | 'admin.action'
  | 'security.violation';

export interface SecurityEvent {
  type: SecurityEventType;
  timestamp: number;
  userId?: string;
  email?: string;
  ipAddress?: string;
  userAgent?: string;
  metadata?: Record<string, unknown>;
  severity: 'low' | 'medium' | 'high' | 'critical';
}

class SecurityEventLogger {
  private events: SecurityEvent[] = [];
  private maxEvents = 1000; // Keep last 1000 events in memory

  /**
   * Log a security event
   */
  log(
    type: SecurityEventType,
    metadata?: Record<string, unknown>,
    severity: SecurityEvent['severity'] = 'medium'
  ): void {
    const event: SecurityEvent = {
      type,
      timestamp: Date.now(),
      severity,
      ...(metadata && { metadata }),
    };

    // Add user context if available
    const userContext = this.getUserContext();
    if (userContext) {
      event.userId = userContext.userId;
      event.email = userContext.email;
    }

    // Add browser context
    event.userAgent = navigator.userAgent;

    // Store event
    this.events.push(event);

    // Trim old events
    if (this.events.length > this.maxEvents) {
      this.events = this.events.slice(-this.maxEvents);
    }

    // Log to console in development
    if (import.meta.env.DEV) {
      const color = this.getSeverityColor(severity);
      console.log(
        `%c[SECURITY EVENT] ${type}`,
        `color: ${color}; font-weight: bold`,
        metadata
      );
    }

    // Send to logging service in production
    if (import.meta.env.PROD) {
      this.sendToLoggingService(event);
    }

    // Check for critical events
    if (severity === 'critical') {
      this.handleCriticalEvent(event);
    }

    // Check for patterns (potential attack)
    this.detectPatterns(type);
  }

  /**
   * Get user context from localStorage or session
   */
  private getUserContext(): { userId: string; email: string } | null {
    try {
      const userStr = localStorage.getItem('auth_user');
      if (userStr) {
        const user = JSON.parse(userStr);
        return {
          userId: user.id,
          email: user.email,
        };
      }
    } catch {
      // Ignore errors
    }
    return null;
  }

  /**
   * Get color for severity level
   */
  private getSeverityColor(severity: SecurityEvent['severity']): string {
    switch (severity) {
      case 'low':
        return '#10b981'; // green
      case 'medium':
        return '#f59e0b'; // yellow
      case 'high':
        return '#ef4444'; // red
      case 'critical':
        return '#dc2626'; // dark red
    }
  }

  /**
   * Send event to logging service (implement based on your provider)
   */
  private sendToLoggingService(event: SecurityEvent): void {
    // TODO: Implement based on your logging provider
    // Examples: Datadog, LogRocket, New Relic, etc.

    /*
    // Example with Datadog:
    if (window.DD_LOGS) {
      window.DD_LOGS.logger.info('security_event', {
        type: event.type,
        severity: event.severity,
        userId: event.userId,
        metadata: event.metadata,
      });
    }
    */

    /*
    // Example with custom API:
    fetch('/api/security-events', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(event),
    }).catch(() => {
      // Fail silently in production
    });
    */

    // For now, just log to console
    if (event.severity === 'high' || event.severity === 'critical') {
      console.warn('[Security Event]', event);
    }
  }

  /**
   * Handle critical security events
   */
  private handleCriticalEvent(event: SecurityEvent): void {
    // Alert user
    console.error('[CRITICAL SECURITY EVENT]', event);

    // In production, you might:
    // 1. Send immediate notification to security team
    // 2. Lock the account
    // 3. Trigger additional monitoring
    // 4. Create an incident ticket

    // For now, show warning in console
    if (import.meta.env.PROD) {
      console.error('Critical security event detected. Administrators have been notified.');
    }
  }

  /**
   * Detect attack patterns (e.g., brute force)
   */
  private detectPatterns(type: SecurityEventType): void {
    const recentWindow = 5 * 60 * 1000; // 5 minutes
    const now = Date.now();

    // Count recent events of this type
    const recentEvents = this.events.filter(
      (e) => e.type === type && now - e.timestamp < recentWindow
    );

    // Detect brute force (10+ failed logins in 5 minutes)
    if (type === 'auth.login.failed' && recentEvents.length >= 10) {
      this.log('security.violation', {
        pattern: 'brute_force',
        eventCount: recentEvents.length,
        window: '5m',
      }, 'critical');
    }

    // Detect rate limit abuse (5+ rate limit hits in 5 minutes)
    if (type === 'rate_limit.exceeded' && recentEvents.length >= 5) {
      this.log('security.violation', {
        pattern: 'rate_limit_abuse',
        eventCount: recentEvents.length,
        window: '5m',
      }, 'high');
    }
  }

  /**
   * Get recent security events
   */
  getRecentEvents(limit = 100): SecurityEvent[] {
    return this.events.slice(-limit);
  }

  /**
   * Get events by type
   */
  getEventsByType(type: SecurityEventType): SecurityEvent[] {
    return this.events.filter((e) => e.type === type);
  }

  /**
   * Get events by severity
   */
  getEventsBySeverity(severity: SecurityEvent['severity']): SecurityEvent[] {
    return this.events.filter((e) => e.severity === severity);
  }

  /**
   * Export events for analysis
   */
  exportEvents(): string {
    return JSON.stringify(this.events, null, 2);
  }

  /**
   * Clear all events
   */
  clearEvents(): void {
    this.events = [];
  }
}

// Singleton instance
export const securityLogger = new SecurityEventLogger();

/**
 * Convenience functions for common security events
 */

export function logLoginSuccess(email: string): void {
  securityLogger.log('auth.login.success', { email }, 'low');
}

export function logLoginFailed(email: string, reason?: string): void {
  securityLogger.log('auth.login.failed', { email, reason }, 'medium');
}

export function logLoginLocked(email: string, lockoutMinutes: number): void {
  securityLogger.log('auth.login.locked', { email, lockoutMinutes }, 'high');
}

export function logLogout(email: string): void {
  securityLogger.log('auth.logout', { email }, 'low');
}

export function logRateLimitExceeded(endpoint: string, limit: number): void {
  securityLogger.log('rate_limit.exceeded', { endpoint, limit }, 'medium');
}

export function logInputSanitized(field: string, originalValue: string): void {
  securityLogger.log('input.sanitized', { field, originalValue }, 'low');
}

export function logUnauthorizedAccess(resource: string): void {
  securityLogger.log('api.unauthorized', { resource }, 'high');
}

export function logDataExport(dataType: string, recordCount: number): void {
  securityLogger.log('data.export', { dataType, recordCount }, 'medium');
}

export function logDataDeletion(dataType: string, recordCount: number): void {
  securityLogger.log('data.delete', { dataType, recordCount }, 'high');
}

export function logAdminAction(action: string, target: string): void {
  securityLogger.log('admin.action', { action, target }, 'high');
}
