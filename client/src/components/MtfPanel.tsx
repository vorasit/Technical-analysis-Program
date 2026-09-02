import { useEffect, useState } from "react";
import { getMtf } from "../api";
import type { Interval, Market, MtfEntry } from "../types";

const INTERVAL_LABEL: Record<Interval, string> = {
  "1h": "1H",
  "1d": "1D",
  "1w": "1W",
};

const PHASE_LABEL: Record<string, string> = {
  confirmed: "Wave 3 ยืนยันแล้ว",
  watching: "รอทะลุ Wave 3",
  none: "ยังไม่เข้าเงื่อนไข",
};

function phaseClass(entry: MtfEntry): string {
  if (entry.error || !entry.wave2to3) return "";
  return `mtf-phase-${entry.wave2to3.phase}`;
}

export default function MtfPanel({ market, symbol, deviation }: { market: Market; symbol: string; deviation: number }) {
  const [entries, setEntries] = useState<MtfEntry[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    getMtf(market, symbol, deviation)
      .then((r) => {
        if (!cancelled) setEntries(r);
      })
      .catch(() => {
        if (!cancelled) setEntries([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [market, symbol, deviation]);

  const confirmedCount = entries.filter((e) => e.wave2to3?.phase === "confirmed").length;
  const watchingCount = entries.filter((e) => e.wave2to3?.phase === "watching").length;

  return (
    <div className="mtf-panel">
      <div className="wave23-header">
        <span className="wave23-title">เทียบหลาย Timeframe</span>
      </div>
      {loading ? (
        <div className="empty-state">กำลังตรวจสอบ...</div>
      ) : (
        <>
          <div className="mtf-rows">
            {entries.map((entry) => (
              <div key={entry.interval} className={`mtf-row ${phaseClass(entry)}`}>
                <span className="mtf-interval">{INTERVAL_LABEL[entry.interval]}</span>
                {entry.error || !entry.wave2to3 ? (
                  <span className="mtf-status">ข้อมูลไม่พอ</span>
                ) : (
                  <>
                    <span className="mtf-status">{PHASE_LABEL[entry.wave2to3.phase]}</span>
                    {entry.wave2to3.phase !== "none" && <span className="mtf-confidence">{entry.wave2to3.confidence}%</span>}
                  </>
                )}
              </div>
            ))}
          </div>
          {confirmedCount + watchingCount >= 2 && (
            <p className="mtf-note">
              ✓ {confirmedCount + watchingCount} จาก {entries.length} timeframe เห็นสัญญาณไปทางเดียวกัน — เพิ่มความน่าเชื่อถือของสัญญาณ
            </p>
          )}
          {confirmedCount + watchingCount === 1 && <p className="mtf-note">มีเพียง 1 timeframe ที่เห็นสัญญาณ — ควรระวัง</p>}
          {confirmedCount + watchingCount === 0 && <p className="mtf-note">ไม่มี timeframe ไหนเข้าเงื่อนไข Wave 3 ในตอนนี้</p>}
        </>
      )}
    </div>
  );
}
