import type { AnalyzeResponse, Interval, Market, MtfEntry, ScanResult, SymbolInfo } from "./types";

async function jsonOrThrow<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(body.error ?? `Request failed with status ${res.status}`);
  }
  return res.json() as Promise<T>;
}

export function getSymbols(market: Market): Promise<SymbolInfo[]> {
  return fetch(`/api/symbols?market=${market}`).then((r) => jsonOrThrow<SymbolInfo[]>(r));
}

export function analyze(market: Market, symbol: string, interval: Interval, deviation: number): Promise<AnalyzeResponse> {
  const params = new URLSearchParams({ market, symbol, interval, deviation: String(deviation) });
  return fetch(`/api/analyze?${params.toString()}`).then((r) => jsonOrThrow<AnalyzeResponse>(r));
}

export function scanWave3(
  market: Market,
  interval: Interval,
  deviation: number,
  symbols?: SymbolInfo[]
): Promise<ScanResult[]> {
  const params = new URLSearchParams({ market, interval, deviation: String(deviation) });
  if (symbols && symbols.length > 0) {
    params.set("symbols", JSON.stringify(symbols.map((s) => ({ symbol: s.symbol, name: s.name }))));
  }
  return fetch(`/api/scan/wave3?${params.toString()}`).then((r) => jsonOrThrow<ScanResult[]>(r));
}

export function getMtf(market: Market, symbol: string, deviation: number): Promise<MtfEntry[]> {
  const params = new URLSearchParams({ market, symbol, deviation: String(deviation) });
  return fetch(`/api/mtf?${params.toString()}`).then((r) => jsonOrThrow<MtfEntry[]>(r));
}

export function searchSymbols(market: Market, q: string): Promise<SymbolInfo[]> {
  const params = new URLSearchParams({ market, q });
  return fetch(`/api/search?${params.toString()}`).then((r) => jsonOrThrow<SymbolInfo[]>(r));
}
