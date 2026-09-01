import { useEffect, useMemo, useState } from "react";
import { getSymbols } from "../api";
import type { Market, SymbolInfo } from "../types";

const MARKET_LABEL: Record<Market, string> = {
  stock: "หุ้น",
  commodity: "แร่ / โภคภัณฑ์",
  crypto: "คริปโต",
};

interface Props {
  market: Market;
  onMarketChange: (m: Market) => void;
  selectedSymbol: string;
  onSelectSymbol: (s: SymbolInfo) => void;
}

export default function Sidebar({ market, onMarketChange, selectedSymbol, onSelectSymbol }: Props) {
  const [symbols, setSymbols] = useState<SymbolInfo[]>([]);
  const [query, setQuery] = useState("");

  useEffect(() => {
    let cancelled = false;
    getSymbols(market).then((list) => {
      if (!cancelled) setSymbols(list);
    });
    return () => {
      cancelled = true;
    };
  }, [market]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return symbols;
    return symbols.filter((s) => s.symbol.toLowerCase().includes(q) || s.name.toLowerCase().includes(q));
  }, [symbols, query]);

  return (
    <aside className="sidebar">
      <div className="market-tabs">
        {(Object.keys(MARKET_LABEL) as Market[]).map((m) => (
          <button key={m} className={`market-tab ${m === market ? "active" : ""}`} onClick={() => onMarketChange(m)}>
            {MARKET_LABEL[m]}
          </button>
        ))}
      </div>
      <input
        className="symbol-search"
        placeholder="ค้นหาสัญลักษณ์..."
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />
      <div className="symbol-list">
        {filtered.map((s) => (
          <button
            key={s.symbol}
            className={`symbol-item ${s.symbol === selectedSymbol ? "active" : ""}`}
            onClick={() => onSelectSymbol(s)}
          >
            <span className="symbol-code">{s.symbol}</span>
            <span className="symbol-name">{s.name}</span>
          </button>
        ))}
        {filtered.length === 0 && <div className="empty-state">ไม่พบสัญลักษณ์</div>}
      </div>
    </aside>
  );
}
