import { useEffect, useState } from "react";
import type { Market } from "../types";

const PALETTE = ["#1f6feb", "#8957e5", "#bf3989", "#da3633", "#bb8009", "#2ea043", "#0969da", "#6e40c9"];

function hashString(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
}

function initialsFor(symbol: string): string {
  const base = symbol.split(/[.=]/)[0];
  return base.slice(0, 2).toUpperCase();
}

interface Props {
  symbol: string;
  market: Market;
  size?: number;
}

export default function SymbolLogo({ symbol, market, size = 20 }: Props) {
  const [failed, setFailed] = useState(false);

  // Reset fallback state when the symbol changes, since this component
  // instance may be reused (e.g. the chart toolbar's current-symbol header)
  // rather than remounted.
  useEffect(() => {
    setFailed(false);
  }, [symbol]);

  const color = PALETTE[hashString(symbol) % PALETTE.length];

  if (market === "stock" && !failed) {
    return (
      <img
        src={`https://assets.parqet.com/logos/symbol/${encodeURIComponent(symbol)}`}
        alt=""
        width={size}
        height={size}
        className="symbol-logo"
        onError={() => setFailed(true)}
      />
    );
  }

  return (
    <span
      className="symbol-logo symbol-logo-fallback"
      style={{ width: size, height: size, background: color, fontSize: size * 0.42 }}
    >
      {initialsFor(symbol)}
    </span>
  );
}
