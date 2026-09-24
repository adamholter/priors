"use client";
import { createContext, useContext, useEffect, useRef } from "react";
import type { EChartsOption } from "echarts";
import { echarts, themeFor, LIGHT_PALETTE, type ChartPalette } from "./theme";

export * from "./theme";

export const ChartPaletteContext = createContext<ChartPalette>(LIGHT_PALETTE);
export const useChartPalette = () => useContext(ChartPaletteContext);

/** Mounts an ECharts instance and keeps it in sync with `option` (merge mode, so transitions animate). */
export function useEChart(option: EChartsOption, deps: unknown[] = [], onReady?: (chart: echarts.ECharts) => void) {
  const ref = useRef<HTMLDivElement>(null);
  const chart = useRef<echarts.ECharts | null>(null);
  const theme = themeFor(useChartPalette());
  const latest = useRef(option);
  useEffect(() => { latest.current = option; });
  useEffect(() => {
    if (!ref.current) return;
    // Re-created when the page's palette changes: ECharts themes apply at init.
    const c = echarts.init(ref.current, theme, { renderer: "svg" });
    c.setOption(latest.current);
    chart.current = c;
    onReady?.(c);
    const ro = new ResizeObserver(() => c.resize());
    ro.observe(ref.current);
    return () => { ro.disconnect(); c.dispose(); chart.current = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [theme]);
  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      chart.current?.setOption({ ...option, animation: !reduced, animationDurationUpdate: reduced ? 0 : 350, animationEasingUpdate: "cubicOut" }, { notMerge: false, replaceMerge: ["series", "graphic"] });
    });
    return () => cancelAnimationFrame(frame);
  }, deps); // eslint-disable-line react-hooks/exhaustive-deps
  return { ref, chart };
}
