import { Play, Pause, Mail, Eye, MessageSquare } from "lucide-react";
import type { CampaignStatus } from "@the-closer/shared";
import type { CampaignListProps } from "./types";
import { getStatusColor } from "./types";

/**
 * Campaign list with status indicators and quick actions
 */
export function CampaignList({
  campaigns,
  selectedId,
  onSelect,
  onToggleStatus,
}: CampaignListProps): React.ReactElement {
  if (campaigns.length === 0) {
    return (
      <div className="card p-8 text-center text-gray-500">
        <Mail className="w-12 h-12 mx-auto mb-3 text-gray-400" />
        <p className="font-medium text-gray-900">No campaigns yet</p>
        <p className="text-sm">Create your first campaign to start outreach.</p>
      </div>
    );
  }

  return (
    <div className="card p-0 overflow-hidden">
      <div className="p-4 border-b border-gray-200 bg-gray-50">
        <h2 className="font-semibold text-gray-900">Campaigns</h2>
      </div>

      <div className="divide-y divide-gray-100">
        {campaigns.map((campaign) => {
          const isSelected = campaign.id === selectedId;
          const statusColors = getStatusColor(campaign.status);
          const canToggle = campaign.status === "active" || campaign.status === "paused";

          return (
            <button
              key={campaign.id}
              onClick={() => onSelect(campaign.id)}
              className={`w-full text-left p-4 hover:bg-gray-50 transition-colors ${
                isSelected ? "bg-primary-50 border-l-4 border-l-primary-500" : ""
              }`}
            >
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  {/* Campaign name and status */}
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-medium text-gray-900 truncate">
                      {campaign.name}
                    </span>
                    <span
                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${statusColors.bg} ${statusColors.text}`}
                    >
                      <span className={`w-1.5 h-1.5 rounded-full ${statusColors.dot}`} />
                      {campaign.status}
                    </span>
                  </div>

                  {/* Progress bar */}
                  <div className="mb-2">
                    <div className="flex items-center justify-between text-xs text-gray-500 mb-1">
                      <span>
                        {campaign.emailsSent} / {campaign.totalLeads} leads
                      </span>
                      <span>
                        {campaign.totalLeads > 0
                          ? Math.round((campaign.emailsSent / campaign.totalLeads) * 100)
                          : 0}
                        %
                      </span>
                    </div>
                    <div className="w-full h-1.5 bg-gray-200 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-primary-500 rounded-full transition-all"
                        style={{
                          width: `${
                            campaign.totalLeads > 0
                              ? (campaign.emailsSent / campaign.totalLeads) * 100
                              : 0
                          }%`,
                        }}
                      />
                    </div>
                  </div>

                  {/* Quick stats */}
                  <div className="flex items-center gap-4 text-xs text-gray-500">
                    <span className="flex items-center gap-1">
                      <Mail className="w-3 h-3" />
                      {campaign.metrics.sent} sent
                    </span>
                    <span className="flex items-center gap-1">
                      <Eye className="w-3 h-3" />
                      {campaign.metrics.opened} opened
                    </span>
                    <span className="flex items-center gap-1">
                      <MessageSquare className="w-3 h-3" />
                      {campaign.metrics.replied} replied
                    </span>
                  </div>
                </div>

                {/* Play/Pause button */}
                {canToggle && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      const newStatus: CampaignStatus =
                        campaign.status === "active" ? "paused" : "active";
                      onToggleStatus(campaign.id, newStatus);
                    }}
                    className={`p-2 rounded-lg transition-colors ${
                      campaign.status === "active"
                        ? "bg-yellow-100 text-yellow-700 hover:bg-yellow-200"
                        : "bg-green-100 text-green-700 hover:bg-green-200"
                    }`}
                    title={campaign.status === "active" ? "Pause campaign" : "Resume campaign"}
                  >
                    {campaign.status === "active" ? (
                      <Pause className="w-4 h-4" />
                    ) : (
                      <Play className="w-4 h-4" />
                    )}
                  </button>
                )}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
