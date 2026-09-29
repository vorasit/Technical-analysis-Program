import { Candle, Interval } from "../types.js";

const INTERVAL_MAP: Record<Interval, string> = {
  "1h": "1h",
  "1d": "1d",
  "1w": "1w",
};

export async function fetchBinanceCandles(symbol: string, interval: Interval, limit = 400): Promise<Candle[]> {
  const binanceInterval = INTERVAL_MAP[interval];
  // data-api.binance.vision serves the same public market data as api.binance.com but isn't
  // geo-blocked, so it keeps working from cloud regions (e.g. US datacenters) that get HTTP 451.
  const url = `https://data-api.binance.vision/api/v3/klines?symbol=${encodeURIComponent(symbol)}&interval=${binanceInterval}&limit=${limit}`;
  const res = await fetch(url);
  if (!res.ok) {
    const body = await res.text();
    const parsed = (() => {
      try {
        return JSON.parse(body) as { msg?: string };
      } catch {
        return null;
      }
    })();
    throw new Error(parsed?.msg ? `Symbol not found: ${symbol} (${parsed.msg})` : `Binance API error ${res.status}: ${body}`);
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
