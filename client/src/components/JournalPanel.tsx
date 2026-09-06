import { useEffect, useState } from "react";
import { getJournalStatus } from "../api";
import { formatPrice } from "../format";
import SymbolLogo from "./SymbolLogo";
import type { JournalEntry, JournalStatus } from "../types";

interface Props {
  entries: JournalEntry[];
  onDelete: (id: string) => void;
}

function fmtDateTime(t: number): string {
  return new Date(t * 1000).toLocaleString();
}

const STATUS_LABEL: Record<JournalStatus["status"], string> = {
  open: "เปิดอยู่",
  stopped: "โดน Stop-loss",
  target_hit: "ถึงเป้าหมายแล้ว",
};

const STATUS_BADGE_CLASS: Record<JournalStatus["status"], string> = {
  open: "badge-watching",
  stopped: "badge-stopped",
  target_hit: "badge-active",
};

function EntryCard({ entry, onDelete }: { entry: JournalEntry; onDelete: (id: string) => void }) {
  const [status, setStatus] = useState<JournalStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    getJournalStatus(
      entry.market,
      entry.symbol,
      entry.interval,
      entry.direction,
      entry.entryTime,
      entry.entryPrice,
      entry.stopLoss,
      entry.invalidationLevel,
      entry.targets
    )
      .then((s) => {
        if (!cancelled) setStatus(s);
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
    // entry is an immutable snapshot once logged, so its id alone is a stable key for this fetch.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entry.id]);

  return (
    <div className="journal-card">
      <div className="journal-card-header">
        <span className="journal-card-title">
          <SymbolLogo symbol={entry.symbol} market={entry.market} size={22} />
          {entry.symbol} <small>{entry.name}</small>
        </span>
        <span className={`badge ${entry.direction === "up" ? "badge-active" : "badge-stopped"}`}>{entry.direction === "up" ? "▲ Long" : "▼ Short"}</span>
        <span className="badge">{entry.phaseAtLog === "confirmed" ? "บันทึกตอนยืนยันแล้ว" : "บันทึกตอนรอทะลุ"}</span>
        <button className="journal-delete" onClick={() => onDelete(entry.id)} title="ลบออกจาก Journal">
          ✕
        </button>
      </div>
      <div className="journal-meta">
        บันทึกเมื่อ {fmtDateTime(entry.loggedAt)} · ราคาตอนบันทึก {formatPrice(entry.entryPrice)} · ความมั่นใจตอนบันทึก {entry.confidence}%
        {entry.cdcConfluence !== null && (entry.cdcConfluence ? " · ✓ CDC ตรงกัน" : " · ✗ CDC ไม่ตรงกัน")}
        {entry.divergenceConfluence !== null && (entry.divergenceConfluence ? " · ✓ Divergence ยืนยัน" : "")}
      </div>
      <div className="journal-levels">
        <span>
          Stop-loss: <strong>{formatPrice(entry.stopLoss)}</strong>
        </span>
        <span>
          แนวยกเลิกนับคลื่น: <strong>{formatPrice(entry.invalidationLevel)}</strong>
        </span>
        <span>
          เป้าหมาย: <strong>{entry.targets.map((t) => `${t.ratio}x @ ${formatPrice(t.price)}`).join(" / ")}</strong>
        </span>
      </div>

      {loading && <div className="empty-state">กำลังตรวจสอบผลจริง...</div>}
      {error && <div className="empty-state error">{error}</div>}

      {status && (
        <>
          <div className="journal-status-row">
            <span className={`badge ${STATUS_BADGE_CLASS[status.status]}`}>{STATUS_LABEL[status.status]}</span>
            <span className={`journal-return ${status.returnPct >= 0 ? "pos" : "neg"}`}>
              {status.returnPct >= 0 ? "+" : ""}
              {status.returnPct.toFixed(2)}%
            </span>
            {status.waveInvalidated && (
              <span
                className="badge badge-no-confluence"
                title="ราคาทะลุแนวยกเลิกนับคลื่น (Wave 0) แล้ว การนับคลื่นเดิมไม่ถูกต้องแล้ว แม้สถานะการเทรดจะยังไม่โดน stop ก็ตาม"
              >
                ⚠ คลื่นถูกยกเลิกนับ
              </span>
            )}
          </div>
          {status.targetsHit.length > 0 && (
            <div className="journal-targets-hit">
              ถึงเป้าหมาย: {status.targetsHit.map((t) => `${t.ratio}x @ ${formatPrice(t.price)} (${fmtDateTime(t.time)})`).join(", ")}
            </div>
          )}
          <div className="journal-current">
            ราคาล่าสุดที่ตรวจสอบ: <strong>{formatPrice(status.currentPrice)}</strong> ({fmtDateTime(status.currentTime)})
          </div>
        </>
      )}
    </div>
  );
}

export default function JournalPanel({ entries, onDelete }: Props) {
  return (
    <div className="journal-panel">
      <div className="journal-header">
        <h2>Signal Journal</h2>
        <p>
          บันทึกสัญญาณ Wave 3 ที่พบจริงพร้อมเวลา แล้วติดตามผลจริงที่เกิดขึ้นหลังจากนั้น — ต่างจาก Backtest ที่จำลองผลย้อนหลัง หน้านี้เช็คสถานะปัจจุบันของสัญญาณที่คุณเลือกบันทึกไว้เองแบบ
          walk-forward จริง
        </p>
      </div>
      {entries.length === 0 ? (
        <div className="empty-state">
          ยังไม่มีสัญญาณที่บันทึกไว้ — กดปุ่ม "📝 บันทึกลง Journal" จากแท็บกราฟหรือ Wave 3 Scanner เมื่อเจอสัญญาณที่สนใจ
        </div>
      ) : (
        <div className="journal-list">
          {entries.map((e) => (
            <EntryCard key={e.id} entry={e} onDelete={onDelete} />
          ))}
        </div>
      )}
    </div>
  );
}
