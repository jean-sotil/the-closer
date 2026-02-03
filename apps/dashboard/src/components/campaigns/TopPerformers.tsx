import { TrendingUp, TrendingDown, Minus, Users, FileText, Crown } from "lucide-react";
import type { TopPerformersProps, TopPerformer } from "./types";

interface PerformerCardProps {
  performer: TopPerformer;
  rank: number;
}

function PerformerCard({ performer, rank }: PerformerCardProps): React.ReactElement {
  const TrendIcon =
    performer.trend === "up"
      ? TrendingUp
      : performer.trend === "down"
        ? TrendingDown
        : Minus;

  const trendColor =
    performer.trend === "up"
      ? "text-green-600"
      : performer.trend === "down"
        ? "text-red-600"
        : "text-gray-400";

  return (
    <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
      <div
        className={`w-8 h-8 rounded-full flex items-center justify-center ${
          rank === 1
            ? "bg-yellow-100 text-yellow-700"
            : rank === 2
              ? "bg-gray-200 text-gray-700"
              : "bg-orange-100 text-orange-700"
        }`}
      >
        {rank === 1 ? (
          <Crown className="w-4 h-4" />
        ) : (
          <span className="text-sm font-bold">{rank}</span>
        )}
      </div>

      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-gray-900 truncate">{performer.name}</p>
        <p className="text-xs text-gray-500">{performer.metric}</p>
      </div>

      <div className="flex items-center gap-1">
        <span className="text-sm font-bold text-gray-900">{performer.value}</span>
        <TrendIcon className={`w-4 h-4 ${trendColor}`} />
      </div>
    </div>
  );
}

interface PerformerListProps {
  title: string;
  icon: React.ReactNode;
  performers: TopPerformer[];
  emptyMessage: string;
}

function PerformerList({
  title,
  icon,
  performers,
  emptyMessage,
}: PerformerListProps): React.ReactElement {
  return (
    <div className="flex-1">
      <div className="flex items-center gap-2 mb-3">
        {icon}
        <h4 className="font-medium text-gray-900">{title}</h4>
      </div>

      {performers.length === 0 ? (
        <div className="p-4 bg-gray-50 rounded-lg text-center text-sm text-gray-500">
          {emptyMessage}
        </div>
      ) : (
        <div className="space-y-2">
          {performers.slice(0, 5).map((performer, index) => (
            <PerformerCard key={performer.id} performer={performer} rank={index + 1} />
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * Top performers section showing best leads and templates
 */
export function TopPerformers({
  leads,
  templates,
}: TopPerformersProps): React.ReactElement {
  return (
    <div className="card">
      <div className="p-4 border-b border-gray-200">
        <h3 className="font-semibold text-gray-900">Top Performers</h3>
        <p className="text-sm text-gray-500">Best converting leads and templates</p>
      </div>

      <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-6">
        <PerformerList
          title="Top Leads"
          icon={<Users className="w-5 h-5 text-primary-600" />}
          performers={leads}
          emptyMessage="No lead data available yet"
        />

        <PerformerList
          title="Top Templates"
          icon={<FileText className="w-5 h-5 text-primary-600" />}
          performers={templates}
          emptyMessage="No template data available yet"
        />
      </div>
    </div>
  );
}
