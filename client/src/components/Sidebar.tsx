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
  recents: SymbolInfo[];
}

export default function Sidebar({ market, onMarketChange, selectedSymbol, onSelectSymbol, recents }: Props) {
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

  // Only show recents that aren't already visible in the preset list, to avoid duplicates.
  const extraRecents = useMemo(
    () => recents.filter((r) => !symbols.some((s) => s.symbol.toUpperCase() === r.symbol.toUpperCase())),
    [recents, symbols]
  );

  function handleSearchKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key !== "Enter") return;
    const trimmed = query.trim();
    if (!trimmed) return;
    const upper = trimmed.toUpperCase();
    const known = symbols.find((s) => s.symbol.toUpperCase() === upper) ?? recents.find((s) => s.symbol.toUpperCase() === upper);
    onSelectSymbol(known ?? { symbol: upper, name: upper, market });
    setQuery("");
  }

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
        placeholder="ค้นหา หรือพิมพ์สัญลักษณ์แล้วกด Enter..."
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onKeyDown={handleSearchKeyDown}
      />
      <div className="symbol-list">
        {extraRecents.length > 0 && (
          <>
            <div className="symbol-list-heading">ล่าสุด</div>
            {extraRecents.map((s) => (
              <button
                key={`recent-${s.symbol}`}
                className={`symbol-item ${s.symbol === selectedSymbol ? "active" : ""}`}
                onClick={() => onSelectSymbol(s)}
              >
                <span className="symbol-code">{s.symbol}</span>
                <span className="symbol-name">{s.name}</span>
              </button>
            ))}
            <div className="symbol-list-heading">รายการ</div>
          </>
        )}
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
        {filtered.length === 0 && extraRecents.length === 0 && (
          <div className="empty-state">ไม่พบสัญลักษณ์ — พิมพ์แล้วกด Enter เพื่อค้นหาโดยตรง</div>
        )}
      </div>
    </aside>
  );
}
