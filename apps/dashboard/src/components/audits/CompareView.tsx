import { Fragment } from "react";
import { Dialog, Transition } from "@headlessui/react";
import {
  X,
  ArrowUp,
  ArrowDown,
  Minus,
  TrendingUp,
  TrendingDown,
  Calendar,
} from "lucide-react";
import type { AuditResult } from "@the-closer/shared";
import { getScoreLevel, getScoreLevelColor } from "./types";

interface CompareViewProps {
  auditA: AuditResult;
  auditB: AuditResult;
  isOpen: boolean;
  onClose: () => void;
}

/**
 * Delta indicator showing change between two values
 */
function DeltaIndicator({
  valueA,
  valueB,
  higherIsBetter = true,
}: {
  valueA: number | undefined;
  valueB: number | undefined;
  higherIsBetter?: boolean;
}): React.ReactElement {
  if (valueA === undefined || valueB === undefined) {
    return <span className="text-gray-400">—</span>;
  }

  const delta = valueB - valueA;
  const isPositive = higherIsBetter ? delta > 0 : delta < 0;
  const isNegative = higherIsBetter ? delta < 0 : delta > 0;

  if (delta === 0) {
    return (
      <span className="flex items-center gap-1 text-gray-500">
        <Minus className="w-4 h-4" />
        No change
      </span>
    );
  }

  return (
    <span
      className={`flex items-center gap-1 ${
        isPositive ? "text-green-600" : isNegative ? "text-red-600" : "text-gray-600"
      }`}
    >
      {delta > 0 ? (
        <ArrowUp className="w-4 h-4" />
      ) : (
        <ArrowDown className="w-4 h-4" />
      )}
      {delta > 0 ? "+" : ""}
      {delta}
    </span>
  );
}

/**
 * Metric comparison row
 */
function MetricRow({
  label,
  valueA,
  valueB,
  unit = "",
  higherIsBetter = true,
}: {
  label: string;
  valueA: number | undefined;
  valueB: number | undefined;
  unit?: string;
  higherIsBetter?: boolean;
}): React.ReactElement {
  const levelA = getScoreLevel(valueA);
  const levelB = getScoreLevel(valueB);
  const colorsA = getScoreLevelColor(levelA);
  const colorsB = getScoreLevelColor(levelB);

  return (
    <tr>
      <td className="py-3 text-sm text-gray-700">{label}</td>
      <td className="py-3 text-right">
        <span className={`font-medium ${colorsA.text}`}>
          {valueA !== undefined ? `${valueA}${unit}` : "—"}
        </span>
      </td>
      <td className="py-3 text-right">
        <span className={`font-medium ${colorsB.text}`}>
          {valueB !== undefined ? `${valueB}${unit}` : "—"}
        </span>
      </td>
      <td className="py-3 text-right">
        <DeltaIndicator
          valueA={valueA}
          valueB={valueB}
          higherIsBetter={higherIsBetter}
        />
      </td>
    </tr>
  );
}

/**
 * Side-by-side audit comparison view
 */
export function CompareView({
  auditA,
  auditB,
  isOpen,
  onClose,
}: CompareViewProps): React.ReactElement {
  const dateA = new Date(auditA.auditedAt);
  const dateB = new Date(auditB.auditedAt);

  // Calculate overall improvement
  const perfDelta =
    (auditB.metrics.performanceScore ?? 0) -
    (auditA.metrics.performanceScore ?? 0);
  const a11yDelta =
    (auditB.accessibilityScore ?? 0) - (auditA.accessibilityScore ?? 0);
  const painPointsDelta = auditA.painPoints.length - auditB.painPoints.length;

  const overallTrend = perfDelta + a11yDelta + painPointsDelta > 0;

  return (
    <Transition appear show={isOpen} as={Fragment}>
      <Dialog as="div" className="relative z-50" onClose={onClose}>
        <Transition.Child
          as={Fragment}
          enter="ease-out duration-300"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-200"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-black bg-opacity-25" />
        </Transition.Child>

        <div className="fixed inset-0 overflow-y-auto">
          <div className="flex min-h-full items-center justify-center p-4">
            <Transition.Child
              as={Fragment}
              enter="ease-out duration-300"
              enterFrom="opacity-0 scale-95"
              enterTo="opacity-100 scale-100"
              leave="ease-in duration-200"
              leaveFrom="opacity-100 scale-100"
              leaveTo="opacity-0 scale-95"
            >
              <Dialog.Panel className="w-full max-w-4xl transform overflow-hidden rounded-2xl bg-white shadow-xl transition-all">
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 bg-gray-50 border-b border-gray-200">
                  <Dialog.Title className="text-lg font-semibold text-gray-900">
                    Audit Comparison
                  </Dialog.Title>
                  <button
                    onClick={onClose}
                    className="p-2 text-gray-400 hover:text-gray-600 rounded"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                {/* Overall trend banner */}
                <div
                  className={`px-6 py-3 flex items-center justify-center gap-2 ${
                    overallTrend
                      ? "bg-green-50 text-green-700"
                      : "bg-red-50 text-red-700"
                  }`}
                >
                  {overallTrend ? (
                    <>
                      <TrendingUp className="w-5 h-5" />
                      <span className="font-medium">Overall Improvement</span>
                    </>
                  ) : (
                    <>
                      <TrendingDown className="w-5 h-5" />
                      <span className="font-medium">Regression Detected</span>
                    </>
                  )}
                </div>

                {/* Content */}
                <div className="p-6">
                  {/* Date headers */}
                  <div className="grid grid-cols-4 gap-4 mb-6">
                    <div></div>
                    <div className="text-center">
                      <span className="inline-flex items-center gap-2 px-3 py-1 bg-gray-100 rounded-full text-sm text-gray-700">
                        <Calendar className="w-4 h-4" />
                        {dateA.toLocaleDateString()}
                      </span>
                      <p className="text-xs text-gray-500 mt-1">Baseline</p>
                    </div>
                    <div className="text-center">
                      <span className="inline-flex items-center gap-2 px-3 py-1 bg-primary-100 rounded-full text-sm text-primary-700">
                        <Calendar className="w-4 h-4" />
                        {dateB.toLocaleDateString()}
                      </span>
                      <p className="text-xs text-gray-500 mt-1">Current</p>
                    </div>
                    <div className="text-center">
                      <span className="text-sm font-medium text-gray-600">
                        Change
                      </span>
                    </div>
                  </div>

                  {/* Metrics table */}
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-gray-200">
                        <th className="py-2 text-left text-sm font-medium text-gray-500">
                          Metric
                        </th>
                        <th className="py-2 text-right text-sm font-medium text-gray-500">
                          Before
                        </th>
                        <th className="py-2 text-right text-sm font-medium text-gray-500">
                          After
                        </th>
                        <th className="py-2 text-right text-sm font-medium text-gray-500">
                          Delta
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {/* Main scores */}
                      <MetricRow
                        label="Performance Score"
                        valueA={auditA.metrics.performanceScore}
                        valueB={auditB.metrics.performanceScore}
                        higherIsBetter={true}
                      />
                      <MetricRow
                        label="Accessibility Score"
                        valueA={auditA.accessibilityScore}
                        valueB={auditB.accessibilityScore}
                        higherIsBetter={true}
                      />
                      <MetricRow
                        label="Pain Points"
                        valueA={auditA.painPoints.length}
                        valueB={auditB.painPoints.length}
                        higherIsBetter={false}
                      />
                      <MetricRow
                        label="WCAG Violations"
                        valueA={auditA.wcagViolations.length}
                        valueB={auditB.wcagViolations.length}
                        higherIsBetter={false}
                      />
                      <MetricRow
                        label="Responsive Issues"
                        valueA={auditA.responsiveIssues.length}
                        valueB={auditB.responsiveIssues.length}
                        higherIsBetter={false}
                      />

                      {/* Performance metrics */}
                      <tr>
                        <td colSpan={4} className="pt-4 pb-2">
                          <span className="text-sm font-medium text-gray-700">
                            Core Web Vitals
                          </span>
                        </td>
                      </tr>
                      <MetricRow
                        label="First Contentful Paint"
                        valueA={auditA.metrics.firstContentfulPaint}
                        valueB={auditB.metrics.firstContentfulPaint}
                        unit="ms"
                        higherIsBetter={false}
                      />
                      <MetricRow
                        label="Largest Contentful Paint"
                        valueA={auditA.metrics.largestContentfulPaint}
                        valueB={auditB.metrics.largestContentfulPaint}
                        unit="ms"
                        higherIsBetter={false}
                      />
                      <MetricRow
                        label="Time to Interactive"
                        valueA={auditA.metrics.timeToInteractive}
                        valueB={auditB.metrics.timeToInteractive}
                        unit="ms"
                        higherIsBetter={false}
                      />
                    </tbody>
                  </table>
                </div>

                {/* Footer */}
                <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 flex justify-end">
                  <button
                    onClick={onClose}
                    className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
                  >
                    Close
                  </button>
                </div>
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition>
  );
}
