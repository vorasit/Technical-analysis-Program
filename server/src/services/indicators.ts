import { Candle } from "../types.js";

export interface IndicatorSeries {
  time: number;
  value: number;
}

export function sma(candles: Candle[], period: number): IndicatorSeries[] {
  const out: IndicatorSeries[] = [];
  let sum = 0;
  for (let i = 0; i < candles.length; i++) {
    sum += candles[i].close;
    if (i >= period) sum -= candles[i - period].close;
    if (i >= period - 1) out.push({ time: candles[i].time, value: sum / period });
  }
  return out;
}

function emaOfValues(values: IndicatorSeries[], period: number): IndicatorSeries[] {
  const out: IndicatorSeries[] = [];
  const k = 2 / (period + 1);
  let prev: number | null = null;
  for (let i = 0; i < values.length; i++) {
    const price = values[i].value;
    if (prev === null) {
      if (i === period - 1) {
        const seed = values.slice(0, period).reduce((s, v) => s + v.value, 0) / period;
        prev = seed;
        out.push({ time: values[i].time, value: seed });
      }
      continue;
    }
    const value: number = price * k + prev * (1 - k);
    prev = value;
    out.push({ time: values[i].time, value });
  }
  return out;
}

export function ema(candles: Candle[], period: number): IndicatorSeries[] {
  return emaOfValues(
    candles.map((c) => ({ time: c.time, value: c.close })),
    period
  );
}

export function rsi(candles: Candle[], period = 14): IndicatorSeries[] {
  const out: IndicatorSeries[] = [];
  if (candles.length <= period) return out;
  let avgGain = 0;
  let avgLoss = 0;
  for (let i = 1; i <= period; i++) {
    const change = candles[i].close - candles[i - 1].close;
    avgGain += Math.max(change, 0);
    avgLoss += Math.max(-change, 0);
  }
  avgGain /= period;
  avgLoss /= period;
  out.push({
    time: candles[period].time,
    value: avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss),
  });
  for (let i = period + 1; i < candles.length; i++) {
    const change = candles[i].close - candles[i - 1].close;
    const gain = Math.max(change, 0);
    const loss = Math.max(-change, 0);
    avgGain = (avgGain * (period - 1) + gain) / period;
    avgLoss = (avgLoss * (period - 1) + loss) / period;
    const rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
    out.push({ time: candles[i].time, value: avgLoss === 0 ? 100 : 100 - 100 / (1 + rs) });
  }
  return out;
}

export interface MacdResult {
  time: number;
  macd: number;
  signal: number;
  histogram: number;
}

export function macd(candles: Candle[], fast = 12, slow = 26, signalPeriod = 9): MacdResult[] {
  const emaFast = ema(candles, fast);
  const emaSlow = ema(candles, slow);
  const slowStart = emaSlow[0]?.time;
  const fastMap = new Map(emaFast.map((p) => [p.time, p.value]));
  const macdLine: IndicatorSeries[] = emaSlow
    .filter((p) => fastMap.has(p.time))
    .map((p) => ({ time: p.time, value: fastMap.get(p.time)! - p.value }));
  void slowStart;

  // signal = EMA of macd line
  const k = 2 / (signalPeriod + 1);
  let prevSignal: number | null = null;
  const out: MacdResult[] = [];
  macdLine.forEach((p, i) => {
    if (prevSignal === null) {
      if (i === signalPeriod - 1) {
        const seed = macdLine.slice(0, signalPeriod).reduce((s, x) => s + x.value, 0) / signalPeriod;
        prevSignal = seed;
        out.push({ time: p.time, macd: p.value, signal: seed, histogram: p.value - seed });
      }
      return;
    }
    const signal = p.value * k + prevSignal * (1 - k);
    prevSignal = signal;
    out.push({ time: p.time, macd: p.value, signal, histogram: p.value - signal });
  });
  return out;
}

export interface BollingerPoint {
  time: number;
  upper: number;
  middle: number;
  lower: number;
}

export function bollinger(candles: Candle[], period = 20, mult = 2): BollingerPoint[] {
  const out: BollingerPoint[] = [];
  for (let i = period - 1; i < candles.length; i++) {
    const window = candles.slice(i - period + 1, i + 1);
    const mean = window.reduce((s, c) => s + c.close, 0) / period;
    const variance = window.reduce((s, c) => s + (c.close - mean) ** 2, 0) / period;
    const sd = Math.sqrt(variance);
    out.push({ time: candles[i].time, upper: mean + mult * sd, middle: mean, lower: mean - mult * sd });
  }
  return out;
}

export type CdcZone = "green" | "blue" | "red" | "yellow";

export interface CdcPoint {
  time: number;
  ema1: number;
  ema2: number;
  zone: CdcZone;
  signal: "buy" | "sell" | null;
}

/**
 * CDC Action Zone: classifies each bar into one of 4 zones from two EMAs of a
 * lightly-smoothed price (Ema1 fast / Ema2 slow), and flags the first bar of
 * a Buy (entering green) or Sell (entering red) zone.
 */
export function cdcActionZone(candles: Candle[], fastLength = 12, slowLength = 26, apPeriod = 2): CdcPoint[] {
  const closeSeries = candles.map((c) => ({ time: c.time, value: c.close }));
  const shortMa = emaOfValues(closeSeries, apPeriod);
  const ema1Series = emaOfValues(shortMa, fastLength);
  const ema2Series = emaOfValues(shortMa, slowLength);

  const shortMaMap = new Map(shortMa.map((p) => [p.time, p.value]));
  const ema1Map = new Map(ema1Series.map((p) => [p.time, p.value]));

  const out: CdcPoint[] = [];
  let prevZone: CdcZone | null = null;

  for (const p of ema2Series) {
    const ema2 = p.value;
    const ema1 = ema1Map.get(p.time);
    const sMa = shortMaMap.get(p.time);
    if (ema1 === undefined || sMa === undefined) continue;

    const bulls = ema1 > ema2;
    const zone: CdcZone = bulls ? (sMa > ema1 ? "green" : "blue") : sMa < ema1 ? "red" : "yellow";

    let signal: "buy" | "sell" | null = null;
    if (zone === "green" && prevZone !== "green") signal = "buy";
    else if (zone === "red" && prevZone !== "red") signal = "sell";

    out.push({ time: p.time, ema1, ema2, zone, signal });
    prevZone = zone;
  }

  return out;
}
