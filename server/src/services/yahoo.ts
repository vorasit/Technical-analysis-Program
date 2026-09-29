import { Candle, HistoryRange, Interval } from "../types.js";

// Yahoo's own `range=max` silently downgrades the bar size (daily and weekly come
// back as 3-month bars), so full history is requested as an explicit
// period1..period2 window starting before any listing instead.
const FULL = "full";
const EARLIEST_PERIOD = -2208988800; // 1900-01-01, so pre-1970 listings (e.g. ^GSPC from 1927) come back in full

const CONFIG: Record<Interval, { interval: string; recent: string; all: string }> = {
  "1h": { interval: "60m", recent: "60d", all: "730d" }, // Yahoo serves intraday bars for the last 730 days only
  "1d": { interval: "1d", recent: "2y", all: FULL },
  "1w": { interval: "1wk", recent: "10y", all: FULL },
  // Months are built from daily bars (see aggregateByMonth): Yahoo's native monthly
  // series is cut short for some long-listed symbols (AAPL, KO and ^GSPC only start
  // in 1985) and ends with the latest session split off as an extra bar.
  "1mo": { interval: "1d", recent: FULL, all: FULL },
};

interface YahooChartResult {
  chart: {
    result: Array<{
      meta: { exchangeTimezoneName: string };
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

export async function fetchYahooCandles(symbol: string, interval: Interval, history: HistoryRange = "recent"): Promise<Candle[]> {
  const { interval: yInterval, [history]: range } = CONFIG[interval];
  const window = range === FULL ? `period1=${EARLIEST_PERIOD}&period2=${Math.floor(Date.now() / 1000)}` : `range=${range}`;
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?${window}&interval=${yInterval}`;
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
  return interval === "1mo" ? aggregateByMonth(candles, result.meta.exchangeTimezoneName) : candles;
}

/** Rolls daily bars up into one bar per calendar month, as the exchange's own timezone dates them. */
function aggregateByMonth(daily: Candle[], timeZone: string): Candle[] {
  const monthOf = (() => {
    try {
      return new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit" });
    } catch {
      return new Intl.DateTimeFormat("en-CA", { timeZone: "UTC", year: "numeric", month: "2-digit" });
    }
  })();

  const months: Candle[] = [];
  let currentMonth = "";
  for (const day of daily) {
    const month = monthOf.format(day.time * 1000);
    const bar = months[months.length - 1];
    if (month !== currentMonth) {
      months.push({ ...day });
      currentMonth = month;
      continue;
    }
    bar.high = Math.max(bar.high, day.high);
    bar.low = Math.min(bar.low, day.low);
    bar.close = day.close;
    bar.volume += day.volume;
  }
  return months;
}
