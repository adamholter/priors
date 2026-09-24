"use client";
import { ChartExport } from "./ChartExport";
import type { EChartsOption } from "echarts";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { Lab } from "@/data/types";
import { useChartPalette, useEChart } from "./echarts";
import { chartLabel, type ScatterPoint } from "./ScoreScatter";
import { barsOption, compact, selectBars } from "./bars-option";
import { barsHtml, unitOf } from "./embed";
import { ChartLink, type ChartLinkParams } from "./ChartLink";

const value = (p: ScatterPoint) => p.raw ?? p.x;

/**
 * Vertical bars of one metric (Artificial Analysis style), best first. The caller's effort mode
 * applies: best mode shows one bar per model, all mode shows every effort. Capped at `limit`
 * points by index score so the axis stays readable.
 */
export function MetricBars({ pts, labs, better, xName, formatValue, height = 400, aria, actions, limit = 24, exportName, anchor, linkParams }: {
  pts: ScatterPoint[]; labs: Lab[]; better: "lower" | "higher"; xName: string; formatValue: (x: number) => string;
  height?: number; aria: string; actions?: ReactNode; limit?: number; exportName: string; anchor?: string; linkParams?: ChartLinkParams;
}) {
  const wrap = useRef<HTMLDivElement>(null);
  const [narrow, setNarrow] = useState(false);
  useEffect(() => { const el = wrap.current; if (!el) return; const ro = new ResizeObserver(([e]) => setNarrow(e.contentRect.width < 560)); ro.observe(el); return () => ro.disconnect(); }, []);
  const cap = narrow ? Math.min(12, limit) : limit;
  const pal = useChartPalette();
  const bars = useMemo(() => selectBars(pts, better, cap), [pts, better, cap]);
  const option = useMemo<EChartsOption>(() => barsOption({ bars, labs, xName, formatValue, pal, narrow }), [bars, labs, xName, formatValue, narrow, pal]);
  const { ref, chart } = useEChart(option, [option]);
  return (
    <div ref={wrap} className="max-sm:-mx-4">
      <div className="flex items-center justify-end gap-1 max-sm:px-4 min-h-8 -mb-8 relative z-10 pointer-events-none"><div className="flex items-center gap-1 pointer-events-auto">{actions}{anchor && <ChartLink id={anchor} name={exportName} params={linkParams} />}<ChartExport name={exportName} frame getHtml={() => barsHtml({ title: exportName, yName: xName, unit: unitOf(formatValue), bars: bars.map((p) => ({ n: chartLabel(p.r), v: value(p), c: labs.find((l) => l.id === p.r.model.labId)?.color ?? "#A3A39B", t: `<b>${chartLabel(p.r)}</b><div style="font-family:'JetBrains Mono',monospace;margin-top:4px">${compact(formatValue)(value(p))} · index ${p.r.score.toFixed(1)}</div>` })) })} getSvg={() => chart.current?.renderToSVGString()} getRows={() => bars.map((p, i) => ({ rank: i + 1, model: p.r.model.name, effort: p.r.variant.effort, [xName]: +value(p).toFixed(4), index_score: +p.r.score.toFixed(2) }))} /></div></div>
      <div ref={ref} role="img" aria-label={aria} style={{ width: "100%", height, overflow: "hidden", position: "relative", isolation: "isolate" }} />
    </div>
  );
}
