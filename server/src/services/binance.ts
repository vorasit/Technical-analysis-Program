import { Candle, Interval } from "../types.js";

const INTERVAL_MAP: Record<Interval, string> = {
  "1h": "1h",
  "1d": "1d",
  "1w": "1w",
};

export async function fetchBinanceCandles(symbol: string, interval: Interval, limit = 400): Promise<Candle[]> {
  const binanceInterval = INTERVAL_MAP[interval];
  const url = `https://api.binance.com/api/v3/klines?symbol=${encodeURIComponent(symbol)}&interval=${binanceInterval}&limit=${limit}`;
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Binance API error ${res.status}: ${await res.text()}`);
  }
  const raw = (await res.json()) as unknown[][];
  return raw.map((row) => ({
    time: Math.floor(Number(row[0]) / 1000),
    open: Number(row[1]),
    high: Number(row[2]),
    low: Number(row[3]),
    close: Number(row[4]),
    volume: Number(row[5]),
  }));
}
