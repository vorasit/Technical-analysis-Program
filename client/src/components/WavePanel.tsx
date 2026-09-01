import type { Wave2To3Tracker, WaveAnalysis, WaveCount } from "../types";

function fmtPct(v: number | undefined): string {
  if (v === undefined || Number.isNaN(v)) return "-";
  return `${(v * 100).toFixed(0)}%`;
}

function fmtDate(t: number): string {
  return new Date(t * 1000).toLocaleDateString();
}

function fmtPrice(v: number): string {
  return v.toLocaleString(undefined, { maximumFractionDigits: v < 10 ? 4 : 2 });
}

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

      <p>{tracker.note}</p>
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
