import {
  ExternalLink,
  Calendar,
  Clock,
  Download,
  GitCompare,
  Zap,
  Shield,
  Smartphone,
} from "lucide-react";
import type { AuditResult } from "@the-closer/shared";
import { ScoreCard } from "./ScoreCard";
import { PerformanceSection } from "./PerformanceSection";
import { AccessibilitySection } from "./AccessibilitySection";
import { ResponsivenessSection } from "./ResponsivenessSection";
import { EvidenceGallery } from "./EvidenceGallery";

interface AuditReportProps {
  audit: AuditResult;
  businessName: string | undefined;
  onExportPdf: () => void;
  onCompare: (() => void) | undefined;
}

/**
 * Complete audit report with all sections
 */
export function AuditReport({
  audit,
  businessName,
  onExportPdf,
  onCompare,
}: AuditReportProps): React.ReactElement {
  const auditDate = new Date(audit.auditedAt);
  const formattedDate = auditDate.toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  const formattedTime = auditDate.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });

  // Calculate mobile-friendly score from responsive issues
  const responsiveScore = audit.mobileFriendly
    ? audit.responsiveIssues.length === 0
      ? 100
      : Math.max(0, 100 - audit.responsiveIssues.length * 15)
    : 30;

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="card p-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">
              {businessName ?? "Site Audit Report"}
            </h2>
            <div className="flex flex-wrap items-center gap-4 mt-2 text-sm text-gray-600">
              <a
                href={audit.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 text-primary-600 hover:underline"
              >
                <ExternalLink className="w-4 h-4" />
                {audit.url}
              </a>
              <span className="flex items-center gap-1">
                <Calendar className="w-4 h-4" />
                {formattedDate}
              </span>
              <span className="flex items-center gap-1">
                <Clock className="w-4 h-4" />
                {formattedTime}
              </span>
              {audit.durationMs && (
                <span className="text-gray-500">
                  Audit completed in {(audit.durationMs / 1000).toFixed(1)}s
                </span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            {onCompare && (
              <button
                onClick={onCompare}
                className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                <GitCompare className="w-4 h-4" />
                Compare
              </button>
            )}
            <button
              onClick={onExportPdf}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-primary-600 rounded-lg hover:bg-primary-700"
            >
              <Download className="w-4 h-4" />
              Export PDF
            </button>
          </div>
        </div>

        {/* Error banner if audit had issues */}
        {audit.error && (
          <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-sm text-red-700">
              <strong>Audit Warning:</strong> {audit.error}
            </p>
          </div>
        )}
      </div>

      {/* Score summary cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <ScoreCard
          label="Performance"
          score={audit.metrics.performanceScore}
          icon={Zap}
          description="Page speed and loading metrics"
        />
        <ScoreCard
          label="Accessibility"
          score={audit.accessibilityScore}
          icon={Shield}
          description="WCAG compliance status"
        />
        <ScoreCard
          label="Responsiveness"
          score={responsiveScore}
          icon={Smartphone}
          description="Mobile and tablet compatibility"
        />
      </div>

      {/* Pain points summary */}
      {audit.painPoints.length > 0 && (
        <div className="card p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            Key Issues Identified ({audit.painPoints.length})
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {audit.painPoints.map((pp, idx) => {
              const severityColors = {
                CRITICAL: "border-red-500 bg-red-50",
                HIGH: "border-orange-500 bg-orange-50",
                MEDIUM: "border-yellow-500 bg-yellow-50",
                LOW: "border-blue-500 bg-blue-50",
              };
              return (
                <div
                  key={idx}
                  className={`p-4 rounded-lg border-l-4 ${severityColors[pp.severity]}`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-gray-900">
                      {pp.type.replace(/_/g, " ")}
                    </span>
                    <span
                      className={`text-xs px-2 py-0.5 rounded ${
                        pp.severity === "CRITICAL"
                          ? "bg-red-100 text-red-700"
                          : pp.severity === "HIGH"
                            ? "bg-orange-100 text-orange-700"
                            : pp.severity === "MEDIUM"
                              ? "bg-yellow-100 text-yellow-700"
                              : "bg-blue-100 text-blue-700"
                      }`}
                    >
                      {pp.severity}
                    </span>
                  </div>
                  <p className="text-lg font-bold text-gray-800">{pp.value}</p>
                  {pp.description && (
                    <p className="text-xs text-gray-600 mt-1">{pp.description}</p>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Performance section */}
      <div className="card p-6">
        <PerformanceSection metrics={audit.metrics} />
      </div>

      {/* Accessibility section */}
      <div className="card p-6">
        <AccessibilitySection
          violations={audit.wcagViolations}
          score={audit.accessibilityScore}
        />
      </div>

      {/* Responsiveness section */}
      <div className="card p-6">
        <ResponsivenessSection
          issues={audit.responsiveIssues}
          mobileFriendly={audit.mobileFriendly}
          viewports={audit.testedViewports}
          evidence={audit.evidence}
        />
      </div>

      {/* Evidence gallery */}
      <div className="card p-6">
        <EvidenceGallery
          items={audit.evidence}
          onItemClick={(item) => console.log("View evidence:", item)}
        />
      </div>
    </div>
  );
}
