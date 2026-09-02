import { formatPrice } from "../format";
import type { Wave2To3Tracker, WaveAnalysis, WaveCount } from "../types";

function fmtPct(v: number | undefined): string {
  if (v === undefined || Number.isNaN(v)) return "-";
  return `${(v * 100).toFixed(0)}%`;
}

function fmtDate(t: number): string {
  return new Date(t * 1000).toLocaleDateString();
}

const fmtPrice = formatPrice;

const PHASE_LABEL: Record<Wave2To3Tracker["phase"], string> = {
  none: "ยังไม่เข้าเงื่อนไข Wave 1-2",
  watching: "Wave 2 เสร็จแล้ว — รอ Wave 3 ทะลุแนว",
  confirmed: "Wave 3 ยืนยันแล้ว กำลังเคลื่อนไหว",
};

function Wave2To3Card({ tracker, symbol }: { tracker: Wave2To3Tracker; symbol: string }) {
  const barPct = Math.max(0, Math.min(100, tracker.progressPct));
  return (
    <div className={`wave23-card phase-${tracker.phase}`}>
      <div className="wave23-header">
        <span className="wave23-title">
          {tracker.phase === "confirmed" ? "🚀" : tracker.phase === "watching" ? "👀" : "—"} {symbol}
        </span>
        {tracker.phase !== "none" && (
          <span className="confidence-badge" data-level={tracker.confidence >= 70 ? "high" : tracker.confidence >= 45 ? "mid" : "low"}>
            {tracker.confidence}%
          </span>
        )}
      </div>
      <div className="wave23-phase">{PHASE_LABEL[tracker.phase]}</div>

      {tracker.phase !== "none" && tracker.cdcConfluence !== null && (
        <div
          className={`badge wave23-confluence ${tracker.cdcConfluence ? "badge-confluence" : "badge-no-confluence"}`}
          title="ผลทดสอบย้อนหลังพบว่าสัญญาณที่ CDC Action Zone เห็นตรงกันให้ผลตอบแทนเฉลี่ยดีกว่าอย่างชัดเจน (ดูแท็บ Backtest)"
        >
          {tracker.cdcConfluence ? "✓ CDC Action Zone เห็นตรงกัน" : "✗ CDC Action Zone ไม่ตรงกัน"}
        </div>
      )}

      {tracker.phase !== "none" && tracker.divergenceConfluence !== null && (
        <div
          className={`badge wave23-confluence ${tracker.divergenceConfluence ? "badge-confluence" : "badge-no-confluence"}`}
          title="Hidden divergence: RSI/MACD ที่จุด Wave 0 กับ Wave 2 ชี้ว่าโมเมนตัมกำลังสะสมไปในทิศทางเดียวกับคลื่น ยืนยันว่า Wave 2 น่าจะเป็นแค่การพักฐาน ไม่ใช่การกลับตัว (ดูแท็บ Backtest)"
        >
          {tracker.divergenceConfluence ? "✓ RSI/MACD Divergence ยืนยัน" : "✗ ไม่มี Divergence ยืนยัน"}
        </div>
      )}

      {tracker.phase !== "none" && tracker.breakoutLevel !== null && (
        <>
          <div className="wave23-progress-track">
            <div className="wave23-progress-fill" style={{ width: `${barPct}%` }} />
          </div>
          <div className="wave23-progress-label">
            {tracker.phase === "watching" ? `${barPct}% ของระยะทางไปแนวทะลุ` : `ขยายไปแล้ว ${tracker.progressPct}% ของความยาว Wave 1`}
          </div>
          <div className="wave23-levels">
            <span>
              แนวทะลุ (ยืนยัน Wave 3): <strong>{fmtPrice(tracker.breakoutLevel)}</strong>
            </span>
            {tracker.invalidationLevel !== null && (
              <span>
                แนวยกเลิกนับ: <strong>{fmtPrice(tracker.invalidationLevel)}</strong>
              </span>
            )}
            {tracker.currentPrice !== null && (
              <span>
                {tracker.phase === "confirmed" ? "ราคาล่าสุด" : "จุดสูง/ต่ำล่าสุดของคลื่นนี้"}: <strong>{fmtPrice(tracker.currentPrice)}</strong>
              </span>
            )}
          </div>
        </>
      )}

      {tracker.riskReward && <RiskRewardTable plan={tracker.riskReward} />}

      <p>{tracker.note}</p>
    </div>
  );
}

function RiskRewardTable({ plan }: { plan: NonNullable<Wave2To3Tracker["riskReward"]> }) {
  return (
    <div className="wave23-riskreward">
      <div className="wave23-riskreward-header">แผน Risk/Reward (อ้างอิงจุดทะลุแนวเป็นจุดเข้า)</div>
      <div className="wave23-levels">
        <span>
          จุดเข้า: <strong>{fmtPrice(plan.entryPrice)}</strong>
        </span>
        <span>
          Stop-loss (ใต้ Wave 2): <strong>{fmtPrice(plan.stopLoss)}</strong> <small>(ความเสี่ยง {plan.riskPct.toFixed(1)}%)</small>
        </span>
      </div>
      <table className="rr-table">
        <thead>
          <tr>
            <th>เป้าหมาย (Fib ext. ของ Wave 1)</th>
            <th>ราคา</th>
            <th>ผลตอบแทน</th>
            <th>R:R</th>
          </tr>
        </thead>
        <tbody>
          {plan.targets.map((t) => (
            <tr key={t.ratio}>
              <td className="mono">{t.ratio}x</td>
              <td className="mono">{fmtPrice(t.price)}</td>
              <td className="mono pos">+{t.rewardPct.toFixed(1)}%</td>
              <td className="mono">{t.riskRewardRatio.toFixed(2)}:1</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function CountCard({ title, count }: { title: string; count: WaveCount }) {
  return (
    <div className="wave-count-card">
      <div className="wave-count-header">
        <span>{title}</span>
        <span className="confidence-badge" data-level={count.confidence >= 70 ? "high" : count.confidence >= 45 ? "mid" : "low"}>
          {count.confidence}%
        </span>
      </div>
      <div className="wave-points-row">
        {count.points.map((p) => (
          <span key={p.label} className={`wave-chip ${p.label === "3" ? "wave-chip-3" : ""}`}>
            {p.label}
            <small>{fmtDate(p.time)}</small>
          </span>
        ))}
      </div>
      <div className="fib-row">
        <span>Wave2 retrace: {fmtPct(count.fib.wave2Retrace)}</span>
        <span>Wave3 extension: {count.fib.wave3Extension ? `${count.fib.wave3Extension.toFixed(2)}x` : "-"}</span>
        <span>Wave4 retrace: {fmtPct(count.fib.wave4Retrace)}</span>
      </div>
      <details>
        <summary>Rules ({count.rulesPassed.length} passed{count.rulesFailed.length ? `, ${count.rulesFailed.length} failed` : ""})</summary>
        <ul className="rules-list">
          {count.rulesPassed.map((r) => (
            <li key={r} className="rule-ok">✓ {r}</li>
          ))}
          {count.rulesFailed.map((r) => (
            <li key={r} className="rule-fail">✗ {r}</li>
          ))}
        </ul>
      </details>
    </div>
  );
}

export default function WavePanel({ wave, symbol }: { wave: WaveAnalysis; symbol: string }) {
  return (
    <div className="wave-panel">
      <Wave2To3Card tracker={wave.wave2to3} symbol={symbol} />

      {wave.bestCount ? (
        <CountCard title="Best auto wave count" count={wave.bestCount} />
      ) : (
        <div className="empty-state">No valid 5-wave impulse pattern found in the visible range. Try a different timeframe or sensitivity.</div>
      )}

      {wave.alternates.length > 0 && (
        <div>
          <div className="section-label">Alternate counts</div>
          {wave.alternates.map((c, i) => (
            <CountCard key={i} title={`Alternate ${i + 1}`} count={c} />
          ))}
        </div>
      )}

      <p className="disclaimer">
        Elliott Wave counting is inherently subjective. This is an automated, rule-based approximation for idea generation only — not financial advice.
      </p>
    </div>
  );
}
