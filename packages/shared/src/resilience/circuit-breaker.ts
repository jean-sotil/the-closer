import { z } from "zod";

/**
 * Circuit breaker states
 */
export type CircuitState = "closed" | "open" | "half-open";

/**
 * Circuit breaker configuration schema
 */
export const CircuitBreakerConfigSchema = z.object({
  failureThreshold: z.number().int().positive().default(5),
  successThreshold: z.number().int().positive().default(2),
  timeout: z.number().int().positive().default(30000), // 30 seconds
  monitoringWindow: z.number().int().positive().default(60000), // 1 minute
  halfOpenRequests: z.number().int().positive().default(3),
});

export type CircuitBreakerConfig = z.infer<typeof CircuitBreakerConfigSchema>;

/**
 * Circuit breaker statistics
 */
export interface CircuitStats {
  state: CircuitState;
  failures: number;
  successes: number;
  lastFailureTime: number | null;
  lastSuccessTime: number | null;
  totalRequests: number;
  openedAt: number | null;
}

/**
 * Circuit breaker event types
 */
export type CircuitEvent =
  | { type: "state_change"; from: CircuitState; to: CircuitState }
  | { type: "success"; latencyMs: number }
  | { type: "failure"; error: Error }
  | { type: "rejected"; reason: string };

/**
 * Circuit breaker event listener
 */
export type CircuitEventListener = (event: CircuitEvent) => void;

/**
 * Circuit breaker error
 */
export class CircuitBreakerError extends Error {
  constructor(
    message: string,
    public readonly state: CircuitState
  ) {
    super(message);
    this.name = "CircuitBreakerError";
  }
}

/**
 * Circuit breaker implementation
 *
 * Prevents cascading failures by temporarily stopping calls to a failing service.
 *
 * States:
 * - CLOSED: Normal operation, requests pass through
 * - OPEN: Circuit is tripped, requests are rejected
 * - HALF-OPEN: Testing if service has recovered
 */
export class CircuitBreaker {
  private state: CircuitState = "closed";
  private failures = 0;
  private successes = 0;
  private lastFailureTime: number | null = null;
  private lastSuccessTime: number | null = null;
  private openedAt: number | null = null;
  private halfOpenRequests = 0;
  private totalRequests = 0;
  private readonly config: CircuitBreakerConfig;
  private readonly listeners: CircuitEventListener[] = [];
  private readonly failureTimestamps: number[] = [];

  constructor(
    private readonly name: string,
    config: Partial<CircuitBreakerConfig> = {}
  ) {
    this.config = CircuitBreakerConfigSchema.parse(config);
  }

  /**
   * Get current circuit state
   */
  getState(): CircuitState {
    return this.state;
  }

  /**
   * Get circuit statistics
   */
  getStats(): CircuitStats {
    return {
      state: this.state,
      failures: this.failures,
      successes: this.successes,
      lastFailureTime: this.lastFailureTime,
      lastSuccessTime: this.lastSuccessTime,
      totalRequests: this.totalRequests,
      openedAt: this.openedAt,
    };
  }

  /**
   * Add event listener
   */
  on(listener: CircuitEventListener): () => void {
    this.listeners.push(listener);
    return () => {
      const index = this.listeners.indexOf(listener);
      if (index !== -1) {
        this.listeners.splice(index, 1);
      }
    };
  }

  /**
   * Emit event to all listeners
   */
  private emit(event: CircuitEvent): void {
    for (const listener of this.listeners) {
      try {
        listener(event);
      } catch {
        // Ignore listener errors
      }
    }
  }

  /**
   * Transition to a new state
   */
  private transitionTo(newState: CircuitState): void {
    if (this.state === newState) return;

    const oldState = this.state;
    this.state = newState;

    if (newState === "open") {
      this.openedAt = Date.now();
    } else if (newState === "closed") {
      this.openedAt = null;
      this.failures = 0;
      this.halfOpenRequests = 0;
    } else if (newState === "half-open") {
      this.halfOpenRequests = 0;
      this.successes = 0;
    }

    this.emit({ type: "state_change", from: oldState, to: newState });
  }

  /**
   * Check if circuit should transition from open to half-open
   */
  private checkTimeout(): void {
    if (this.state === "open" && this.openedAt) {
      const elapsed = Date.now() - this.openedAt;
      if (elapsed >= this.config.timeout) {
        this.transitionTo("half-open");
      }
    }
  }

  /**
   * Clean up old failure timestamps outside monitoring window
   */
  private cleanupFailures(): void {
    const cutoff = Date.now() - this.config.monitoringWindow;
    while (this.failureTimestamps.length > 0 && this.failureTimestamps[0]! < cutoff) {
      this.failureTimestamps.shift();
    }
  }

  /**
   * Record a successful call
   */
  private recordSuccess(latencyMs: number): void {
    this.successes++;
    this.lastSuccessTime = Date.now();
    this.totalRequests++;

    this.emit({ type: "success", latencyMs });

    if (this.state === "half-open") {
      this.halfOpenRequests++;
      if (this.successes >= this.config.successThreshold) {
        this.transitionTo("closed");
      }
    }
  }

  /**
   * Record a failed call
   */
  private recordFailure(error: Error): void {
    this.failures++;
    this.lastFailureTime = Date.now();
    this.totalRequests++;
    this.failureTimestamps.push(Date.now());

    this.emit({ type: "failure", error });

    // Clean up old failures
    this.cleanupFailures();

    if (this.state === "half-open") {
      // Any failure in half-open state opens the circuit
      this.transitionTo("open");
    } else if (this.state === "closed") {
      // Check if we've exceeded failure threshold in monitoring window
      if (this.failureTimestamps.length >= this.config.failureThreshold) {
        this.transitionTo("open");
      }
    }
  }

  /**
   * Check if request should be allowed
   */
  private shouldAllow(): boolean {
    this.checkTimeout();

    switch (this.state) {
      case "closed":
        return true;

      case "open":
        return false;

      case "half-open":
        // Allow limited requests in half-open state
        return this.halfOpenRequests < this.config.halfOpenRequests;

      default:
        return false;
    }
  }

  /**
   * Execute an operation through the circuit breaker
   */
  async execute<T>(operation: () => Promise<T>): Promise<T> {
    if (!this.shouldAllow()) {
      const error = new CircuitBreakerError(
        `Circuit breaker "${this.name}" is ${this.state}`,
        this.state
      );
      this.emit({ type: "rejected", reason: this.state });
      throw error;
    }

    const startTime = Date.now();

    try {
      const result = await operation();
      this.recordSuccess(Date.now() - startTime);
      return result;
    } catch (error) {
      this.recordFailure(error instanceof Error ? error : new Error(String(error)));
      throw error;
    }
  }

  /**
   * Manually open the circuit
   */
  open(): void {
    this.transitionTo("open");
  }

  /**
   * Manually close the circuit
   */
  close(): void {
    this.transitionTo("closed");
  }

  /**
   * Reset the circuit breaker to initial state
   */
  reset(): void {
    this.state = "closed";
    this.failures = 0;
    this.successes = 0;
    this.lastFailureTime = null;
    this.lastSuccessTime = null;
    this.openedAt = null;
    this.halfOpenRequests = 0;
    this.totalRequests = 0;
    this.failureTimestamps.length = 0;
  }
}

/**
 * Circuit breaker registry for managing multiple breakers
 */
export class CircuitBreakerRegistry {
  private readonly breakers = new Map<string, CircuitBreaker>();
  private readonly defaultConfig: Partial<CircuitBreakerConfig>;

  constructor(defaultConfig: Partial<CircuitBreakerConfig> = {}) {
    this.defaultConfig = defaultConfig;
  }

  /**
   * Get or create a circuit breaker by name
   */
  get(name: string, config?: Partial<CircuitBreakerConfig>): CircuitBreaker {
    let breaker = this.breakers.get(name);
    if (!breaker) {
      breaker = new CircuitBreaker(name, { ...this.defaultConfig, ...config });
      this.breakers.set(name, breaker);
    }
    return breaker;
  }

  /**
   * Get all circuit breakers
   */
  getAll(): Map<string, CircuitBreaker> {
    return new Map(this.breakers);
  }

  /**
   * Get statistics for all breakers
   */
  getAllStats(): Record<string, CircuitStats> {
    const stats: Record<string, CircuitStats> = {};
    for (const [name, breaker] of this.breakers) {
      stats[name] = breaker.getStats();
    }
    return stats;
  }

  /**
   * Reset all circuit breakers
   */
  resetAll(): void {
    for (const breaker of this.breakers.values()) {
      breaker.reset();
    }
  }
}

// Global registry instance
export const circuitBreakers = new CircuitBreakerRegistry();
