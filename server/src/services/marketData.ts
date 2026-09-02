import NodeCache from "node-cache";
import { Candle, Interval, Market } from "../types.js";
import { fetchBinanceCandles } from "./binance.js";
import { fetchYahooCandles } from "./yahoo.js";

const cache = new NodeCache({ stdTTL: 60, checkperiod: 30 });

export async function getCandles(market: Market, symbol: string, interval: Interval, limit = 400): Promise<Candle[]> {
  const key = `${market}:${symbol}:${interval}:${limit}`;
  const cached = cache.get<Candle[]>(key);
  if (cached) return cached;

  // forex, stock, and commodity symbols all resolve through Yahoo Finance;
  // only crypto pairs go through the dedicated Binance client.
  const candles =
    market === "crypto" ? await fetchBinanceCandles(symbol, interval, limit) : await fetchYahooCandles(symbol, interval);

  cache.set(key, candles);
  return candles;
}
