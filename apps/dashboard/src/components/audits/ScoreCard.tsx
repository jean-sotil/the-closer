import { getScoreLevel, getScoreLevelColor, type LucideIcon } from "./types";

interface ScoreCardProps {
  label: string;
  score: number | undefined;
  icon: LucideIcon;
  description?: string;
}

/**
 * Score card with circular gauge visualization
 */
export function ScoreCard({
  label,
  score,
  icon: Icon,
  description,
}: ScoreCardProps): React.ReactElement {
  const level = getScoreLevel(score);
  const colors = getScoreLevelColor(level);
  const displayScore = score ?? 0;
  const circumference = 2 * Math.PI * 40; // radius = 40
  const strokeDashoffset = circumference - (displayScore / 100) * circumference;

  return (
    <div className="card flex flex-col items-center p-6">
      {/* Circular gauge */}
      <div className="relative w-24 h-24 mb-3">
        <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
          {/* Background circle */}
          <circle
            cx="50"
            cy="50"
            r="40"
            fill="none"
            stroke="currentColor"
            strokeWidth="8"
            className="text-gray-200"
          />
          {/* Progress circle */}
          <circle
            cx="50"
            cy="50"
            r="40"
            fill="none"
            stroke="currentColor"
            strokeWidth="8"
            strokeLinecap="round"
            className={colors.text}
            style={{
              strokeDasharray: circumference,
              strokeDashoffset: strokeDashoffset,
              transition: "stroke-dashoffset 0.5s ease",
            }}
          />
        </svg>
        {/* Score text in center */}
        <div className="absolute inset-0 flex items-center justify-center">
          <span className={`text-2xl font-bold ${colors.text}`}>
            {score !== undefined ? score : "—"}
          </span>
        </div>
      </div>

      {/* Label and icon */}
      <div className="flex items-center gap-2 text-gray-600">
        <Icon className="w-4 h-4" />
        <span className="font-medium">{label}</span>
      </div>

      {/* Description */}
      {description && (
        <p className="text-xs text-gray-500 text-center mt-1">{description}</p>
      )}

      {/* Level badge */}
      <span
        className={`mt-2 px-2 py-0.5 rounded-full text-xs font-medium ${colors.bg} ${colors.text}`}
      >
        {level === "good"
          ? "Good"
          : level === "needs-improvement"
            ? "Needs Work"
            : "Poor"}
      </span>
    </div>
  );
}
