import {
  Calendar,
  Clock,
  Mail,
  Users,
  Edit2,
  Download,
  Play,
  Pause,
  CheckCircle,
} from "lucide-react";
import type { CampaignStatus } from "@the-closer/shared";
import type { CampaignDetailProps } from "./types";
import { getStatusColor } from "./types";

interface SequenceStepProps {
  step: number;
  subject: string;
  delay: string;
  isLast: boolean;
}

function SequenceStep({ step, subject, delay, isLast }: SequenceStepProps): React.ReactElement {
  return (
    <div className="flex items-start gap-3">
      <div className="flex flex-col items-center">
        <div className="w-8 h-8 rounded-full bg-primary-100 flex items-center justify-center">
          <span className="text-sm font-bold text-primary-700">{step}</span>
        </div>
        {!isLast && <div className="w-0.5 h-12 bg-gray-200 mt-1" />}
      </div>
      <div className="flex-1 pb-4">
        <p className="text-sm font-medium text-gray-900">{subject}</p>
        <p className="text-xs text-gray-500 mt-0.5">{delay}</p>
      </div>
    </div>
  );
}

/**
 * Campaign detail header and sequence visualization
 */
export function CampaignDetail({
  campaign,
  onEdit,
  onExport,
}: CampaignDetailProps): React.ReactElement {
  const statusColors = getStatusColor(campaign.status);

  // Mock sequence steps - in real implementation, this would come from campaign.sequence
  const sequenceSteps = [
    { subject: "Initial Outreach", delay: "Immediately" },
    { subject: "Follow-up #1", delay: "3 days after no reply" },
    { subject: "Follow-up #2", delay: "5 days after no reply" },
    { subject: "Final Follow-up", delay: "7 days after no reply" },
  ];

  const formatDate = (date: string | Date | undefined) => {
    if (!date) return "Not set";
    return new Date(date).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  const getStatusIcon = (status: CampaignStatus) => {
    switch (status) {
      case "active":
        return <Play className="w-4 h-4" />;
      case "paused":
        return <Pause className="w-4 h-4" />;
      case "completed":
        return <CheckCircle className="w-4 h-4" />;
      default:
        return null;
    }
  };

  return (
    <div className="card">
      {/* Header */}
      <div className="p-4 border-b border-gray-200">
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <h2 className="text-xl font-bold text-gray-900">{campaign.name}</h2>
              <span
                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${statusColors.bg} ${statusColors.text}`}
              >
                {getStatusIcon(campaign.status)}
                {campaign.status}
              </span>
            </div>
            {campaign.description && (
              <p className="text-sm text-gray-600">{campaign.description}</p>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onEdit}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              <Edit2 className="w-4 h-4" />
              Edit
            </button>
            <button
              onClick={onExport}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              <Download className="w-4 h-4" />
              Export
            </button>
          </div>
        </div>
      </div>

      {/* Campaign Info */}
      <div className="p-4 grid grid-cols-2 md:grid-cols-4 gap-4 border-b border-gray-200">
        <div className="flex items-center gap-2">
          <Users className="w-5 h-5 text-gray-400" />
          <div>
            <p className="text-xs text-gray-500">Total Leads</p>
            <p className="text-sm font-medium text-gray-900">
              {campaign.totalLeads?.toLocaleString() ?? 0}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Mail className="w-5 h-5 text-gray-400" />
          <div>
            <p className="text-xs text-gray-500">Emails Sent</p>
            <p className="text-sm font-medium text-gray-900">
              {campaign.emailsSent?.toLocaleString() ?? 0}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Calendar className="w-5 h-5 text-gray-400" />
          <div>
            <p className="text-xs text-gray-500">Started</p>
            <p className="text-sm font-medium text-gray-900">
              {formatDate(campaign.startedAt)}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Clock className="w-5 h-5 text-gray-400" />
          <div>
            <p className="text-xs text-gray-500">Completed</p>
            <p className="text-sm font-medium text-gray-900">
              {formatDate(campaign.completedAt)}
            </p>
          </div>
        </div>
      </div>

      {/* Email Sequence */}
      <div className="p-4">
        <h3 className="text-sm font-semibold text-gray-900 mb-4">Email Sequence</h3>
        <div className="pl-1">
          {sequenceSteps.map((step, index) => (
            <SequenceStep
              key={index}
              step={index + 1}
              subject={step.subject}
              delay={step.delay}
              isLast={index === sequenceSteps.length - 1}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
