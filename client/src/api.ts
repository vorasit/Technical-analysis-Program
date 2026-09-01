import type { AnalyzeResponse, Interval, Market, ScanResult, SymbolInfo } from "./types";

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

export function scanWave3(market: Market, interval: Interval, deviation: number): Promise<ScanResult[]> {
  const params = new URLSearchParams({ market, interval, deviation: String(deviation) });
  return fetch(`/api/scan/wave3?${params.toString()}`).then((r) => jsonOrThrow<ScanResult[]>(r));
}
