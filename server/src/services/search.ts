import NodeCache from "node-cache";
import { Market, SymbolInfo } from "../types.js";

const cache = new NodeCache({ stdTTL: 3600, checkperiod: 300 });

interface YahooSearchQuote {
  symbol: string;
  shortname?: string;
  longname?: string;
  quoteType: string;
}

interface YahooSearchResponse {
  quotes?: YahooSearchQuote[];
}

const STOCK_QUOTE_TYPES = new Set(["EQUITY", "ETF"]);
const COMMODITY_QUOTE_TYPES = new Set(["FUTURE"]);
const FOREX_QUOTE_TYPES = new Set(["CURRENCY"]);

async function searchYahoo(query: string, quoteTypes: Set<string>, market: Market): Promise<SymbolInfo[]> {
  const url = `https://query1.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(query)}&quotesCount=15&newsCount=0`;
  const res = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36" } });
  if (!res.ok) return [];
  const data = (await res.json()) as YahooSearchResponse;
  return (data.quotes ?? [])
    .filter((q) => quoteTypes.has(q.quoteType) && q.symbol)
    .map((q) => ({ symbol: q.symbol, name: q.shortname ?? q.longname ?? q.symbol, market }))
    .slice(0, 10);
}

// Friendly names for well-known coins; anything else falls back to its base asset code.
const CRYPTO_NAMES: Record<string, string> = {
  BTC: "Bitcoin",
  ETH: "Ethereum",
  BNB: "BNB",
  SOL: "Solana",
  XRP: "XRP",
  ADA: "Cardano",
  DOGE: "Dogecoin",
  AVAX: "Avalanche",
  LINK: "Chainlink",
  TON: "Toncoin",
  DOT: "Polkadot",
  SUI: "Sui",
  SHIB: "Shiba Inu",
  PEPE: "Pepe",
  WIF: "dogwifhat",
  LTC: "Litecoin",
  TRX: "TRON",
  MATIC: "Polygon",
  UNI: "Uniswap",
  ATOM: "Cosmos",
  NEAR: "NEAR Protocol",
  APT: "Aptos",
  ARB: "Arbitrum",
  OP: "Optimism",
  FIL: "Filecoin",
  ETC: "Ethereum Classic",
  ICP: "Internet Computer",
  BCH: "Bitcoin Cash",
  XLM: "Stellar",
  HBAR: "Hedera",
};

interface BinanceExchangeSymbol {
  symbol: string;
  baseAsset: string;
  quoteAsset: string;
  status: string;
}

async function loadBinanceUsdtPairs(): Promise<BinanceExchangeSymbol[]> {
  const cached = cache.get<BinanceExchangeSymbol[]>("binance:usdt-pairs");
  if (cached) return cached;

  const res = await fetch("https://api.binance.com/api/v3/exchangeInfo");
  if (!res.ok) return [];
  const data = (await res.json()) as { symbols: BinanceExchangeSymbol[] };
  const pairs = data.symbols.filter((s) => s.quoteAsset === "USDT" && s.status === "TRADING");
  cache.set("binance:usdt-pairs", pairs);
  return pairs;
}

async function searchBinance(query: string): Promise<SymbolInfo[]> {
  const pairs = await loadBinanceUsdtPairs();
  const q = query.trim().toUpperCase();
  if (!q) return [];

  const scored = pairs
    .filter((p) => p.baseAsset.includes(q) || p.symbol.includes(q))
    .map((p) => ({
      pair: p,
      // Prefer an exact base-asset match (e.g. "SOL" -> SOLUSDT) over a substring match.
      score: p.baseAsset === q ? 0 : p.baseAsset.startsWith(q) ? 1 : 2,
    }))
    .sort((a, b) => a.score - b.score || a.pair.symbol.length - b.pair.symbol.length);

  return scored.slice(0, 10).map(({ pair }) => ({
    symbol: pair.symbol,
    name: CRYPTO_NAMES[pair.baseAsset] ?? pair.baseAsset,
    market: "crypto" as const,
  }));
}

export async function searchSymbols(market: Market, query: string): Promise<SymbolInfo[]> {
  const trimmed = query.trim();
  if (trimmed.length < 2) return [];

  const cacheKey = `search:${market}:${trimmed.toLowerCase()}`;
  const cached = cache.get<SymbolInfo[]>(cacheKey);
  if (cached) return cached;

  const YAHOO_QUOTE_TYPES: Record<"stock" | "commodity" | "forex", Set<string>> = {
    stock: STOCK_QUOTE_TYPES,
    commodity: COMMODITY_QUOTE_TYPES,
    forex: FOREX_QUOTE_TYPES,
  };

  const results =
    market === "crypto" ? await searchBinance(trimmed) : await searchYahoo(trimmed, YAHOO_QUOTE_TYPES[market], market);

  cache.set(cacheKey, results, 120);
  return results;
}
