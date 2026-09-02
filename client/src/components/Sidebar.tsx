import { useEffect, useMemo, useState } from "react";
import { getSymbols, searchSymbols } from "../api";
import SymbolLogo from "./SymbolLogo";
import type { Market, SymbolInfo } from "../types";

const MARKET_LABEL: Record<Market, string> = {
  stock: "หุ้น",
  commodity: "แร่ / โภคภัณฑ์",
  crypto: "คริปโต",
};

const SEARCH_DEBOUNCE_MS = 350;
const MIN_QUERY_LENGTH = 2;

interface Props {
  market: Market;
  onMarketChange: (m: Market) => void;
  selectedSymbol: string;
  onSelectSymbol: (s: SymbolInfo) => void;
  recents: SymbolInfo[];
  watchlist: SymbolInfo[];
  onToggleWatchlist: (s: SymbolInfo) => void;
}

function isSameSymbol(a: string, b: string): boolean {
  return a.toUpperCase() === b.toUpperCase();
}

function SymbolButton({
  s,
  active,
  watched,
  onClick,
  onToggleWatch,
}: {
  s: SymbolInfo;
  active: boolean;
  watched: boolean;
  onClick: () => void;
  onToggleWatch: () => void;
}) {
  return (
    <div className={`symbol-item-row ${active ? "active" : ""}`}>
      <button className="symbol-item" onClick={onClick}>
        <SymbolLogo symbol={s.symbol} market={s.market} size={22} />
        <span className="symbol-text">
          <span className="symbol-code">{s.symbol}</span>
          <span className="symbol-name">{s.name}</span>
        </span>
      </button>
      <button
        className={`watch-toggle ${watched ? "active" : ""}`}
        onClick={(e) => {
          e.stopPropagation();
          onToggleWatch();
        }}
        title="เพิ่ม/นำออกจาก Watchlist"
      >
        {watched ? "★" : "☆"}
      </button>
    </div>
  );
}

export default function Sidebar({
  market,
  onMarketChange,
  selectedSymbol,
  onSelectSymbol,
  recents,
  watchlist,
  onToggleWatchlist,
}: Props) {
  const [symbols, setSymbols] = useState<SymbolInfo[]>([]);
  const [query, setQuery] = useState("");
  const [remoteResults, setRemoteResults] = useState<SymbolInfo[]>([]);
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    let cancelled = false;
    getSymbols(market).then((list) => {
      if (!cancelled) setSymbols(list);
    });
    return () => {
      cancelled = true;
    };
  }, [market]);

  useEffect(() => {
    const trimmed = query.trim();
    if (trimmed.length < MIN_QUERY_LENGTH) {
      setRemoteResults([]);
      setSearching(false);
      return;
    }
    setSearching(true);
    let cancelled = false;
    const timer = setTimeout(() => {
      searchSymbols(market, trimmed)
        .then((results) => {
          if (!cancelled) setRemoteResults(results);
        })
        .catch(() => {
          if (!cancelled) setRemoteResults([]);
        })
        .finally(() => {
          if (!cancelled) setSearching(false);
        });
    }, SEARCH_DEBOUNCE_MS);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [market, query]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return symbols;
    return symbols.filter((s) => s.symbol.toLowerCase().includes(q) || s.name.toLowerCase().includes(q));
  }, [symbols, query]);

  // Only show recents that aren't already visible in the preset list, to avoid duplicates.
  const extraRecents = useMemo(
    () => recents.filter((r) => !symbols.some((s) => isSameSymbol(s.symbol, r.symbol))),
    [recents, symbols]
  );

  // Remote results that aren't already shown in the local preset matches.
  const extraRemoteResults = useMemo(
    () => remoteResults.filter((r) => !filtered.some((s) => isSameSymbol(s.symbol, r.symbol))),
    [remoteResults, filtered]
  );

  const isSearchMode = query.trim().length >= MIN_QUERY_LENGTH;
  const isWatched = (symbol: string) => watchlist.some((w) => isSameSymbol(w.symbol, symbol));

  function handleSearchKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key !== "Enter") return;
    const trimmed = query.trim();
    if (!trimmed) return;
    const upper = trimmed.toUpperCase();
    const known =
      symbols.find((s) => isSameSymbol(s.symbol, upper)) ??
      recents.find((s) => isSameSymbol(s.symbol, upper)) ??
      remoteResults.find((s) => isSameSymbol(s.symbol, upper));
    onSelectSymbol(known ?? { symbol: upper, name: upper, market });
    setQuery("");
  }

  function handleSelect(s: SymbolInfo) {
    onSelectSymbol(s);
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
        placeholder="ค้นหาชื่อหรือสัญลักษณ์ทั่วโลก..."
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onKeyDown={handleSearchKeyDown}
      />
      <div className="symbol-list">
        {!isSearchMode && watchlist.length > 0 && (
          <>
            <div className="symbol-list-heading">★ Watchlist ของฉัน</div>
            {watchlist.map((s) => (
              <SymbolButton
                key={`watch-${s.symbol}`}
                s={s}
                active={s.symbol === selectedSymbol}
                watched
                onClick={() => handleSelect(s)}
                onToggleWatch={() => onToggleWatchlist(s)}
              />
            ))}
          </>
        )}
        {!isSearchMode && extraRecents.length > 0 && (
          <>
            <div className="symbol-list-heading">ล่าสุด</div>
            {extraRecents.map((s) => (
              <SymbolButton
                key={`recent-${s.symbol}`}
                s={s}
                active={s.symbol === selectedSymbol}
                watched={isWatched(s.symbol)}
                onClick={() => handleSelect(s)}
                onToggleWatch={() => onToggleWatchlist(s)}
              />
            ))}
          </>
        )}
        {!isSearchMode && <div className="symbol-list-heading">รายการ</div>}
        {filtered.map((s) => (
          <SymbolButton
            key={s.symbol}
            s={s}
            active={s.symbol === selectedSymbol}
            watched={isWatched(s.symbol)}
            onClick={() => handleSelect(s)}
            onToggleWatch={() => onToggleWatchlist(s)}
          />
        ))}
        {isSearchMode && (
          <>
            <div className="symbol-list-heading">
              ผลการค้นหาทั่วโลก{searching ? " — กำลังค้นหา..." : ""}
            </div>
            {extraRemoteResults.map((s) => (
              <SymbolButton
                key={`remote-${s.symbol}`}
                s={s}
                active={s.symbol === selectedSymbol}
                watched={isWatched(s.symbol)}
                onClick={() => handleSelect(s)}
                onToggleWatch={() => onToggleWatchlist(s)}
              />
            ))}
            {!searching && extraRemoteResults.length === 0 && (
              <div className="empty-state">ไม่พบผลลัพธ์เพิ่มเติม — กด Enter เพื่อค้นหาด้วยสัญลักษณ์ตรง ๆ</div>
            )}
          </>
        )}
        {!isSearchMode && filtered.length === 0 && extraRecents.length === 0 && watchlist.length === 0 && (
          <div className="empty-state">ไม่พบสัญลักษณ์ — พิมพ์ชื่อหรือสัญลักษณ์เพื่อค้นหา</div>
        )}
      </div>
    </aside>
  );
}
