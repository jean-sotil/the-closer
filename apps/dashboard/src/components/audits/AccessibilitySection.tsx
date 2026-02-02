import { Shield, AlertTriangle, ChevronDown, ChevronUp, ExternalLink } from "lucide-react";
import { useState } from "react";
import type { WCAGViolation } from "@the-closer/shared";
import type { AccessibilitySectionProps } from "./types";
import { groupViolationsBySeverity, getSeverityColor } from "./types";

/**
 * Single violation item with expandable details
 */
interface ViolationItemProps {
  violation: WCAGViolation;
}

function ViolationItem({ violation }: ViolationItemProps): React.ReactElement {
  const [expanded, setExpanded] = useState(false);
  const colors = getSeverityColor(violation.severity);

  return (
    <div className={`border rounded-lg ${colors.border} ${colors.bg}`}>
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between p-3 text-left"
      >
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <span
              className={`px-2 py-0.5 rounded text-xs font-medium ${colors.text} bg-white`}
            >
              {violation.severity}
            </span>
            <span className="text-sm font-medium text-gray-800">
              {violation.ruleId}
            </span>
            {violation.wcagCriteria && (
              <span className="text-xs text-gray-500">
                WCAG {violation.wcagCriteria}
              </span>
            )}
          </div>
          <p className="text-sm text-gray-600 mt-1">{violation.description}</p>
        </div>
        {expanded ? (
          <ChevronUp className="w-5 h-5 text-gray-400" />
        ) : (
          <ChevronDown className="w-5 h-5 text-gray-400" />
        )}
      </button>

      {expanded && (
        <div className="px-3 pb-3 space-y-3 border-t border-gray-200 pt-3">
          {/* Affected element */}
          {violation.elementSelector && (
            <div>
              <p className="text-xs font-medium text-gray-500 mb-1">
                Affected Element
              </p>
              <code className="block bg-gray-100 rounded p-2 text-xs text-gray-700 overflow-x-auto">
                {violation.elementSelector}
              </code>
            </div>
          )}

          {/* HTML snippet */}
          {violation.htmlSnippet && (
            <div>
              <p className="text-xs font-medium text-gray-500 mb-1">
                HTML Snippet
              </p>
              <pre className="bg-gray-100 rounded p-2 text-xs text-gray-700 overflow-x-auto">
                {violation.htmlSnippet}
              </pre>
            </div>
          )}

          {/* Recommendation */}
          <div>
            <p className="text-xs font-medium text-gray-500 mb-1">
              How to Fix
            </p>
            <p className="text-sm text-gray-700">{violation.recommendation}</p>
          </div>

          {/* WCAG link */}
          {violation.wcagCriteria && (
            <a
              href={`https://www.w3.org/WAI/WCAG21/Understanding/${violation.wcagCriteria.toLowerCase().replace(/\./g, "")}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-sm text-primary-600 hover:underline"
            >
              <ExternalLink className="w-3 h-3" />
              View WCAG {violation.wcagCriteria} documentation
            </a>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * Violation group section
 */
interface ViolationGroupProps {
  title: string;
  violations: WCAGViolation[];
  defaultExpanded?: boolean;
}

function ViolationGroup({
  title,
  violations,
  defaultExpanded = true,
}: ViolationGroupProps): React.ReactElement | null {
  const [expanded, setExpanded] = useState(defaultExpanded);

  if (violations.length === 0) return null;

  const firstViolation = violations[0];
  const colors = firstViolation ? getSeverityColor(firstViolation.severity) : getSeverityColor("minor");

  return (
    <div className="space-y-2">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-2 text-sm font-medium text-gray-700 hover:text-gray-900"
      >
        {expanded ? (
          <ChevronDown className="w-4 h-4" />
        ) : (
          <ChevronUp className="w-4 h-4" />
        )}
        <span className={`px-2 py-0.5 rounded ${colors.bg} ${colors.text}`}>
          {title}
        </span>
        <span className="text-gray-500">({violations.length})</span>
      </button>

      {expanded && (
        <div className="space-y-2 pl-6">
          {violations.map((violation, idx) => (
            <ViolationItem key={`${violation.ruleId}-${idx}`} violation={violation} />
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * Accessibility section with grouped violations
 */
export function AccessibilitySection({
  violations,
  score,
}: AccessibilitySectionProps): React.ReactElement {
  const grouped = groupViolationsBySeverity(violations);
  const hasCritical = grouped.critical.length > 0;
  const totalCount = violations.length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Shield className="w-5 h-5 text-primary-600" />
          <h3 className="text-lg font-semibold text-gray-900">
            Accessibility Audit
          </h3>
        </div>
        {score !== undefined && (
          <span
            className={`text-2xl font-bold ${
              score >= 90
                ? "text-green-600"
                : score >= 50
                  ? "text-yellow-600"
                  : "text-red-600"
            }`}
          >
            {score}/100
          </span>
        )}
      </div>

      {/* Legal risk warning */}
      {hasCritical && (
        <div className="flex items-start gap-3 p-4 bg-red-50 border border-red-200 rounded-lg">
          <AlertTriangle className="w-6 h-6 text-red-600 flex-shrink-0" />
          <div>
            <h4 className="font-medium text-red-800">Legal Risk Warning</h4>
            <p className="text-sm text-red-700 mt-1">
              This site has {grouped.critical.length} critical accessibility
              violation{grouped.critical.length > 1 ? "s" : ""} that may expose the
              business to legal liability under ADA and WCAG compliance laws.
            </p>
          </div>
        </div>
      )}

      {/* Summary stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="card p-4">
          <p className="text-sm text-gray-500">Total Issues</p>
          <p className="text-2xl font-bold text-gray-900">{totalCount}</p>
        </div>
        <div className="card p-4 border-red-200">
          <p className="text-sm text-gray-500">Critical</p>
          <p className="text-2xl font-bold text-red-600">
            {grouped.critical.length}
          </p>
        </div>
        <div className="card p-4 border-orange-200">
          <p className="text-sm text-gray-500">Serious</p>
          <p className="text-2xl font-bold text-orange-600">
            {grouped.serious.length}
          </p>
        </div>
        <div className="card p-4 border-yellow-200">
          <p className="text-sm text-gray-500">Moderate</p>
          <p className="text-2xl font-bold text-yellow-600">
            {grouped.moderate.length}
          </p>
        </div>
      </div>

      {/* Violation groups */}
      {totalCount > 0 ? (
        <div className="space-y-4">
          <ViolationGroup
            title="Critical"
            violations={grouped.critical}
            defaultExpanded={true}
          />
          <ViolationGroup
            title="Serious"
            violations={grouped.serious}
            defaultExpanded={grouped.critical.length === 0}
          />
          <ViolationGroup
            title="Moderate"
            violations={grouped.moderate}
            defaultExpanded={false}
          />
          <ViolationGroup
            title="Minor"
            violations={grouped.minor}
            defaultExpanded={false}
          />
        </div>
      ) : (
        <div className="text-center py-8 text-gray-500">
          <Shield className="w-12 h-12 mx-auto mb-3 text-green-500" />
          <p className="font-medium text-gray-900">No accessibility issues found</p>
          <p className="text-sm">
            Great job! The site passes all automated accessibility checks.
          </p>
        </div>
      )}
    </div>
  );
}
