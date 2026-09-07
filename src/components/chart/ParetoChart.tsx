"use client";
import type { EChartsOption } from "echarts";
import { useMemo } from "react";
import type { Lab } from "@/data/types";
import type { RankedVariant } from "@/engine";
import { INK, useEChart } from "./echarts";

export function variantLabel(r: RankedVariant) {
  return r.variant.effort === "default" ? r.model.name : `${r.model.name} ${r.variant.effort}`;
}

/**
 * Index score vs measured cost per task (log x). Marks colored by lab, reasoning-effort variants of one
 * model joined by a thin line, Pareto frontier traced in ink. Labels collide-avoid via labelLayout.
 */
export function ParetoChart({ ranked, labs, height = 460, yLabel = "Index score" }: { ranked: RankedVariant[]; labs: Lab[]; height?: number; yLabel?: string }) {
  const option = useMemo<EChartsOption>(() => {
    const color = new Map(labs.map((l) => [l.id, l.color]));
    const pts = ranked.filter((r) => r.costUsd != null && r.costUsd > 0);
    const frontier = pts.filter((p) => p.onFrontier).sort((a, b) => a.costUsd! - b.costUsd!);
    const byModel = new Map<string, RankedVariant[]>();
    for (const p of pts) (byModel.get(p.model.id) ?? byModel.set(p.model.id, []).get(p.model.id)!).push(p);
    const links = [...byModel.values()].filter((v) => v.length > 1).map((v) => v.sort((a, b) => a.costUsd! - b.costUsd!));
    const ys = pts.map((p) => p.score);
    const yMin = Math.max(0, Math.floor((Math.min(...ys, 100) - 6) / 5) * 5), yMax = Math.min(100, Math.ceil((Math.max(...ys, 0) + 4) / 5) * 5);
    const series: EChartsOption["series"] = [
      ...links.map((v) => ({ type: "line" as const, id: `link-${v[0].model.id}`, data: v.map((p) => [p.costUsd, p.score]), showSymbol: false, lineStyle: { color: color.get(v[0].model.labId), width: 1, opacity: 0.55 }, silent: true, animationDuration: 500, z: 1 })),
      { type: "line", id: "frontier", data: frontier.map((p) => [p.costUsd, p.score]), showSymbol: false, lineStyle: { color: INK, width: 1.4 }, silent: true, animationDuration: 500, z: 2 },
      {
        type: "scatter", id: "marks", z: 3,
        data: pts.map((p) => ({ name: variantLabel(p), value: [p.costUsd, p.score], id: p.variant.id, itemStyle: { color: color.get(p.model.labId), borderColor: p.onFrontier ? INK : "#FBFBF9", borderWidth: 1.5 }, extra: p })),
        symbolSize: 10,
        label: { show: true, position: "right", formatter: "{b}", fontSize: 11.5, color: INK, distance: 6 },
        labelLayout: { hideOverlap: true, moveOverlap: "shiftY" },
        emphasis: { scale: 1.4, label: { fontWeight: 600 } },
        universalTransition: { enabled: true },
        animationDurationUpdate: 500, animationEasingUpdate: "cubicOut",
      },
    ];
    return {
      animation: true,
      grid: { left: 48, right: 130, top: 24, bottom: 44 },
      xAxis: { type: "log", name: "Cost per task ($, log)", nameLocation: "end", nameGap: 8, nameTextStyle: { color: "#8A8A80", fontSize: 11, align: "right", verticalAlign: "top", padding: [26, 0, 0, 0] }, axisLabel: { formatter: (v: number) => `$${v >= 10 ? Math.round(v) : v >= 1 ? v.toFixed(1).replace(/\.0$/, "") : v.toFixed(2).replace(/0$/, "")}` }, min: (e: { min: number }) => e.min / 1.5, max: (e: { max: number }) => e.max * 1.8 },
      yAxis: { type: "value", name: yLabel, nameTextStyle: { color: "#8A8A80", fontSize: 11, align: "left", padding: [0, 0, 0, -30] }, min: yMin, max: yMax },
      tooltip: {
        trigger: "item", formatter: (p: unknown) => {
          const d = (p as { data?: { extra?: RankedVariant } }).data?.extra; if (!d) return "";
          return `<div style="font-weight:600">${variantLabel(d)}</div><div style="color:#8A8A80;font-size:11px">${d.model.labId}</div><div style="font-family:var(--font-jetbrains);margin-top:4px">${d.score.toFixed(1)} · $${d.costUsd!.toFixed(2)}/task${d.speed ? ` · ${Math.round(d.speed)} tok/s` : ""}</div>${d.coverage < 1 ? `<div style="color:#8A8A80;font-size:11px">${Math.round(d.coverage * 100)}% of weight measured</div>` : ""}`;
        },
      },
      series,
    };
  }, [ranked, labs, yLabel]);
  const { ref } = useEChart(option, [option]);
  return <div ref={ref} style={{ width: "100%", height }} />;
}
