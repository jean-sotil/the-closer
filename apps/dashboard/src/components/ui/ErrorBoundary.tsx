import { Component, type ReactNode, type ErrorInfo } from "react";
import { AlertTriangle, RefreshCw, ChevronDown, ChevronUp } from "lucide-react";

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
  showDetails: boolean;
}

interface ErrorBoundaryProps {
  children: ReactNode;
  /** Fallback UI to render when an error occurs */
  fallback?: ReactNode | ((error: Error, reset: () => void) => ReactNode);
  /** Called when an error is caught */
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
  /** Component name for error reporting */
  componentName?: string;
  /** Level of error - affects styling */
  level?: "page" | "section" | "widget";
}

/**
 * Error boundary component for graceful error handling
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      showDetails: false,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return { hasError: true, error };
  }

  override componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    this.setState({ errorInfo });

    // Call custom error handler
    this.props.onError?.(error, errorInfo);

    // Log to console in development
    if (import.meta.env.DEV) {
      console.error("ErrorBoundary caught an error:", error, errorInfo);
    }
  }

  handleReset = (): void => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
      showDetails: false,
    });
  };

  toggleDetails = (): void => {
    this.setState((prev) => ({ showDetails: !prev.showDetails }));
  };

  override render(): ReactNode {
    if (this.state.hasError) {
      // Custom fallback
      if (this.props.fallback) {
        if (typeof this.props.fallback === "function") {
          return this.props.fallback(this.state.error!, this.handleReset);
        }
        return this.props.fallback;
      }

      // Default fallback based on level
      return (
        <DefaultErrorFallback
          error={this.state.error}
          errorInfo={this.state.errorInfo}
          level={this.props.level ?? "section"}
          componentName={this.props.componentName}
          onReset={this.handleReset}
          showDetails={this.state.showDetails}
          onToggleDetails={this.toggleDetails}
        />
      );
    }

    return this.props.children;
  }
}

interface DefaultErrorFallbackProps {
  error: Error | null;
  errorInfo: ErrorInfo | null;
  level: "page" | "section" | "widget";
  componentName: string | undefined;
  onReset: () => void;
  showDetails: boolean;
  onToggleDetails: () => void;
}

function DefaultErrorFallback({
  error,
  errorInfo,
  level,
  componentName,
  onReset,
  showDetails,
  onToggleDetails,
}: DefaultErrorFallbackProps) {
  const levelStyles = {
    page: "min-h-screen bg-gray-50 flex items-center justify-center p-8",
    section: "bg-red-50 border border-red-200 rounded-lg p-6 m-4",
    widget: "bg-red-50 border border-red-100 rounded p-4",
  };

  const iconSizes = {
    page: "h-16 w-16",
    section: "h-12 w-12",
    widget: "h-8 w-8",
  };

  const titleSizes = {
    page: "text-2xl",
    section: "text-lg",
    widget: "text-base",
  };

  return (
    <div className={levelStyles[level]} role="alert">
      <div className={level === "page" ? "max-w-md w-full text-center" : ""}>
        <div className={`flex ${level === "page" ? "flex-col items-center" : "items-start gap-4"}`}>
          <div className={`${level === "page" ? "mb-4" : ""}`}>
            <AlertTriangle className={`${iconSizes[level]} text-red-500`} />
          </div>

          <div className={level === "page" ? "" : "flex-1"}>
            <h2 className={`${titleSizes[level]} font-semibold text-gray-900 mb-2`}>
              {level === "page" ? "Something went wrong" : "Error loading content"}
            </h2>

            <p className="text-sm text-gray-600 mb-4">
              {componentName
                ? `An error occurred in ${componentName}. `
                : "An unexpected error occurred. "}
              {level === "page"
                ? "Please try refreshing the page or contact support if the problem persists."
                : "Please try again or refresh the page."}
            </p>

            <div className="flex items-center gap-2 flex-wrap">
              <button
                onClick={onReset}
                className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
              >
                <RefreshCw className="h-4 w-4" />
                Try again
              </button>

              {level === "page" && (
                <button
                  onClick={() => window.location.reload()}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-gray-200 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-300 transition-colors"
                >
                  Refresh page
                </button>
              )}

              {import.meta.env.DEV && (
                <button
                  onClick={onToggleDetails}
                  className="inline-flex items-center gap-1 px-3 py-2 text-sm text-gray-500 hover:text-gray-700 transition-colors"
                >
                  {showDetails ? (
                    <>
                      <ChevronUp className="h-4 w-4" />
                      Hide details
                    </>
                  ) : (
                    <>
                      <ChevronDown className="h-4 w-4" />
                      Show details
                    </>
                  )}
                </button>
              )}
            </div>

            {showDetails && error && (
              <div className="mt-4 p-4 bg-gray-800 rounded-lg overflow-auto max-h-64">
                <p className="text-red-400 font-mono text-sm mb-2">
                  {error.name}: {error.message}
                </p>
                {error.stack && (
                  <pre className="text-gray-300 font-mono text-xs whitespace-pre-wrap">
                    {error.stack}
                  </pre>
                )}
                {errorInfo?.componentStack && (
                  <div className="mt-4 pt-4 border-t border-gray-700">
                    <p className="text-gray-400 text-xs mb-2">Component Stack:</p>
                    <pre className="text-gray-500 font-mono text-xs whitespace-pre-wrap">
                      {errorInfo.componentStack}
                    </pre>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * HOC to wrap a component with error boundary
 */
export function withErrorBoundary<P extends object>(
  WrappedComponent: React.ComponentType<P>,
  errorBoundaryProps?: Omit<ErrorBoundaryProps, "children">
) {
  const displayName = WrappedComponent.displayName || WrappedComponent.name || "Component";

  const ComponentWithErrorBoundary = (props: P) => (
    <ErrorBoundary componentName={displayName} {...errorBoundaryProps}>
      <WrappedComponent {...props} />
    </ErrorBoundary>
  );

  ComponentWithErrorBoundary.displayName = `withErrorBoundary(${displayName})`;

  return ComponentWithErrorBoundary;
}

/**
 * Query error fallback component
 */
interface QueryErrorFallbackProps {
  error: Error;
  isCircuitOpen: boolean | undefined;
  onRetry: (() => void) | undefined;
  onResetCircuit: (() => void) | undefined;
}

export function QueryErrorFallback({
  error,
  isCircuitOpen,
  onRetry,
  onResetCircuit,
}: QueryErrorFallbackProps) {
  return (
    <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
      <div className="flex items-start gap-3">
        <AlertTriangle className="h-5 w-5 text-amber-500 mt-0.5" />
        <div className="flex-1">
          <h3 className="font-medium text-amber-800">
            {isCircuitOpen ? "Service temporarily unavailable" : "Failed to load data"}
          </h3>
          <p className="text-sm text-amber-700 mt-1">
            {isCircuitOpen
              ? "Too many errors occurred. The service has been temporarily disabled to prevent further issues."
              : error.message || "An error occurred while fetching data."}
          </p>
          <div className="flex items-center gap-2 mt-3">
            {onRetry && !isCircuitOpen && (
              <button
                onClick={onRetry}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-amber-100 text-amber-800 text-sm font-medium rounded hover:bg-amber-200 transition-colors"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                Retry
              </button>
            )}
            {onResetCircuit && isCircuitOpen && (
              <button
                onClick={onResetCircuit}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-amber-100 text-amber-800 text-sm font-medium rounded hover:bg-amber-200 transition-colors"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                Reset circuit
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Loading fallback with error state
 */
interface DataLoaderProps {
  isLoading: boolean;
  isError: boolean;
  error?: Error | null;
  isCircuitOpen?: boolean;
  onRetry?: () => void;
  onResetCircuit?: () => void;
  children: ReactNode;
  loadingFallback?: ReactNode;
}

export function DataLoader({
  isLoading,
  isError,
  error,
  isCircuitOpen,
  onRetry,
  onResetCircuit,
  children,
  loadingFallback,
}: DataLoaderProps) {
  if (isLoading) {
    return (
      loadingFallback ?? (
        <div className="flex items-center justify-center p-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
        </div>
      )
    );
  }

  if (isError && error) {
    return (
      <QueryErrorFallback
        error={error}
        isCircuitOpen={isCircuitOpen}
        onRetry={onRetry}
        onResetCircuit={onResetCircuit}
      />
    );
  }

  return <>{children}</>;
}
