import { Candle, JournalStatus, JournalTarget } from "../types.js";

/**
 * Walks the candles from the moment a signal was logged forward to now and
 * reports what actually happened — the real-world counterpart to backtest.ts's
 * simulated signals. Uses candle closes throughout (not intrabar highs/lows),
 * the same convention findBacktestSignals uses, so a logged signal's outcome
 * stays comparable to the backtest's numbers.
 *
 * Once stopped out, target hits and the return are frozen as of the stop —
 * a trade that already exited doesn't keep "gaining" just because price kept
 * moving. waveInvalidated is tracked independently: it flags that the original
 * Elliott Wave count itself broke down, which can happen before or after the
 * trade's own stop-loss is hit.
 */
export function computeJournalStatus(
  candles: Candle[],
  direction: "up" | "down",
  entryTime: number,
  entryPrice: number,
  stopLoss: number,
  invalidationLevel: number,
  targets: JournalTarget[]
): JournalStatus | null {
  const relevant = candles.filter((c) => c.time >= entryTime);
  if (relevant.length === 0) return null;

  const sign = direction === "up" ? 1 : -1;
  let stoppedOutTime: number | null = null;
  let waveInvalidatedTime: number | null = null;
  const targetsHit: JournalStatus["targetsHit"] = [];
  const remaining = [...targets];

  for (const c of relevant) {
    if (waveInvalidatedTime === null) {
      const invalidated = direction === "up" ? c.close < invalidationLevel : c.close > invalidationLevel;
      if (invalidated) waveInvalidatedTime = c.time;
    }

    if (stoppedOutTime !== null) continue; // trade is closed — stop scanning for further target hits

    const stopped = direction === "up" ? c.close < stopLoss : c.close > stopLoss;
    if (stopped) {
      stoppedOutTime = c.time;
      continue;
    }

    for (let i = remaining.length - 1; i >= 0; i--) {
      const t = remaining[i];
      const reached = direction === "up" ? c.close >= t.price : c.close <= t.price;
      if (reached) {
        targetsHit.push({ ratio: t.ratio, price: t.price, time: c.time });
        remaining.splice(i, 1);
      }
    }
  }

  const last = relevant[relevant.length - 1];
  const currentPrice = stoppedOutTime !== null ? stopLoss : last.close;
  const currentTime = stoppedOutTime !== null ? stoppedOutTime : last.time;

  return {
    currentPrice,
    currentTime,
    returnPct: (sign * (currentPrice - entryPrice) * 100) / entryPrice,
    stoppedOut: stoppedOutTime !== null,
    stoppedOutTime,
    waveInvalidated: waveInvalidatedTime !== null,
    waveInvalidatedTime,
    targetsHit: targetsHit.sort((a, b) => a.time - b.time),
    status: stoppedOutTime !== null ? "stopped" : targetsHit.length > 0 ? "target_hit" : "open",
  };
}
