import { useEffect, useRef, useCallback } from "react";

/**
 * Performance metrics tracking
 */
interface PerformanceMetrics {
  pageLoadTime: number | null;
  timeToInteractive: number | null;
  firstContentfulPaint: number | null;
  largestContentfulPaint: number | null;
  cumulativeLayoutShift: number | null;
}

/**
 * Hook for tracking page performance metrics
 */
export function usePerformanceMetrics(): PerformanceMetrics {
  const metricsRef = useRef<PerformanceMetrics>({
    pageLoadTime: null,
    timeToInteractive: null,
    firstContentfulPaint: null,
    largestContentfulPaint: null,
    cumulativeLayoutShift: null,
  });

  useEffect(() => {
    // Get navigation timing
    const navEntry = performance.getEntriesByType(
      "navigation"
    )[0] as PerformanceNavigationTiming | undefined;

    if (navEntry) {
      metricsRef.current.pageLoadTime = navEntry.loadEventEnd - navEntry.startTime;
      metricsRef.current.timeToInteractive =
        navEntry.domInteractive - navEntry.startTime;
    }

    // Get paint timing
    const paintEntries = performance.getEntriesByType("paint");
    for (const entry of paintEntries) {
      if (entry.name === "first-contentful-paint") {
        metricsRef.current.firstContentfulPaint = entry.startTime;
      }
    }

    // Observe LCP
    const lcpObserver = new PerformanceObserver((list) => {
      const entries = list.getEntries();
      const lastEntry = entries[entries.length - 1];
      if (lastEntry) {
        metricsRef.current.largestContentfulPaint = lastEntry.startTime;
      }
    });

    try {
      lcpObserver.observe({ type: "largest-contentful-paint", buffered: true });
    } catch {
      // LCP not supported
    }

    // Observe CLS
    let clsValue = 0;
    const clsObserver = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        // @ts-expect-error - hadRecentInput is available on layout-shift entries
        if (!entry.hadRecentInput) {
          // @ts-expect-error - value is available on layout-shift entries
          clsValue += entry.value;
          metricsRef.current.cumulativeLayoutShift = clsValue;
        }
      }
    });

    try {
      clsObserver.observe({ type: "layout-shift", buffered: true });
    } catch {
      // CLS not supported
    }

    return () => {
      lcpObserver.disconnect();
      clsObserver.disconnect();
    };
  }, []);

  return metricsRef.current;
}

/**
 * Hook for measuring component render time
 */
export function useRenderTime(componentName: string): void {
  const startTimeRef = useRef<number>(0);

  useEffect(() => {
    startTimeRef.current = performance.now();

    return () => {
      const renderTime = performance.now() - startTimeRef.current;
      if (renderTime > 100) {
        // Only log slow renders > 100ms
        console.warn(`[Performance] ${componentName} render time: ${renderTime.toFixed(2)}ms`);
      }
    };
  });
}

/**
 * Hook for debouncing expensive operations
 */
export function useDebouncedCallback<T extends (...args: Parameters<T>) => void>(
  callback: T,
  delay: number
): T {
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const debouncedCallback = useCallback(
    (...args: Parameters<T>) => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }

      timeoutRef.current = setTimeout(() => {
        callback(...args);
      }, delay);
    },
    [callback, delay]
  ) as T;

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  return debouncedCallback;
}

/**
 * Hook for throttling expensive operations
 */
export function useThrottledCallback<T extends (...args: Parameters<T>) => void>(
  callback: T,
  delay: number
): T {
  const lastCallRef = useRef<number>(0);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const throttledCallback = useCallback(
    (...args: Parameters<T>) => {
      const now = Date.now();
      const timeSinceLastCall = now - lastCallRef.current;

      if (timeSinceLastCall >= delay) {
        lastCallRef.current = now;
        callback(...args);
      } else {
        // Schedule a trailing call
        if (timeoutRef.current) {
          clearTimeout(timeoutRef.current);
        }

        timeoutRef.current = setTimeout(() => {
          lastCallRef.current = Date.now();
          callback(...args);
        }, delay - timeSinceLastCall);
      }
    },
    [callback, delay]
  ) as T;

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  return throttledCallback;
}

/**
 * Hook for intersection observer (lazy loading)
 */
export function useIntersectionObserver(
  elementRef: React.RefObject<Element | null>,
  options: IntersectionObserverInit = {}
): boolean {
  const isIntersectingRef = useRef(false);

  useEffect(() => {
    const element = elementRef.current;
    if (!element) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry) {
          isIntersectingRef.current = entry.isIntersecting;
        }
      },
      {
        rootMargin: "50px",
        threshold: 0.01,
        ...options,
      }
    );

    observer.observe(element);

    return () => observer.disconnect();
  }, [elementRef, options]);

  return isIntersectingRef.current;
}

/**
 * Report Web Vitals to analytics
 */
export function reportWebVitals(onReport: (metric: PerformanceMetrics) => void): void {
  const metrics: PerformanceMetrics = {
    pageLoadTime: null,
    timeToInteractive: null,
    firstContentfulPaint: null,
    largestContentfulPaint: null,
    cumulativeLayoutShift: null,
  };

  // Navigation timing
  const navEntry = performance.getEntriesByType(
    "navigation"
  )[0] as PerformanceNavigationTiming | undefined;

  if (navEntry) {
    metrics.pageLoadTime = navEntry.loadEventEnd - navEntry.startTime;
    metrics.timeToInteractive = navEntry.domInteractive - navEntry.startTime;
  }

  // Paint timing
  const paintEntries = performance.getEntriesByType("paint");
  for (const entry of paintEntries) {
    if (entry.name === "first-contentful-paint") {
      metrics.firstContentfulPaint = entry.startTime;
    }
  }

  // Wait for LCP and CLS
  setTimeout(() => {
    onReport(metrics);
  }, 3000);
}
