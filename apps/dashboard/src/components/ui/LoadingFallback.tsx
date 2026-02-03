import { Loader2 } from "lucide-react";

interface LoadingFallbackProps {
  message?: string | undefined;
}

/**
 * Loading fallback component for lazy-loaded routes and components
 */
export function LoadingFallback({ message }: LoadingFallbackProps): React.ReactElement {
  return (
    <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
      <Loader2 className="w-8 h-8 text-primary-600 animate-spin" />
      {message && <p className="text-sm text-gray-500">{message}</p>}
    </div>
  );
}

/**
 * Full page loading state
 */
export function PageLoader(): React.ReactElement {
  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-50">
      <div className="flex flex-col items-center gap-4">
        <Loader2 className="w-12 h-12 text-primary-600 animate-spin" />
        <p className="text-gray-500">Loading...</p>
      </div>
    </div>
  );
}

/**
 * Skeleton loader for cards
 */
export function CardSkeleton(): React.ReactElement {
  return (
    <div className="card animate-pulse">
      <div className="h-4 bg-gray-200 rounded w-1/3 mb-4" />
      <div className="space-y-3">
        <div className="h-3 bg-gray-200 rounded w-full" />
        <div className="h-3 bg-gray-200 rounded w-5/6" />
        <div className="h-3 bg-gray-200 rounded w-4/6" />
      </div>
    </div>
  );
}

/**
 * Skeleton loader for table rows
 */
export function TableRowSkeleton({ columns = 5 }: { columns?: number | undefined }): React.ReactElement {
  return (
    <tr className="animate-pulse">
      {Array.from({ length: columns }).map((_, i) => (
        <td key={i} className="px-4 py-3">
          <div className="h-4 bg-gray-200 rounded w-full" />
        </td>
      ))}
    </tr>
  );
}

/**
 * Skeleton loader for charts
 */
export function ChartSkeleton(): React.ReactElement {
  return (
    <div className="card animate-pulse">
      <div className="h-4 bg-gray-200 rounded w-1/4 mb-4" />
      <div className="h-64 bg-gray-100 rounded flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-gray-300 animate-spin" />
      </div>
    </div>
  );
}
