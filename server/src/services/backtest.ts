import { BacktestSignal, Candle, HorizonStat, Pivot } from "../types.js";
import { computeZigzag } from "./elliottWave.js";
import { cdcActionZone } from "./indicators.js";
import { buildDivergenceMaps, checkHiddenDivergence } from "./divergence.js";

export const BACKTEST_HORIZONS = [5, 10, 20];

/**
 * Finds every historical Wave 1-2-3 setup in the given candles and measures
 * what actually happened afterward — a walk-forward-safe backtest of the
 * live Wave 2->3 tracker's signal.
 *
 * Lookahead-bias note: this scans the full pivot history in one pass, which
 * is safe here because this zigzag algorithm never revises a *confirmed*
 * pivot once later price action locks it in — a pivot's index and price are
 * fully determined by candles up to shortly after it forms, never by data
 * further in the future. So the pivot triple (p0, p1, p2) that defines a
 * setup is exactly what the live tracker would have seen at that point in
 * time; only the forward candle scan for the entry/exit uses future data,
 * which is exactly what a backtest is supposed to do.
 */
export function findBacktestSignals(candles: Candle[], deviationPct: number): BacktestSignal[] {
  const pivots = computeZigzag(candles, deviationPct);
  const signals: BacktestSignal[] = [];

  const cdcByTime = new Map(cdcActionZone(candles).map((p) => [p.time, p.zone]));
  function cdcAgreesAt(time: number, isUp: boolean): boolean | null {
    const zone = cdcByTime.get(time);
    if (!zone) return null;
    const bullZone = zone === "green" || zone === "blue";
    const bearZone = zone === "red" || zone === "yellow";
    return isUp ? bullZone : bearZone;
  }

  const divergenceMaps = buildDivergenceMaps(candles);

  for (let i = 0; i + 2 < pivots.length; i++) {
    const p0 = pivots[i];
    const p1 = pivots[i + 1];
    const p2 = pivots[i + 2];
    const isUp = p1.price > p0.price;
    const patternOk = isUp
      ? p0.type === "low" && p1.type === "high" && p2.type === "low"
      : p0.type === "high" && p1.type === "low" && p2.type === "high";
    if (!patternOk) continue;

    const wave2Holds = isUp ? p2.price > p0.price : p2.price < p0.price;
    if (!wave2Holds) continue;

    const breakoutLevel = p1.price;
    const invalidationLevel = p0.price;
    const entryIdx = findEntryIndex(candles, p2, isUp, breakoutLevel, invalidationLevel);
    if (entryIdx === null) continue;

    const entryPrice = candles[entryIdx].close;
    const sign = isUp ? 1 : -1;
    const returns: BacktestSignal["returns"] = {};

    for (const horizon of BACKTEST_HORIZONS) {
      const exitIdx = entryIdx + horizon;
      if (exitIdx >= candles.length) {
        returns[horizon] = null;
        continue;
      }
      const exitPrice = candles[exitIdx].close;
      const returnPct = (sign * (exitPrice - entryPrice) * 100) / entryPrice;
      let hitInvalidation = false;
      for (let idx = entryIdx; idx <= exitIdx; idx++) {
        if (isUp ? candles[idx].close < invalidationLevel : candles[idx].close > invalidationLevel) {
          hitInvalidation = true;
          break;
        }
      }
      returns[horizon] = { returnPct, hitInvalidation };
    }

    signals.push({
      direction: isUp ? "up" : "down",
      wave0Time: p0.time,
      wave1Time: p1.time,
      wave2Time: p2.time,
      entryTime: candles[entryIdx].time,
      entryPrice,
      breakoutLevel,
      invalidationLevel,
      cdcAgrees: cdcAgreesAt(candles[entryIdx].time, isUp),
      divergenceAgrees: checkHiddenDivergence(divergenceMaps, p0.time, p2.time, isUp ? "up" : "down"),
      returns,
    });
  }

  return signals;
}

/** First candle after the Wave 2 pivot that closes past the breakout level, as long as the setup doesn't invalidate first. */
function findEntryIndex(candles: Candle[], p2: Pivot, isUp: boolean, breakoutLevel: number, invalidationLevel: number): number | null {
  for (let idx = p2.index + 1; idx < candles.length; idx++) {
    const close = candles[idx].close;
    const invalidated = isUp ? close < invalidationLevel : close > invalidationLevel;
    if (invalidated) return null;
    const brokeOut = isUp ? close > breakoutLevel : close < breakoutLevel;
    if (brokeOut) return idx;
  }
  return null;
}

export function computeHorizonStats(signals: BacktestSignal[]): HorizonStat[] {
  return BACKTEST_HORIZONS.map((horizon) => {
    const valid = signals.map((s) => s.returns[horizon]).filter((r): r is NonNullable<typeof r> => r !== null);
    if (valid.length === 0) {
      return { horizon, count: 0, winRate: 0, avgReturnPct: 0, medianReturnPct: 0, stopRatePct: 0 };
    }
    const sorted = [...valid].sort((a, b) => a.returnPct - b.returnPct);
    const wins = valid.filter((r) => r.returnPct > 0).length;
    const stopped = valid.filter((r) => r.hitInvalidation).length;
    const avgReturnPct = valid.reduce((sum, r) => sum + r.returnPct, 0) / valid.length;
    const medianReturnPct = sorted[Math.floor(sorted.length / 2)].returnPct;
    return {
      horizon,
      count: valid.length,
      winRate: (wins / valid.length) * 100,
      avgReturnPct,
      medianReturnPct,
      stopRatePct: (stopped / valid.length) * 100,
    };
  });
}
