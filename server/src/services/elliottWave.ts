import {
  Candle,
  FibAnalysis,
  Pivot,
  WaveAnalysis,
  WaveChainPoint,
  WaveChainRun,
  WaveCount,
  WaveLabel,
  WavePoint,
  Wave2To3Tracker,
} from "../types.js";

type Six = [Pivot, Pivot, Pivot, Pivot, Pivot, Pivot];

export function computeZigzag(candles: Candle[], deviationPct = 3): Pivot[] {
  if (candles.length < 3) return [];
  const pivots: Pivot[] = [];

  let up = true;
  let extremeIdx = 0;
  let extremePrice = candles[0].close;

  for (let i = 1; i < candles.length; i++) {
    const high = candles[i].high;
    const low = candles[i].low;

    if (up) {
      if (high > extremePrice) {
        // Extending the current up-leg's extreme. Checking for a reversal in
        // this same branch (rather than unconditionally) is what prevents a
        // single wide-range candle from being recorded as both a high and a
        // low pivot at the same index — a duplicate the chart can't render.
        extremePrice = high;
        extremeIdx = i;
      } else if (((extremePrice - low) / extremePrice) * 100 >= deviationPct) {
        pivots.push({ index: extremeIdx, time: candles[extremeIdx].time, price: extremePrice, type: "high" });
        up = false;
        extremePrice = low;
        extremeIdx = i;
      }
    } else {
      if (low < extremePrice) {
        extremePrice = low;
        extremeIdx = i;
      } else if (((high - extremePrice) / extremePrice) * 100 >= deviationPct) {
        pivots.push({ index: extremeIdx, time: candles[extremeIdx].time, price: extremePrice, type: "low" });
        up = true;
        extremePrice = high;
        extremeIdx = i;
      }
    }
  }

  // final tentative (unconfirmed / still-forming) swing extreme
  if (pivots.length === 0 || pivots[pivots.length - 1].index !== extremeIdx) {
    pivots.push({ index: extremeIdx, time: candles[extremeIdx].time, price: extremePrice, type: up ? "high" : "low" });
  }

  return pivots;
}

interface ScoredImpulse {
  score: number;
  fib: Record<string, number>;
  rulesPassed: string[];
  rulesFailed: string[];
}

function fibBonus(ratio: number, targets: number[], tolerance: number, weight: number): number {
  let best = Infinity;
  for (const t of targets) {
    const dist = Math.abs(ratio - t) / t;
    if (dist < best) best = dist;
  }
  const closeness = Math.max(0, 1 - best / tolerance);
  return closeness * weight;
}

function scoreImpulse(p: [Pivot, Pivot, Pivot, Pivot, Pivot, Pivot], isUp: boolean): ScoredImpulse | null {
  const [p0, p1, p2, p3, p4, p5] = p;
  const sign = isUp ? 1 : -1;
  const w1 = sign * (p1.price - p0.price);
  const w2 = sign * (p1.price - p2.price);
  const w3 = sign * (p3.price - p2.price);
  const w4 = sign * (p3.price - p4.price);
  const w5 = sign * (p5.price - p4.price);

  if (w1 <= 0 || w3 <= 0 || w5 <= 0) return null;

  const rulesPassed: string[] = [];
  const rulesFailed: string[] = [];
  let hardOk = true;

  if (isUp ? p2.price > p0.price : p2.price < p0.price) {
    rulesPassed.push("Wave 2 does not retrace beyond the start of Wave 1");
  } else {
    rulesFailed.push("Wave 2 retraced beyond the start of Wave 1");
    hardOk = false;
  }

  if (w3 >= Math.min(w1, w5)) {
    rulesPassed.push("Wave 3 is not the shortest of waves 1, 3, 5");
  } else {
    rulesFailed.push("Wave 3 is the shortest wave (invalid)");
    hardOk = false;
  }

  if (isUp ? p4.price > p1.price : p4.price < p1.price) {
    rulesPassed.push("Wave 4 does not overlap Wave 1 territory");
  } else {
    rulesFailed.push("Wave 4 overlaps Wave 1 territory");
    hardOk = false;
  }

  if (isUp ? p3.price > p1.price : p3.price < p1.price) {
    rulesPassed.push("Wave 3 travels beyond the end of Wave 1");
  } else {
    rulesFailed.push("Wave 3 fails to exceed Wave 1 extreme");
    hardOk = false;
  }

  if (!hardOk) return null;

  const retrace2 = w2 / w1;
  const ext3 = w3 / w1;
  const retrace4 = w4 / w3;

  let score = 40;
  score += fibBonus(retrace2, [0.382, 0.5, 0.618, 0.786], 0.35, 20);
  score += Math.min(20, ext3 >= 1 ? 10 + fibBonus(ext3, [1.618, 2.618, 2.0], 0.4, 10) : 0);
  score += fibBonus(retrace4, [0.236, 0.382, 0.5], 0.35, 20);

  return {
    score: Math.max(0, Math.min(100, score)),
    fib: { wave2Retrace: retrace2, wave3Extension: ext3, wave4Retrace: retrace4 },
    rulesPassed,
    rulesFailed,
  };
}

function toWaveCount(p: [Pivot, Pivot, Pivot, Pivot, Pivot, Pivot], scored: ScoredImpulse): WaveCount {
  const labels: WavePoint["label"][] = ["0", "1", "2", "3", "4", "5"];
  const points: WavePoint[] = p.map((pivot, i) => ({
    label: labels[i],
    time: pivot.time,
    price: pivot.price,
    index: pivot.index,
  }));
  return {
    points,
    confidence: Math.round(scored.score),
    rulesPassed: scored.rulesPassed,
    rulesFailed: scored.rulesFailed,
    fib: scored.fib,
    degree: "auto",
  };
}

function findImpulseCandidates(pivots: Pivot[]): WaveCount[] {
  const candidates: WaveCount[] = [];
  for (let i = 0; i + 5 < pivots.length; i++) {
    const window = pivots.slice(i, i + 6) as [Pivot, Pivot, Pivot, Pivot, Pivot, Pivot];
    const isUp = window[0].type === "low";
    const alternatesCorrectly = window.every((pt, idx) => (idx % 2 === 0 ? pt.type === window[0].type : pt.type !== window[0].type));
    if (!alternatesCorrectly) continue;
    const scored = scoreImpulse(window, isUp);
    if (scored) {
      candidates.push(toWaveCount(window, scored));
    }
  }
  candidates.sort((a, b) => {
    const lastA = a.points[a.points.length - 1].index;
    const lastB = b.points[b.points.length - 1].index;
    if (b.confidence !== a.confidence) return b.confidence - a.confidence;
    return lastB - lastA;
  });
  return candidates;
}

const EMPTY_TRACKER: Wave2To3Tracker = {
  phase: "none",
  direction: null,
  wave0: null,
  wave1: null,
  wave2: null,
  breakoutLevel: null,
  invalidationLevel: null,
  currentPrice: null,
  progressPct: 0,
  retraceRatio: null,
  confidence: 0,
  note: "Not enough swing data yet.",
};

function pt(p: Pivot) {
  return { time: p.time, price: p.price };
}

/**
 * Tracks the count from a confirmed Wave 2 through to a confirmed Wave 3:
 * - "watching": Wave 1-2 validated, price has not yet broken the Wave 1 extreme (the Wave 3 breakout level).
 * - "confirmed": price has broken past Wave 1 — Wave 3 is underway.
 */
function detectWave2To3(pivots: Pivot[]): Wave2To3Tracker {
  if (pivots.length < 4) return EMPTY_TRACKER;

  const tentative = pivots[pivots.length - 1];
  const confirmed = pivots.slice(0, -1);
  if (confirmed.length < 3) return { ...EMPTY_TRACKER, note: "Not enough confirmed swings yet." };

  const [p0, p1, p2] = confirmed.slice(-3);
  const isUp = p1.price > p0.price;
  const patternOk = isUp
    ? p0.type === "low" && p1.type === "high" && p2.type === "low"
    : p0.type === "high" && p1.type === "low" && p2.type === "high";

  if (!patternOk) return { ...EMPTY_TRACKER, note: "Latest swings do not form a Wave 1-2 setup." };

  const wave2HoldsUp = isUp ? p2.price > p0.price : p2.price < p0.price;
  if (!wave2HoldsUp) {
    return {
      ...EMPTY_TRACKER,
      direction: isUp ? "up" : "down",
      wave0: pt(p0),
      wave1: pt(p1),
      wave2: pt(p2),
      invalidationLevel: p0.price,
      note: "Wave 2 retraced beyond the Wave 1 start — count invalidated.",
    };
  }

  const wave1Len = Math.abs(p1.price - p0.price);
  const breakoutLevel = p1.price;
  const invalidationLevel = p0.price;
  const retraceRatio = wave1Len > 0 ? Math.abs(p1.price - p2.price) / wave1Len : 0;

  // Has the still-forming swing already broken past the Wave 1 extreme?
  const continuesWave1Direction = isUp ? tentative.type === "high" : tentative.type === "low";
  const brokeWave1 = continuesWave1Direction && (isUp ? tentative.price > p1.price : tentative.price < p1.price);

  if (brokeWave1) {
    const currentLen = Math.abs(tentative.price - p2.price);
    const extensionSoFar = wave1Len > 0 ? currentLen / wave1Len : 0;

    let confidence = 45;
    confidence += fibBonus(retraceRatio, [0.382, 0.5, 0.618, 0.786], 0.35, 25);
    confidence += Math.min(30, extensionSoFar * 20);
    confidence = Math.max(0, Math.min(100, Math.round(confidence)));

    return {
      phase: "confirmed",
      direction: isUp ? "up" : "down",
      wave0: pt(p0),
      wave1: pt(p1),
      wave2: pt(p2),
      breakoutLevel,
      invalidationLevel,
      currentPrice: tentative.price,
      progressPct: Math.round(extensionSoFar * 100),
      retraceRatio,
      confidence,
      note: `${isUp ? "Bullish" : "Bearish"} Wave 3 is underway — price is already ${(extensionSoFar * 100).toFixed(0)}% of the Wave 1 length past Wave 2, following a ${(retraceRatio * 100).toFixed(0)}% Wave 2 pullback.`,
    };
  }

  // Still watching: Wave 2 may still be extending, or price has turned but not yet broken Wave 1.
  let effectiveWave2 = p2;
  if (tentative.type === p2.type) {
    // Wave 2 leg is still forming — the tentative extreme is the live candidate for its endpoint.
    const stillHolds = isUp ? tentative.price > p0.price : tentative.price < p0.price;
    if (!stillHolds) {
      return {
        ...EMPTY_TRACKER,
        direction: isUp ? "up" : "down",
        wave0: pt(p0),
        wave1: pt(p1),
        wave2: pt(tentative),
        invalidationLevel,
        note: "Price is extending the Wave 2 pullback beyond the Wave 1 start — count invalidated.",
      };
    }
    effectiveWave2 = tentative;
  }

  const currentPrice = tentative.price;
  const totalNeeded = isUp ? breakoutLevel - effectiveWave2.price : effectiveWave2.price - breakoutLevel;
  const distanceCovered = isUp ? currentPrice - effectiveWave2.price : effectiveWave2.price - currentPrice;
  const progressPct = totalNeeded > 0 ? Math.max(0, Math.min(100, Math.round((distanceCovered / totalNeeded) * 100))) : 0;

  let confidence = 30 + fibBonus(retraceRatio, [0.382, 0.5, 0.618, 0.786], 0.35, 20);
  confidence = Math.max(0, Math.min(100, Math.round(confidence)));

  return {
    phase: "watching",
    direction: isUp ? "up" : "down",
    wave0: pt(p0),
    wave1: pt(p1),
    wave2: pt(effectiveWave2),
    breakoutLevel,
    invalidationLevel,
    currentPrice,
    progressPct,
    retraceRatio,
    confidence,
    note: `Wave 2 pullback of ${(retraceRatio * 100).toFixed(0)}% looks complete — price needs to break ${
      isUp ? "above" : "below"
    } ${breakoutLevel.toFixed(4)} to confirm Wave 3 (currently ${progressPct}% of the way there).`,
  };
}

function chainPoint(p: Pivot, label: WaveLabel | null, phase: WaveChainPoint["phase"]): WaveChainPoint {
  return { time: p.time, price: p.price, index: p.index, type: p.type, label, phase };
}

const IMPULSE_LABELS: WaveLabel[] = ["1", "2", "3", "4", "5"];
const CORRECTIVE_LABELS: WaveLabel[] = ["A", "B", "C"];

/**
 * Builds a continuous, whole-history wave map: alternating impulse (1-2-3-4-5)
 * and corrective (A-B-C) legs chained end-to-end, the way a manually-annotated
 * Elliott Wave chart reads. Impulses must pass the standard hard rules; once an
 * impulse validates, the next 3 pivots are taken unconditionally as its A-B-C
 * (corrective structure is far more variable, so we don't gate on it) before
 * trying to extend the chain with another validated impulse. A run ends where
 * the next impulse fails to validate; scanning then resumes to look for a new run.
 */
export function buildWaveChain(pivots: Pivot[]): WaveChainRun[] {
  const runs: WaveChainRun[] = [];
  let i = 0;

  while (i + 5 < pivots.length) {
    const window = pivots.slice(i, i + 6) as Six;
    const isUp = window[0].type === "low";
    const scored = scoreImpulse(window, isUp);
    if (!scored) {
      i++;
      continue;
    }

    const points: WaveChainPoint[] = [chainPoint(window[0], null, "impulse")];
    IMPULSE_LABELS.forEach((label, k) => points.push(chainPoint(window[k + 1], label, "impulse")));
    let cursor = i + 5;

    // Keep extending: attach a corrective ABC, then try another validated impulse, repeat.
    while (cursor + 3 < pivots.length) {
      CORRECTIVE_LABELS.forEach((label, k) => points.push(chainPoint(pivots[cursor + k + 1], label, "corrective")));
      cursor += 3;

      if (cursor + 5 >= pivots.length) break;
      const nextWindow = pivots.slice(cursor, cursor + 6) as Six;
      const nextIsUp = nextWindow[0].type === "low";
      const nextScored = scoreImpulse(nextWindow, nextIsUp);
      if (!nextScored) break;

      IMPULSE_LABELS.forEach((label, k) => points.push(chainPoint(nextWindow[k + 1], label, "impulse")));
      cursor += 5;
    }

    runs.push({ points });
    i = cursor;
  }

  return runs;
}

const FIB_RATIOS = [0, 0.236, 0.382, 0.5, 0.618, 0.786, 1, 1.272, 1.618];

/**
 * Fibonacci retracement (and short extension) levels for the most recent
 * completed swing — the last two confirmed pivots. Independent of any wave
 * count, so it's available even when no valid Elliott pattern is found.
 */
function computeFibonacci(pivots: Pivot[]): FibAnalysis | null {
  const confirmed = pivots.slice(0, -1);
  if (confirmed.length < 2) return null;

  const [start, end] = confirmed.slice(-2);
  const direction: "up" | "down" = end.price > start.price ? "up" : "down";
  const high = direction === "up" ? end.price : start.price;
  const low = direction === "up" ? start.price : end.price;
  const range = high - low;
  if (range <= 0) return null;

  const levels = FIB_RATIOS.map((ratio) => ({
    ratio,
    price: direction === "up" ? high - range * ratio : low + range * ratio,
  }));

  return { high, low, direction, startTime: start.time, endTime: end.time, levels };
}

export function analyzeWaves(candles: Candle[], deviationPct = 3): WaveAnalysis {
  const pivots = computeZigzag(candles, deviationPct);
  const candidates = findImpulseCandidates(pivots);
  const wave2to3 = detectWave2To3(pivots);
  const waveChain = buildWaveChain(pivots);
  const fibonacci = computeFibonacci(pivots);

  return {
    bestCount: candidates[0] ?? null,
    alternates: candidates.slice(1, 4),
    inWave3: {
      active: wave2to3.phase === "confirmed",
      confidence: wave2to3.confidence,
      note: wave2to3.note,
    },
    wave2to3,
    waveChain,
    fibonacci,
    pivots,
  };
}
