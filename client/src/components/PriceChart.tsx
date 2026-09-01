import { useEffect, useLayoutEffect, useRef } from "react";
import {
  CandlestickSeries,
  ColorType,
  createChart,
  createSeriesMarkers,
  HistogramSeries,
  LineSeries,
} from "lightweight-charts";
import type { IChartApi, IPriceLine, ISeriesApi, ISeriesMarkersPluginApi, SeriesMarker, Time, UTCTimestamp } from "lightweight-charts";
import { pricePrecision } from "../format";
import type { AnalyzeResponse, WaveChainPoint } from "../types";

export interface OverlayToggles {
  sma20: boolean;
  sma50: boolean;
  ema12: boolean;
  ema26: boolean;
  bollinger: boolean;
  wave: boolean;
  volume: boolean;
  cdc: boolean;
  waveMap: boolean;
}

interface Props {
  data: AnalyzeResponse | null;
  overlays: OverlayToggles;
}

const WAVE_COLOR = "#f5c451";
const CDC_COLORS: Record<"green" | "blue" | "red" | "yellow", string> = {
  green: "#00c853",
  blue: "#2962ff",
  red: "#ef5350",
  yellow: "#ffd600",
};
const CHAIN_IMPULSE_COLOR = "#2ecc71";
const CHAIN_CORRECTIVE_COLOR = "#ff6b81";
const CHAIN_NUMBER_COLOR = "#3172f0";
const CHAIN_LETTER_COLOR = "#e0455b";

function pickPriceFormat(prices: number[]): { precision: number; minMove: number } {
  const maxAbs = prices.reduce((m, p) => Math.max(m, Math.abs(p)), 0);
  return pricePrecision(maxAbs);
}

function splitChainByPhase(points: WaveChainPoint[]): { phase: WaveChainPoint["phase"]; points: WaveChainPoint[] }[] {
  const groups: { phase: WaveChainPoint["phase"]; points: WaveChainPoint[] }[] = [];
  points.forEach((p, i) => {
    const last = groups[groups.length - 1];
    if (!last || last.phase !== p.phase) {
      const seg: WaveChainPoint[] = [];
      if (i > 0) seg.push(points[i - 1]); // include the boundary point so segments connect visually
      seg.push(p);
      groups.push({ phase: p.phase, points: seg });
    } else {
      last.points.push(p);
    }
  });
  return groups;
}

export default function PriceChart({ data, overlays }: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<{
    candle: ISeriesApi<"Candlestick">;
    volume: ISeriesApi<"Histogram">;
    sma20: ISeriesApi<"Line">;
    sma50: ISeriesApi<"Line">;
    ema12: ISeriesApi<"Line">;
    ema26: ISeriesApi<"Line">;
    bbUpper: ISeriesApi<"Line">;
    bbMiddle: ISeriesApi<"Line">;
    bbLower: ISeriesApi<"Line">;
    waveLine: ISeriesApi<"Line">;
    rsi: ISeriesApi<"Line">;
    macdLine: ISeriesApi<"Line">;
    macdSignal: ISeriesApi<"Line">;
    macdHist: ISeriesApi<"Histogram">;
  } | null>(null);
  const markersRef = useRef<ISeriesMarkersPluginApi<Time> | null>(null);
  const cdcMarkersRef = useRef<ISeriesMarkersPluginApi<Time> | null>(null);
  const chainMarkersRef = useRef<ISeriesMarkersPluginApi<Time> | null>(null);
  const chainLinesRef = useRef<ISeriesApi<"Line">[]>([]);
  const wave23LinesRef = useRef<{ breakout: IPriceLine | null; invalidation: IPriceLine | null }>({
    breakout: null,
    invalidation: null,
  });

  useLayoutEffect(() => {
    if (!containerRef.current) return;

    const chart = createChart(containerRef.current, {
      autoSize: true,
      layout: {
        background: { type: ColorType.Solid, color: "#0e1117" },
        textColor: "#c9d1d9",
      },
      grid: {
        vertLines: { color: "#1c212b" },
        horzLines: { color: "#1c212b" },
      },
      rightPriceScale: { borderColor: "#30363d" },
      timeScale: { borderColor: "#30363d", timeVisible: true },
      crosshair: { mode: 0 },
    });

    chart.addPane();
    chart.addPane();
    const panes = chart.panes();
    panes[0].setStretchFactor(5);
    panes[1].setStretchFactor(1.6);
    panes[2].setStretchFactor(1.6);

    const candle = chart.addSeries(
      CandlestickSeries,
      {
        upColor: "#26a69a",
        downColor: "#ef5350",
        borderVisible: false,
        wickUpColor: "#26a69a",
        wickDownColor: "#ef5350",
      },
      0
    );

    const volume = chart.addSeries(
      HistogramSeries,
      {
        priceFormat: { type: "volume" },
        priceScaleId: "vol",
        color: "#3a4353",
      },
      0
    );
    chart.priceScale("vol").applyOptions({ scaleMargins: { top: 0.85, bottom: 0 } });
    candle.priceScale().applyOptions({ scaleMargins: { top: 0.05, bottom: 0.2 } });

    const sma20 = chart.addSeries(LineSeries, { color: "#58a6ff", lineWidth: 1 }, 0);
    const sma50 = chart.addSeries(LineSeries, { color: "#bc8cff", lineWidth: 1 }, 0);
    const ema12 = chart.addSeries(LineSeries, { color: "#ffa657", lineWidth: 1 }, 0);
    const ema26 = chart.addSeries(LineSeries, { color: "#f778ba", lineWidth: 1 }, 0);
    const bbUpper = chart.addSeries(LineSeries, { color: "#4d5566", lineWidth: 1 }, 0);
    const bbMiddle = chart.addSeries(LineSeries, { color: "#6e7889", lineWidth: 1 }, 0);
    const bbLower = chart.addSeries(LineSeries, { color: "#4d5566", lineWidth: 1 }, 0);
    const waveLine = chart.addSeries(
      LineSeries,
      { color: WAVE_COLOR, lineWidth: 2, lineStyle: 0, pointMarkersVisible: true },
      0
    );

    const rsi = chart.addSeries(LineSeries, { color: "#e3b341", lineWidth: 1 }, 1);
    rsi.createPriceLine({ price: 70, color: "#4d5566", lineWidth: 1, lineStyle: 2, axisLabelVisible: true, title: "70" });
    rsi.createPriceLine({ price: 30, color: "#4d5566", lineWidth: 1, lineStyle: 2, axisLabelVisible: true, title: "30" });

    const macdHist = chart.addSeries(HistogramSeries, { color: "#3a4353" }, 2);
    const macdLine = chart.addSeries(LineSeries, { color: "#58a6ff", lineWidth: 1 }, 2);
    const macdSignal = chart.addSeries(LineSeries, { color: "#ffa657", lineWidth: 1 }, 2);

    const markers = createSeriesMarkers(candle, []);
    const cdcMarkers = createSeriesMarkers(candle, []);
    const chainMarkers = createSeriesMarkers(candle, []);

    chartRef.current = chart;
    seriesRef.current = {
      candle,
      volume,
      sma20,
      sma50,
      ema12,
      ema26,
      bbUpper,
      bbMiddle,
      bbLower,
      waveLine,
      rsi,
      macdLine,
      macdSignal,
      macdHist,
    };
    markersRef.current = markers;
    cdcMarkersRef.current = cdcMarkers;
    chainMarkersRef.current = chainMarkers;

    return () => {
      chart.remove();
      chartRef.current = null;
      seriesRef.current = null;
      markersRef.current = null;
      cdcMarkersRef.current = null;
      chainMarkersRef.current = null;
      chainLinesRef.current = [];
      wave23LinesRef.current = { breakout: null, invalidation: null };
    };
  }, []);

  useEffect(() => {
    const s = seriesRef.current;
    if (!s || !data) return;

    const priceFormat = { type: "price" as const, ...pickPriceFormat(data.candles.map((c) => c.close)) };
    for (const line of [s.sma20, s.sma50, s.ema12, s.ema26, s.bbUpper, s.bbMiddle, s.bbLower, s.waveLine]) {
      line.applyOptions({ priceFormat });
    }
    // MACD tracks raw price differences, so it needs the same precision as the price series itself.
    s.macdLine.applyOptions({ priceFormat });
    s.macdSignal.applyOptions({ priceFormat });
    s.macdHist.applyOptions({ priceFormat });

    s.volume.setData(
      data.candles.map((c) => ({
        time: c.time as UTCTimestamp,
        value: c.volume,
        color: c.close >= c.open ? "#26a69a55" : "#ef535055",
      }))
    );
    s.sma20.setData(data.indicators.sma20.map((p) => ({ time: p.time as UTCTimestamp, value: p.value })));
    s.sma50.setData(data.indicators.sma50.map((p) => ({ time: p.time as UTCTimestamp, value: p.value })));
    s.ema12.setData(data.indicators.ema12.map((p) => ({ time: p.time as UTCTimestamp, value: p.value })));
    s.ema26.setData(data.indicators.ema26.map((p) => ({ time: p.time as UTCTimestamp, value: p.value })));
    s.bbUpper.setData(data.indicators.bollinger.map((p) => ({ time: p.time as UTCTimestamp, value: p.upper })));
    s.bbMiddle.setData(data.indicators.bollinger.map((p) => ({ time: p.time as UTCTimestamp, value: p.middle })));
    s.bbLower.setData(data.indicators.bollinger.map((p) => ({ time: p.time as UTCTimestamp, value: p.lower })));
    s.rsi.setData(data.indicators.rsi14.map((p) => ({ time: p.time as UTCTimestamp, value: p.value })));
    s.macdLine.setData(data.indicators.macd.map((p) => ({ time: p.time as UTCTimestamp, value: p.macd })));
    s.macdSignal.setData(data.indicators.macd.map((p) => ({ time: p.time as UTCTimestamp, value: p.signal })));
    s.macdHist.setData(
      data.indicators.macd.map((p) => ({
        time: p.time as UTCTimestamp,
        value: p.histogram,
        color: p.histogram >= 0 ? "#26a69a" : "#ef5350",
      }))
    );

    const best = data.wave.bestCount;
    if (best) {
      s.waveLine.setData(best.points.map((p) => ({ time: p.time as UTCTimestamp, value: p.price })));
      const markers: SeriesMarker<Time>[] = best.points.map((p) => ({
        time: p.time as UTCTimestamp,
        position: p.label === "1" || p.label === "3" || p.label === "5" || p.label === "B" ? "aboveBar" : "belowBar",
        color: p.label === "3" ? "#ff5f5f" : WAVE_COLOR,
        shape: "circle",
        text: p.label,
      }));
      markersRef.current?.setMarkers(markers);
    } else {
      s.waveLine.setData([]);
      markersRef.current?.setMarkers([]);
    }

    const lines = wave23LinesRef.current;
    if (lines.breakout) {
      s.candle.removePriceLine(lines.breakout);
      lines.breakout = null;
    }
    if (lines.invalidation) {
      s.candle.removePriceLine(lines.invalidation);
      lines.invalidation = null;
    }
    const tracker = data.wave.wave2to3;
    if (tracker.phase !== "none") {
      if (tracker.breakoutLevel !== null) {
        lines.breakout = s.candle.createPriceLine({
          price: tracker.breakoutLevel,
          color: tracker.phase === "confirmed" ? "#3fb950" : "#e3b341",
          lineWidth: 2,
          lineStyle: 2,
          axisLabelVisible: true,
          title: "Wave 3 breakout",
        });
      }
      if (tracker.invalidationLevel !== null) {
        lines.invalidation = s.candle.createPriceLine({
          price: tracker.invalidationLevel,
          color: "#f85149",
          lineWidth: 1,
          lineStyle: 3,
          axisLabelVisible: true,
          title: "invalidation",
        });
      }
    }
  }, [data]);

  useEffect(() => {
    const s = seriesRef.current;
    if (!s || !data) return;

    const cdcMap = new Map(data.indicators.cdc.map((p) => [p.time, p]));

    s.candle.applyOptions({ priceFormat: { type: "price", ...pickPriceFormat(data.candles.map((c) => c.close)) } });

    s.candle.setData(
      data.candles.map((c) => {
        const cdc = overlays.cdc ? cdcMap.get(c.time) : undefined;
        const color = cdc ? CDC_COLORS[cdc.zone] : undefined;
        return {
          time: c.time as UTCTimestamp,
          open: c.open,
          high: c.high,
          low: c.low,
          close: c.close,
          ...(color ? { color, borderColor: color, wickColor: color } : {}),
        };
      })
    );

    if (overlays.cdc) {
      const cdcMarkers: SeriesMarker<Time>[] = data.indicators.cdc
        .filter((p) => p.signal !== null)
        .map((p) => ({
          time: p.time as UTCTimestamp,
          position: p.signal === "buy" ? "belowBar" : "aboveBar",
          color: p.signal === "buy" ? CDC_COLORS.green : CDC_COLORS.red,
          shape: p.signal === "buy" ? "arrowUp" : "arrowDown",
          text: p.signal === "buy" ? "Buy" : "Sell",
        }));
      cdcMarkersRef.current?.setMarkers(cdcMarkers);
    } else {
      cdcMarkersRef.current?.setMarkers([]);
    }
  }, [data, overlays.cdc]);

  useEffect(() => {
    const chart = chartRef.current;
    if (!chart) return;

    for (const line of chainLinesRef.current) chart.removeSeries(line);
    chainLinesRef.current = [];

    if (!data || !overlays.waveMap) {
      chainMarkersRef.current?.setMarkers([]);
      return;
    }

    const newLines: ISeriesApi<"Line">[] = [];
    const chainMarkers: SeriesMarker<Time>[] = [];

    for (const run of data.wave.waveChain) {
      for (const group of splitChainByPhase(run.points)) {
        const color = group.phase === "impulse" ? CHAIN_IMPULSE_COLOR : CHAIN_CORRECTIVE_COLOR;
        const line = chart.addSeries(LineSeries, { color, lineWidth: 3, lineStyle: 0, lastValueVisible: false, priceLineVisible: false }, 0);
        line.setData(group.points.map((p) => ({ time: p.time as UTCTimestamp, value: p.price })));
        newLines.push(line);
      }

      for (const p of run.points) {
        if (!p.label) continue;
        const isNumber = p.label !== "A" && p.label !== "B" && p.label !== "C";
        chainMarkers.push({
          time: p.time as UTCTimestamp,
          position: p.type === "high" ? "aboveBar" : "belowBar",
          color: isNumber ? CHAIN_NUMBER_COLOR : CHAIN_LETTER_COLOR,
          shape: "square",
          text: p.label,
        });
      }
    }

    chainLinesRef.current = newLines;
    chainMarkersRef.current?.setMarkers(chainMarkers);
  }, [data, overlays.waveMap]);

  useEffect(() => {
    const s = seriesRef.current;
    if (!s) return;
    s.sma20.applyOptions({ visible: overlays.sma20 });
    s.sma50.applyOptions({ visible: overlays.sma50 });
    s.ema12.applyOptions({ visible: overlays.ema12 });
    s.ema26.applyOptions({ visible: overlays.ema26 });
    s.bbUpper.applyOptions({ visible: overlays.bollinger });
    s.bbMiddle.applyOptions({ visible: overlays.bollinger });
    s.bbLower.applyOptions({ visible: overlays.bollinger });
    s.waveLine.applyOptions({ visible: overlays.wave });
    s.volume.applyOptions({ visible: overlays.volume });
  }, [overlays]);

  return <div ref={containerRef} style={{ width: "100%", height: "100%" }} />;
}
