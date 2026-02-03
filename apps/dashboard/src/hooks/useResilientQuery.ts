import { useQuery, useMutation, type UseQueryOptions, type UseMutationOptions } from "@tanstack/react-query";
import { useState, useCallback, useRef, useEffect } from "react";

/**
 * Circuit breaker state for frontend
 */
type CircuitState = "closed" | "open" | "half-open";

interface CircuitBreakerState {
  state: CircuitState;
  failures: number;
  lastFailureTime: number | null;
  successesSinceHalfOpen: number;
}

interface CircuitBreakerConfig {
  failureThreshold: number;
  resetTimeoutMs: number;
  halfOpenSuccessThreshold: number;
}

const DEFAULT_CIRCUIT_CONFIG: CircuitBreakerConfig = {
  failureThreshold: 3,
  resetTimeoutMs: 30000, // 30 seconds
  halfOpenSuccessThreshold: 2,
};

/**
 * Simple frontend circuit breaker for API calls
 */
class FrontendCircuitBreaker {
  private state: CircuitBreakerState;
  private readonly config: CircuitBreakerConfig;
  private listeners: Set<() => void> = new Set();

  constructor(config: Partial<CircuitBreakerConfig> = {}) {
    this.config = { ...DEFAULT_CIRCUIT_CONFIG, ...config };
    this.state = {
      state: "closed",
      failures: 0,
      lastFailureTime: null,
      successesSinceHalfOpen: 0,
    };
  }

  getState(): CircuitState {
    this.checkTransition();
    return this.state.state;
  }

  private checkTransition(): void {
    if (this.state.state === "open" && this.state.lastFailureTime) {
      const elapsed = Date.now() - this.state.lastFailureTime;
      if (elapsed >= this.config.resetTimeoutMs) {
        this.state.state = "half-open";
        this.state.successesSinceHalfOpen = 0;
        this.notify();
      }
    }
  }

  recordSuccess(): void {
    if (this.state.state === "half-open") {
      this.state.successesSinceHalfOpen++;
      if (this.state.successesSinceHalfOpen >= this.config.halfOpenSuccessThreshold) {
        this.state.state = "closed";
        this.state.failures = 0;
      }
    } else if (this.state.state === "closed") {
      // Reset failure count on success
      this.state.failures = Math.max(0, this.state.failures - 1);
    }
    this.notify();
  }

  recordFailure(): void {
    this.state.failures++;
    this.state.lastFailureTime = Date.now();

    if (this.state.state === "half-open") {
      // Any failure in half-open opens the circuit
      this.state.state = "open";
    } else if (this.state.failures >= this.config.failureThreshold) {
      this.state.state = "open";
    }
    this.notify();
  }

  canExecute(): boolean {
    this.checkTransition();
    return this.state.state !== "open";
  }

  subscribe(callback: () => void): () => void {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }

  private notify(): void {
    this.listeners.forEach((cb) => cb());
  }

  reset(): void {
    this.state = {
      state: "closed",
      failures: 0,
      lastFailureTime: null,
      successesSinceHalfOpen: 0,
    };
    this.notify();
  }
}

// Global circuit breakers per API endpoint category
const circuitBreakers = new Map<string, FrontendCircuitBreaker>();

function getCircuitBreaker(key: string, config?: Partial<CircuitBreakerConfig>): FrontendCircuitBreaker {
  if (!circuitBreakers.has(key)) {
    circuitBreakers.set(key, new FrontendCircuitBreaker(config));
  }
  return circuitBreakers.get(key)!;
}

/**
 * Fallback data configuration
 */
interface FallbackConfig<T> {
  /** Static fallback data to use when circuit is open */
  data?: T;
  /** Function to generate fallback data */
  generate?: () => T;
  /** Whether to show stale data when circuit is open */
  showStale?: boolean;
}

/**
 * Retry configuration for queries
 */
interface RetryConfig {
  maxAttempts: number;
  baseDelayMs: number;
  maxDelayMs: number;
  backoffMultiplier: number;
}

const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxAttempts: 3,
  baseDelayMs: 1000,
  maxDelayMs: 10000,
  backoffMultiplier: 2,
};

/**
 * Calculate retry delay with exponential backoff
 */
function calculateRetryDelay(attempt: number, config: RetryConfig): number {
  const delay = config.baseDelayMs * Math.pow(config.backoffMultiplier, attempt - 1);
  const jitter = delay * 0.1 * (Math.random() * 2 - 1);
  return Math.min(delay + jitter, config.maxDelayMs);
}

/**
 * Classify error as retryable or not
 */
function isRetryableError(error: unknown): boolean {
  if (error instanceof Error) {
    const message = error.message.toLowerCase();
    // Network errors are retryable
    if (message.includes("network") || message.includes("timeout") || message.includes("fetch")) {
      return true;
    }
    // Auth errors are not retryable
    if (message.includes("unauthorized") || message.includes("forbidden") || message.includes("401") || message.includes("403")) {
      return false;
    }
  }

  // Check for HTTP status
  const errorWithStatus = error as { status?: number };
  if (errorWithStatus.status) {
    // 5xx errors are retryable
    if (errorWithStatus.status >= 500) return true;
    // 429 rate limit is retryable
    if (errorWithStatus.status === 429) return true;
    // 4xx errors (except 429) are not retryable
    if (errorWithStatus.status >= 400 && errorWithStatus.status < 500) return false;
  }

  // Default to retryable for unknown errors
  return true;
}

/**
 * Hook options for resilient query
 */
interface UseResilientQueryOptions<TData, TError = Error> extends Omit<UseQueryOptions<TData, TError>, "queryKey" | "queryFn" | "retry"> {
  /** Circuit breaker key for grouping related endpoints */
  circuitKey?: string;
  /** Circuit breaker configuration */
  circuitConfig?: Partial<CircuitBreakerConfig>;
  /** Fallback data when circuit is open or query fails */
  fallback?: FallbackConfig<TData>;
  /** Retry configuration */
  retryConfig?: Partial<RetryConfig>;
  /** Called when circuit state changes */
  onCircuitChange?: (state: CircuitState) => void;
}

/**
 * Resilient query hook with circuit breaker and fallback support
 */
export function useResilientQuery<TData, TError = Error>(
  queryKey: readonly unknown[],
  queryFn: () => Promise<TData>,
  options: UseResilientQueryOptions<TData, TError> = {}
) {
  const {
    circuitKey = "default",
    circuitConfig,
    fallback,
    retryConfig: userRetryConfig,
    onCircuitChange,
    ...queryOptions
  } = options;

  const retryConfig = { ...DEFAULT_RETRY_CONFIG, ...userRetryConfig };
  const circuitBreaker = getCircuitBreaker(circuitKey, circuitConfig);
  const [circuitState, setCircuitState] = useState<CircuitState>(circuitBreaker.getState());
  const staleDataRef = useRef<TData | undefined>(undefined);

  // Subscribe to circuit state changes
  useEffect(() => {
    const unsubscribe = circuitBreaker.subscribe(() => {
      const newState = circuitBreaker.getState();
      setCircuitState(newState);
      onCircuitChange?.(newState);
    });
    return unsubscribe;
  }, [circuitBreaker, onCircuitChange]);

  // Wrapped query function with circuit breaker
  const wrappedQueryFn = useCallback(async (): Promise<TData> => {
    if (!circuitBreaker.canExecute()) {
      // Circuit is open - use fallback
      if (fallback?.showStale && staleDataRef.current !== undefined) {
        return staleDataRef.current;
      }
      if (fallback?.data !== undefined) {
        return fallback.data;
      }
      if (fallback?.generate) {
        return fallback.generate();
      }
      throw new Error(`Circuit breaker "${circuitKey}" is open`);
    }

    try {
      const result = await queryFn();
      circuitBreaker.recordSuccess();
      staleDataRef.current = result;
      return result;
    } catch (error) {
      circuitBreaker.recordFailure();
      throw error;
    }
  }, [queryFn, circuitBreaker, circuitKey, fallback]);

  // Custom retry logic
  const shouldRetry = useCallback(
    (failureCount: number, error: TError): boolean => {
      if (failureCount >= retryConfig.maxAttempts) return false;
      if (!isRetryableError(error)) return false;
      if (!circuitBreaker.canExecute()) return false;
      return true;
    },
    [retryConfig.maxAttempts, circuitBreaker]
  );

  const retryDelay = useCallback(
    (attemptIndex: number): number => {
      return calculateRetryDelay(attemptIndex + 1, retryConfig);
    },
    [retryConfig]
  );

  const query = useQuery({
    ...queryOptions,
    queryKey,
    queryFn: wrappedQueryFn,
    retry: shouldRetry,
    retryDelay,
  });

  return {
    ...query,
    circuitState,
    isCircuitOpen: circuitState === "open",
    resetCircuit: () => circuitBreaker.reset(),
  };
}

/**
 * Hook options for resilient mutation
 */
interface UseResilientMutationOptions<TData, TError, TVariables, TContext>
  extends Omit<UseMutationOptions<TData, TError, TVariables, TContext>, "mutationFn" | "retry"> {
  /** Circuit breaker key for grouping related endpoints */
  circuitKey?: string;
  /** Circuit breaker configuration */
  circuitConfig?: Partial<CircuitBreakerConfig>;
  /** Retry configuration */
  retryConfig?: Partial<RetryConfig>;
  /** Called when circuit state changes */
  onCircuitChange?: (state: CircuitState) => void;
}

/**
 * Resilient mutation hook with circuit breaker and retry support
 */
export function useResilientMutation<TData = unknown, TError = Error, TVariables = void, TContext = unknown>(
  mutationFn: (variables: TVariables) => Promise<TData>,
  options: UseResilientMutationOptions<TData, TError, TVariables, TContext> = {}
) {
  const {
    circuitKey = "default-mutation",
    circuitConfig,
    retryConfig: userRetryConfig,
    onCircuitChange,
    ...mutationOptions
  } = options;

  const retryConfig = { ...DEFAULT_RETRY_CONFIG, ...userRetryConfig };
  const circuitBreaker = getCircuitBreaker(circuitKey, circuitConfig);
  const [circuitState, setCircuitState] = useState<CircuitState>(circuitBreaker.getState());

  // Subscribe to circuit state changes
  useEffect(() => {
    const unsubscribe = circuitBreaker.subscribe(() => {
      const newState = circuitBreaker.getState();
      setCircuitState(newState);
      onCircuitChange?.(newState);
    });
    return unsubscribe;
  }, [circuitBreaker, onCircuitChange]);

  // Wrapped mutation function with circuit breaker and retry
  const wrappedMutationFn = useCallback(
    async (variables: TVariables): Promise<TData> => {
      if (!circuitBreaker.canExecute()) {
        throw new Error(`Circuit breaker "${circuitKey}" is open`);
      }

      let lastError: Error | null = null;
      for (let attempt = 1; attempt <= retryConfig.maxAttempts; attempt++) {
        try {
          const result = await mutationFn(variables);
          circuitBreaker.recordSuccess();
          return result;
        } catch (error) {
          lastError = error instanceof Error ? error : new Error(String(error));

          if (!isRetryableError(error) || attempt >= retryConfig.maxAttempts) {
            circuitBreaker.recordFailure();
            throw error;
          }

          // Wait before retry
          const delay = calculateRetryDelay(attempt, retryConfig);
          await new Promise((resolve) => setTimeout(resolve, delay));
        }
      }

      circuitBreaker.recordFailure();
      throw lastError ?? new Error("Mutation failed");
    },
    [mutationFn, circuitBreaker, circuitKey, retryConfig]
  );

  const mutation = useMutation({
    ...mutationOptions,
    mutationFn: wrappedMutationFn,
  });

  return {
    ...mutation,
    circuitState,
    isCircuitOpen: circuitState === "open",
    resetCircuit: () => circuitBreaker.reset(),
  };
}

/**
 * Hook to monitor circuit breaker status
 */
export function useCircuitBreaker(key: string, config?: Partial<CircuitBreakerConfig>) {
  const circuitBreaker = getCircuitBreaker(key, config);
  const [state, setState] = useState<CircuitState>(circuitBreaker.getState());

  useEffect(() => {
    const unsubscribe = circuitBreaker.subscribe(() => {
      setState(circuitBreaker.getState());
    });
    return unsubscribe;
  }, [circuitBreaker]);

  return {
    state,
    isOpen: state === "open",
    isClosed: state === "closed",
    isHalfOpen: state === "half-open",
    reset: () => circuitBreaker.reset(),
  };
}

/**
 * Get all circuit breaker statuses
 */
export function getAllCircuitBreakerStatuses(): Record<string, CircuitState> {
  const statuses: Record<string, CircuitState> = {};
  circuitBreakers.forEach((cb, key) => {
    statuses[key] = cb.getState();
  });
  return statuses;
}

/**
 * Reset all circuit breakers
 */
export function resetAllCircuitBreakers(): void {
  circuitBreakers.forEach((cb) => cb.reset());
}
