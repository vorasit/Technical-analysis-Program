import type { BollingerPoint, Candle, CdcPoint, CdcZone, IndicatorPoint, Indicators, MacdPoint } from "./types";

// Chart overlays, computed here from /api/analyze's candles rather than shipped
// with them (see the note in the server's /analyze route). Mirrors
// server/src/services/indicators.ts, which the wave analysis still uses — keep
// the two in step so the chart shows what the analysis saw.

function sma(candles: Candle[], period: number): IndicatorPoint[] {
  const out: IndicatorPoint[] = [];
  let sum = 0;
  for (let i = 0; i < candles.length; i++) {
    sum += candles[i].close;
    if (i >= period) sum -= candles[i - period].close;
    if (i >= period - 1) out.push({ time: candles[i].time, value: sum / period });
  }
  return out;
}

function emaOfValues(values: IndicatorPoint[], period: number): IndicatorPoint[] {
  const out: IndicatorPoint[] = [];
  const k = 2 / (period + 1);
  let prev: number | null = null;
  for (let i = 0; i < values.length; i++) {
    if (prev === null) {
      if (i === period - 1) {
        prev = values.slice(0, period).reduce((s, v) => s + v.value, 0) / period;
        out.push({ time: values[i].time, value: prev });
      }
      continue;
    }
    prev = values[i].value * k + prev * (1 - k);
    out.push({ time: values[i].time, value: prev });
  }
  return out;
}

function closes(candles: Candle[]): IndicatorPoint[] {
  return candles.map((c) => ({ time: c.time, value: c.close }));
}

function ema(candles: Candle[], period: number): IndicatorPoint[] {
  return emaOfValues(closes(candles), period);
}

function rsi(candles: Candle[], period = 14): IndicatorPoint[] {
  const out: IndicatorPoint[] = [];
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
  out.push({ time: candles[period].time, value: avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss) });
  for (let i = period + 1; i < candles.length; i++) {
    const change = candles[i].close - candles[i - 1].close;
    avgGain = (avgGain * (period - 1) + Math.max(change, 0)) / period;
    avgLoss = (avgLoss * (period - 1) + Math.max(-change, 0)) / period;
    out.push({ time: candles[i].time, value: avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss) });
  }
  return out;
}

function macd(candles: Candle[], fast = 12, slow = 26, signalPeriod = 9): MacdPoint[] {
  const fastMap = new Map(ema(candles, fast).map((p) => [p.time, p.value]));
  const macdLine: IndicatorPoint[] = ema(candles, slow)
    .filter((p) => fastMap.has(p.time))
    .map((p) => ({ time: p.time, value: fastMap.get(p.time)! - p.value }));
  const signalMap = new Map(emaOfValues(macdLine, signalPeriod).map((p) => [p.time, p.value]));
  return macdLine
    .filter((p) => signalMap.has(p.time))
    .map((p) => {
      const signal = signalMap.get(p.time)!;
      return { time: p.time, macd: p.value, signal, histogram: p.value - signal };
    });
}

function bollinger(candles: Candle[], period = 20, mult = 2): BollingerPoint[] {
  const out: BollingerPoint[] = [];
  for (let i = period - 1; i < candles.length; i++) {
    const window = candles.slice(i - period + 1, i + 1);
    const mean = window.reduce((s, c) => s + c.close, 0) / period;
    const sd = Math.sqrt(window.reduce((s, c) => s + (c.close - mean) ** 2, 0) / period);
    out.push({ time: candles[i].time, upper: mean + mult * sd, middle: mean, lower: mean - mult * sd });
  }
  return out;
}

function cdcActionZone(candles: Candle[], fastLength = 12, slowLength = 26, apPeriod = 2): CdcPoint[] {
  const shortMa = emaOfValues(closes(candles), apPeriod);
  const shortMaMap = new Map(shortMa.map((p) => [p.time, p.value]));
  const ema1Map = new Map(emaOfValues(shortMa, fastLength).map((p) => [p.time, p.value]));

  const out: CdcPoint[] = [];
  let prevZone: CdcZone | null = null;
  for (const { time, value: ema2 } of emaOfValues(shortMa, slowLength)) {
    const ema1 = ema1Map.get(time);
    const sMa = shortMaMap.get(time);
    if (ema1 === undefined || sMa === undefined) continue;

    const zone: CdcZone = ema1 > ema2 ? (sMa > ema1 ? "green" : "blue") : sMa < ema1 ? "red" : "yellow";
    const signal = zone === "green" && prevZone !== "green" ? "buy" : zone === "red" && prevZone !== "red" ? "sell" : null;
    out.push({ time, ema1, ema2, zone, signal });
    prevZone = zone;
  }
  return out;
}

export function computeIndicators(candles: Candle[]): Indicators {
  return {
    sma20: sma(candles, 20),
    sma50: sma(candles, 50),
    ema12: ema(candles, 12),
    ema26: ema(candles, 26),
    rsi14: rsi(candles, 14),
    macd: macd(candles),
    bollinger: bollinger(candles, 20, 2),
    cdc: cdcActionZone(candles),
  };
}
