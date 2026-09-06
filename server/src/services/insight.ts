import { MtfEntry, Wave2To3Phase, Wave2To3Tracker } from "../types.js";

export type InsightStatus = "BULLISH" | "NEUTRAL" | "BEARISH" | "HIGH_RISK";
export type InsightRiskLevel = "LOW" | "MEDIUM" | "HIGH";

export interface PlainLanguageInsight {
  status: InsightStatus;
  statusLabel: string;
  headline: string;
  bulletPoints: string[];
  riskLevel: InsightRiskLevel;
}

export interface InsightInput {
  /** Current Elliott Wave setup — carries direction, invalidation level, and (via riskReward) target prices. */
  wave2to3: Wave2To3Tracker;
  /** Wave setup on the other timeframes, same shape the /api/mtf route already returns. */
  mtf: MtfEntry[];
}

function fmtPrice(price: number): string {
  return price.toFixed(4);
}

interface MtfAgreement {
  agree: number;
  disagree: number;
  total: number;
}

/**
 * Counts how many *other* timeframes have an active setup (phase !== "none")
 * and whether it points the same way as the current one. Timeframes with no
 * active setup are excluded rather than counted as neutral — an idle
 * timeframe says nothing about agreement or conflict either way.
 */
function computeMtfAgreement(mtf: MtfEntry[], direction: "up" | "down"): MtfAgreement {
  let agree = 0;
  let disagree = 0;
  for (const entry of mtf) {
    if (!entry.wave2to3 || entry.wave2to3.phase === "none" || !entry.wave2to3.direction) continue;
    if (entry.wave2to3.direction === direction) agree++;
    else disagree++;
  }
  return { agree, disagree, total: agree + disagree };
}

function buildStatusLabel(status: InsightStatus, phase: Wave2To3Phase, isUp: boolean): string {
  if (status === "HIGH_RISK") return isUp ? "ขาขึ้นแต่ต้องระวังแรงขาย" : "ขาลงและมีแรงขายกดดัน ต้องระวัง";
  if (status === "BULLISH") return phase === "confirmed" ? "แนวโน้มขาขึ้นแข็งแกร่ง" : "เริ่มพักฐานก่อนไปต่อขาขึ้น";
  if (status === "BEARISH") return phase === "confirmed" ? "แนวโน้มขาลงแข็งแกร่ง" : "เริ่มพักฐานก่อนไปต่อขาลง";
  return "ยังไม่มีสัญญาณชัดเจน";
}

const NO_SETUP_INSIGHT: PlainLanguageInsight = {
  status: "NEUTRAL",
  statusLabel: "ยังไม่มีสัญญาณชัดเจน",
  headline: "ตอนนี้ยังไม่พบรูปแบบคลื่น Elliott Wave (ทฤษฎีนับคลื่นราคา) ที่ชัดเจนพอจะสรุปทิศทางได้",
  bulletPoints: [
    "จุดได้เปรียบ: ยังไม่มีข้อมูลเพียงพอ ควรรอให้ราคาสร้างจุดกลับตัว (Pivot) เพิ่มเติมก่อน",
    "จุดเฝ้าระวัง: การเข้าเทรดในช่วงที่ยังไม่มีรูปแบบชัดเจนมีความเสี่ยงสูง ควรรอสัญญาณที่ชัดเจนกว่านี้",
  ],
  riskLevel: "LOW",
};

/**
 * Turns the raw current-timeframe wave setup plus the other timeframes' trend
 * into a short, plain-language summary a non-technical reader can act on.
 * Kept deterministic (no randomness, no external calls) so the same inputs
 * always produce the same summary.
 */
export function generatePlainLanguageInsight(input: InsightInput): PlainLanguageInsight {
  const { wave2to3, mtf } = input;
  const { phase, direction, confidence, cdcConfluence, divergenceConfluence, invalidationLevel, retraceRatio, riskReward } = wave2to3;

  if (phase === "none" || !direction) {
    return { ...NO_SETUP_INSIGHT, headline: wave2to3.note ? `${NO_SETUP_INSIGHT.headline} (${wave2to3.note})` : NO_SETUP_INSIGHT.headline };
  }

  const isUp = direction === "up";
  const dirWord = isUp ? "ขาขึ้น" : "ขาลง";

  const cdcAgrees = cdcConfluence === true;
  const cdcDisagrees = cdcConfluence === false;
  const divAgrees = divergenceConfluence === true;
  const divDisagrees = divergenceConfluence === false;
  const { agree, disagree, total } = computeMtfAgreement(mtf, direction);
  const mtfConflict = total >= 2 && disagree > agree;
  // A Wave 2 pullback that has already retraced 75%+ of Wave 1 is one step
  // from invalidating the whole count outright — worth flagging as risk even
  // before it actually crosses the invalidation level.
  const nearInvalidation = phase === "watching" && retraceRatio !== null && retraceRatio >= 0.75;

  let riskScore = 0;
  if (cdcDisagrees) riskScore += 1;
  if (divDisagrees) riskScore += 1;
  if (mtfConflict) riskScore += 1;
  if (nearInvalidation) riskScore += 1;
  if (confidence < 50) riskScore += 1;
  // CDC Action Zone and RSI/MACD divergence are the two filters this app's own
  // backtest (see elliottWave.ts / /api/backtest) found actually predictive —
  // both disagreeing at once outweighs any single lesser flag.
  const bothConfluenceDisagree = cdcDisagrees && divDisagrees;

  const riskLevel: InsightRiskLevel = riskScore >= 3 || bothConfluenceDisagree ? "HIGH" : riskScore >= 1 ? "MEDIUM" : "LOW";
  const status: InsightStatus = riskLevel === "HIGH" ? "HIGH_RISK" : isUp ? "BULLISH" : "BEARISH";
  const statusLabel = buildStatusLabel(status, phase, isUp);

  const phaseText =
    phase === "confirmed"
      ? "ยืนยันแล้วว่ากำลังอยู่ใน Wave 3 (คลื่นหลักที่มักเคลื่อนไหวแรงและยาวที่สุด)"
      : "อยู่ในช่วงพักฐาน (Wave 2) รอราคาทะลุแนวเพื่อยืนยัน Wave 3";
  const headline = `ราคากำลังอยู่ในแนวโน้ม${dirWord}และ${phaseText}${
    status === "HIGH_RISK" ? " แต่มีสัญญาณเตือนหลายจุดที่ควรระวังก่อนตัดสินใจ" : ""
  }`;

  const supportBits: string[] = [];
  if (cdcAgrees) supportBits.push("แนวโน้มราคาหลัก (CDC Action Zone) ไปทางเดียวกัน");
  if (divAgrees) supportBits.push("มี Divergence ของ RSI/MACD (ความต่างระหว่างทิศทางราคากับโมเมนตัม) ยืนยัน");
  if (agree > 0) supportBits.push(`อีก ${agree} จาก ${total} timeframe ที่มีสัญญาณ เห็นไปทางเดียวกัน`);
  const advantageBullet =
    supportBits.length > 0
      ? `จุดได้เปรียบ: ${supportBits.join(", ")}`
      : `จุดได้เปรียบ: ยังไม่มีสัญญาณอื่นสนับสนุนเพิ่มเติมนอกจากรูปแบบคลื่นเอง ควรรอความชัดเจนก่อนเพิ่มขนาดการเทรด`;

  const warnBits: string[] = [];
  if (cdcDisagrees) warnBits.push("แนวโน้มราคาหลัก (CDC Action Zone) ยังสวนทางอยู่");
  if (divDisagrees) warnBits.push("ยังไม่มี Divergence ของ RSI/MACD ยืนยันโมเมนตัม");
  if (mtfConflict) warnBits.push(`timeframe อื่น ${disagree} จาก ${total} เห็นไปคนละทาง`);
  if (nearInvalidation) warnBits.push("การพักฐาน (Wave 2) ลึกเกิน 75% ของคลื่นก่อนหน้า ใกล้จุดที่จะทำให้แผนนี้เป็นโมฆะ");
  const watchOutBullet =
    warnBits.length > 0
      ? `จุดเฝ้าระวัง: ${warnBits.join(", ")}`
      : `จุดเฝ้าระวัง: ยังไม่มีสัญญาณเตือนที่ชัดเจน แต่ตลาดเปลี่ยนทิศได้เสมอ ควรติดตามใกล้ชิด`;

  const priceBits: string[] = [];
  if (invalidationLevel !== null) {
    priceBits.push(`หากราคาหลุด ${fmtPrice(invalidationLevel)} แผนนี้จะถือว่าเป็นโมฆะทันที (Invalidation Level)`);
  }
  if (riskReward && riskReward.targets.length > 0) {
    priceBits.push(`เป้าหมายราคาถัดไปอยู่ที่ ${fmtPrice(riskReward.targets[0].price)} (Target Price)`);
  }

  const bulletPoints = [advantageBullet, watchOutBullet];
  if (priceBits.length > 0) bulletPoints.push(`ราคาที่ต้องจับตา: ${priceBits.join(" / ")}`);

  return { status, statusLabel, headline, bulletPoints, riskLevel };
}
