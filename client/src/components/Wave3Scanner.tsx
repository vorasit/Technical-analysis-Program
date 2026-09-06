import { useEffect, useState } from "react";
import { scanWave3 } from "../api";
import { formatPrice } from "../format";
import SymbolLogo from "./SymbolLogo";
import type { Interval, Market, NewJournalEntry, ScanResult, SymbolInfo } from "../types";

type Source = "preset" | "watchlist";
type FilterKey = "confirmed" | "watching" | "cdc" | "divergence";

const PHASE_FILTERS: FilterKey[] = ["confirmed", "watching"];
const CONFLUENCE_FILTERS: FilterKey[] = ["cdc", "divergence"];

interface Props {
  market: Market;
  interval: Interval;
  deviation: number;
  onOpenSymbol: (symbol: string) => void;
  watchlist: SymbolInfo[];
  onLogSignal: (entry: NewJournalEntry) => void;
}

export default function Wave3Scanner({ market, interval, deviation, onOpenSymbol, watchlist, onLogSignal }: Props) {
  const [source, setSource] = useState<Source>("preset");
  const [results, setResults] = useState<ScanResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeFilters, setActiveFilters] = useState<Set<FilterKey>>(new Set());

  const watchlistForMarket = watchlist.filter((w) => w.market === market);

  function toggleFilter(key: FilterKey) {
    setActiveFilters((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  // Phase filters (confirmed/watching) are OR'd together — a row only ever has one
  // phase, so requiring both would always match nothing. CDC and Divergence are
  // independent per-row flags, so they're AND'd — selecting both surfaces only the
  // highest-quality setups where both backtest-validated filters agree.
  const activePhases = PHASE_FILTERS.filter((f) => activeFilters.has(f));
  const activeConfluence = CONFLUENCE_FILTERS.filter((f) => activeFilters.has(f));
  const filteredResults = results.filter((r) => {
    if (activePhases.length > 0 && !activePhases.some((f) => f === r.wave2to3.phase)) return false;
    if (activeConfluence.includes("cdc") && r.wave2to3.cdcConfluence !== true) return false;
    if (activeConfluence.includes("divergence") && r.wave2to3.divergenceConfluence !== true) return false;
    return true;
  });

  useEffect(() => {
    if (source === "watchlist" && watchlistForMarket.length === 0) {
      setResults([]);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    scanWave3(market, interval, deviation, source === "watchlist" ? watchlistForMarket : undefined)
      .then((r) => {
        if (!cancelled) setResults(r);
      })
      .catch((e) => {
        if (!cancelled) setError(e.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // watchlistForMarket is derived fresh each render from the watchlist prop + market;
    // re-running on its length is enough to catch additions/removals without an unstable dep.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [market, interval, deviation, source, watchlistForMarket.length]);

  return (
    <div className="scanner">
      <div className="scanner-header">
        <h2>Wave 3 Scanner</h2>
        <p>
          สแกนหาสัญลักษณ์ที่ Wave 2 เสร็จสมบูรณ์แล้วและกำลังรอทะลุแนวเข้าสู่ Wave 3 หรือยืนยัน Wave 3 แล้ว (คลื่นที่มักให้ผลตอบแทนแรงที่สุดในทฤษฎี
          Elliott Wave)
        </p>
        <div className="scanner-source-tabs">
          <button className={source === "preset" ? "active" : ""} onClick={() => setSource("preset")}>
            รายการที่ตั้งไว้
          </button>
          <button className={source === "watchlist" ? "active" : ""} onClick={() => setSource("watchlist")}>
            ★ Watchlist ของฉัน ({watchlistForMarket.length})
          </button>
        </div>
      </div>
      {source === "watchlist" && watchlistForMarket.length === 0 && (
        <div className="empty-state">
          ยังไม่มีสัญลักษณ์ใน Watchlist ของตลาดนี้ — กดไอคอน ☆ ข้างสัญลักษณ์ในแถบด้านซ้ายหรือบนกราฟเพื่อเพิ่ม
        </div>
      )}
      {loading && <div className="empty-state">กำลังสแกน...</div>}
      {error && <div className="empty-state error">{error}</div>}
      {!loading && !error && !(source === "watchlist" && watchlistForMarket.length === 0) && (
        <>
          <div className="scanner-legend">
            <button
              type="button"
              className={`scanner-legend-item scanner-filter-chip ${activeFilters.has("confirmed") ? "active" : ""}`}
              onClick={() => toggleFilter("confirmed")}
            >
              <span className="badge badge-active">Wave 3 กำลังเกิด</span> ราคาทะลุแนว Wave 1 แล้ว — กำลังเคลื่อนที่เป็น Wave 3 จริง
            </button>
            <button
              type="button"
              className={`scanner-legend-item scanner-filter-chip ${activeFilters.has("watching") ? "active" : ""}`}
              onClick={() => toggleFilter("watching")}
            >
              <span className="badge badge-watching">รอทะลุ Wave 3</span> Wave 2 ปรับฐานเสร็จแล้ว รอราคาทะลุแนวเพื่อยืนยัน
            </button>
            <div className="scanner-legend-item">
              <span className="badge">ยังไม่เข้าเงื่อนไข</span> ยังไม่พบรูปแบบ Wave 1-2 ที่ใช้ได้ในตอนนี้
            </div>
            <button
              type="button"
              className={`scanner-legend-item scanner-filter-chip ${activeFilters.has("cdc") ? "active" : ""}`}
              onClick={() => toggleFilter("cdc")}
            >
              <span className="badge badge-confluence">✓ CDC ตรงกัน</span> ผลทดสอบย้อนหลังพบว่าให้ผลตอบแทนเฉลี่ยดีกว่าอย่างชัดเจน (ดูแท็บ Backtest)
            </button>
            <button
              type="button"
              className={`scanner-legend-item scanner-filter-chip ${activeFilters.has("divergence") ? "active" : ""}`}
              onClick={() => toggleFilter("divergence")}
            >
              <span className="badge badge-confluence">✓ Divergence ยืนยัน</span> RSI/MACD มี hidden divergence ที่จุด Wave 0/Wave 2 ยืนยันโมเมนตัมไปทิศทางเดียวกับคลื่น
              (ดูแท็บ Backtest)
            </button>
            {activeFilters.size > 0 && (
              <button type="button" className="scanner-filter-clear" onClick={() => setActiveFilters(new Set())}>
                ✕ ล้างตัวกรอง ({filteredResults.length}/{results.length})
              </button>
            )}
          </div>
          {filteredResults.length === 0 ? (
            <div className="empty-state">ไม่มีสัญลักษณ์ที่ตรงกับตัวกรองที่เลือก ลองล้างตัวกรองบางส่วนดู</div>
          ) : (
          <table className="scanner-table">
            <thead>
              <tr>
                <th>สัญลักษณ์</th>
                <th>ชื่อ</th>
                <th>ราคาล่าสุด</th>
                <th>สถานะ &amp; ระยะทางถึงจุดทะลุ</th>
                <th title="คุณภาพของรูปแบบคลื่นตามอัตราส่วน Fibonacci และกฎ Elliott Wave — ไม่เกี่ยวกับระยะทางราคา">
                  ความมั่นใจของรูปแบบคลื่น
                </th>
                <th title="Risk:Reward ที่เป้าหมาย Fibonacci extension 1.618 เท่าของ Wave 1 (จุดเข้า = แนวทะลุ, stop-loss = ใต้ Wave 2)">
                  R:R @1.618x
                </th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {filteredResults.map((r) => (
                <tr key={r.symbol} className={r.wave2to3.phase !== "none" ? `row-${r.wave2to3.phase}` : ""}>
                  <td className="mono symbol-cell">
                    <SymbolLogo symbol={r.symbol} market={r.market} size={20} />
                    {r.symbol}
                  </td>
                  <td>{r.name}</td>
                  <td className="mono">{formatPrice(r.lastPrice)}</td>
                  <td className="status-cell">
                    {r.wave2to3.phase === "confirmed" && <span className="badge badge-active">Wave 3 กำลังเกิด</span>}
                    {r.wave2to3.phase === "watching" && <span className="badge badge-watching">รอทะลุ Wave 3</span>}
                    {r.wave2to3.phase === "none" && <span className="badge">ยังไม่เข้าเงื่อนไข</span>}
                    {r.wave2to3.phase !== "none" && r.wave2to3.cdcConfluence !== null && (
                      <span
                        className={`badge ${r.wave2to3.cdcConfluence ? "badge-confluence" : "badge-no-confluence"}`}
                        title="ผลทดสอบย้อนหลังพบว่าสัญญาณที่ CDC Action Zone เห็นตรงกันให้ผลตอบแทนเฉลี่ยดีกว่าอย่างชัดเจน (ดูแท็บ Backtest)"
                      >
                        {r.wave2to3.cdcConfluence ? "✓ CDC ตรงกัน" : "✗ CDC ไม่ตรงกัน"}
                      </span>
                    )}
                    {r.wave2to3.phase !== "none" && r.wave2to3.divergenceConfluence !== null && (
                      <span
                        className={`badge ${r.wave2to3.divergenceConfluence ? "badge-confluence" : "badge-no-confluence"}`}
                        title="Hidden divergence: RSI/MACD ที่จุด Wave 0 กับ Wave 2 ยืนยันโมเมนตัมไปทิศทางเดียวกับคลื่น (ดูแท็บ Backtest)"
                      >
                        {r.wave2to3.divergenceConfluence ? "✓ Divergence ยืนยัน" : "✗ ไม่มี Divergence"}
                      </span>
                    )}
                    {r.wave2to3.phase !== "none" && (
                      <div
                        className="mini-progress-track"
                        title="ระยะทางที่ราคาเคลื่อนไปแล้ว เทียบกับระยะที่ต้องใช้ทะลุแนว (หรือขยายคลื่น 3 ถ้ายืนยันแล้ว)"
                      >
                        <div
                          className={`mini-progress-fill ${r.wave2to3.phase === "confirmed" ? "confirmed" : ""}`}
                          style={{ width: `${Math.max(0, Math.min(100, r.wave2to3.progressPct))}%` }}
                        />
                        <span className="mini-progress-text">{r.wave2to3.progressPct}%</span>
                      </div>
                    )}
                  </td>
                  <td className="mono">{r.wave2to3.phase !== "none" ? `${r.wave2to3.confidence}%` : "-"}</td>
                  <td className="mono">
                    {(() => {
                      const target = r.wave2to3.riskReward?.targets.find((t) => t.ratio === 1.618);
                      return target ? `${target.riskRewardRatio.toFixed(2)}:1` : "-";
                    })()}
                  </td>
                  <td className="scanner-actions">
                    <button className="link-btn" onClick={() => onOpenSymbol(r.symbol)}>
                      ดูกราฟ
                    </button>
                    {r.wave2to3.phase !== "none" && r.wave2to3.direction && r.wave2to3.riskReward && r.wave2to3.invalidationLevel !== null && (
                      <button
                        className="link-btn"
                        title="บันทึกสัญญาณนี้ลง Journal เพื่อติดตามผลจริง"
                        onClick={() =>
                          onLogSignal({
                            symbol: r.symbol,
                            name: r.name,
                            market: r.market,
                            interval,
                            deviation,
                            direction: r.wave2to3.direction!,
                            entryTime: r.lastTime,
                            entryPrice: r.lastPrice,
                            stopLoss: r.wave2to3.riskReward!.stopLoss,
                            invalidationLevel: r.wave2to3.invalidationLevel!,
                            targets: r.wave2to3.riskReward!.targets.map((t) => ({ ratio: t.ratio, price: t.price })),
                            confidence: r.wave2to3.confidence,
                            cdcConfluence: r.wave2to3.cdcConfluence,
                            divergenceConfluence: r.wave2to3.divergenceConfluence,
                            phaseAtLog: r.wave2to3.phase === "confirmed" ? "confirmed" : "watching",
                          })
                        }
                      >
                        📝
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          )}
        </>
      )}
    </div>
  );
}
