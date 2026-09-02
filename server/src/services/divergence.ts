import { Candle } from "../types.js";
import { rsi, macd } from "./indicators.js";

export interface DivergenceMaps {
  rsi: Map<number, number>;
  macdHist: Map<number, number>;
}

export function buildDivergenceMaps(candles: Candle[]): DivergenceMaps {
  return {
    rsi: new Map(rsi(candles, 14).map((p) => [p.time, p.value])),
    macdHist: new Map(macd(candles).map((p) => [p.time, p.histogram])),
  };
}

/**
 * Checks for *hidden* divergence between price and RSI/MACD at the two pivots
 * framing a Wave 1-2 setup (wave0 -> wave2, both the same pivot type). Wave 2
 * is required by Elliott rules to hold a higher low (uptrend) or lower high
 * (downtrend) than wave0, so the classic "regular" divergence (price makes a
 * new extreme, indicator doesn't) can't apply here. Hidden divergence is the
 * textbook-correct read instead: price makes a higher low/lower high (trend
 * continuation) while the indicator makes a *lower* low/*higher* high —
 * momentum quietly building against the pullback, confirming the trend is
 * likely to resume into Wave 3. Agreement on either RSI or MACD histogram
 * counts as confluence; null means not enough indicator history at these
 * pivots yet (warmup period).
 */
export function checkHiddenDivergence(
  maps: DivergenceMaps,
  wave0Time: number,
  wave2Time: number,
  direction: "up" | "down"
): boolean | null {
  const rsi0 = maps.rsi.get(wave0Time);
  const rsi2 = maps.rsi.get(wave2Time);
  const macd0 = maps.macdHist.get(wave0Time);
  const macd2 = maps.macdHist.get(wave2Time);

  const rsiHidden = rsi0 !== undefined && rsi2 !== undefined ? (direction === "up" ? rsi2 < rsi0 : rsi2 > rsi0) : null;
  const macdHidden =
    macd0 !== undefined && macd2 !== undefined ? (direction === "up" ? macd2 < macd0 : macd2 > macd0) : null;

  if (rsiHidden === null && macdHidden === null) return null;
  return Boolean(rsiHidden) || Boolean(macdHidden);
}
