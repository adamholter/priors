"use client";
import { ChartExport } from "./ChartExport";
import type { EChartsOption } from "echarts";
import { useMemo } from "react";
import type { Lab } from "@/data/types";
import type { RankedVariant } from "@/engine";
import { MARK_LABEL, useEChart } from "./echarts";
import { variantLabel } from "./ParetoChart";

export interface MetricPoint { x: number; r: RankedVariant }

/** Generic index-score-vs-metric scatter used by the profile metric gallery. */
export function MetricScatter({ pts, labs, xLabel, xName, scale = "linear", formatX, height = 400, aria }: {
  pts: MetricPoint[]; labs: Lab[]; xLabel: string; xName: string;
  scale?: "linear" | "log" | "time"; formatX: (x: number) => string; height?: number; aria: string;
}) {
  const option = useMemo<EChartsOption>(() => {
    const color = new Map(labs.map((l) => [l.id, l.color]));
    const ys = pts.map((p) => p.r.score);
    return {
      grid: { left: 48, right: 130, top: 24, bottom: 44 },
      xAxis: {
        type: scale, name: xName, nameLocation: "end", nameGap: 8,
        nameTextStyle: { color: "#8A8A80", fontSize: 11, align: "right", verticalAlign: "top", padding: [26, 0, 0, 0] },
        axisLabel: scale === "time" ? undefined : { formatter: (v: number) => formatX(v) },
      } as EChartsOption["xAxis"],
      yAxis: { type: "value", name: "Index score", nameTextStyle: { color: "#8A8A80", fontSize: 11, align: "left", padding: [0, 0, 0, -30] }, min: Math.max(0, Math.floor((Math.min(...ys, 100) - 6) / 5) * 5), max: Math.min(100, Math.ceil((Math.max(...ys, 0) + 4) / 5) * 5) },
      tooltip: { trigger: "item", confine: true, formatter: (p: unknown) => { const d = (p as { data?: { extra?: MetricPoint } }).data?.extra; return d ? `<b>${variantLabel(d.r)}</b><br/><span style="font-family:var(--font-jetbrains)">${d.r.score.toFixed(1)} · ${formatX(d.x)} ${xLabel}</span>` : ""; } },
      series: [{ type: "scatter", id: "metric", data: pts.map((p) => ({ id: p.r.variant.id, name: variantLabel(p.r), value: [p.x, p.r.score], itemStyle: { color: color.get(p.r.model.labId), borderColor: "#FBFBF9", borderWidth: 1.5 }, extra: p })), symbolSize: 10, label: MARK_LABEL, labelLayout: { hideOverlap: true, moveOverlap: "shiftY" }, clip: true, universalTransition: { enabled: false }, animationDurationUpdate: 350, animationEasingUpdate: "cubicOut" }],
    };
  }, [pts, labs, xName, scale, formatX, xLabel]);
  const { ref, chart } = useEChart(option, [option]);
  return <div><ChartExport name={xName} getSvg={() => chart.current?.renderToSVGString()} getRows={() => pts.map((p) => ({ rank: p.r.rank, model: p.r.model.name, effort: p.r.variant.effort, score: +p.r.score.toFixed(2), [xName]: +p.x.toFixed(4) }))} /><div ref={ref} role="img" aria-label={aria} style={{ width: "100%", height, overflow: "hidden", position: "relative", isolation: "isolate" }} /></div>;
}
