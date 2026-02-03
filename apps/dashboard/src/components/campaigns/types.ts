import type { CampaignConfig, CampaignStatus } from "@the-closer/shared";

/**
 * Campaign metrics for dashboard display
 */
export interface CampaignMetrics {
  sent: number;
  delivered: number;
  opened: number;
  clicked: number;
  replied: number;
  booked: number;
  bounced: number;
  unsubscribed: number;
}

/**
 * Calculated rates for metrics
 */
export interface CampaignRates {
  deliveryRate: number;
  openRate: number;
  clickRate: number;
  replyRate: number;
  bookingRate: number;
  bounceRate: number;
}

/**
 * Funnel stage data
 */
export interface FunnelStage {
  name: string;
  value: number;
  percentage: number;
  dropOff: number;
  color: string;
}

/**
 * Timeline data point
 */
export interface TimelineDataPoint {
  date: string;
  sent: number;
  opened: number;
  clicked: number;
  replied: number;
}

/**
 * Top performer (lead or template)
 */
export interface TopPerformer {
  id: string;
  name: string;
  metric: string;
  value: number;
  trend: "up" | "down" | "stable";
}

/**
 * Campaign with extended metrics
 */
export interface CampaignWithMetrics extends CampaignConfig {
  metrics: CampaignMetrics;
  rates: CampaignRates;
}

/**
 * Props for CampaignList component
 */
export interface CampaignListProps {
  campaigns: CampaignWithMetrics[];
  selectedId: string | undefined;
  onSelect: (id: string) => void;
  onToggleStatus: (id: string, status: CampaignStatus) => void;
}

/**
 * Props for CampaignDetail component
 */
export interface CampaignDetailProps {
  campaign: CampaignWithMetrics;
  onEdit: () => void;
  onExport: () => void;
}

/**
 * Props for MetricsPanel component
 */
export interface MetricsPanelProps {
  metrics: CampaignMetrics;
  rates: CampaignRates;
  isLoading?: boolean;
}

/**
 * Props for FunnelChart component
 */
export interface FunnelChartProps {
  metrics: CampaignMetrics;
  onStageClick?: (stage: string) => void;
}

/**
 * Props for TimelineChart component
 */
export interface TimelineChartProps {
  data: TimelineDataPoint[];
  dateRange: { start: Date; end: Date };
  onDateRangeChange: (range: { start: Date; end: Date }) => void;
}

/**
 * Props for TopPerformers component
 */
export interface TopPerformersProps {
  leads: TopPerformer[];
  templates: TopPerformer[];
}

/**
 * Industry benchmark rates for comparison
 */
export const BENCHMARK_RATES: CampaignRates = {
  deliveryRate: 95,
  openRate: 20,
  clickRate: 2.5,
  replyRate: 1,
  bookingRate: 0.5,
  bounceRate: 2,
};

/**
 * Calculate rates from metrics
 */
export function calculateRates(metrics: CampaignMetrics): CampaignRates {
  const { sent, delivered, opened, clicked, replied, booked, bounced } = metrics;

  return {
    deliveryRate: sent > 0 ? (delivered / sent) * 100 : 0,
    openRate: delivered > 0 ? (opened / delivered) * 100 : 0,
    clickRate: opened > 0 ? (clicked / opened) * 100 : 0,
    replyRate: delivered > 0 ? (replied / delivered) * 100 : 0,
    bookingRate: replied > 0 ? (booked / replied) * 100 : 0,
    bounceRate: sent > 0 ? (bounced / sent) * 100 : 0,
  };
}

/**
 * Build funnel stages from metrics
 */
export function buildFunnelStages(metrics: CampaignMetrics): FunnelStage[] {
  const stages: FunnelStage[] = [
    { name: "Sent", value: metrics.sent, percentage: 100, dropOff: 0, color: "#6366f1" },
    { name: "Delivered", value: metrics.delivered, percentage: 0, dropOff: 0, color: "#8b5cf6" },
    { name: "Opened", value: metrics.opened, percentage: 0, dropOff: 0, color: "#a855f7" },
    { name: "Clicked", value: metrics.clicked, percentage: 0, dropOff: 0, color: "#d946ef" },
    { name: "Replied", value: metrics.replied, percentage: 0, dropOff: 0, color: "#ec4899" },
    { name: "Booked", value: metrics.booked, percentage: 0, dropOff: 0, color: "#f43f5e" },
  ];

  // Calculate percentages and drop-offs
  for (let i = 0; i < stages.length; i++) {
    const stage = stages[i];
    if (!stage) continue;

    if (metrics.sent > 0) {
      stage.percentage = (stage.value / metrics.sent) * 100;
    }

    if (i > 0) {
      const prevStage = stages[i - 1];
      if (prevStage && prevStage.value > 0) {
        stage.dropOff = ((prevStage.value - stage.value) / prevStage.value) * 100;
      }
    }
  }

  return stages;
}

/**
 * Format rate with comparison to benchmark
 */
export function formatRateWithBenchmark(
  rate: number,
  benchmark: number
): { formatted: string; comparison: "above" | "below" | "at" } {
  const formatted = `${rate.toFixed(1)}%`;
  const comparison = rate > benchmark * 1.1 ? "above" : rate < benchmark * 0.9 ? "below" : "at";
  return { formatted, comparison };
}

/**
 * Get status color for campaign
 */
export function getStatusColor(status: CampaignStatus): {
  bg: string;
  text: string;
  dot: string;
} {
  switch (status) {
    case "active":
      return { bg: "bg-green-100", text: "text-green-700", dot: "bg-green-500" };
    case "paused":
      return { bg: "bg-yellow-100", text: "text-yellow-700", dot: "bg-yellow-500" };
    case "completed":
      return { bg: "bg-blue-100", text: "text-blue-700", dot: "bg-blue-500" };
    case "draft":
      return { bg: "bg-gray-100", text: "text-gray-700", dot: "bg-gray-500" };
    case "scheduled":
      return { bg: "bg-purple-100", text: "text-purple-700", dot: "bg-purple-500" };
    case "cancelled":
      return { bg: "bg-red-100", text: "text-red-700", dot: "bg-red-500" };
    default:
      return { bg: "bg-gray-100", text: "text-gray-700", dot: "bg-gray-500" };
  }
}
