import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
} from "recharts";
import { Zap, AlertTriangle, CheckCircle } from "lucide-react";
import type { PerformanceSectionProps } from "./types";
import { formatTime, formatBytes, getScoreLevel, getScoreLevelColor } from "./types";

/**
 * Core Web Vital metric display
 */
interface MetricGaugeProps {
  name: string;
  value: number | undefined;
  unit: string;
  thresholds: { good: number; needsImprovement: number };
  description: string;
}

function MetricGauge({
  name,
  value,
  unit,
  thresholds,
  description,
}: MetricGaugeProps): React.ReactElement {
  const level =
    value === undefined
      ? "poor"
      : value <= thresholds.good
        ? "good"
        : value <= thresholds.needsImprovement
          ? "needs-improvement"
          : ("poor" as const);

  const colors = getScoreLevelColor(level);
  const displayValue =
    value === undefined
      ? "—"
      : unit === "s"
        ? (value / 1000).toFixed(1)
        : unit === "ms"
          ? Math.round(value).toString()
          : value.toFixed(2);

  return (
    <div className={`p-4 rounded-lg ${colors.bg} border ${colors.ring.replace("ring", "border")}`}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-medium text-gray-700">{name}</span>
        <span className={`text-lg font-bold ${colors.text}`}>
          {displayValue}
          <span className="text-xs ml-1">{unit}</span>
        </span>
      </div>
      <p className="text-xs text-gray-500">{description}</p>
      <div className="mt-2 flex items-center gap-2 text-xs">
        <span className="text-green-600">Good: ≤{thresholds.good}{unit}</span>
        <span className="text-yellow-600">
          Fair: ≤{thresholds.needsImprovement}{unit}
        </span>
      </div>
    </div>
  );
}

/**
 * Performance section with Core Web Vitals and resource metrics
 */
export function PerformanceSection({
  metrics,
}: PerformanceSectionProps): React.ReactElement {
  // Code coverage data for pie chart
  const coverageData = [
    {
      name: "Used JS",
      value: 100 - (metrics.unusedJsPercent ?? 0),
      color: "#22c55e",
    },
    { name: "Unused JS", value: metrics.unusedJsPercent ?? 0, color: "#ef4444" },
  ];

  const cssData = [
    {
      name: "Used CSS",
      value: 100 - (metrics.unusedCssPercent ?? 0),
      color: "#22c55e",
    },
    {
      name: "Unused CSS",
      value: metrics.unusedCssPercent ?? 0,
      color: "#ef4444",
    },
  ];

  const recommendations = getRecommendations(metrics);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Zap className="w-5 h-5 text-primary-600" />
        <h3 className="text-lg font-semibold text-gray-900">
          Performance Metrics
        </h3>
      </div>

      {/* Core Web Vitals */}
      <div>
        <h4 className="text-sm font-medium text-gray-700 mb-3">
          Core Web Vitals
        </h4>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <MetricGauge
            name="First Contentful Paint"
            value={metrics.firstContentfulPaint}
            unit="ms"
            thresholds={{ good: 1800, needsImprovement: 3000 }}
            description="Time until first content renders"
          />
          <MetricGauge
            name="Largest Contentful Paint"
            value={metrics.largestContentfulPaint}
            unit="ms"
            thresholds={{ good: 2500, needsImprovement: 4000 }}
            description="Time until main content loads"
          />
          <MetricGauge
            name="Cumulative Layout Shift"
            value={metrics.cumulativeLayoutShift}
            unit=""
            thresholds={{ good: 0.1, needsImprovement: 0.25 }}
            description="Visual stability score"
          />
          <MetricGauge
            name="Time to First Byte"
            value={metrics.timeToFirstByte}
            unit="ms"
            thresholds={{ good: 800, needsImprovement: 1800 }}
            description="Server response time"
          />
          <MetricGauge
            name="Time to Interactive"
            value={metrics.timeToInteractive}
            unit="ms"
            thresholds={{ good: 3800, needsImprovement: 7300 }}
            description="Time until fully interactive"
          />
          <MetricGauge
            name="DOM Content Loaded"
            value={metrics.domContentLoaded}
            unit="ms"
            thresholds={{ good: 2000, needsImprovement: 4000 }}
            description="HTML parsing complete"
          />
        </div>
      </div>

      {/* Resource Summary */}
      <div>
        <h4 className="text-sm font-medium text-gray-700 mb-3">
          Resource Summary
        </h4>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="card p-4">
            <p className="text-sm text-gray-500">Total Size</p>
            <p className="text-xl font-bold text-gray-900">
              {formatBytes(metrics.totalResourceSize)}
            </p>
          </div>
          <div className="card p-4">
            <p className="text-sm text-gray-500">Requests</p>
            <p className="text-xl font-bold text-gray-900">
              {metrics.totalRequests ?? "—"}
            </p>
          </div>
          <div className="card p-4">
            <p className="text-sm text-gray-500">Load Time</p>
            <p className="text-xl font-bold text-gray-900">
              {formatTime(metrics.loadComplete)}
            </p>
          </div>
          <div className="card p-4">
            <p className="text-sm text-gray-500">Performance Score</p>
            <p
              className={`text-xl font-bold ${getScoreLevelColor(getScoreLevel(metrics.performanceScore)).text}`}
            >
              {metrics.performanceScore ?? "—"}
            </p>
          </div>
        </div>
      </div>

      {/* Code Coverage Charts */}
      <div>
        <h4 className="text-sm font-medium text-gray-700 mb-3">Code Coverage</h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* JavaScript Coverage */}
          <div className="card p-4">
            <h5 className="text-sm font-medium text-gray-600 mb-2">
              JavaScript
            </h5>
            <div className="flex items-center gap-4">
              <div className="w-32 h-32">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={coverageData}
                      cx="50%"
                      cy="50%"
                      innerRadius={25}
                      outerRadius={45}
                      paddingAngle={2}
                      dataKey="value"
                    >
                      {coverageData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value) => `${(value as number).toFixed(1)}%`} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="space-y-2">
                <p className="text-sm">
                  <span className="inline-block w-3 h-3 bg-red-500 rounded mr-2" />
                  Unused: {(metrics.unusedJsPercent ?? 0).toFixed(1)}%
                </p>
                <p className="text-xs text-gray-500">
                  {formatBytes(metrics.unusedJsBytes)} wasted
                </p>
              </div>
            </div>
          </div>

          {/* CSS Coverage */}
          <div className="card p-4">
            <h5 className="text-sm font-medium text-gray-600 mb-2">CSS</h5>
            <div className="flex items-center gap-4">
              <div className="w-32 h-32">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={cssData}
                      cx="50%"
                      cy="50%"
                      innerRadius={25}
                      outerRadius={45}
                      paddingAngle={2}
                      dataKey="value"
                    >
                      {cssData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value) => `${(value as number).toFixed(1)}%`} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="space-y-2">
                <p className="text-sm">
                  <span className="inline-block w-3 h-3 bg-red-500 rounded mr-2" />
                  Unused: {(metrics.unusedCssPercent ?? 0).toFixed(1)}%
                </p>
                <p className="text-xs text-gray-500">
                  {formatBytes(metrics.unusedCssBytes)} wasted
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Recommendations */}
      {recommendations.length > 0 && (
        <div>
          <h4 className="text-sm font-medium text-gray-700 mb-3">
            Recommendations
          </h4>
          <div className="space-y-2">
            {recommendations.map((rec, idx) => (
              <div
                key={idx}
                className={`flex items-start gap-3 p-3 rounded-lg ${
                  rec.priority === "high"
                    ? "bg-red-50"
                    : rec.priority === "medium"
                      ? "bg-yellow-50"
                      : "bg-blue-50"
                }`}
              >
                {rec.priority === "high" ? (
                  <AlertTriangle className="w-5 h-5 text-red-600 flex-shrink-0" />
                ) : (
                  <CheckCircle className="w-5 h-5 text-blue-600 flex-shrink-0" />
                )}
                <div>
                  <p className="text-sm font-medium text-gray-800">{rec.title}</p>
                  <p className="text-xs text-gray-600">{rec.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Generate performance recommendations based on metrics
 */
function getRecommendations(
  metrics: PerformanceSectionProps["metrics"]
): Array<{ title: string; description: string; priority: "high" | "medium" | "low" }> {
  const recommendations: Array<{
    title: string;
    description: string;
    priority: "high" | "medium" | "low";
  }> = [];

  if (metrics.largestContentfulPaint && metrics.largestContentfulPaint > 2500) {
    recommendations.push({
      title: "Improve Largest Contentful Paint",
      description:
        "Optimize images, reduce server response time, and remove render-blocking resources.",
      priority: metrics.largestContentfulPaint > 4000 ? "high" : "medium",
    });
  }

  if (metrics.cumulativeLayoutShift && metrics.cumulativeLayoutShift > 0.1) {
    recommendations.push({
      title: "Reduce Layout Shifts",
      description:
        "Set explicit dimensions on images and videos, avoid inserting content above existing content.",
      priority: metrics.cumulativeLayoutShift > 0.25 ? "high" : "medium",
    });
  }

  if (metrics.unusedJsPercent && metrics.unusedJsPercent > 50) {
    recommendations.push({
      title: "Remove Unused JavaScript",
      description: `${metrics.unusedJsPercent.toFixed(0)}% of JavaScript is never executed. Use code splitting and tree shaking.`,
      priority: metrics.unusedJsPercent > 70 ? "high" : "medium",
    });
  }

  if (metrics.unusedCssPercent && metrics.unusedCssPercent > 50) {
    recommendations.push({
      title: "Remove Unused CSS",
      description: `${metrics.unusedCssPercent.toFixed(0)}% of CSS is unused. Use PurgeCSS or similar tools.`,
      priority: metrics.unusedCssPercent > 70 ? "high" : "medium",
    });
  }

  if (metrics.timeToFirstByte && metrics.timeToFirstByte > 800) {
    recommendations.push({
      title: "Reduce Server Response Time",
      description:
        "Optimize server configuration, use caching, or upgrade hosting.",
      priority: metrics.timeToFirstByte > 1800 ? "high" : "medium",
    });
  }

  return recommendations;
}
