import { useEffect, useState } from "react";
import { getBacktest } from "../api";
import type { HorizonStat, Interval, Market, BacktestResponse, SymbolInfo } from "../types";

type Source = "preset" | "watchlist";

interface Props {
  market: Market;
  interval: Interval;
  deviation: number;
  watchlist: SymbolInfo[];
}

function fmtPct(v: number): string {
  return `${v >= 0 ? "+" : ""}${v.toFixed(2)}%`;
}

function HorizonCard({ stat }: { stat: HorizonStat }) {
  return (
    <div className="backtest-card">
      <div className="backtest-card-title">{stat.horizon} แท่งเทียนหลังสัญญาณ</div>
      {stat.count === 0 ? (
        <div className="empty-state">ไม่มีข้อมูลพอ</div>
      ) : (
        <>
          <div className="backtest-stat-row">
            <span>จำนวนสัญญาณ</span>
            <strong>{stat.count}</strong>
          </div>
          <div className="backtest-stat-row">
            <span>อัตราชนะ (ราคาไปตามคาด)</span>
            <strong className={stat.winRate >= 50 ? "pos" : "neg"}>{stat.winRate.toFixed(1)}%</strong>
          </div>
          <div className="backtest-stat-row">
            <span>ผลตอบแทนเฉลี่ย</span>
            <strong className={stat.avgReturnPct >= 0 ? "pos" : "neg"}>{fmtPct(stat.avgReturnPct)}</strong>
          </div>
          <div className="backtest-stat-row">
            <span>ผลตอบแทนมัธยฐาน</span>
            <strong className={stat.medianReturnPct >= 0 ? "pos" : "neg"}>{fmtPct(stat.medianReturnPct)}</strong>
          </div>
          <div className="backtest-stat-row">
            <span>โดนจุดยกเลิกระหว่างทาง</span>
            <strong>{stat.stopRatePct.toFixed(1)}%</strong>
          </div>
        </>
      )}
    </div>
  );
}

export default function BacktestPanel({ market, interval, deviation, watchlist }: Props) {
  const [source, setSource] = useState<Source>("preset");
  const [data, setData] = useState<BacktestResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const watchlistForMarket = watchlist.filter((w) => w.market === market);

  useEffect(() => {
    if (source === "watchlist" && watchlistForMarket.length === 0) {
      setData(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    getBacktest(market, interval, deviation, source === "watchlist" ? watchlistForMarket : undefined)
      .then((r) => {
        if (!cancelled) setData(r);
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
        <h2>Backtest — วัดผลย้อนหลังของสัญญาณ Wave 3</h2>
        <p>
          จำลองย้อนหลังว่าทุกครั้งที่ระบบเคยขึ้น "Wave 3 ยืนยันแล้ว" ในอดีต ถ้าเข้าซื้อ/ขายทันทีที่ราคาทะลุแนว แล้วถือไว้ตามจำนวนแท่งเทียนที่กำหนด
          ผลตอบแทนจริงเป็นอย่างไร — ใช้ข้อมูลเท่าที่มีในอดีต ณ ตอนนั้นเท่านั้น (walk-forward) ไม่มีการมองล่วงหน้า
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
        <div className="empty-state">ยังไม่มีสัญลักษณ์ใน Watchlist ของตลาดนี้ — กดไอคอน ☆ ข้างสัญลักษณ์เพื่อเพิ่มก่อน</div>
      )}
      {loading && <div className="empty-state">กำลังคำนวณย้อนหลัง...</div>}
      {error && <div className="empty-state error">{error}</div>}

      {data && !loading && !error && (
        <>
          <div className="backtest-cards">
            {data.aggregate.map((stat) => (
              <HorizonCard key={stat.horizon} stat={stat} />
            ))}
          </div>

          <table className="scanner-table">
            <thead>
              <tr>
                <th>สัญลักษณ์</th>
                <th>จำนวนสัญญาณ</th>
                {data.horizons.map((h) => (
                  <th key={h}>Win% @ {h} แท่ง</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.bySymbol.map((s) => (
                <tr key={s.symbol}>
                  <td className="mono">
                    {s.symbol} <span className="symbol-name">{s.name}</span>
                  </td>
                  <td className="mono">{s.signalCount}</td>
                  {s.horizonStats.map((h) => (
                    <td key={h.horizon} className="mono">
                      {h.count > 0 ? (
                        <span className={h.winRate >= 50 ? "pos" : "neg"}>{h.winRate.toFixed(0)}%</span>
                      ) : (
                        "-"
                      )}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>

          {data.failures.length > 0 && (
            <div className="empty-state">ข้อมูลไม่พอสำหรับ: {data.failures.map((f) => f.symbol).join(", ")}</div>
          )}

          <p className="disclaimer">
            วิธีจำลอง: เข้าสถานะที่ราคาปิดของแท่งแรกที่ทะลุแนว Wave 1 แล้ววัดผลตอบแทน ณ จำนวนแท่งเทียนที่กำหนดไว้พอดี (ไม่ปิดสถานะก่อนกำหนดแม้ราคาจะแตะจุดยกเลิกระหว่างทาง —
            "โดนจุดยกเลิก" ในตารางเป็นแค่ตัวชี้วัดความเสี่ยงแยกต่างหาก) ไม่รวมค่าธรรมเนียม สลิปเพจ หรือการทบต้น ผลย้อนหลังไม่ได้การันตีผลในอนาคต และ Elliott Wave
            เป็นทฤษฎีที่ตีความได้หลายแบบโดยธรรมชาติ
          </p>
        </>
      )}
    </div>
  );
}
