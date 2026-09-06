import { useState, type ReactNode } from "react";

/** Short, plain-language explanations for the technical terms used around the app. */
const GLOSSARY: Record<string, string> = {
  RSI: "Relative Strength Index วัดโมเมนตัมราคาเป็นสเกล 0-100 สูงกว่า 70 มักถือว่าซื้อมากไป (Overbought) ต่ำกว่า 30 มักถือว่าขายมากไป (Oversold)",
  MACD: "เส้นค่าเฉลี่ยเคลื่อนที่ 2 เส้นลบกัน ใช้ดูโมเมนตัมและจังหวะกลับตัวของแนวโน้ม",
  "Elliott Wave": "ทฤษฎีนับคลื่นราคาเป็น 5 คลื่นส่ง (Impulse) ตามด้วย 3 คลื่นปรับ (Corrective) เพื่อคาดการณ์ทิศทางถัดไป",
  Divergence: "ราคากับอินดิเคเตอร์ (เช่น RSI/MACD) เคลื่อนไหวสวนทางกัน มักเป็นสัญญาณเตือนว่าแนวโน้มเดิมกำลังอ่อนแรงหรือใกล้กลับตัว",
  "Invalidation Level": "ระดับราคาที่ถ้าหลุดไป จะถือว่าการนับคลื่นหรือแผนเทรดปัจจุบัน \"ผิด\" และต้องยกเลิกแผนนั้น",
  "Wave 3": "คลื่นส่งที่ 3 ในทฤษฎี Elliott Wave มักเป็นคลื่นที่แรงและยาวที่สุด เหมาะกับการเข้าเทรดตามแนวโน้ม",
  Confluence: "จุดที่สัญญาณจากหลายเครื่องมือ (เช่น แนวคลื่น, CDC, Divergence) ยืนยันไปทางเดียวกัน เพิ่มความมั่นใจของสัญญาณ",
  "CDC Action Zone": "ระบบสีจาก EMA 2 เส้น บ่งบอกโซนซื้อ/ขาย/ระวัง ด้วยสีเขียว น้ำเงิน แดง เหลือง",
  Fibonacci: "อัตราส่วนตัวเลขที่ใช้หาแนวรับ-แนวต้านหรือเป้าหมายราคา จากระยะสวิงล่าสุด",
};

interface InfoTooltipProps {
  /** Glossary key to look up (also used as the display label if no children are given). */
  term: string;
  /** Overrides the built-in glossary text. */
  definition?: string;
  /** Custom label to display instead of the term itself. */
  children?: ReactNode;
}

export default function InfoTooltip({ term, definition, children }: InfoTooltipProps) {
  const [open, setOpen] = useState(false);
  const text = definition ?? GLOSSARY[term];

  if (!text) {
    return <>{children ?? term}</>;
  }

  return (
    <span
      className="info-tooltip"
      tabIndex={0}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onFocus={() => setOpen(true)}
      onBlur={() => setOpen(false)}
      onClick={() => setOpen((v) => !v)}
    >
      <span className="info-tooltip-term">{children ?? term}</span>
      <sup className="info-tooltip-mark">?</sup>
      {open && (
        <span className="info-tooltip-bubble" role="tooltip">
          {text}
        </span>
      )}
    </span>
  );
}

export { GLOSSARY };
