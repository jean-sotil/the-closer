import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import type { MetricsPanelProps, CampaignRates } from "./types";
import { BENCHMARK_RATES, formatRateWithBenchmark } from "./types";

interface MetricCardProps {
  label: string;
  value: number;
  rate: number | undefined;
  benchmark: number | undefined;
  isLoading?: boolean | undefined;
}

function MetricCard({
  label,
  value,
  rate,
  benchmark,
  isLoading,
}: MetricCardProps): React.ReactElement {
  if (isLoading) {
    return (
      <div className="p-4 bg-gray-50 rounded-lg animate-pulse">
        <div className="h-4 w-20 bg-gray-200 rounded mb-2" />
        <div className="h-8 w-16 bg-gray-200 rounded mb-1" />
        <div className="h-3 w-24 bg-gray-200 rounded" />
      </div>
    );
  }

  const hasRate = rate !== undefined && benchmark !== undefined;
  const comparison = hasRate ? formatRateWithBenchmark(rate, benchmark) : null;

  return (
    <div className="p-4 bg-gray-50 rounded-lg">
      <p className="text-sm text-gray-500 mb-1">{label}</p>
      <p className="text-2xl font-bold text-gray-900">{value.toLocaleString()}</p>
      {hasRate && comparison && (
        <div className="flex items-center gap-1 mt-1">
          <span
            className={`text-sm font-medium ${
              comparison.comparison === "above"
                ? "text-green-600"
                : comparison.comparison === "below"
                  ? "text-red-600"
                  : "text-gray-600"
            }`}
          >
            {comparison.formatted}
          </span>
          {comparison.comparison === "above" ? (
            <TrendingUp className="w-3 h-3 text-green-600" />
          ) : comparison.comparison === "below" ? (
            <TrendingDown className="w-3 h-3 text-red-600" />
          ) : (
            <Minus className="w-3 h-3 text-gray-600" />
          )}
          <span className="text-xs text-gray-400">vs {benchmark}% avg</span>
        </div>
      )}
    </div>
  );
}

/**
 * Panel displaying campaign metrics with benchmark comparisons
 */
export function MetricsPanel({
  metrics,
  rates,
  isLoading,
}: MetricsPanelProps): React.ReactElement {
  const metricItems: Array<{
    label: string;
    value: number;
    rateKey: keyof CampaignRates | null;
  }> = [
    { label: "Sent", value: metrics.sent, rateKey: null },
    { label: "Delivered", value: metrics.delivered, rateKey: "deliveryRate" },
    { label: "Opened", value: metrics.opened, rateKey: "openRate" },
    { label: "Clicked", value: metrics.clicked, rateKey: "clickRate" },
    { label: "Replied", value: metrics.replied, rateKey: "replyRate" },
    { label: "Booked", value: metrics.booked, rateKey: "bookingRate" },
    { label: "Bounced", value: metrics.bounced, rateKey: "bounceRate" },
    { label: "Unsubscribed", value: metrics.unsubscribed, rateKey: null },
  ];

  return (
    <div className="card">
      <div className="p-4 border-b border-gray-200">
        <h3 className="font-semibold text-gray-900">Campaign Metrics</h3>
      </div>
      <div className="p-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {metricItems.map((item) => (
            <MetricCard
              key={item.label}
              label={item.label}
              value={item.value}
              rate={item.rateKey ? rates[item.rateKey] : undefined}
              benchmark={item.rateKey ? BENCHMARK_RATES[item.rateKey] : undefined}
              isLoading={isLoading}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
