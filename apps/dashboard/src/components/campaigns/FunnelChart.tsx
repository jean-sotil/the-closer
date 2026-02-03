import type { FunnelChartProps, FunnelStage } from "./types";
import { buildFunnelStages } from "./types";

interface FunnelBarProps {
  stage: FunnelStage;
  maxValue: number;
  onClick?: (() => void) | undefined;
}

function FunnelBar({ stage, maxValue, onClick }: FunnelBarProps): React.ReactElement {
  const widthPercent = maxValue > 0 ? (stage.value / maxValue) * 100 : 0;

  return (
    <button
      onClick={onClick}
      disabled={!onClick}
      className={`w-full text-left transition-all ${onClick ? "hover:opacity-80 cursor-pointer" : "cursor-default"}`}
    >
      <div className="flex items-center gap-4 mb-1">
        <span className="w-20 text-sm font-medium text-gray-700">{stage.name}</span>
        <div className="flex-1 relative h-8">
          <div
            className="absolute inset-y-0 left-0 rounded-r-lg transition-all duration-500"
            style={{
              width: `${Math.max(widthPercent, 2)}%`,
              backgroundColor: stage.color,
            }}
          />
          <div className="absolute inset-0 flex items-center pl-2">
            <span className="text-sm font-bold text-white drop-shadow">
              {stage.value.toLocaleString()}
            </span>
          </div>
        </div>
        <div className="w-24 text-right">
          <span className="text-sm font-medium text-gray-900">
            {stage.percentage.toFixed(1)}%
          </span>
          {stage.dropOff > 0 && (
            <span className="text-xs text-red-500 ml-1">
              (-{stage.dropOff.toFixed(0)}%)
            </span>
          )}
        </div>
      </div>
    </button>
  );
}

/**
 * Visual conversion funnel showing email campaign progression
 */
export function FunnelChart({
  metrics,
  onStageClick,
}: FunnelChartProps): React.ReactElement {
  const stages = buildFunnelStages(metrics);
  const maxValue = Math.max(...stages.map((s) => s.value), 1);

  return (
    <div className="card">
      <div className="p-4 border-b border-gray-200">
        <h3 className="font-semibold text-gray-900">Conversion Funnel</h3>
        <p className="text-sm text-gray-500">Email campaign progression</p>
      </div>
      <div className="p-4 space-y-3">
        {stages.map((stage) => (
          <FunnelBar
            key={stage.name}
            stage={stage}
            maxValue={maxValue}
            onClick={onStageClick ? () => onStageClick(stage.name) : undefined}
          />
        ))}
      </div>

      {/* Funnel summary */}
      <div className="px-4 pb-4">
        <div className="p-3 bg-gray-50 rounded-lg">
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-600">Overall Conversion</span>
            <span className="font-bold text-gray-900">
              {metrics.sent > 0
                ? ((metrics.booked / metrics.sent) * 100).toFixed(2)
                : 0}
              %
            </span>
          </div>
          <p className="text-xs text-gray-500 mt-1">
            {metrics.booked} bookings from {metrics.sent} emails sent
          </p>
        </div>
      </div>
    </div>
  );
}
