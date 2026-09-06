import type { PlainLanguageInsight } from "../types";

const STATUS_ICON: Record<PlainLanguageInsight["status"], string> = {
  BULLISH: "📈",
  BEARISH: "📉",
  HIGH_RISK: "⚠️",
  NEUTRAL: "⏸️",
};

/** Collapses the 4 insight statuses down to the 3-color signal the card shows at a glance. */
type SummaryLevel = "good" | "caution" | "danger";

const STATUS_LEVEL: Record<PlainLanguageInsight["status"], SummaryLevel> = {
  BULLISH: "good",
  NEUTRAL: "caution",
  HIGH_RISK: "danger",
  BEARISH: "danger",
};

interface SmartSummaryCardProps {
  insight: PlainLanguageInsight;
  onViewDetails?: () => void;
}

export default function SmartSummaryCard({ insight, onViewDetails }: SmartSummaryCardProps) {
  const level = STATUS_LEVEL[insight.status];

  return (
    <div className={`summary-card summary-level-${level}`}>
      <div className="summary-bar" />
      <div className="summary-body">
        <div className="summary-top">
          <span className="summary-status-badge">
            {STATUS_ICON[insight.status]} {insight.statusLabel}
          </span>
          {onViewDetails && (
            <button className="summary-details-btn" onClick={onViewDetails}>
              ดูรายละเอียดเชิงลึก
            </button>
          )}
        </div>
        <p className="summary-headline">{insight.headline}</p>
        <ul className="summary-bullets">
          {insight.bulletPoints.map((point, i) => (
            <li key={i}>{point}</li>
          ))}
        </ul>
      </div>
    </div>
  );
}
