export type Market = "stock" | "commodity" | "crypto";
export type Interval = "1h" | "1d" | "1w";

export interface Candle {
  time: number; // unix seconds
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

export interface Pivot {
  index: number; // index into candles array
  time: number;
  price: number;
  type: "high" | "low";
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
  confidence: number; // 0-100
  rulesPassed: string[];
  rulesFailed: string[];
  fib: Record<string, number>;
  degree: string;
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
  breakoutLevel: number | null; // price that must be crossed to confirm Wave 3
  invalidationLevel: number | null; // price that, if crossed, invalidates the Wave 1-2 count
  currentPrice: number | null;
  progressPct: number; // 0-100 toward breakout while "watching"; extension % of Wave 1 while "confirmed"
  retraceRatio: number | null; // Wave 2 retracement of Wave 1, 0-1
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

export interface FibLevel {
  ratio: number;
  price: number;
}

export interface FibAnalysis {
  high: number;
  low: number;
  direction: "up" | "down"; // "up" = retracement of an upswing (low -> high); "down" = retracement of a downswing
  startTime: number;
  endTime: number;
  levels: FibLevel[];
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
  fibonacci: FibAnalysis | null;
  pivots: Pivot[];
}

export interface BacktestReturn {
  returnPct: number;
  hitInvalidation: boolean;
}

export interface BacktestSignal {
  direction: "up" | "down";
  wave0Time: number;
  wave1Time: number;
  wave2Time: number;
  entryTime: number;
  entryPrice: number;
  breakoutLevel: number;
  invalidationLevel: number;
  returns: Record<number, BacktestReturn | null>;
}

export interface HorizonStat {
  horizon: number;
  count: number;
  winRate: number;
  avgReturnPct: number;
  medianReturnPct: number;
  stopRatePct: number;
}

export interface BacktestSymbolResult {
  symbol: string;
  name: string;
  signalCount: number;
  horizonStats: HorizonStat[];
}

export interface BacktestResponse {
  horizons: number[];
  aggregate: HorizonStat[];
  bySymbol: BacktestSymbolResult[];
  failures: { symbol: string; error: string }[];
}
