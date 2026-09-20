"use client";
import * as echarts from "echarts/core";
import { LineChart, ScatterChart, BarChart } from "echarts/charts";
import { GridComponent, TooltipComponent, DatasetComponent, MarkLineComponent, GraphicComponent, DataZoomComponent } from "echarts/components";
import { SVGRenderer } from "echarts/renderers";
import { LabelLayout, UniversalTransition } from "echarts/features";
import { useEffect, useRef } from "react";
import type { EChartsOption } from "echarts";

echarts.use([LineChart, ScatterChart, BarChart, GridComponent, TooltipComponent, DatasetComponent, MarkLineComponent, GraphicComponent, DataZoomComponent, SVGRenderer, LabelLayout, UniversalTransition]);

export const INK = "#1A1A1A", GREY = "#8A8A80", HAIR = "#ECEAE3", BONE = "#FBFBF9", INDIGO = "#2F4FB0";
const SANS = "var(--font-inter), Inter, system-ui, sans-serif";
const MONO = "var(--font-jetbrains), 'JetBrains Mono', Menlo, monospace";
export const MARK_LABEL = { show: true, position: "right" as const, formatter: "{b}", fontSize: 11.5, color: INK, opacity: 1, distance: 7, backgroundColor: "rgba(251,251,249,.72)", padding: [2, 3], borderRadius: 2, textBorderColor: "rgba(251,251,249,.85)", textBorderWidth: 2 };

echarts.registerTheme("priors", {
  backgroundColor: "transparent",
  textStyle: { fontFamily: SANS, color: INK },
  categoryAxis: { axisLine: { show: false }, axisTick: { show: false }, splitLine: { show: false }, axisLabel: { color: GREY, fontFamily: MONO, fontSize: 11 } },
  valueAxis: { axisLine: { show: false }, axisTick: { show: false }, splitLine: { lineStyle: { color: HAIR } }, axisLabel: { color: GREY, fontFamily: MONO, fontSize: 11 } },
  logAxis: { axisLine: { show: false }, axisTick: { show: false }, splitLine: { lineStyle: { color: HAIR } }, axisLabel: { color: GREY, fontFamily: MONO, fontSize: 11 } },
  tooltip: { confine: true, backgroundColor: "#fff", borderColor: "#DDDBD4", borderWidth: 1, textStyle: { color: INK, fontSize: 12, fontFamily: SANS }, extraCssText: "box-shadow:none;border-radius:4px;padding:8px 10px" },
});

export { echarts, MONO, SANS };

/** Mounts an ECharts instance and keeps it in sync with `option` (merge mode, so transitions animate). */
export function useEChart(option: EChartsOption, deps: unknown[] = [], onReady?: (chart: echarts.ECharts) => void) {
  const ref = useRef<HTMLDivElement>(null);
  const chart = useRef<echarts.ECharts | null>(null);
  useEffect(() => {
    if (!ref.current) return;
    const c = echarts.init(ref.current, "priors", { renderer: "svg" });
    chart.current = c;
    onReady?.(c);
    const ro = new ResizeObserver(() => c.resize());
    ro.observe(ref.current);
    return () => { ro.disconnect(); c.dispose(); chart.current = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      chart.current?.setOption({ ...option, animation: !reduced, animationDurationUpdate: reduced ? 0 : 350, animationEasingUpdate: "cubicOut" }, { notMerge: false, replaceMerge: ["series", "graphic"] });
    });
    return () => cancelAnimationFrame(frame);
  }, deps); // eslint-disable-line react-hooks/exhaustive-deps
  return { ref, chart };
}
