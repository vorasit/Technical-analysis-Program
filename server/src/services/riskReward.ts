import { PricePoint, RiskRewardPlan, Wave2To3Tracker } from "../types.js";

// Standard Elliott Wave 3 extension targets: 1.0x (Wave 3 at least equals
// Wave 1), 1.618x (the most common Wave 3 extension), 2.618x (an extended
// Wave 3) — the same ratios scoreImpulse rewards when scoring a completed
// impulse's Wave 3 extension.
const TARGET_RATIOS = [1, 1.618, 2.618];

/**
 * Builds a Wave 3 trade plan from the Wave 1-2 setup: entry at the Wave 3
 * breakout level (the same trigger the backtest uses), stop-loss just beyond
 * the Wave 2 pivot extreme (tighter and more actionable than the Wave 0
 * invalidation level, which only marks where the count itself breaks), and
 * take-profit targets projected from Wave 2 using Fibonacci extensions of
 * the Wave 1 length.
 */
export function computeRiskRewardPlan(
  direction: Wave2To3Tracker["direction"],
  wave0: PricePoint | null,
  wave1: PricePoint | null,
  wave2: PricePoint | null,
  breakoutLevel: number | null
): RiskRewardPlan | null {
  if (!direction || !wave0 || !wave1 || !wave2 || breakoutLevel === null) return null;

  const sign = direction === "up" ? 1 : -1;
  const wave1Len = Math.abs(wave1.price - wave0.price);
  if (wave1Len <= 0) return null;

  const entryPrice = breakoutLevel;
  const stopLoss = wave2.price;
  const risk = Math.abs(entryPrice - stopLoss);
  if (risk <= 0) return null;

  const targets = TARGET_RATIOS.map((ratio) => {
    const price = wave2.price + sign * wave1Len * ratio;
    const reward = Math.abs(price - entryPrice);
    return {
      ratio,
      price,
      rewardPct: (reward / entryPrice) * 100,
      riskRewardRatio: reward / risk,
    };
  });

  return {
    entryPrice,
    stopLoss,
    riskPct: (risk / entryPrice) * 100,
    targets,
  };
}
