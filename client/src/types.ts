export type Market = "stock" | "commodity" | "crypto";
export type Interval = "1h" | "1d" | "1w";

export interface Candle {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface SymbolInfo {
  symbol: string;
  name: string;
  market: Market;
}

export interface IndicatorPoint {
  time: number;
  value: number;
}

export interface MacdPoint {
  time: number;
  macd: number;
  signal: number;
  histogram: number;
}

export interface BollingerPoint {
  time: number;
  upper: number;
  middle: number;
  lower: number;
}

export type CdcZone = "green" | "blue" | "red" | "yellow";

export interface CdcPoint {
  time: number;
  ema1: number;
  ema2: number;
  zone: CdcZone;
  signal: "buy" | "sell" | null;
}

export interface Indicators {
  sma20: IndicatorPoint[];
  sma50: IndicatorPoint[];
  ema12: IndicatorPoint[];
  ema26: IndicatorPoint[];
  rsi14: IndicatorPoint[];
  macd: MacdPoint[];
  bollinger: BollingerPoint[];
  cdc: CdcPoint[];
}

export type WaveLabel = "0" | "1" | "2" | "3" | "4" | "5" | "A" | "B" | "C";

export interface WavePoint {
  label: WaveLabel;
  time: number;
  price: number;
  index: number;
}

export interface WaveCount {
  points: WavePoint[];
  confidence: number;
  rulesPassed: string[];
  rulesFailed: string[];
  fib: Record<string, number>;
  degree: string;
}

export interface Pivot {
  index: number;
  time: number;
  price: number;
  type: "high" | "low";
}

export interface PricePoint {
  time: number;
  price: number;
}

export type Wave2To3Phase = "none" | "watching" | "confirmed";

export interface Wave2To3Tracker {
  phase: Wave2To3Phase;
  direction: "up" | "down" | null;
  wave0: PricePoint | null;
  wave1: PricePoint | null;
  wave2: PricePoint | null;
  breakoutLevel: number | null;
  invalidationLevel: number | null;
  currentPrice: number | null;
  progressPct: number;
  retraceRatio: number | null;
  confidence: number;
  note: string;
}

export interface WaveChainPoint {
  time: number;
  price: number;
  index: number;
  type: "high" | "low";
  label: WaveLabel | null;
  phase: "impulse" | "corrective";
}

export interface WaveChainRun {
  points: WaveChainPoint[];
}

export interface WaveAnalysis {
  bestCount: WaveCount | null;
  alternates: WaveCount[];
  inWave3: {
    active: boolean;
    confidence: number;
    note: string;
  };
  wave2to3: Wave2To3Tracker;
  waveChain: WaveChainRun[];
  pivots: Pivot[];
}

export interface AnalyzeResponse {
  symbol: string;
  market: Market;
  interval: Interval;
  candles: Candle[];
  indicators: Indicators;
  wave: WaveAnalysis;
}

export interface ScanResult {
  symbol: string;
  name: string;
  market: Market;
  lastPrice: number;
  lastTime: number;
  inWave3: WaveAnalysis["inWave3"];
  wave2to3: Wave2To3Tracker;
  bestCount: WaveCount | null;
}
