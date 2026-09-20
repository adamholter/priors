"use client";
import { ChartExport } from "./ChartExport";
import type { EChartsOption } from "echarts";
import { useEffect, useMemo, useRef, useState } from "react";
import type { Lab } from "@/data/types";
import type { RankedVariant } from "@/engine";
import { INK, MARK_LABEL, useEChart } from "./echarts";

export function variantLabel(r: RankedVariant) {
  if (r.variant.configuration && r.variant.sourceModel) return r.variant.sourceModel.name;
  return r.variant.effort === "default" ? r.model.name : `${r.model.name} ${r.variant.effort}`;
}

/**
 * Index score vs measured cost per task (log x). Marks colored by lab, reasoning-effort variants of one
 * model joined by a thin line, Pareto frontier traced in ink. Labels collide-avoid via labelLayout.
 */
export function ParetoChart({ ranked, labs, height = 460, yLabel = "Index score" }: { ranked: RankedVariant[]; labs: Lab[]; height?: number; yLabel?: string }) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [narrow, setNarrow] = useState(false);
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setNarrow(e.contentRect.width < 560));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
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
      ...links.map((v) => ({ type: "line" as const, id: `link-${v[0].model.id}`, data: v.map((p) => ({ id: p.variant.id, name: p.variant.id, value: [p.costUsd, p.score] })), showSymbol: false, lineStyle: { color: color.get(v[0].model.labId), width: 1, opacity: 0.35 }, silent: true, animationDuration: 500, z: 1 })),
      { type: "line", id: "frontier", data: frontier.map((p) => ({ id: p.variant.id, name: p.variant.id, value: [p.costUsd, p.score] })), showSymbol: false, lineStyle: { color: INK, width: 1.4 }, silent: true, animationDuration: 500, z: 2 },
      {
        type: "scatter", id: "marks", z: 3,
        data: pts.map((p) => ({ name: chartLabel(p), value: [p.costUsd, p.score], id: p.variant.id, itemStyle: { color: color.get(p.model.labId), borderColor: p.onFrontier ? INK : "#FBFBF9", borderWidth: 1.5 }, extra: p })),
        symbolSize: 10,
        label: narrow
          ? { ...MARK_LABEL, fontSize: 10.5, formatter: (p: { name?: unknown; data?: unknown }) => { const d = p.data as { extra?: RankedVariant } | null | undefined; return d?.extra?.onFrontier ? String(p.name ?? "") : ""; } }
          : MARK_LABEL,
        labelLayout: { hideOverlap: true, moveOverlap: "shiftY" },
        emphasis: { scale: 1.4, label: { fontWeight: 600 } },
        clip: true, universalTransition: { enabled: false },
        animationDurationUpdate: 350, animationEasingUpdate: "cubicOut",
      },
    ];
    return {
      animation: true,
      grid: narrow ? { left: 38, right: 12, top: 24, bottom: 40 } : { left: 48, right: 130, top: 24, bottom: 44 },
      xAxis: { type: "log", name: narrow ? "$ / task (log)" : "Cost per task ($, log)", nameLocation: "end", nameGap: 8, nameTextStyle: { color: "#8A8A80", fontSize: 11, align: "right", verticalAlign: "top", padding: [26, 0, 0, 0] }, axisLabel: { formatter: (v: number) => `$${v >= 10 ? Math.round(v) : v >= 1 ? v.toFixed(1).replace(/\.0$/, "") : v.toFixed(2).replace(/0$/, "")}` }, min: (e: { min: number }) => e.min / 1.5, max: (e: { max: number }) => e.max * 1.8 },
      yAxis: { type: "value", name: yLabel, nameTextStyle: { color: "#8A8A80", fontSize: 11, align: "left", padding: [0, 0, 0, narrow ? -22 : -30] }, min: yMin, max: yMax },
      tooltip: {
        trigger: "item", confine: true, formatter: (p: unknown) => {
          const d = (p as { data?: { extra?: RankedVariant } }).data?.extra; if (!d) return "";
          return `<div style="font-weight:600">${escapeHtml(variantLabel(d))}</div><div style="color:#8A8A80;font-size:11px">${escapeHtml(d.model.labId)}</div><div style="font-family:var(--font-jetbrains);margin-top:4px">${d.score.toFixed(1)} · $${d.costUsd!.toFixed(2)}/task${d.speed ? ` · ${Math.round(d.speed)} tok/s` : ""}</div>`;
        },
      },
      series,
    };
  }, [ranked, labs, yLabel, narrow]);
  const { ref, chart } = useEChart(option, [option]);
  return <div ref={wrapRef} className="max-sm:-mx-4"><ChartExport name="Pareto frontier" getSvg={() => chart.current?.renderToSVGString()} /><div ref={ref} role="img" aria-label="Index score versus cost per task" style={{ width: "100%", height, overflow: "hidden", position: "relative", isolation: "isolate" }} /></div>;
}

function escapeHtml(s: string) { return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!)); }

function chartLabel(r: RankedVariant) {
  const name = r.variant.effort === "default" ? r.model.name : `${r.model.name} ${r.variant.effort}`;
  const source = r.variant.sourceModel?.name ?? "";
  return /no fallback|without fallback/i.test(source) ? `${name}, no fallback` : /fallback/i.test(source) ? `${name}, fallback` : name;
}
