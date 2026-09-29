import { Candle, Interval } from "../types.js";

const INTERVAL_MAP: Record<Interval, string> = {
  "1h": "1h",
  "1d": "1d",
  "1w": "1w",
  "1mo": "1M",
};

const MAX_PER_REQUEST = 1000;

async function fetchKlines(symbol: string, binanceInterval: string, limit: number, endTimeMs?: number): Promise<Candle[]> {
  // data-api.binance.vision serves the same public market data as api.binance.com but isn't
  // geo-blocked, so it keeps working from cloud regions (e.g. US datacenters) that get HTTP 451.
  const endTime = endTimeMs !== undefined ? `&endTime=${endTimeMs}` : "";
  const url = `https://data-api.binance.vision/api/v3/klines?symbol=${encodeURIComponent(symbol)}&interval=${binanceInterval}&limit=${limit}${endTime}`;
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

/**
 * The latest `limit` candles. Binance caps a single klines request at 1000, so
 * larger limits page backwards from the newest candle until either `limit` is
 * reached or the pair's listing date is (a short page means nothing older exists).
 */
export async function fetchBinanceCandles(symbol: string, interval: Interval, limit = 400): Promise<Candle[]> {
  const binanceInterval = INTERVAL_MAP[interval];
  let candles: Candle[] = [];
  let endTimeMs: number | undefined;

  while (candles.length < limit) {
    const pageSize = Math.min(MAX_PER_REQUEST, limit - candles.length);
    const page = await fetchKlines(symbol, binanceInterval, pageSize, endTimeMs);
    candles = page.concat(candles);
    if (page.length < pageSize) break;
    endTimeMs = page[0].time * 1000 - 1;
  }

  return candles;
}
