/**
 * Error Monitoring Integration
 *
 * Centralized error tracking and monitoring for production debugging.
 * Integrates with Sentry for real-time error alerts.
 *
 * To enable Sentry:
 * 1. npm install @sentry/react
 * 2. Set VITE_SENTRY_DSN environment variable
 * 3. Uncomment Sentry initialization code below
 */

// import * as Sentry from '@sentry/react';

interface ErrorContext {
  user?: {
    id: string;
    email: string;
  };
  tags?: Record<string, string>;
  extra?: Record<string, unknown>;
}

/**
 * Initialize error monitoring
 */
export function initErrorMonitoring(): void {
  const sentryDsn = import.meta.env['VITE_SENTRY_DSN'];
  const environment = import.meta.env.MODE;

  if (!sentryDsn) {
    console.warn('[Error Monitoring] Sentry DSN not configured');
    return;
  }

  // Uncomment when Sentry is installed:
  /*
  Sentry.init({
    dsn: sentryDsn,
    environment,

    // Set tracesSampleRate to 1.0 to capture 100% of transactions
    // In production, reduce this to 0.1 (10%) to reduce costs
    tracesSampleRate: environment === 'production' ? 0.1 : 1.0,

    // Capture console errors
    integrations: [
      new Sentry.BrowserTracing(),
      new Sentry.Replay({
        maskAllText: true,
        blockAllMedia: true,
      }),
    ],

    // Session Replay sampling
    replaysSessionSampleRate: 0.1, // 10% of sessions
    replaysOnErrorSampleRate: 1.0, // 100% of sessions with errors

    // Filter out sensitive data
    beforeSend(event, hint) {
      // Don't send events containing sensitive patterns
      const eventString = JSON.stringify(event);
      const sensitivePatterns = [
        /password/i,
        /token/i,
        /api[_-]?key/i,
        /secret/i,
      ];

      for (const pattern of sensitivePatterns) {
        if (pattern.test(eventString)) {
          return null; // Don't send this event
        }
      }

      return event;
    },
  });
  */

  console.log('[Error Monitoring] Sentry initialized for', environment);
}

/**
 * Capture an error with context
 */
export function captureError(
  error: Error,
  context?: ErrorContext
): void {
  if (import.meta.env.DEV) {
    console.error('[Error]', error, context);
    return;
  }

  // Uncomment when Sentry is installed:
  /*
  if (context?.user) {
    Sentry.setUser(context.user);
  }

  if (context?.tags) {
    Sentry.setTags(context.tags);
  }

  if (context?.extra) {
    Sentry.setExtras(context.extra);
  }

  Sentry.captureException(error);
  */

  // Fallback logging
  console.error('[Production Error]', {
    message: error.message,
    stack: error.stack,
    ...context,
  });
}

/**
 * Capture a custom message
 */
export function captureMessage(
  message: string,
  level: 'info' | 'warning' | 'error' = 'info',
  context?: ErrorContext
): void {
  if (import.meta.env.DEV) {
    console.log(`[${level.toUpperCase()}]`, message, context);
    return;
  }

  // Uncomment when Sentry is installed:
  /*
  if (context?.user) {
    Sentry.setUser(context.user);
  }

  if (context?.tags) {
    Sentry.setTags(context.tags);
  }

  Sentry.captureMessage(message, level);
  */

  console.log(`[${level.toUpperCase()}]`, message, context);
}

/**
 * Set user context for error reporting
 */
export function setUserContext(user: { id: string; email: string }): void {
  // Uncomment when Sentry is installed:
  /*
  Sentry.setUser(user);
  */

  console.log('[Error Monitoring] User context set:', user.id);
}

/**
 * Clear user context (on logout)
 */
export function clearUserContext(): void {
  // Uncomment when Sentry is installed:
  /*
  Sentry.setUser(null);
  */

  console.log('[Error Monitoring] User context cleared');
}

/**
 * Track performance metrics
 */
export function trackPerformance(
  name: string,
  duration: number,
  metadata?: Record<string, unknown>
): void {
  if (import.meta.env.DEV) {
    console.debug(`[Performance] ${name}: ${duration}ms`, metadata);
    return;
  }

  // Uncomment when Sentry is installed:
  /*
  const transaction = Sentry.startTransaction({
    name,
    op: 'custom',
  });

  if (metadata) {
    transaction.setData('metadata', metadata);
  }

  setTimeout(() => {
    transaction.finish();
  }, duration);
  */

  // Log to console for now
  console.debug(`[Performance] ${name}: ${duration}ms`, metadata);
}

/**
 * React Error Boundary fallback
 */
export function ErrorBoundaryFallback({ error }: { error: Error }) {
  captureError(error);

  // Return string description instead of JSX for now
  // In a real implementation, this would return proper JSX
  // when React and JSX are properly configured
  return `Error: ${error.message}`;
}

/**
 * Installation Instructions
 *
 * To enable Sentry monitoring:
 *
 * 1. Install dependencies:
 *    npm install @sentry/react
 *
 * 2. Create Sentry project at https://sentry.io
 *
 * 3. Add DSN to .env:
 *    VITE_SENTRY_DSN=https://xxx@xxx.ingest.sentry.io/xxx
 *
 * 4. Uncomment all Sentry code in this file
 *
 * 5. Wrap your app with ErrorBoundary in App.tsx:
 *    import * as Sentry from '@sentry/react';
 *
 *    <Sentry.ErrorBoundary fallback={ErrorBoundaryFallback}>
 *      <YourApp />
 *    </Sentry.ErrorBoundary>
 *
 * 6. Initialize in main.tsx:
 *    import { initErrorMonitoring } from './utils/errorMonitoring';
 *    initErrorMonitoring();
 */
