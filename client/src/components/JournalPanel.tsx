import { useEffect, useState } from "react";
import { getJournalStatus } from "../api";
import { formatPrice } from "../format";
import SymbolLogo from "./SymbolLogo";
import type { JournalEntry, JournalStatus } from "../types";

interface Props {
  entries: JournalEntry[];
  onDelete: (id: string) => void;
}

interface EntryState {
  status: JournalStatus | null;
  loading: boolean;
  error: string | null;
}

function fmtDateTime(t: number): string {
  return new Date(t * 1000).toLocaleString();
}

function fmtSignedPct(v: number): string {
  return `${v >= 0 ? "+" : ""}${v.toFixed(2)}%`;
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

function JournalSummary({ entries, states }: { entries: JournalEntry[]; states: Record<string, EntryState> }) {
  const loaded = entries.map((e) => states[e.id]?.status).filter((s): s is JournalStatus => s !== null && s !== undefined);
  const stillLoading = entries.some((e) => states[e.id]?.loading);

  const counts = { open: 0, target_hit: 0, stopped: 0 };
  let sumReturnAll = 0;
  let sumReturnClosed = 0;
  let closedCount = 0;

  for (const s of loaded) {
    counts[s.status]++;
    sumReturnAll += s.returnPct;
    if (s.status !== "open") {
      sumReturnClosed += s.returnPct;
      closedCount++;
    }
  }

  const avgReturnAll = loaded.length > 0 ? sumReturnAll / loaded.length : null;
  const avgReturnClosed = closedCount > 0 ? sumReturnClosed / closedCount : null;
  const winRate = closedCount > 0 ? (counts.target_hit / closedCount) * 100 : null;

  return (
    <div className="backtest-cards">
      <div className="backtest-card">
        <div className="backtest-card-title">ภาพรวม ({entries.length} รายการ{stillLoading ? " — กำลังโหลด..." : ""})</div>
        <div className="backtest-stat-row">
          <span>เปิดอยู่</span>
          <strong>{counts.open}</strong>
        </div>
        <div className="backtest-stat-row">
          <span>ถึงเป้าหมาย</span>
          <strong className="pos">{counts.target_hit}</strong>
        </div>
        <div className="backtest-stat-row">
          <span>โดน Stop-loss</span>
          <strong className="neg">{counts.stopped}</strong>
        </div>
      </div>
      <div className="backtest-card">
        <div className="backtest-card-title">ผลตอบแทนจริง</div>
        <div className="backtest-stat-row">
          <span>Win rate (เฉพาะที่ปิดแล้ว)</span>
          <strong>{winRate !== null ? `${winRate.toFixed(0)}% (${counts.target_hit}/${closedCount})` : "-"}</strong>
        </div>
        <div className="backtest-stat-row">
          <span>ผลตอบแทนเฉลี่ย (ที่ปิดแล้ว)</span>
          <strong className={avgReturnClosed !== null ? (avgReturnClosed >= 0 ? "pos" : "neg") : ""}>
            {avgReturnClosed !== null ? fmtSignedPct(avgReturnClosed) : "-"}
          </strong>
        </div>
        <div className="backtest-stat-row">
          <span>ผลตอบแทนเฉลี่ย (ทั้งหมด รวมที่ยังเปิดอยู่)</span>
          <strong className={avgReturnAll !== null ? (avgReturnAll >= 0 ? "pos" : "neg") : ""}>
            {avgReturnAll !== null ? fmtSignedPct(avgReturnAll) : "-"}
          </strong>
        </div>
      </div>
    </div>
  );
}

function EntryCard({ entry, state, onDelete }: { entry: JournalEntry; state: EntryState; onDelete: (id: string) => void }) {
  const { status, loading, error } = state;

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
            <span className={`journal-return ${status.returnPct >= 0 ? "pos" : "neg"}`}>{fmtSignedPct(status.returnPct)}</span>
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
  const [states, setStates] = useState<Record<string, EntryState>>({});
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    let cancelled = false;

    setStates(() => {
      const initial: Record<string, EntryState> = {};
      for (const e of entries) initial[e.id] = { status: null, loading: true, error: null };
      return initial;
    });

    entries.forEach((entry) => {
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
          if (!cancelled) setStates((prev) => ({ ...prev, [entry.id]: { status: s, loading: false, error: null } }));
        })
        .catch((e) => {
          if (!cancelled) setStates((prev) => ({ ...prev, [entry.id]: { status: null, loading: false, error: e.message } }));
        });
    });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entries, refreshKey]);

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
        <>
          <JournalSummary entries={entries} states={states} />
          <button className="link-btn journal-refresh-btn" onClick={() => setRefreshKey((k) => k + 1)}>
            🔄 รีเฟรชสถานะทั้งหมด
          </button>
          <div className="journal-list">
            {entries.map((e) => (
              <EntryCard key={e.id} entry={e} state={states[e.id] ?? { status: null, loading: true, error: null }} onDelete={onDelete} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
