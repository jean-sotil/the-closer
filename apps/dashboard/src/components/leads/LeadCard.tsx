import {
  ExternalLink,
  Phone,
  MapPin,
  Star,
  AlertTriangle,
  FileSearch,
  Mail,
  Archive,
  Clock,
  BarChart3,
  Shield,
} from "lucide-react";
import type { PainPoint } from "@the-closer/shared";
import type { LeadCardProps } from "./types";

/**
 * Get severity color class
 */
function getSeverityColor(severity: string): string {
  switch (severity) {
    case "CRITICAL":
      return "text-red-600 bg-red-50";
    case "HIGH":
      return "text-orange-600 bg-orange-50";
    case "MEDIUM":
      return "text-yellow-600 bg-yellow-50";
    case "LOW":
      return "text-blue-600 bg-blue-50";
    default:
      return "text-gray-600 bg-gray-50";
  }
}

/**
 * Format pain point type for display
 */
function formatPainPointType(type: string): string {
  return type
    .replace(/_/g, " ")
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

/**
 * Pain point badge component
 */
function PainPointBadge({ painPoint }: { painPoint: PainPoint }): React.ReactElement {
  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium ${getSeverityColor(painPoint.severity)}`}
    >
      <AlertTriangle className="w-3 h-3" />
      {formatPainPointType(painPoint.type)}
      <span className="opacity-75">({painPoint.value})</span>
    </span>
  );
}

/**
 * LeadCard component for expanded row preview
 */
export function LeadCard({
  lead,
  onAudit,
  onEmail,
  onArchive,
}: LeadCardProps): React.ReactElement {
  const hasAuditData =
    lead.performanceScore !== undefined ||
    lead.accessibilityScore !== undefined ||
    lead.painPoints.length > 0;

  return (
    <div className="bg-gray-50 border-t border-b border-gray-200 p-6">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Lead details */}
        <div className="space-y-4">
          <h3 className="font-semibold text-gray-900 text-lg">
            {lead.businessName}
          </h3>

          <div className="space-y-2 text-sm">
            {lead.address && (
              <div className="flex items-start gap-2 text-gray-600">
                <MapPin className="w-4 h-4 mt-0.5 flex-shrink-0" />
                <span>{lead.address}</span>
              </div>
            )}

            {lead.phoneNumber && (
              <div className="flex items-center gap-2 text-gray-600">
                <Phone className="w-4 h-4 flex-shrink-0" />
                <a
                  href={`tel:${lead.phoneNumber}`}
                  className="hover:text-primary-600 hover:underline"
                >
                  {lead.phoneNumber}
                </a>
              </div>
            )}

            {lead.websiteUrl && (
              <div className="flex items-center gap-2 text-gray-600">
                <ExternalLink className="w-4 h-4 flex-shrink-0" />
                <a
                  href={lead.websiteUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-primary-600 hover:underline truncate max-w-[250px]"
                >
                  {lead.websiteUrl.replace(/^https?:\/\//, "")}
                </a>
              </div>
            )}

            {lead.rating !== undefined && (
              <div className="flex items-center gap-2 text-gray-600">
                <Star className="w-4 h-4 flex-shrink-0 text-yellow-500" />
                <span>
                  {lead.rating.toFixed(1)} stars
                  {lead.reviewCount !== undefined && (
                    <span className="text-gray-400">
                      {" "}
                      ({lead.reviewCount} reviews)
                    </span>
                  )}
                </span>
              </div>
            )}

            {lead.lastContactedAt && (
              <div className="flex items-center gap-2 text-gray-600">
                <Clock className="w-4 h-4 flex-shrink-0" />
                <span>
                  Last contacted:{" "}
                  {new Date(lead.lastContactedAt).toLocaleDateString()}
                </span>
              </div>
            )}
          </div>

          {lead.notes && (
            <div className="mt-4 p-3 bg-white rounded-lg border border-gray-200">
              <p className="text-sm text-gray-600">{lead.notes}</p>
            </div>
          )}
        </div>

        {/* Metrics and scores */}
        <div className="space-y-4">
          <h4 className="font-medium text-gray-900 flex items-center gap-2">
            <BarChart3 className="w-4 h-4" />
            Audit Metrics
          </h4>

          {hasAuditData ? (
            <div className="space-y-3">
              {lead.performanceScore !== undefined && (
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Performance</span>
                  <div className="flex items-center gap-2">
                    <div className="w-32 h-2 bg-gray-200 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full ${
                          lead.performanceScore >= 90
                            ? "bg-green-500"
                            : lead.performanceScore >= 50
                              ? "bg-yellow-500"
                              : "bg-red-500"
                        }`}
                        style={{ width: `${lead.performanceScore}%` }}
                      />
                    </div>
                    <span
                      className={`text-sm font-medium w-8 text-right ${
                        lead.performanceScore >= 90
                          ? "text-green-600"
                          : lead.performanceScore >= 50
                            ? "text-yellow-600"
                            : "text-red-600"
                      }`}
                    >
                      {lead.performanceScore}
                    </span>
                  </div>
                </div>
              )}

              {lead.accessibilityScore !== undefined && (
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600 flex items-center gap-1">
                    <Shield className="w-3 h-3" />
                    Accessibility
                  </span>
                  <div className="flex items-center gap-2">
                    <div className="w-32 h-2 bg-gray-200 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full ${
                          lead.accessibilityScore >= 90
                            ? "bg-green-500"
                            : lead.accessibilityScore >= 50
                              ? "bg-yellow-500"
                              : "bg-red-500"
                        }`}
                        style={{ width: `${lead.accessibilityScore}%` }}
                      />
                    </div>
                    <span
                      className={`text-sm font-medium w-8 text-right ${
                        lead.accessibilityScore >= 90
                          ? "text-green-600"
                          : lead.accessibilityScore >= 50
                            ? "text-yellow-600"
                            : "text-red-600"
                      }`}
                    >
                      {lead.accessibilityScore}
                    </span>
                  </div>
                </div>
              )}

              {lead.mobileFriendly !== undefined && (
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Mobile Friendly</span>
                  <span
                    className={`text-sm font-medium ${
                      lead.mobileFriendly ? "text-green-600" : "text-red-600"
                    }`}
                  >
                    {lead.mobileFriendly ? "Yes" : "No"}
                  </span>
                </div>
              )}

              {lead.painPoints.length > 0 && (
                <div className="pt-2">
                  <p className="text-sm text-gray-600 mb-2">
                    Pain Points ({lead.painPoints.length})
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {lead.painPoints.slice(0, 5).map((pp, idx) => (
                      <PainPointBadge key={idx} painPoint={pp} />
                    ))}
                    {lead.painPoints.length > 5 && (
                      <span className="text-xs text-gray-500 self-center">
                        +{lead.painPoints.length - 5} more
                      </span>
                    )}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="text-sm text-gray-500 italic">
              No audit data available. Run an audit to identify issues.
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="space-y-4">
          <h4 className="font-medium text-gray-900">Quick Actions</h4>

          <div className="flex flex-col gap-2">
            <button
              onClick={() => onAudit(lead)}
              className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors text-sm font-medium"
            >
              <FileSearch className="w-4 h-4" />
              {hasAuditData ? "Re-run Audit" : "Run Audit"}
            </button>

            <button
              onClick={() => onEmail(lead)}
              className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors text-sm font-medium"
            >
              <Mail className="w-4 h-4" />
              Send Email
            </button>

            <button
              onClick={() => onArchive(lead)}
              className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors text-sm font-medium"
            >
              <Archive className="w-4 h-4" />
              Archive Lead
            </button>
          </div>

          {/* Evidence links */}
          {lead.evidenceUrls.length > 0 && (
            <div className="pt-4 border-t border-gray-200">
              <p className="text-sm text-gray-600 mb-2">
                Evidence ({lead.evidenceUrls.length})
              </p>
              <div className="space-y-1">
                {lead.evidenceUrls.slice(0, 3).map((evidence, idx) => (
                  <a
                    key={idx}
                    href={evidence.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 text-sm text-primary-600 hover:underline"
                  >
                    <ExternalLink className="w-3 h-3" />
                    {evidence.type}
                    {evidence.description && ` - ${evidence.description}`}
                  </a>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
