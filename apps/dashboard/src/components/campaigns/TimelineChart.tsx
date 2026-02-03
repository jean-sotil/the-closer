import { useState, useMemo } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { Calendar, ChevronLeft, ChevronRight } from "lucide-react";
import type { TimelineChartProps, TimelineDataPoint } from "./types";

const METRIC_COLORS = {
  sent: "#6366f1",
  opened: "#8b5cf6",
  clicked: "#d946ef",
  replied: "#ec4899",
};

interface DateRangePickerProps {
  start: Date;
  end: Date;
  onChange: (range: { start: Date; end: Date }) => void;
}

function DateRangePicker({ start, end, onChange }: DateRangePickerProps): React.ReactElement {
  const formatDate = (date: Date) => {
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  };

  const shiftRange = (days: number) => {
    const newStart = new Date(start);
    const newEnd = new Date(end);
    newStart.setDate(newStart.getDate() + days);
    newEnd.setDate(newEnd.getDate() + days);
    onChange({ start: newStart, end: newEnd });
  };

  const setPreset = (preset: "7d" | "14d" | "30d") => {
    const newEnd = new Date();
    const newStart = new Date();
    const days = preset === "7d" ? 7 : preset === "14d" ? 14 : 30;
    newStart.setDate(newEnd.getDate() - days);
    onChange({ start: newStart, end: newEnd });
  };

  return (
    <div className="flex items-center gap-2">
      <div className="flex items-center gap-1">
        <button
          onClick={() => shiftRange(-7)}
          className="p-1 rounded hover:bg-gray-100"
          title="Previous week"
        >
          <ChevronLeft className="w-4 h-4 text-gray-500" />
        </button>
        <div className="flex items-center gap-1 px-2 py-1 bg-gray-100 rounded-lg text-sm">
          <Calendar className="w-4 h-4 text-gray-400" />
          <span className="text-gray-700">
            {formatDate(start)} - {formatDate(end)}
          </span>
        </div>
        <button
          onClick={() => shiftRange(7)}
          className="p-1 rounded hover:bg-gray-100"
          title="Next week"
        >
          <ChevronRight className="w-4 h-4 text-gray-500" />
        </button>
      </div>

      <div className="flex items-center gap-1 ml-2">
        {(["7d", "14d", "30d"] as const).map((preset) => (
          <button
            key={preset}
            onClick={() => setPreset(preset)}
            className="px-2 py-1 text-xs font-medium text-gray-600 hover:bg-gray-100 rounded"
          >
            {preset}
          </button>
        ))}
      </div>
    </div>
  );
}

/**
 * Timeline chart showing daily email metrics
 */
export function TimelineChart({
  data,
  dateRange,
  onDateRangeChange,
}: TimelineChartProps): React.ReactElement {
  const [visibleMetrics, setVisibleMetrics] = useState<Set<keyof TimelineDataPoint>>(
    new Set(["sent", "opened", "replied"])
  );

  const toggleMetric = (metric: keyof TimelineDataPoint) => {
    const newSet = new Set(visibleMetrics);
    if (newSet.has(metric)) {
      newSet.delete(metric);
    } else {
      newSet.add(metric);
    }
    setVisibleMetrics(newSet);
  };

  const chartData = useMemo(() => {
    return data.map((point) => ({
      ...point,
      date: new Date(point.date).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
      }),
    }));
  }, [data]);

  const totals = useMemo(() => {
    return {
      sent: data.reduce((sum, d) => sum + d.sent, 0),
      opened: data.reduce((sum, d) => sum + d.opened, 0),
      clicked: data.reduce((sum, d) => sum + d.clicked, 0),
      replied: data.reduce((sum, d) => sum + d.replied, 0),
    };
  }, [data]);

  return (
    <div className="card">
      <div className="p-4 border-b border-gray-200 flex items-center justify-between">
        <div>
          <h3 className="font-semibold text-gray-900">Activity Timeline</h3>
          <p className="text-sm text-gray-500">Daily email metrics</p>
        </div>
        <DateRangePicker
          start={dateRange.start}
          end={dateRange.end}
          onChange={onDateRangeChange}
        />
      </div>

      {/* Metric toggles */}
      <div className="px-4 pt-4 flex items-center gap-4">
        {(Object.entries(METRIC_COLORS) as Array<[keyof typeof METRIC_COLORS, string]>).map(
          ([metric, color]) => (
            <button
              key={metric}
              onClick={() => toggleMetric(metric)}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium transition-all ${
                visibleMetrics.has(metric)
                  ? "bg-gray-100 text-gray-900"
                  : "text-gray-400 hover:text-gray-600"
              }`}
            >
              <span
                className="w-3 h-3 rounded-full"
                style={{
                  backgroundColor: visibleMetrics.has(metric) ? color : "#d1d5db",
                }}
              />
              <span className="capitalize">{metric}</span>
              <span className="text-xs text-gray-500">
                {totals[metric].toLocaleString()}
              </span>
            </button>
          )
        )}
      </div>

      {/* Chart */}
      <div className="p-4">
        {data.length === 0 ? (
          <div className="h-64 flex items-center justify-center text-gray-500">
            No data available for this date range
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis
                dataKey="date"
                tick={{ fontSize: 12, fill: "#6b7280" }}
                tickLine={false}
              />
              <YAxis
                tick={{ fontSize: 12, fill: "#6b7280" }}
                tickLine={false}
                axisLine={false}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: "#fff",
                  border: "1px solid #e5e7eb",
                  borderRadius: "8px",
                  boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)",
                }}
              />
              <Legend />
              {visibleMetrics.has("sent") && (
                <Line
                  type="monotone"
                  dataKey="sent"
                  stroke={METRIC_COLORS.sent}
                  strokeWidth={2}
                  dot={{ fill: METRIC_COLORS.sent, r: 4 }}
                  activeDot={{ r: 6 }}
                />
              )}
              {visibleMetrics.has("opened") && (
                <Line
                  type="monotone"
                  dataKey="opened"
                  stroke={METRIC_COLORS.opened}
                  strokeWidth={2}
                  dot={{ fill: METRIC_COLORS.opened, r: 4 }}
                  activeDot={{ r: 6 }}
                />
              )}
              {visibleMetrics.has("clicked") && (
                <Line
                  type="monotone"
                  dataKey="clicked"
                  stroke={METRIC_COLORS.clicked}
                  strokeWidth={2}
                  dot={{ fill: METRIC_COLORS.clicked, r: 4 }}
                  activeDot={{ r: 6 }}
                />
              )}
              {visibleMetrics.has("replied") && (
                <Line
                  type="monotone"
                  dataKey="replied"
                  stroke={METRIC_COLORS.replied}
                  strokeWidth={2}
                  dot={{ fill: METRIC_COLORS.replied, r: 4 }}
                  activeDot={{ r: 6 }}
                />
              )}
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}
