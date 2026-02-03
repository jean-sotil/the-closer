/**
 * Timeout error class
 */
export class TimeoutError extends Error {
  constructor(
    message: string,
    public readonly timeoutMs: number
  ) {
    super(message);
    this.name = "TimeoutError";
  }
}

/**
 * Execute an operation with a timeout
 */
export async function withTimeout<T>(
  operation: () => Promise<T>,
  timeoutMs: number,
  errorMessage?: string
): Promise<T> {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;

  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => {
      reject(
        new TimeoutError(
          errorMessage ?? `Operation timed out after ${timeoutMs}ms`,
          timeoutMs
        )
      );
    }, timeoutMs);
  });

  try {
    const result = await Promise.race([operation(), timeoutPromise]);
    return result;
  } finally {
    if (timeoutId !== null) {
      clearTimeout(timeoutId);
    }
  }
}

/**
 * Create a timeout-wrapped version of an async function
 */
export function withTimeoutFn<TArgs extends unknown[], TReturn>(
  fn: (...args: TArgs) => Promise<TReturn>,
  timeoutMs: number,
  errorMessage?: string
): (...args: TArgs) => Promise<TReturn> {
  return async (...args: TArgs): Promise<TReturn> => {
    return withTimeout(() => fn(...args), timeoutMs, errorMessage);
  };
}

/**
 * Deadline-based timeout (absolute time)
 */
export async function withDeadline<T>(
  operation: () => Promise<T>,
  deadline: Date,
  errorMessage?: string
): Promise<T> {
  const remaining = deadline.getTime() - Date.now();
  if (remaining <= 0) {
    throw new TimeoutError(
      errorMessage ?? "Deadline already passed",
      0
    );
  }
  return withTimeout(operation, remaining, errorMessage);
}

/**
 * Cancellable operation with timeout
 */
export interface CancellableOperation<T> {
  promise: Promise<T>;
  cancel: () => void;
}

export function cancellableTimeout<T>(
  operation: (signal: AbortSignal) => Promise<T>,
  timeoutMs: number
): CancellableOperation<T> {
  const controller = new AbortController();
  let timeoutId: ReturnType<typeof setTimeout> | null = null;

  const promise = new Promise<T>((resolve, reject) => {
    timeoutId = setTimeout(() => {
      controller.abort();
      reject(new TimeoutError(`Operation timed out after ${timeoutMs}ms`, timeoutMs));
    }, timeoutMs);

    operation(controller.signal)
      .then(resolve)
      .catch(reject)
      .finally(() => {
        if (timeoutId !== null) {
          clearTimeout(timeoutId);
        }
      });
  });

  const cancel = () => {
    if (timeoutId !== null) {
      clearTimeout(timeoutId);
    }
    controller.abort();
  };

  return { promise, cancel };
}
