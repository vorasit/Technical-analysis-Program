import { Router } from "express";
import { Interval, Market } from "../types.js";
import { SYMBOLS } from "../services/symbols.js";
import { getCandles } from "../services/marketData.js";
import { sma, ema, rsi, macd, bollinger, cdcActionZone } from "../services/indicators.js";
import { analyzeWaves } from "../services/elliottWave.js";
import { mapLimit } from "../services/concurrency.js";
import { searchSymbols } from "../services/search.js";

const router = Router();

const VALID_MARKETS: Market[] = ["stock", "commodity", "crypto"];
const VALID_INTERVALS: Interval[] = ["1h", "1d", "1w"];

function parseMarket(v: unknown): Market | null {
  return typeof v === "string" && (VALID_MARKETS as string[]).includes(v) ? (v as Market) : null;
}

function parseInterval(v: unknown): Interval | null {
  return typeof v === "string" && (VALID_INTERVALS as string[]).includes(v) ? (v as Interval) : null;
}

router.get("/symbols", (req, res) => {
  const market = parseMarket(req.query.market);
  if (!market) {
    return res.status(400).json({ error: "Invalid or missing market. Use stock, commodity, or crypto." });
  }
  res.json(SYMBOLS[market]);
});

router.get("/search", async (req, res) => {
  const market = parseMarket(req.query.market);
  const q = typeof req.query.q === "string" ? req.query.q : "";

  if (!market) {
    return res.status(400).json({ error: "Invalid or missing market. Use stock, commodity, or crypto." });
  }

  try {
    const results = await searchSymbols(market, q);
    res.json(results);
  } catch (err) {
    res.status(502).json({ error: err instanceof Error ? err.message : "Search failed." });
  }
});

router.get("/analyze", async (req, res) => {
  const market = parseMarket(req.query.market);
  const interval = parseInterval(req.query.interval) ?? "1d";
  const symbol = typeof req.query.symbol === "string" ? req.query.symbol : null;
  const deviation = req.query.deviation ? Number(req.query.deviation) : 3;

  if (!market || !symbol) {
    return res.status(400).json({ error: "market and symbol are required." });
  }

  try {
    const candles = await getCandles(market, symbol, interval);
    if (candles.length < 20) {
      return res.status(422).json({ error: "Not enough data returned for this symbol/interval." });
    }
    const wave = analyzeWaves(candles, deviation);
    res.json({
      symbol,
      market,
      interval,
      candles,
      indicators: {
        sma20: sma(candles, 20),
        sma50: sma(candles, 50),
        ema12: ema(candles, 12),
        ema26: ema(candles, 26),
        rsi14: rsi(candles, 14),
        macd: macd(candles),
        bollinger: bollinger(candles, 20, 2),
        cdc: cdcActionZone(candles),
      },
      wave,
    });
  } catch (err) {
    res.status(502).json({ error: err instanceof Error ? err.message : "Failed to fetch or analyze data." });
  }
});

function parseCustomSymbols(raw: unknown, market: Market): { symbol: string; name: string; market: Market }[] | null {
  if (typeof raw !== "string" || !raw) return null;
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return null;
    const list = parsed
      .filter((item): item is { symbol: string; name?: string } => typeof item === "object" && item !== null && typeof (item as { symbol?: unknown }).symbol === "string")
      .map((item) => ({ symbol: item.symbol, name: item.name ?? item.symbol, market }));
    return list.length > 0 ? list : null;
  } catch {
    return null;
  }
}

router.get("/mtf", async (req, res) => {
  const market = parseMarket(req.query.market);
  const symbol = typeof req.query.symbol === "string" ? req.query.symbol : null;
  const deviation = req.query.deviation ? Number(req.query.deviation) : 3;

  if (!market || !symbol) {
    return res.status(400).json({ error: "market and symbol are required." });
  }

  const intervals: Interval[] = ["1h", "1d", "1w"];
  const results = await Promise.all(
    intervals.map(async (interval) => {
      try {
        const candles = await getCandles(market, symbol, interval);
        if (candles.length < 20) return { interval, error: "Not enough data." };
        const wave = analyzeWaves(candles, deviation);
        return { interval, wave2to3: wave.wave2to3, lastPrice: candles[candles.length - 1].close };
      } catch (err) {
        return { interval, error: err instanceof Error ? err.message : "Failed to fetch data." };
      }
    })
  );

  res.json(results);
});

router.get("/scan/wave3", async (req, res) => {
  const market = parseMarket(req.query.market);
  const interval = parseInterval(req.query.interval) ?? "1d";
  const deviation = req.query.deviation ? Number(req.query.deviation) : 3;

  if (!market) {
    return res.status(400).json({ error: "Invalid or missing market. Use stock, commodity, or crypto." });
  }

  const resolvedMarket: Market = market;
  const symbols = parseCustomSymbols(req.query.symbols, resolvedMarket) ?? SYMBOLS[resolvedMarket];

  async function scanOne(s: (typeof symbols)[number]) {
    const candles = await getCandles(resolvedMarket, s.symbol, interval);
    if (candles.length < 20) throw new Error("insufficient data");
    const wave = analyzeWaves(candles, deviation);
    const lastCandle = candles[candles.length - 1];
    return {
      symbol: s.symbol,
      name: s.name,
      market: s.market,
      lastPrice: lastCandle.close,
      lastTime: lastCandle.time,
      inWave3: wave.inWave3,
      wave2to3: wave.wave2to3,
      bestCount: wave.bestCount,
    };
  }

  const results = await mapLimit(symbols, 4, scanOne);

  const scanned = results
    .filter((r): r is PromiseFulfilledResult<Awaited<ReturnType<typeof scanOne>>> => r.status === "fulfilled")
    .map((r) => r.value);

  const phaseRank: Record<string, number> = { confirmed: 2, watching: 1, none: 0 };
  scanned.sort((a, b) => {
    const rankDiff = phaseRank[b.wave2to3.phase] - phaseRank[a.wave2to3.phase];
    if (rankDiff !== 0) return rankDiff;
    return b.wave2to3.confidence - a.wave2to3.confidence;
  });

  res.json(scanned);
});

export default router;
