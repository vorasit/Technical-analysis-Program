import { useEffect, useState } from "react";
import "./App.css";
import { analyze } from "./api";
import PriceChart from "./components/PriceChart";
import type { OverlayToggles } from "./components/PriceChart";
import Sidebar from "./components/Sidebar";
import WavePanel from "./components/WavePanel";
import Wave3Scanner from "./components/Wave3Scanner";
import type { AnalyzeResponse, Interval, Market, SymbolInfo } from "./types";

const DEFAULT_SYMBOL: Record<Market, SymbolInfo> = {
  stock: { symbol: "AAPL", name: "Apple Inc.", market: "stock" },
  commodity: { symbol: "GC=F", name: "Gold Futures", market: "commodity" },
  crypto: { symbol: "BTCUSDT", name: "Bitcoin", market: "crypto" },
};

type View = "chart" | "scanner";

export default function App() {
  const [view, setView] = useState<View>("chart");
  const [market, setMarket] = useState<Market>("crypto");
  const [selected, setSelected] = useState<SymbolInfo>(DEFAULT_SYMBOL.crypto);
  const [interval, setInterval_] = useState<Interval>("1d");
  const [deviation, setDeviation] = useState(3);
  const [data, setData] = useState<AnalyzeResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [overlays, setOverlays] = useState<OverlayToggles>({
    sma20: true,
    sma50: true,
    ema12: false,
    ema26: false,
    bollinger: false,
    wave: true,
    volume: true,
  });

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    analyze(market, selected.symbol, interval, deviation)
      .then((d) => {
        if (!cancelled) setData(d);
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
  }

  function handleOpenFromScanner(symbol: string) {
    setSelected({ symbol, name: symbol, market });
    setView("chart");
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
        <Sidebar market={market} onMarketChange={handleMarketChange} selectedSymbol={selected.symbol} onSelectSymbol={setSelected} />

        {view === "chart" ? (
          <>
            <main className="chart-area">
              <div className="chart-toolbar">
                <span className="current-symbol">
                  {selected.symbol} <small>{selected.name}</small>
                </span>
                <div className="overlay-toggles">
                  {(
                    [
                      ["sma20", "SMA20"],
                      ["sma50", "SMA50"],
                      ["ema12", "EMA12"],
                      ["ema26", "EMA26"],
                      ["bollinger", "Bollinger"],
                      ["wave", "Wave"],
                      ["volume", "Volume"],
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
              <div className="chart-container">
                {loading && <div className="overlay-message">กำลังโหลดข้อมูล...</div>}
                {error && <div className="overlay-message error">{error}</div>}
                <PriceChart data={data} overlays={overlays} />
              </div>
            </main>
            <section className="side-panel">{data && <WavePanel wave={data.wave} symbol={data.symbol} />}</section>
          </>
        ) : (
          <main className="chart-area">
            <Wave3Scanner market={market} interval={interval} deviation={deviation} onOpenSymbol={handleOpenFromScanner} />
          </main>
        )}
      </div>
    </div>
  );
}
