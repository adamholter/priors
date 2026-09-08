"use client";
import { ChartExport } from "./ChartExport";
import type { EChartsOption } from "echarts";
import { useMemo } from "react";
import type { Lab } from "@/data/types";
import type { RankedVariant } from "@/engine";
import { MARK_LABEL, useEChart } from "./echarts";
import { variantLabel } from "./ParetoChart";

/** Index score vs output speed (tok/s). */
export function SpeedChart({ ranked, labs, height = 400 }: { ranked: RankedVariant[]; labs: Lab[]; height?: number }) {
  const option = useMemo<EChartsOption>(() => {
    const color = new Map(labs.map((l) => [l.id, l.color]));
    const pts = ranked.filter((r) => r.speed && r.speed > 0);
    const ys = pts.map((p) => p.score);
    return {
      grid: { left: 48, right: 130, top: 24, bottom: 44 },
      xAxis: { type: "value", name: "Output speed (tok/s)", nameLocation: "end", nameGap: 8, nameTextStyle: { color: "#8A8A80", fontSize: 11, align: "right", verticalAlign: "top", padding: [26, 0, 0, 0] } },
      yAxis: { type: "value", name: "Index score", nameTextStyle: { color: "#8A8A80", fontSize: 11, align: "left", padding: [0, 0, 0, -30] }, min: Math.max(0, Math.floor((Math.min(...ys, 100) - 6) / 5) * 5), max: Math.min(100, Math.ceil((Math.max(...ys, 0) + 4) / 5) * 5) },
      tooltip: { trigger: "item", confine: true, formatter: (p: unknown) => { const d = (p as { data?: { extra?: RankedVariant } }).data?.extra; return d ? `<b>${variantLabel(d)}</b><br/><span style="font-family:var(--font-jetbrains)">${d.score.toFixed(1)} · ${Math.round(d.speed!)} tok/s</span>` : ""; } },
      series: [{ type: "scatter", id: "speed", data: pts.map((p) => ({ id: p.variant.id, name: variantLabel(p), value: [p.speed, p.score], itemStyle: { color: color.get(p.model.labId), borderColor: "#FBFBF9", borderWidth: 1.5 }, extra: p })), symbolSize: 10, label: MARK_LABEL, labelLayout: { hideOverlap: true, moveOverlap: "shiftY" }, clip: true, universalTransition: { enabled: false }, animationDurationUpdate: 350, animationEasingUpdate: "cubicOut" }],
    };
  }, [ranked, labs]);
  const { ref, chart } = useEChart(option, [option]);
  return <div><ChartExport name="Speed chart" getSvg={() => chart.current?.renderToSVGString()} /><div ref={ref} role="img" aria-label="Index score versus output speed" style={{ width: "100%", height, overflow: "hidden", position: "relative", isolation: "isolate" }} /></div>;
}
