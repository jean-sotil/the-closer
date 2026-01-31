import { useCallback } from "react";
import {
  ChevronUp,
  ChevronDown,
  ChevronsUpDown,
  ExternalLink,
} from "lucide-react";
import type { LeadProfile, ContactStatus } from "@the-closer/shared";
import type { LeadTableProps, SortConfig } from "./types";
import { LeadCard } from "./LeadCard";

/**
 * Status badge color mapping
 */
function getStatusColor(status: ContactStatus): string {
  switch (status) {
    case "pending":
      return "bg-yellow-100 text-yellow-800";
    case "emailed":
      return "bg-blue-100 text-blue-800";
    case "called":
      return "bg-purple-100 text-purple-800";
    case "booked":
      return "bg-indigo-100 text-indigo-800";
    case "converted":
      return "bg-green-100 text-green-800";
    case "declined":
      return "bg-red-100 text-red-800";
    default:
      return "bg-gray-100 text-gray-800";
  }
}

/**
 * Calculate qualification score based on lead data
 */
function calculateQualificationScore(lead: LeadProfile): number {
  let score = 50; // Base score

  // Lower rating = higher opportunity (max +20)
  if (lead.rating !== undefined) {
    if (lead.rating < 3) score += 20;
    else if (lead.rating < 4) score += 10;
  }

  // More pain points = higher opportunity (max +20)
  if (lead.painPoints.length >= 5) score += 20;
  else if (lead.painPoints.length >= 3) score += 15;
  else if (lead.painPoints.length >= 1) score += 10;

  // Low performance score = higher opportunity (max +10)
  if (lead.performanceScore !== undefined && lead.performanceScore < 50) {
    score += 10;
  }

  return Math.min(100, score);
}

/**
 * Sortable column header
 */
interface SortableHeaderProps {
  field: SortConfig["field"];
  label: string;
  sortConfig: SortConfig;
  onSort: (field: SortConfig["field"]) => void;
}

function SortableHeader({
  field,
  label,
  sortConfig,
  onSort,
}: SortableHeaderProps): React.ReactElement {
  const isActive = sortConfig.field === field;

  return (
    <button
      onClick={() => onSort(field)}
      className="flex items-center gap-1 text-left text-xs font-medium text-gray-500 uppercase tracking-wider hover:text-gray-700 group"
    >
      {label}
      {isActive ? (
        sortConfig.direction === "asc" ? (
          <ChevronUp className="w-4 h-4 text-primary-600" />
        ) : (
          <ChevronDown className="w-4 h-4 text-primary-600" />
        )
      ) : (
        <ChevronsUpDown className="w-4 h-4 text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity" />
      )}
    </button>
  );
}

/**
 * LeadTable component with sortable columns, checkbox selection, and expandable rows
 */
export function LeadTable({
  leads,
  isLoading,
  selectedIds,
  expandedId,
  sortConfig,
  onSelectionChange,
  onExpandToggle,
  onSortChange,
  onLeadClick,
}: LeadTableProps): React.ReactElement {
  const handleSort = useCallback(
    (field: SortConfig["field"]) => {
      const newDirection: "asc" | "desc" =
        sortConfig.field === field && sortConfig.direction === "asc"
          ? "desc"
          : "asc";
      onSortChange({ field, direction: newDirection });
    },
    [sortConfig, onSortChange]
  );

  const handleCheckboxChange = useCallback(
    (leadId: string, checked: boolean) => {
      const newSelection = new Set(selectedIds);
      if (checked) {
        newSelection.add(leadId);
      } else {
        newSelection.delete(leadId);
      }
      onSelectionChange(newSelection);
    },
    [selectedIds, onSelectionChange]
  );

  const handleRowClick = useCallback(
    (lead: LeadProfile, e: React.MouseEvent) => {
      // Don't expand if clicking checkbox or link
      const target = e.target as HTMLElement;
      if (
        target.closest('input[type="checkbox"]') ||
        target.closest("a") ||
        target.closest("button")
      ) {
        return;
      }
      onExpandToggle(expandedId === lead.id ? undefined : lead.id);
    },
    [expandedId, onExpandToggle]
  );

  // Placeholder handlers for LeadCard actions
  const handleAudit = useCallback((lead: LeadProfile) => {
    console.log("Audit:", lead.id);
    // TODO: Navigate to audit page or open audit modal
  }, []);

  const handleEmail = useCallback((lead: LeadProfile) => {
    console.log("Email:", lead.id);
    // TODO: Navigate to outreach page or open email modal
  }, []);

  const handleArchive = useCallback((lead: LeadProfile) => {
    console.log("Archive:", lead.id);
    // TODO: Update lead status to archived/declined
  }, []);

  if (isLoading) {
    return (
      <div className="card p-0 overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="w-12 px-4 py-3"></th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Business
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Category
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Rating
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Status
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Score
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Last Contacted
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {[...Array(5)].map((_, i) => (
              <tr key={i} className="animate-pulse">
                <td className="px-4 py-4">
                  <div className="w-4 h-4 bg-gray-200 rounded" />
                </td>
                <td className="px-6 py-4">
                  <div className="h-4 bg-gray-200 rounded w-32" />
                </td>
                <td className="px-6 py-4">
                  <div className="h-4 bg-gray-200 rounded w-20" />
                </td>
                <td className="px-6 py-4">
                  <div className="h-4 bg-gray-200 rounded w-12" />
                </td>
                <td className="px-6 py-4">
                  <div className="h-6 bg-gray-200 rounded w-16" />
                </td>
                <td className="px-6 py-4">
                  <div className="h-4 bg-gray-200 rounded w-8" />
                </td>
                <td className="px-6 py-4">
                  <div className="h-4 bg-gray-200 rounded w-24" />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  return (
    <div className="card p-0 overflow-hidden">
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            <th className="w-12 px-4 py-3">
              <span className="sr-only">Select</span>
            </th>
            <th className="px-6 py-3">
              <SortableHeader
                field="businessName"
                label="Business"
                sortConfig={sortConfig}
                onSort={handleSort}
              />
            </th>
            <th className="px-6 py-3">
              <SortableHeader
                field="businessCategory"
                label="Category"
                sortConfig={sortConfig}
                onSort={handleSort}
              />
            </th>
            <th className="px-6 py-3">
              <SortableHeader
                field="rating"
                label="Rating"
                sortConfig={sortConfig}
                onSort={handleSort}
              />
            </th>
            <th className="px-6 py-3">
              <SortableHeader
                field="contactStatus"
                label="Status"
                sortConfig={sortConfig}
                onSort={handleSort}
              />
            </th>
            <th className="px-6 py-3">
              <SortableHeader
                field="qualificationScore"
                label="Score"
                sortConfig={sortConfig}
                onSort={handleSort}
              />
            </th>
            <th className="px-6 py-3">
              <SortableHeader
                field="lastContactedAt"
                label="Last Contacted"
                sortConfig={sortConfig}
                onSort={handleSort}
              />
            </th>
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
          {leads.map((lead) => {
            const isSelected = selectedIds.has(lead.id);
            const isExpanded = expandedId === lead.id;
            const qualScore = calculateQualificationScore(lead);

            return (
              <tr key={lead.id} className="contents">
                <tr
                  onClick={(e) => handleRowClick(lead, e)}
                  className={`hover:bg-gray-50 cursor-pointer transition-colors ${
                    isSelected ? "bg-primary-50" : ""
                  } ${isExpanded ? "bg-gray-50" : ""}`}
                >
                  <td className="px-4 py-4 whitespace-nowrap">
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={(e) =>
                        handleCheckboxChange(lead.id, e.target.checked)
                      }
                      className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded cursor-pointer"
                    />
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div
                      className="font-medium text-gray-900 hover:text-primary-600 cursor-pointer"
                      onClick={() => onLeadClick(lead)}
                    >
                      {lead.businessName}
                    </div>
                    {lead.websiteUrl && (
                      <a
                        href={lead.websiteUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm text-gray-500 hover:text-primary-600 flex items-center gap-1"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <ExternalLink className="w-3 h-3" />
                        <span className="truncate max-w-[150px]">
                          {lead.websiteUrl.replace(/^https?:\/\//, "")}
                        </span>
                      </a>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {lead.businessCategory ?? "—"}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {lead.rating !== undefined ? (
                      <span
                        className={
                          lead.rating < 4 ? "text-yellow-600" : "text-gray-600"
                        }
                      >
                        ⭐ {lead.rating.toFixed(1)}
                      </span>
                    ) : (
                      <span className="text-gray-400">—</span>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span
                      className={`px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(lead.contactStatus)}`}
                    >
                      {lead.contactStatus}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center gap-2">
                      <div className="w-16 h-2 bg-gray-200 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full ${
                            qualScore >= 80
                              ? "bg-green-500"
                              : qualScore >= 60
                                ? "bg-yellow-500"
                                : "bg-gray-400"
                          }`}
                          style={{ width: `${qualScore}%` }}
                        />
                      </div>
                      <span className="text-sm text-gray-600">{qualScore}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {lead.lastContactedAt
                      ? new Date(lead.lastContactedAt).toLocaleDateString()
                      : "—"}
                  </td>
                </tr>
                {isExpanded && (
                  <tr>
                    <td colSpan={7} className="p-0">
                      <LeadCard
                        lead={lead}
                        onAudit={handleAudit}
                        onEmail={handleEmail}
                        onArchive={handleArchive}
                      />
                    </td>
                  </tr>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
