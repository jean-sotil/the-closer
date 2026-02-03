import { useState, useMemo } from "react";
import { Plus } from "lucide-react";
import type { CampaignStatus } from "@the-closer/shared";
import { useCampaigns, useUpdateCampaignStatus } from "../hooks";
import {
  CampaignList,
  CampaignDetail,
  MetricsPanel,
  FunnelChart,
  TimelineChart,
  TopPerformers,
  calculateRates,
} from "../components/campaigns";
import type {
  CampaignWithMetrics,
  CampaignMetrics,
  TimelineDataPoint,
  TopPerformer,
} from "../components/campaigns";

// Generate mock timeline data
function generateTimelineData(days: number): TimelineDataPoint[] {
  const data: TimelineDataPoint[] = [];
  const now = new Date();

  for (let i = days - 1; i >= 0; i--) {
    const date = new Date(now);
    date.setDate(date.getDate() - i);

    data.push({
      date: date.toISOString().split("T")[0] ?? "",
      sent: Math.floor(Math.random() * 50) + 10,
      opened: Math.floor(Math.random() * 30) + 5,
      clicked: Math.floor(Math.random() * 10) + 1,
      replied: Math.floor(Math.random() * 5),
    });
  }

  return data;
}

// Mock top performers data
const mockTopLeads: TopPerformer[] = [
  { id: "1", name: "Acme Corp", metric: "3 meetings booked", value: 3, trend: "up" },
  { id: "2", name: "TechStart Inc", metric: "5 replies", value: 5, trend: "up" },
  { id: "3", name: "Local Dental", metric: "12 opens", value: 12, trend: "stable" },
  { id: "4", name: "City Law Firm", metric: "8 opens", value: 8, trend: "down" },
  { id: "5", name: "Main St Cafe", metric: "2 meetings booked", value: 2, trend: "up" },
];

const mockTopTemplates: TopPerformer[] = [
  { id: "1", name: "Performance Audit Alert", metric: "32% open rate", value: 32, trend: "up" },
  { id: "2", name: "Mobile Issues Found", metric: "28% open rate", value: 28, trend: "up" },
  { id: "3", name: "Follow-up #1", metric: "18% reply rate", value: 18, trend: "stable" },
  { id: "4", name: "Final Follow-up", metric: "12% reply rate", value: 12, trend: "down" },
];

export function Outreach(): React.ReactElement {
  const { data: rawCampaigns, isLoading } = useCampaigns();
  const updateStatus = useUpdateCampaignStatus();

  const [selectedCampaignId, setSelectedCampaignId] = useState<string | undefined>();
  const [dateRange, setDateRange] = useState(() => {
    const end = new Date();
    const start = new Date();
    start.setDate(end.getDate() - 14);
    return { start, end };
  });

  // Transform campaigns to include metrics
  const campaigns: CampaignWithMetrics[] = useMemo(() => {
    if (!rawCampaigns) return [];

    return rawCampaigns.map((campaign) => {
      // Generate mock metrics for demo - in real app, this comes from API
      const mockMetrics: CampaignMetrics = {
        sent: campaign.emailsSent ?? Math.floor(Math.random() * 500) + 100,
        delivered: Math.floor((campaign.emailsSent ?? 100) * 0.95),
        opened: Math.floor((campaign.emailsSent ?? 100) * 0.35),
        clicked: Math.floor((campaign.emailsSent ?? 100) * 0.08),
        replied: Math.floor((campaign.emailsSent ?? 100) * 0.05),
        booked: Math.floor((campaign.emailsSent ?? 100) * 0.02),
        bounced: Math.floor((campaign.emailsSent ?? 100) * 0.03),
        unsubscribed: Math.floor((campaign.emailsSent ?? 100) * 0.01),
      };

      return {
        ...campaign,
        metrics: mockMetrics,
        rates: calculateRates(mockMetrics),
      };
    });
  }, [rawCampaigns]);

  const selectedCampaign = campaigns.find((c) => c.id === selectedCampaignId);

  const handleToggleStatus = (id: string, status: CampaignStatus) => {
    updateStatus.mutate({ id, status });
  };

  const handleEdit = () => {
    // TODO: Implement campaign edit modal
    console.log("Edit campaign:", selectedCampaignId);
  };

  const handleExport = () => {
    // TODO: Implement campaign export
    console.log("Export campaign:", selectedCampaignId);
  };

  // Calculate aggregate metrics
  const aggregateMetrics: CampaignMetrics = useMemo(() => {
    return campaigns.reduce(
      (acc, campaign) => ({
        sent: acc.sent + campaign.metrics.sent,
        delivered: acc.delivered + campaign.metrics.delivered,
        opened: acc.opened + campaign.metrics.opened,
        clicked: acc.clicked + campaign.metrics.clicked,
        replied: acc.replied + campaign.metrics.replied,
        booked: acc.booked + campaign.metrics.booked,
        bounced: acc.bounced + campaign.metrics.bounced,
        unsubscribed: acc.unsubscribed + campaign.metrics.unsubscribed,
      }),
      {
        sent: 0,
        delivered: 0,
        opened: 0,
        clicked: 0,
        replied: 0,
        booked: 0,
        bounced: 0,
        unsubscribed: 0,
      }
    );
  }, [campaigns]);

  const aggregateRates = calculateRates(aggregateMetrics);

  // Generate timeline data based on date range
  const timelineData = useMemo(() => {
    const days = Math.ceil(
      (dateRange.end.getTime() - dateRange.start.getTime()) / (1000 * 60 * 60 * 24)
    );
    return generateTimelineData(days);
  }, [dateRange]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Email Outreach</h1>
          <p className="text-sm text-gray-500">
            Manage campaigns and track performance
          </p>
        </div>
        <button className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 font-medium">
          <Plus className="w-5 h-5" />
          Create Campaign
        </button>
      </div>

      {/* Main layout */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Campaign list sidebar */}
        <div className="lg:col-span-1">
          <CampaignList
            campaigns={campaigns}
            selectedId={selectedCampaignId}
            onSelect={setSelectedCampaignId}
            onToggleStatus={handleToggleStatus}
          />
        </div>

        {/* Main content area */}
        <div className="lg:col-span-3 space-y-6">
          {selectedCampaign ? (
            <>
              {/* Campaign detail header */}
              <CampaignDetail
                campaign={selectedCampaign}
                onEdit={handleEdit}
                onExport={handleExport}
              />

              {/* Metrics panel */}
              <MetricsPanel
                metrics={selectedCampaign.metrics}
                rates={selectedCampaign.rates}
              />

              {/* Charts row */}
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                <FunnelChart metrics={selectedCampaign.metrics} />
                <TopPerformers leads={mockTopLeads} templates={mockTopTemplates} />
              </div>

              {/* Timeline chart */}
              <TimelineChart
                data={timelineData}
                dateRange={dateRange}
                onDateRangeChange={setDateRange}
              />
            </>
          ) : (
            <>
              {/* Aggregate metrics when no campaign selected */}
              <MetricsPanel metrics={aggregateMetrics} rates={aggregateRates} />

              {/* Charts row */}
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                <FunnelChart metrics={aggregateMetrics} />
                <TopPerformers leads={mockTopLeads} templates={mockTopTemplates} />
              </div>

              {/* Timeline chart */}
              <TimelineChart
                data={timelineData}
                dateRange={dateRange}
                onDateRangeChange={setDateRange}
              />

              {/* Tips card */}
              <div className="card bg-green-50 border-green-200">
                <h3 className="text-green-800 font-semibold mb-2">Outreach Tips</h3>
                <ul className="text-sm text-green-700 space-y-1">
                  <li>
                    • Include audit evidence (screenshots, videos) in your emails
                  </li>
                  <li>• Personalize with specific pain points from the audit</li>
                  <li>• Follow up 3-5 times over 2 weeks</li>
                  <li>• Track opens and clicks to optimize your approach</li>
                </ul>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
