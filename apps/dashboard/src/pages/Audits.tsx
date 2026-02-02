import { useState, useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import { FileSearch, Play, Clock, CheckCircle, AlertTriangle } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import type { AuditResult, LeadProfile } from "@the-closer/shared";
import { supabase } from "../contexts/AuthContext";
import {
  AuditReport,
  CompareView,
  getScoreLevel,
  getScoreLevelColor,
} from "../components/audits";

/**
 * Fetch all audits with lead info
 */
async function fetchAudits(): Promise<
  Array<AuditResult & { lead?: LeadProfile }>
> {
  const { data, error } = await supabase
    .from("audit_results")
    .select("*, lead_profiles(*)")
    .order("audited_at", { ascending: false })
    .limit(50);

  if (error) throw error;

  return (data ?? []).map((row) => ({
    ...row,
    lead: row.lead_profiles,
  })) as Array<AuditResult & { lead?: LeadProfile }>;
}

/**
 * Fetch a single audit by ID
 */
async function fetchAuditById(id: string): Promise<AuditResult | null> {
  const { data, error } = await supabase
    .from("audit_results")
    .select("*")
    .eq("id", id)
    .single();

  if (error) {
    if (error.code === "PGRST116") return null;
    throw error;
  }

  return data as AuditResult;
}

/**
 * Audit list item component
 */
interface AuditListItemProps {
  audit: AuditResult & { lead?: LeadProfile };
  isSelected: boolean;
  onClick: () => void;
}

function AuditListItem({
  audit,
  isSelected,
  onClick,
}: AuditListItemProps): React.ReactElement {
  const date = new Date(audit.auditedAt);
  const perfLevel = getScoreLevel(audit.metrics.performanceScore);
  const perfColors = getScoreLevelColor(perfLevel);

  return (
    <button
      onClick={onClick}
      className={`w-full text-left p-4 border-b border-gray-100 hover:bg-gray-50 transition-colors ${
        isSelected ? "bg-primary-50 border-l-4 border-l-primary-500" : ""
      }`}
    >
      <div className="flex items-center justify-between">
        <div className="flex-1 min-w-0">
          <p className="font-medium text-gray-900 truncate">
            {audit.lead?.businessName ?? audit.url}
          </p>
          <p className="text-sm text-gray-500 truncate">{audit.url}</p>
        </div>
        <div className="flex items-center gap-3 ml-4">
          <span
            className={`px-2 py-1 rounded text-sm font-medium ${perfColors.bg} ${perfColors.text}`}
          >
            {audit.metrics.performanceScore ?? "—"}
          </span>
        </div>
      </div>
      <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
        <span className="flex items-center gap-1">
          <Clock className="w-3 h-3" />
          {date.toLocaleDateString()}
        </span>
        {audit.painPoints.length > 0 && (
          <span className="flex items-center gap-1 text-orange-600">
            <AlertTriangle className="w-3 h-3" />
            {audit.painPoints.length} issues
          </span>
        )}
        {audit.painPoints.length === 0 && (
          <span className="flex items-center gap-1 text-green-600">
            <CheckCircle className="w-3 h-3" />
            No issues
          </span>
        )}
      </div>
    </button>
  );
}

/**
 * Audits page with list and detail view
 */
export function Audits(): JSX.Element {
  const [searchParams, setSearchParams] = useSearchParams();
  const selectedId = searchParams.get("id");
  const [compareAuditId, setCompareAuditId] = useState<string | null>(null);

  // Fetch all audits
  const {
    data: audits = [],
    isLoading: auditsLoading,
    error: auditsError,
  } = useQuery({
    queryKey: ["audits"],
    queryFn: fetchAudits,
  });

  // Fetch selected audit details
  const { data: selectedAudit, isLoading: auditLoading } = useQuery({
    queryKey: ["audit", selectedId],
    queryFn: () => (selectedId ? fetchAuditById(selectedId) : null),
    enabled: !!selectedId,
  });

  // Fetch compare audit if selected
  const { data: compareAudit } = useQuery({
    queryKey: ["audit", compareAuditId],
    queryFn: () => (compareAuditId ? fetchAuditById(compareAuditId) : null),
    enabled: !!compareAuditId,
  });

  const handleSelectAudit = useCallback(
    (id: string) => {
      setSearchParams({ id });
    },
    [setSearchParams]
  );

  const handleExportPdf = useCallback(() => {
    // TODO: Implement PDF export
    console.log("Export PDF for audit:", selectedId);
    alert("PDF export coming soon!");
  }, [selectedId]);

  const handleCompare = useCallback(() => {
    // Find the previous audit for the same lead
    if (!selectedAudit) return;

    const previousAudit = audits.find(
      (a) =>
        a.id !== selectedAudit.id &&
        a.leadId === selectedAudit.leadId &&
        new Date(a.auditedAt) < new Date(selectedAudit.auditedAt)
    );

    if (previousAudit) {
      setCompareAuditId(previousAudit.id);
    } else {
      alert("No previous audit found for comparison");
    }
  }, [selectedAudit, audits]);

  // Calculate summary stats
  const stats = {
    total: audits.length,
    withIssues: audits.filter((a) => a.painPoints.length > 0).length,
    avgPerformance: audits.length
      ? Math.round(
          audits.reduce((sum, a) => sum + (a.metrics.performanceScore ?? 0), 0) /
            audits.length
        )
      : 0,
  };

  // Error state
  if (auditsError) {
    return (
      <div className="card bg-red-50 border-red-200">
        <p className="text-red-700">
          Failed to load audits: {(auditsError as Error).message}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <h1>Site Audits</h1>
        <button className="btn-primary inline-flex items-center gap-2">
          <Play className="w-4 h-4" />
          Run New Audit
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="card">
          <p className="text-sm text-gray-500">Total Audits</p>
          <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
        </div>
        <div className="card">
          <p className="text-sm text-gray-500">With Issues</p>
          <p className="text-2xl font-bold text-orange-600">{stats.withIssues}</p>
        </div>
        <div className="card">
          <p className="text-sm text-gray-500">Avg. Performance</p>
          <p
            className={`text-2xl font-bold ${getScoreLevelColor(getScoreLevel(stats.avgPerformance)).text}`}
          >
            {stats.avgPerformance || "—"}
          </p>
        </div>
      </div>

      {/* Main content */}
      <div className="flex gap-6">
        {/* Audit list sidebar */}
        <div className="w-80 flex-shrink-0">
          <div className="card p-0 overflow-hidden">
            <div className="p-4 border-b border-gray-200 bg-gray-50">
              <h2 className="font-semibold text-gray-900">Recent Audits</h2>
            </div>

            {auditsLoading ? (
              <div className="p-8 text-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 mx-auto"></div>
              </div>
            ) : audits.length === 0 ? (
              <div className="p-8 text-center text-gray-500">
                <FileSearch className="w-12 h-12 mx-auto mb-3 text-gray-400" />
                <p className="font-medium text-gray-900">No audits yet</p>
                <p className="text-sm">Run an audit to see results here.</p>
              </div>
            ) : (
              <div className="max-h-[600px] overflow-y-auto">
                {audits.map((audit) => (
                  <AuditListItem
                    key={audit.id}
                    audit={audit}
                    isSelected={audit.id === selectedId}
                    onClick={() => handleSelectAudit(audit.id)}
                  />
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Audit detail */}
        <div className="flex-1 min-w-0">
          {!selectedId ? (
            <div className="card">
              <div className="py-16 text-center text-gray-500">
                <FileSearch className="w-16 h-16 mx-auto mb-4 text-gray-400" />
                <p className="text-lg font-medium text-gray-900">
                  Select an audit to view details
                </p>
                <p className="text-sm">
                  Choose an audit from the list to see the full report.
                </p>
              </div>
            </div>
          ) : auditLoading ? (
            <div className="card">
              <div className="py-16 text-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto"></div>
                <p className="mt-4 text-gray-500">Loading audit report...</p>
              </div>
            </div>
          ) : selectedAudit ? (
            <AuditReport
              audit={selectedAudit}
              businessName={
                audits.find((a) => a.id === selectedId)?.lead?.businessName
              }
              onExportPdf={handleExportPdf}
              onCompare={handleCompare}
            />
          ) : (
            <div className="card bg-yellow-50 border-yellow-200">
              <p className="text-yellow-700">Audit not found</p>
            </div>
          )}
        </div>
      </div>

      {/* Compare modal */}
      {selectedAudit && compareAudit && (
        <CompareView
          auditA={compareAudit}
          auditB={selectedAudit}
          isOpen={!!compareAuditId}
          onClose={() => setCompareAuditId(null)}
        />
      )}
    </div>
  );
}
