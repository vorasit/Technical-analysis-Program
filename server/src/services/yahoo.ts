import { Candle, Interval } from "../types.js";

const CONFIG: Record<Interval, { interval: string; range: string }> = {
  "1h": { interval: "60m", range: "60d" },
  "1d": { interval: "1d", range: "2y" },
  "1w": { interval: "1wk", range: "10y" },
};

interface YahooChartResult {
  chart: {
    result: Array<{
      timestamp: number[];
      indicators: {
        quote: Array<{
          open: (number | null)[];
          high: (number | null)[];
          low: (number | null)[];
          close: (number | null)[];
          volume: (number | null)[];
        }>;
      };
    }> | null;
    error: unknown;
  };
}

export async function fetchYahooCandles(symbol: string, interval: Interval): Promise<Candle[]> {
  const { interval: yInterval, range } = CONFIG[interval];
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(
    symbol
  )}?range=${range}&interval=${yInterval}`;
  const res = await fetch(url, {
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
    },
  });
  const body = await res.text();
  const data = (() => {
    try {
      return JSON.parse(body) as YahooChartResult;
    } catch {
      return null;
    }
  })();

  if (!res.ok || !data) {
    const description = (data?.chart.error as { description?: string } | undefined)?.description;
    throw new Error(description ? `Symbol not found: ${symbol} (${description})` : `Yahoo API error ${res.status}: ${body}`);
  }

  const result = data.chart.result?.[0];
  if (!result) {
    const description = (data.chart.error as { description?: string } | undefined)?.description;
    throw new Error(`Symbol not found: ${symbol}${description ? ` (${description})` : ""}`);
  }
  const { timestamp } = result;
  const quote = result.indicators.quote[0];
  const candles: Candle[] = [];
  for (let i = 0; i < timestamp.length; i++) {
    const open = quote.open[i];
    const high = quote.high[i];
    const low = quote.low[i];
    const close = quote.close[i];
    if (open == null || high == null || low == null || close == null) continue;
    candles.push({
      time: timestamp[i],
      open,
      high,
      low,
      close,
      volume: quote.volume[i] ?? 0,
    });
  }
  return candles;
}
