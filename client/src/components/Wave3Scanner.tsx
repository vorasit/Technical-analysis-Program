import { useEffect, useState } from "react";
import { scanWave3 } from "../api";
import { formatPrice } from "../format";
import type { Interval, Market, ScanResult } from "../types";

interface Props {
  market: Market;
  interval: Interval;
  deviation: number;
  onOpenSymbol: (symbol: string) => void;
}

export default function Wave3Scanner({ market, interval, deviation, onOpenSymbol }: Props) {
  const [results, setResults] = useState<ScanResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    scanWave3(market, interval, deviation)
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
  }, [market, interval, deviation]);

  return (
    <div className="scanner">
      <div className="scanner-header">
        <h2>Wave 3 Scanner</h2>
        <p>
          สแกนหาสัญลักษณ์ที่ Wave 2 เสร็จสมบูรณ์แล้วและกำลังรอทะลุแนวเข้าสู่ Wave 3 หรือยืนยัน Wave 3 แล้ว (คลื่นที่มักให้ผลตอบแทนแรงที่สุดในทฤษฎี
          Elliott Wave)
        </p>
      </div>
      {loading && <div className="empty-state">กำลังสแกน...</div>}
      {error && <div className="empty-state error">{error}</div>}
      {!loading && !error && (
        <table className="scanner-table">
          <thead>
            <tr>
              <th>สัญลักษณ์</th>
              <th>ชื่อ</th>
              <th>ราคาล่าสุด</th>
              <th>สถานะ</th>
              <th>ความคืบหน้า</th>
              <th>ความเชื่อมั่น</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {results.map((r) => (
              <tr key={r.symbol} className={r.wave2to3.phase !== "none" ? `row-${r.wave2to3.phase}` : ""}>
                <td className="mono">{r.symbol}</td>
                <td>{r.name}</td>
                <td className="mono">{formatPrice(r.lastPrice)}</td>
                <td>
                  {r.wave2to3.phase === "confirmed" && <span className="badge badge-active">Wave 3 กำลังเกิด</span>}
                  {r.wave2to3.phase === "watching" && <span className="badge badge-watching">รอทะลุ Wave 3</span>}
                  {r.wave2to3.phase === "none" && <span className="badge">ยังไม่เข้าเงื่อนไข</span>}
                </td>
                <td>
                  {r.wave2to3.phase !== "none" ? (
                    <div className="mini-progress-track">
                      <div
                        className={`mini-progress-fill ${r.wave2to3.phase === "confirmed" ? "confirmed" : ""}`}
                        style={{ width: `${Math.max(0, Math.min(100, r.wave2to3.progressPct))}%` }}
                      />
                      <span className="mini-progress-text">{r.wave2to3.progressPct}%</span>
                    </div>
                  ) : (
                    "-"
                  )}
                </td>
                <td className="mono">{r.wave2to3.phase !== "none" ? `${r.wave2to3.confidence}%` : "-"}</td>
                <td>
                  <button className="link-btn" onClick={() => onOpenSymbol(r.symbol)}>
                    ดูกราฟ
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
