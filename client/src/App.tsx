import { useEffect, useState } from "react";
import "./App.css";
import { analyze } from "./api";
import MtfPanel from "./components/MtfPanel";
import PriceChart from "./components/PriceChart";
import type { OverlayToggles } from "./components/PriceChart";
import Sidebar from "./components/Sidebar";
import SymbolLogo from "./components/SymbolLogo";
import WavePanel from "./components/WavePanel";
import Wave3Scanner from "./components/Wave3Scanner";
import { loadJSON, saveJSON } from "./storage";
import type { AnalyzeResponse, Interval, Market, SymbolInfo } from "./types";

const DEFAULT_SYMBOL: Record<Market, SymbolInfo> = {
  stock: { symbol: "AAPL", name: "Apple Inc.", market: "stock" },
  commodity: { symbol: "GC=F", name: "Gold Futures", market: "commodity" },
  crypto: { symbol: "BTCUSDT", name: "Bitcoin", market: "crypto" },
};

const RECENT_KEY_PREFIX = "ta-recent-symbols:";
const WATCHLIST_KEY_PREFIX = "ta-watchlist:";
const SETTINGS_KEY = "ta-settings";
const MAX_RECENTS = 8;

function loadRecents(market: Market): SymbolInfo[] {
  return loadJSON<SymbolInfo[]>(RECENT_KEY_PREFIX + market, []);
}

function saveRecents(market: Market, list: SymbolInfo[]) {
  saveJSON(RECENT_KEY_PREFIX + market, list.slice(0, MAX_RECENTS));
}

function loadWatchlist(market: Market): SymbolInfo[] {
  return loadJSON<SymbolInfo[]>(WATCHLIST_KEY_PREFIX + market, []);
}

function saveWatchlist(market: Market, list: SymbolInfo[]) {
  saveJSON(WATCHLIST_KEY_PREFIX + market, list);
}

interface PersistedSettings {
  interval: Interval;
  deviation: number;
  overlays: OverlayToggles;
}

const DEFAULT_OVERLAYS: OverlayToggles = {
  sma20: true,
  sma50: true,
  ema12: false,
  ema26: false,
  bollinger: false,
  wave: true,
  volume: true,
  cdc: false,
  waveMap: false,
  fibonacci: false,
};

function loadSettings(): PersistedSettings {
  const loaded = loadJSON<Partial<PersistedSettings>>(SETTINGS_KEY, {});
  return {
    interval: loaded.interval ?? "1d",
    deviation: loaded.deviation ?? 3,
    overlays: { ...DEFAULT_OVERLAYS, ...loaded.overlays },
  };
}

type View = "chart" | "scanner";

export default function App() {
  const [view, setView] = useState<View>("chart");
  const [market, setMarket] = useState<Market>("crypto");
  const [selected, setSelected] = useState<SymbolInfo>(DEFAULT_SYMBOL.crypto);
  const [initialSettings] = useState(loadSettings);
  const [interval, setInterval_] = useState<Interval>(initialSettings.interval);
  const [deviation, setDeviation] = useState(initialSettings.deviation);
  const [data, setData] = useState<AnalyzeResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [recents, setRecents] = useState<SymbolInfo[]>(() => loadRecents(market));
  const [watchlist, setWatchlist] = useState<SymbolInfo[]>(() => loadWatchlist(market));
  const [overlays, setOverlays] = useState<OverlayToggles>(initialSettings.overlays);

  useEffect(() => {
    saveJSON(SETTINGS_KEY, { interval, deviation, overlays });
  }, [interval, deviation, overlays]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    analyze(market, selected.symbol, interval, deviation)
      .then((d) => {
        if (cancelled) return;
        setData(d);
        // Only remember a symbol once we know it actually resolves to real data.
        setRecents((prev) => {
          const next = [selected, ...prev.filter((r) => r.symbol.toUpperCase() !== selected.symbol.toUpperCase())].slice(
            0,
            MAX_RECENTS
          );
          saveRecents(market, next);
          return next;
        });
      })
      .catch((e) => {
        if (!cancelled) setError(e.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [market, selected, interval, deviation]);

  function handleMarketChange(m: Market) {
    setMarket(m);
    setSelected(DEFAULT_SYMBOL[m]);
    setRecents(loadRecents(m));
    setWatchlist(loadWatchlist(m));
  }

  function handleOpenFromScanner(symbol: string) {
    setSelected({ symbol, name: symbol, market });
    setView("chart");
  }

  function handleToggleWatchlist(s: SymbolInfo) {
    setWatchlist((prev) => {
      const exists = prev.some((w) => w.symbol.toUpperCase() === s.symbol.toUpperCase());
      const next = exists ? prev.filter((w) => w.symbol.toUpperCase() !== s.symbol.toUpperCase()) : [...prev, s];
      saveWatchlist(market, next);
      return next;
    });
  }

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">📈 TA Wave Hub</div>
        <nav className="view-tabs">
          <button className={view === "chart" ? "active" : ""} onClick={() => setView("chart")}>
            กราฟ
          </button>
          <button className={view === "scanner" ? "active" : ""} onClick={() => setView("scanner")}>
            Wave 3 Scanner
          </button>
        </nav>
        <div className="topbar-controls">
          <label>
            Timeframe:
            <select value={interval} onChange={(e) => setInterval_(e.target.value as Interval)}>
              <option value="1h">1H</option>
              <option value="1d">1D</option>
              <option value="1w">1W</option>
            </select>
          </label>
          <label>
            ความไว Zigzag:
            <select value={deviation} onChange={(e) => setDeviation(Number(e.target.value))}>
              <option value={1.5}>สูง (1.5%)</option>
              <option value={3}>กลาง (3%)</option>
              <option value={5}>ต่ำ (5%)</option>
              <option value={8}>ต่ำมาก (8%)</option>
            </select>
          </label>
        </div>
      </header>

      <div className="body">
        <Sidebar
          market={market}
          onMarketChange={handleMarketChange}
          selectedSymbol={selected.symbol}
          onSelectSymbol={setSelected}
          recents={recents}
          watchlist={watchlist}
          onToggleWatchlist={handleToggleWatchlist}
        />

        {view === "chart" ? (
          <>
            <main className="chart-area">
              <div className="chart-toolbar">
                <span className="current-symbol">
                  <SymbolLogo symbol={selected.symbol} market={market} size={24} />
                  {selected.symbol} <small>{selected.name}</small>
                  <button
                    className={`watch-star ${watchlist.some((w) => w.symbol.toUpperCase() === selected.symbol.toUpperCase()) ? "active" : ""}`}
                    onClick={() => handleToggleWatchlist(selected)}
                    title="เพิ่ม/นำออกจาก Watchlist"
                  >
                    {watchlist.some((w) => w.symbol.toUpperCase() === selected.symbol.toUpperCase()) ? "★" : "☆"}
                  </button>
                </span>
                <div className="overlay-toggles">
                  {(
                    [
                      ["sma20", "SMA20"],
                      ["sma50", "SMA50"],
                      ["ema12", "EMA12"],
                      ["ema26", "EMA26"],
                      ["bollinger", "Bollinger"],
                      ["wave", "Best Wave"],
                      ["waveMap", "Wave Map (เต็ม)"],
                      ["fibonacci", "Fibonacci"],
                      ["volume", "Volume"],
                      ["cdc", "CDC Action Zone"],
                    ] as [keyof OverlayToggles, string][]
                  ).map(([key, label]) => (
                    <label key={key} className="toggle">
                      <input
                        type="checkbox"
                        checked={overlays[key]}
                        onChange={(e) => setOverlays((prev) => ({ ...prev, [key]: e.target.checked }))}
                      />
                      {label}
                    </label>
                  ))}
                </div>
              </div>
              {overlays.cdc && (
                <div className="cdc-legend">
                  <span className="cdc-swatch" style={{ background: "#00c853" }} /> เขียว = โซนซื้อ (Buy Zone)
                  <span className="cdc-swatch" style={{ background: "#2962ff" }} /> น้ำเงิน = ขาขึ้นแต่พักตัว (ระวัง)
                  <span className="cdc-swatch" style={{ background: "#ef5350" }} /> แดง = โซนขาย (Sell Zone)
                  <span className="cdc-swatch" style={{ background: "#ffd600" }} /> เหลือง = ขาลงแต่เด้ง (ระวัง)
                </div>
              )}
              {overlays.waveMap && (
                <div className="cdc-legend">
                  <span className="cdc-swatch" style={{ background: "#3172f0" }} /> กล่องน้ำเงิน 1-5 = คลื่นส่ง (Impulse)
                  <span className="cdc-swatch" style={{ background: "#e0455b" }} /> กล่องแดง A-B-C = คลื่นปรับ (Corrective)
                  <span className="cdc-swatch" style={{ background: "#2ecc71" }} /> เส้นเขียว = ช่วงคลื่นส่ง
                  <span className="cdc-swatch" style={{ background: "#ff6b81" }} /> เส้นชมพู = ช่วงคลื่นปรับ
                </div>
              )}
              {overlays.fibonacci && (
                <div className="cdc-legend">
                  <span>เส้นประทอง = ระดับ Fibonacci Retracement จากสวิงล่าสุด (0% ถึง 100%)</span>
                </div>
              )}
              <div className="chart-container">
                {loading && <div className="overlay-message">กำลังโหลดข้อมูล...</div>}
                {error && <div className="overlay-message error">{error}</div>}
                <PriceChart data={data} overlays={overlays} />
              </div>
            </main>
            <section className="side-panel">
              {data && <MtfPanel market={market} symbol={selected.symbol} deviation={deviation} />}
              {data && <WavePanel wave={data.wave} symbol={data.symbol} />}
            </section>
          </>
        ) : (
          <main className="chart-area">
            <Wave3Scanner
              market={market}
              interval={interval}
              deviation={deviation}
              onOpenSymbol={handleOpenFromScanner}
              watchlist={watchlist}
            />
          </main>
        )}
      </div>
    </div>
  );
}
