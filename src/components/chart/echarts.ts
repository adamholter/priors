"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import type { EChartsOption } from "echarts";
import type { ECharts } from "echarts/core";
import { markColor, themeSpec } from "./theme-tokens";
import { useChartPalette } from "./palette-context";
import { useChartGrid } from "@/lib/chart-grid-pref";

export * from "./theme-tokens";

/** The chart library, fetched the first time a chart mounts, so a page that draws no chart never downloads it. */
type Runtime = typeof import("./theme");
let runtime: Runtime | null = null, loading: Promise<Runtime> | null = null;
export function loadECharts(): Promise<Runtime> {
  if (!loading) { loading = import("./theme").then((m) => (runtime = m)); loading.catch(() => { loading = null; }); }
  return loading;
}

export { ChartPaletteContext, useChartPalette } from "./palette-context";
/** Lab color for DOM marks (bars, dots, swatches) under the current palette. */
export function useLabColor() {
  const pal = useChartPalette();
  return useCallback((labId: string | undefined, color: string | undefined) => markColor(color, pal, labId), [pal]);
}

/** Mounts an ECharts instance and keeps it in sync with `option` (merge mode, so transitions animate). */
export function useEChart(option: EChartsOption, deps: unknown[] = [], onReady?: (chart: ECharts) => void, resetSeries = false) {
  const ref = useRef<HTMLDivElement>(null);
  const chart = useRef<ECharts | null>(null);
  const pal = useChartPalette(), grid = useChartGrid(pal), theme = themeSpec(pal, undefined, grid).name;
  // Effects in the calling chart read `chart.current`; a render after the first load lets them see it.
  const [, setLoaded] = useState(false);
  const latest = useRef(option);
  useEffect(() => { latest.current = option; });
  useEffect(() => {
    if (!ref.current) return;
    let undo: (() => void) | undefined, live = true;
    const mount = ({ echarts, themeFor }: Runtime) => {
      if (!live || !ref.current) return;
      // Re-created when the page's palette changes: ECharts themes apply at init.
      const c = echarts.init(ref.current, themeFor(pal, undefined, grid), { renderer: "svg" });
      c.setOption(latest.current);
      chart.current = c;
      onReady?.(c);
      const ro = new ResizeObserver(() => c.resize());
      ro.observe(ref.current);
      undo = () => { ro.disconnect(); c.dispose(); chart.current = null; };
    };
    if (runtime) mount(runtime);
    else loadECharts().then((m) => { mount(m); if (live) setLoaded(true); }, () => { /* a failed download leaves the chart empty; the next chart asks again */ });
    return () => { live = false; undo?.(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [theme]);
  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      chart.current?.setOption({ ...option, animation: !reduced, animationDurationUpdate: reduced ? 0 : 350, animationEasingUpdate: "cubicOut" }, { notMerge: resetSeries, replaceMerge: ["series", "graphic"] });
    });
    return () => cancelAnimationFrame(frame);
  }, deps); // eslint-disable-line react-hooks/exhaustive-deps
  return { ref, chart };
}
