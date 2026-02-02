import { Smartphone, Monitor, Tablet, AlertTriangle, CheckCircle } from "lucide-react";
import type { ResponsiveIssue, EvidenceItem } from "@the-closer/shared";
import type { ResponsivenessSectionProps, LucideIcon } from "./types";

/**
 * Get icon for device type based on viewport width
 */
function getDeviceIcon(width: number): LucideIcon {
  if (width <= 480) return Smartphone;
  if (width <= 1024) return Tablet;
  return Monitor;
}

/**
 * Format issue type for display
 */
function formatIssueType(type: ResponsiveIssue["type"]): string {
  return type
    .replace(/_/g, " ")
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

/**
 * Get severity color for issue type
 */
function getIssueColor(type: ResponsiveIssue["type"]): {
  text: string;
  bg: string;
  border: string;
} {
  switch (type) {
    case "HORIZONTAL_SCROLL":
    case "CONTENT_OVERFLOW":
      return {
        text: "text-red-700",
        bg: "bg-red-50",
        border: "border-red-200",
      };
    case "TOUCH_TARGET_TOO_SMALL":
    case "TEXT_TOO_SMALL":
      return {
        text: "text-orange-700",
        bg: "bg-orange-50",
        border: "border-orange-200",
      };
    case "FIXED_WIDTH_ELEMENTS":
    case "MISSING_VIEWPORT":
      return {
        text: "text-yellow-700",
        bg: "bg-yellow-50",
        border: "border-yellow-200",
      };
    default:
      return {
        text: "text-gray-700",
        bg: "bg-gray-50",
        border: "border-gray-200",
      };
  }
}

/**
 * Device comparison card showing screenshot for a viewport
 */
interface DeviceCardProps {
  viewport: { width: number; height: number; deviceName?: string | undefined };
  screenshot: EvidenceItem | undefined;
  issueCount: number;
}

function DeviceCard({
  viewport,
  screenshot,
  issueCount,
}: DeviceCardProps): React.ReactElement {
  const Icon = getDeviceIcon(viewport.width);
  const deviceName =
    viewport.deviceName ??
    (viewport.width <= 480
      ? "Mobile"
      : viewport.width <= 1024
        ? "Tablet"
        : "Desktop");

  return (
    <div className="card p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Icon className="w-5 h-5 text-gray-600" />
          <span className="font-medium text-gray-900">{deviceName}</span>
        </div>
        <span className="text-xs text-gray-500">
          {viewport.width}×{viewport.height}
        </span>
      </div>

      {/* Screenshot preview */}
      <div className="aspect-[3/4] bg-gray-100 rounded-lg overflow-hidden mb-3">
        {screenshot ? (
          <img
            src={screenshot.url}
            alt={`${deviceName} view`}
            className="w-full h-full object-cover object-top"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-gray-400">
            <Icon className="w-12 h-12" />
          </div>
        )}
      </div>

      {/* Issue indicator */}
      {issueCount > 0 ? (
        <div className="flex items-center gap-2 text-sm text-red-600">
          <AlertTriangle className="w-4 h-4" />
          <span>{issueCount} issue{issueCount > 1 ? "s" : ""}</span>
        </div>
      ) : (
        <div className="flex items-center gap-2 text-sm text-green-600">
          <CheckCircle className="w-4 h-4" />
          <span>Looks good</span>
        </div>
      )}
    </div>
  );
}

/**
 * Responsiveness section with device comparison and issues
 */
export function ResponsivenessSection({
  issues,
  mobileFriendly,
  viewports,
  evidence,
}: ResponsivenessSectionProps): React.ReactElement {
  // Group issues by viewport width
  const issuesByViewport = new Map<number, ResponsiveIssue[]>();
  for (const issue of issues) {
    if (issue.viewportWidth) {
      const existing = issuesByViewport.get(issue.viewportWidth) ?? [];
      existing.push(issue);
      issuesByViewport.set(issue.viewportWidth, existing);
    }
  }

  // Find screenshots for each viewport
  const screenshotsByViewport = new Map<number, EvidenceItem>();
  for (const item of evidence) {
    if (item.type === "screenshot" && item.description) {
      // Try to extract viewport info from description
      const match = item.description.match(/(\d+)\s*x\s*\d+/i);
      if (match?.[1]) {
        screenshotsByViewport.set(parseInt(match[1]), item);
      }
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Smartphone className="w-5 h-5 text-primary-600" />
          <h3 className="text-lg font-semibold text-gray-900">
            Responsive Design
          </h3>
        </div>
        <span
          className={`flex items-center gap-2 px-3 py-1 rounded-full text-sm font-medium ${
            mobileFriendly
              ? "bg-green-100 text-green-700"
              : "bg-red-100 text-red-700"
          }`}
        >
          {mobileFriendly ? (
            <>
              <CheckCircle className="w-4 h-4" />
              Mobile Friendly
            </>
          ) : (
            <>
              <AlertTriangle className="w-4 h-4" />
              Not Mobile Friendly
            </>
          )}
        </span>
      </div>

      {/* Device comparison grid */}
      {viewports.length > 0 && (
        <div>
          <h4 className="text-sm font-medium text-gray-700 mb-3">
            Device Comparison
          </h4>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {viewports.map((viewport, idx) => (
              <DeviceCard
                key={idx}
                viewport={viewport}
                screenshot={screenshotsByViewport.get(viewport.width)}
                issueCount={issuesByViewport.get(viewport.width)?.length ?? 0}
              />
            ))}
          </div>
        </div>
      )}

      {/* Issues list */}
      {issues.length > 0 ? (
        <div>
          <h4 className="text-sm font-medium text-gray-700 mb-3">
            Responsive Issues ({issues.length})
          </h4>
          <div className="space-y-3">
            {issues.map((issue, idx) => {
              const colors = getIssueColor(issue.type);
              return (
                <div
                  key={idx}
                  className={`p-4 rounded-lg border ${colors.bg} ${colors.border}`}
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <span
                        className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${colors.text} bg-white mb-2`}
                      >
                        {formatIssueType(issue.type)}
                      </span>
                      <p className="text-sm text-gray-700">{issue.description}</p>
                    </div>
                    {issue.viewportWidth && (
                      <span className="text-xs text-gray-500 whitespace-nowrap ml-4">
                        @{issue.viewportWidth}px
                      </span>
                    )}
                  </div>

                  {issue.elementSelector && (
                    <div className="mt-2">
                      <p className="text-xs text-gray-500 mb-1">
                        Affected Element
                      </p>
                      <code className="block bg-white rounded p-2 text-xs text-gray-700 overflow-x-auto">
                        {issue.elementSelector}
                      </code>
                    </div>
                  )}

                  <div className="mt-2 pt-2 border-t border-gray-200">
                    <p className="text-xs text-gray-500 mb-1">Recommendation</p>
                    <p className="text-sm text-gray-700">{issue.recommendation}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="text-center py-8 text-gray-500">
          <CheckCircle className="w-12 h-12 mx-auto mb-3 text-green-500" />
          <p className="font-medium text-gray-900">
            No responsive design issues found
          </p>
          <p className="text-sm">
            The site renders correctly across all tested viewports.
          </p>
        </div>
      )}
    </div>
  );
}
