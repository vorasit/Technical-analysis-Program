import { useEffect, useState } from "react";
import { formatPrice, pricePrecision } from "../format";
import { loadJSON, saveJSON } from "../storage";
import type { RiskRewardPlan } from "../types";

const SETTINGS_KEY = "ta-risk-calc";

type RiskMode = "percent" | "amount";

interface CalcSettings {
  portfolioSize: number;
  riskMode: RiskMode;
  riskValue: number;
}

const DEFAULT_SETTINGS: CalcSettings = {
  portfolioSize: 100000,
  riskMode: "percent",
  riskValue: 1,
};

function loadSettings(): CalcSettings {
  return { ...DEFAULT_SETTINGS, ...loadJSON<Partial<CalcSettings>>(SETTINGS_KEY, {}) };
}

function formatUnits(v: number): string {
  const { precision } = pricePrecision(Math.abs(v));
  return v.toLocaleString(undefined, { maximumFractionDigits: precision });
}

interface PositionSizeCalculatorProps {
  riskReward: RiskRewardPlan | null;
}

export default function PositionSizeCalculator({ riskReward }: PositionSizeCalculatorProps) {
  const [settings, setSettings] = useState<CalcSettings>(loadSettings);

  useEffect(() => {
    saveJSON(SETTINGS_KEY, settings);
  }, [settings]);

  if (!riskReward) return null;

  const { entryPrice, stopLoss, targets } = riskReward;
  const riskPerUnit = Math.abs(entryPrice - stopLoss);

  const portfolioSize = Math.max(0, settings.portfolioSize);
  const riskValue = Math.max(0, settings.riskValue);
  const riskAmount = settings.riskMode === "percent" ? (portfolioSize * riskValue) / 100 : riskValue;

  const canCalculate = portfolioSize > 0 && riskAmount > 0 && riskPerUnit > 0;
  const units = canCalculate ? riskAmount / riskPerUnit : null;
  const positionValue = units !== null ? units * entryPrice : null;
  const maxLoss = units !== null ? units * riskPerUnit : null;
  const overLeveraged = positionValue !== null && positionValue > portfolioSize;

  const primaryTarget = targets.find((t) => t.ratio === 1.618) ?? targets[0] ?? null;

  return (
    <div className="risk-calc">
      <div className="risk-calc-header">🧮 คำนวณขนาดสถานะ (Position Size)</div>

      <div className="risk-calc-inputs">
        <label>
          เงินทุนรวม (Portfolio Size)
          <input
            type="number"
            min={0}
            value={settings.portfolioSize}
            onChange={(e) => setSettings((prev) => ({ ...prev, portfolioSize: e.target.valueAsNumber || 0 }))}
          />
        </label>
        <label>
          ความเสี่ยงที่ยอมรับได้ต่อการเทรดนี้
          <div className="risk-calc-risk-row">
            <input
              type="number"
              min={0}
              value={settings.riskValue}
              onChange={(e) => setSettings((prev) => ({ ...prev, riskValue: e.target.valueAsNumber || 0 }))}
            />
            <select
              value={settings.riskMode}
              onChange={(e) => setSettings((prev) => ({ ...prev, riskMode: e.target.value as RiskMode }))}
            >
              <option value="percent">% ของเงินทุน</option>
              <option value="amount">จำนวนเงิน</option>
            </select>
          </div>
        </label>
      </div>

      <div className="risk-calc-auto">
        <span>
          Entry: <strong>{formatPrice(entryPrice)}</strong>
        </span>
        <span>
          Stop-loss: <strong>{formatPrice(stopLoss)}</strong>
        </span>
      </div>

      {!canCalculate ? (
        <div className="empty-state">กรอกเงินทุนและความเสี่ยงที่ยอมรับได้เพื่อคำนวณขนาดสถานะ</div>
      ) : (
        <>
          <div className="risk-calc-results">
            <div className="risk-calc-result-row">
              <span>จำนวนหน่วยที่ควรเปิด</span>
              <strong>{formatUnits(units!)}</strong>
            </div>
            <div className="risk-calc-result-row">
              <span>มูลค่าที่ต้องใช้เปิดสถานะ</span>
              <strong>{formatPrice(positionValue!)}</strong>
            </div>
            <div className="risk-calc-result-row">
              <span>ขาดทุนสูงสุดหากโดน Stop Loss</span>
              <strong className="neg">-{formatPrice(maxLoss!)}</strong>
            </div>
          </div>

          {overLeveraged && (
            <div className="risk-calc-warning">
              ⚠️ มูลค่าที่ต้องใช้เปิดสถานะสูงกว่าเงินทุนทั้งหมด — ต้องใช้มาร์จิ้น/เลเวอเรจ หรือลดขนาดสถานะลง
            </div>
          )}

          {primaryTarget && (
            <div className="risk-calc-rr-highlight">
              เสี่ยง 1 เพื่อโอกาสได้ <strong>{primaryTarget.riskRewardRatio.toFixed(2)}</strong> เท่า
              <small> (เป้าหมาย Fib ext. {primaryTarget.ratio}x)</small>
            </div>
          )}

          {targets.length > 1 && (
            <div className="risk-calc-rr-list">
              {targets.map((t) => (
                <span key={t.ratio}>
                  {t.ratio}x → {t.riskRewardRatio.toFixed(2)}:1
                </span>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
