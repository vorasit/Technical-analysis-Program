import NodeCache from "node-cache";
import { Candle, Interval, Market } from "../types.js";
import { fetchBinanceCandles } from "./binance.js";
import { fetchYahooCandles } from "./yahoo.js";

const cache = new NodeCache({ stdTTL: 60, checkperiod: 30 });

// Upper bound on a crypto pair's "all history" fetch. Daily and slower bars cover
// every pair's full listing well under this; hourly bars stop at ~2 years, the
// same intraday depth Yahoo serves for the other markets.
const BINANCE_ALL_HISTORY_LIMIT: Record<Interval, number> = {
  "1h": 24 * 730,
  "1d": 20_000,
  "1w": 20_000,
  "1mo": 20_000,
};

async function cached(key: string, load: () => Promise<Candle[]>): Promise<Candle[]> {
  const hit = cache.get<Candle[]>(key);
  if (hit) return hit;
  const candles = await load();
  cache.set(key, candles);
  return candles;
}

export async function getCandles(market: Market, symbol: string, interval: Interval, limit = 400): Promise<Candle[]> {
  // forex, stock, and commodity symbols all resolve through Yahoo Finance;
  // only crypto pairs go through the dedicated Binance client.
  return cached(`${market}:${symbol}:${interval}:${limit}`, () =>
    market === "crypto" ? fetchBinanceCandles(symbol, interval, limit) : fetchYahooCandles(symbol, interval)
  );
}

/** Every candle the data source has for this symbol, for browsing the chart's full history. */
export async function getFullHistory(market: Market, symbol: string, interval: Interval): Promise<Candle[]> {
  return cached(`${market}:${symbol}:${interval}:all`, () =>
    market === "crypto"
      ? fetchBinanceCandles(symbol, interval, BINANCE_ALL_HISTORY_LIMIT[interval])
      : fetchYahooCandles(symbol, interval, "all")
  );
}
