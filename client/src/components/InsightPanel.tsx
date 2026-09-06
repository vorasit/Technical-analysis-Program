import type { PlainLanguageInsight } from "../types";

const STATUS_ICON: Record<PlainLanguageInsight["status"], string> = {
  BULLISH: "📈",
  BEARISH: "📉",
  HIGH_RISK: "⚠️",
  NEUTRAL: "⏸️",
};

const RISK_LABEL: Record<PlainLanguageInsight["riskLevel"], string> = {
  LOW: "ความเสี่ยงต่ำ",
  MEDIUM: "ความเสี่ยงปานกลาง",
  HIGH: "ความเสี่ยงสูง",
};

export default function InsightPanel({ insight }: { insight: PlainLanguageInsight }) {
  return (
    <div className={`insight-panel insight-status-${insight.status.toLowerCase()}`}>
      <div className="insight-header">
        <span className="insight-status-badge">
          {STATUS_ICON[insight.status]} {insight.statusLabel}
        </span>
        <span className={`insight-risk-badge insight-risk-${insight.riskLevel.toLowerCase()}`}>{RISK_LABEL[insight.riskLevel]}</span>
      </div>
      <p className="insight-headline">{insight.headline}</p>
      <ul className="insight-bullets">
        {insight.bulletPoints.map((point, i) => (
          <li key={i}>{point}</li>
        ))}
      </ul>
    </div>
  );
}
