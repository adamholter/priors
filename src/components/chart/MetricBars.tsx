"use client";
import { ChartExport } from "./ChartExport";
import type { EChartsOption } from "echarts";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { Lab } from "@/data/types";
import { useEChart } from "./echarts";
import { chartLabel, type ScatterPoint } from "./ScoreScatter";

/**
 * Vertical bars of one metric (Artificial Analysis style), best first. One bar per model — its
 * top-scoring effort — for the top `limit` models by index score, so the axis stays readable.
 */
const value = (p: ScatterPoint) => p.raw ?? p.x;
/** Bar labels: round to what a reader compares (189 s, 45.2%, 0.83 s), keeping the metric's unit. */
const compact = (format: (x: number) => string) => (v: number) => {
  const unit = format(1).replace(/^[$]?[\d.,]+/, ""), dollar = format(1).startsWith("$");
  const n = Math.abs(v) >= 1000 ? `${(v / 1000).toFixed(v >= 10000 ? 0 : 1)}k` : Math.abs(v) >= 100 ? Math.round(v).toString() : Math.abs(v) >= 10 ? v.toFixed(1) : v.toPrecision(2);
  return `${dollar ? "$" : ""}${n}${unit.replace(/^k(?=\s|$)/, "")}`;
};

export function MetricBars({ pts, labs, better, xName, formatValue, height = 400, aria, actions, limit = 24, exportName }: {
  pts: ScatterPoint[]; labs: Lab[]; better: "lower" | "higher"; xName: string; formatValue: (x: number) => string;
  height?: number; aria: string; actions?: ReactNode; limit?: number; exportName: string;
}) {
  const wrap = useRef<HTMLDivElement>(null);
  const [narrow, setNarrow] = useState(false);
  useEffect(() => { const el = wrap.current; if (!el) return; const ro = new ResizeObserver(([e]) => setNarrow(e.contentRect.width < 560)); ro.observe(el); return () => ro.disconnect(); }, []);
  const cap = narrow ? Math.min(12, limit) : limit;
  const bars = useMemo(() => {
    const best = new Map<string, ScatterPoint>();
    for (const p of pts) { const cur = best.get(p.r.model.id); if (!cur || p.r.score > cur.r.score) best.set(p.r.model.id, p); }
    const top = [...best.values()].sort((a, b) => b.r.score - a.r.score).slice(0, cap);
    return top.sort((a, b) => better === "lower" ? value(a) - value(b) : value(b) - value(a));
  }, [pts, better, cap]);
  const option = useMemo<EChartsOption>(() => {
    const color = new Map(labs.map((l) => [l.id, l.color]));
    return {
      grid: { left: 48, right: 16, top: 34, bottom: 96 },
      xAxis: { type: "category", data: bars.map((p) => chartLabel(p.r)), axisLabel: { rotate: 45, interval: 0, fontSize: 10.5, color: "#595B53", fontFamily: "var(--font-inter), Inter, sans-serif", width: 110, overflow: "truncate" }, axisTick: { show: false } },
      yAxis: { type: "value", name: xName, nameTextStyle: { color: "#8A8A80", fontSize: 11, align: "left", padding: [0, 0, 0, -30] }, axisLabel: { formatter: (v: number) => compact(formatValue)(v) } },
      tooltip: { trigger: "item", confine: true, formatter: (p: unknown) => { const d = bars[(p as { dataIndex: number }).dataIndex]; return d ? `<div style="font-weight:600">${chartLabel(d.r)}</div><div style="font-family:var(--font-jetbrains);margin-top:4px">${formatValue(value(d))} · index ${d.r.score.toFixed(1)}</div>` : ""; } },
      series: [{
        type: "bar", id: "bars", barMaxWidth: 28,
        data: bars.map((p) => ({ value: value(p), itemStyle: { color: color.get(p.r.model.labId) ?? "#A3A39B", borderRadius: [2, 2, 0, 0] } })),
        label: { show: true, position: "top", fontSize: narrow ? 9 : 10, color: "#1A1A1A", fontFamily: "var(--font-jetbrains), monospace", formatter: (p: { value?: unknown }) => compact(formatValue)(Number(p.value)) },
        animationDurationUpdate: 350,
      }],
    };
  }, [bars, labs, xName, formatValue, narrow]);
  const { ref, chart } = useEChart(option, [option]);
  return (
    <div ref={wrap} className="max-sm:-mx-4">
      <div className="flex items-center justify-end gap-1 max-sm:px-4 min-h-8 -mb-8 relative z-10 pointer-events-none"><div className="flex items-center gap-1 pointer-events-auto">{actions}<ChartExport name={exportName} getSvg={() => chart.current?.renderToSVGString()} getRows={() => bars.map((p, i) => ({ rank: i + 1, model: p.r.model.name, effort: p.r.variant.effort, [xName]: +value(p).toFixed(4), index_score: +p.r.score.toFixed(2) }))} /></div></div>
      <div ref={ref} role="img" aria-label={aria} style={{ width: "100%", height, overflow: "hidden", position: "relative", isolation: "isolate" }} />
    </div>
  );
}
