"use client";
import { ChartExport, type ExportRow } from "./ChartExport";
import type { EChartsOption } from "echarts";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { Lab } from "@/data/types";
import type { RankedVariant } from "@/engine";
import { markColor, markLabel, useChartPalette, useEChart } from "./echarts";
import { scatterHtml, unitOf } from "./embed";
import { ChartLink } from "./ChartLink";

export interface ScatterPoint { x: number; r: RankedVariant; /** untransformed value for tooltips/export when x is transformed */ raw?: number }
export interface ScatterView { density: number; frontier: boolean; links: boolean; kind?: "scatter" | "bars" }
export const DEFAULT_VIEW: ScatterView = { density: 0.45, frontier: true, links: true, kind: "scatter" };

/** Per-chart display preferences (label density, frontier, effort lines), remembered in localStorage. */
export function useScatterView(key: string): [ScatterView, (v: ScatterView) => void] {
  const [view, setView] = useState<ScatterView>(DEFAULT_VIEW);
  useEffect(() => {
    const raf = requestAnimationFrame(() => { try { const s = JSON.parse(localStorage.getItem(`priors:chart:${key}`) ?? "null"); if (s) setView({ ...DEFAULT_VIEW, ...s }); } catch { /* ignore */ } });
    return () => cancelAnimationFrame(raf);
  }, [key]);
  return [view, (v) => { setView(v); try { localStorage.setItem(`priors:chart:${key}`, JSON.stringify(v)); } catch { /* ignore */ } }];
}

/** Compact mark label: model, effort, and fallback flag — never the full source configuration string. */
export function chartLabel(r: RankedVariant) {
  const named = new RegExp(`\\b${r.variant.effort}\\b`, "i").test(r.model.name);
  const name = r.variant.effort === "default" || named ? r.model.name : `${r.model.name} ${r.variant.effort}`;
  const source = r.variant.sourceModel?.name ?? "";
  return /no fallback|without fallback/i.test(source) ? `${name}, no fallback` : /fallback/i.test(source) ? `${name}, fallback` : name;
}

/**
 * Chooses which marks get a label. Frontier marks come first, then marks closest below the frontier;
 * density sets how many and how far from the frontier labels reach. Below high density each model is
 * labeled once (its highest-priority effort), so one release doesn't repeat across every effort.
 */
export function pickLabels(pts: ScatterPoint[], better: "lower" | "higher", density: number): Set<string> {
  if (!pts.length) return new Set();
  const ys = pts.map((p) => p.r.score), range = Math.max(1, Math.max(...ys) - Math.min(...ys));
  const sorted = [...pts].sort((a, b) => better === "lower" ? a.x - b.x : b.x - a.x);
  let run = -Infinity; const level = new Map<string, number>();
  for (const p of sorted) { run = Math.max(run, p.r.score); level.set(p.r.variant.id, run); }
  const gap = (p: ScatterPoint) => (level.get(p.r.variant.id)! - p.r.score) / range;
  const order = [...pts].sort((a, b) => gap(a) - gap(b) || b.r.score - a.r.score);
  if (density >= 0.999) return new Set(order.map((p) => p.r.variant.id));
  const budget = Math.round(3 + density * density * pts.length * 0.9), reach = 0.04 + density * 0.6, perModel = density >= 0.85;
  const out = new Set<string>(), models = new Set<string>();
  for (const p of order) {
    if (out.size >= budget) break;
    if (gap(p) > reach && out.size >= 3) continue;
    if (!perModel && models.has(p.r.model.id)) continue;
    out.add(p.r.variant.id); models.add(p.r.model.id);
  }
  return out;
}

/** Non-dominated marks: nothing is both better on x and higher on score. */
export function frontierOf(pts: ScatterPoint[], better: "lower" | "higher") {
  const sorted = [...pts].sort((a, b) => (better === "lower" ? a.x - b.x : b.x - a.x) || b.r.score - a.r.score);
  const out: ScatterPoint[] = []; let best = -Infinity;
  for (const p of sorted) if (p.r.score > best) { out.push(p); best = p.r.score; }
  return out.sort((a, b) => a.x - b.x);
}

function escapeHtml(s: string) { return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!)); }

/**
 * Index score vs one metric. Lab-colored marks, reasoning efforts of one model joined by a thin line,
 * Pareto frontier traced in ink, labels thinned by density. Title, settings and export share one row.
 */
export function ScoreScatter({ pts, labs, better, xName, xShort, xUnit = "", scale = "linear", formatX, formatValue, height = 420, aria, title, actions, view, exportName, extraRows, tooltipExtra, anchor }: {
  pts: ScatterPoint[]; labs: Lab[]; better: "lower" | "higher"; xName: string; xShort?: string; xUnit?: string;
  scale?: "linear" | "log" | "time"; formatX: (x: number) => string; formatValue?: (x: number) => string;
  height?: number; aria: string; title?: ReactNode; actions?: ReactNode; view: ScatterView; exportName: string;
  extraRows?: (p: ScatterPoint) => ExportRow; tooltipExtra?: (p: ScatterPoint) => string; anchor?: string;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [narrow, setNarrow] = useState(false);
  useEffect(() => {
    const el = wrapRef.current; if (!el) return;
    const ro = new ResizeObserver(([e]) => setNarrow(e.contentRect.width < 560));
    ro.observe(el); return () => ro.disconnect();
  }, []);
  const frontier = useMemo(() => frontierOf(pts, better), [pts, better]);
  const pal = useChartPalette();
  const option = useMemo<EChartsOption>(() => {
    const color = new Map(labs.map((l) => [l.id, markColor(l.color, pal)]));
    const onFrontier = new Set(frontier.map((p) => p.r.variant.id));
    const labeled = pickLabels(pts, better, narrow ? view.density * 0.5 : view.density);
    const byModel = new Map<string, ScatterPoint[]>();
    for (const p of pts) (byModel.get(p.r.model.id) ?? byModel.set(p.r.model.id, []).get(p.r.model.id)!).push(p);
    const links = view.links ? [...byModel.values()].filter((v) => v.length > 1).map((v) => [...v].sort((a, b) => a.x - b.x)) : [];
    const ys = pts.map((p) => p.r.score);
    const yMin = Math.max(0, Math.floor((Math.min(...ys, 100) - 6) / 5) * 5), yMax = Math.min(100, Math.ceil((Math.max(...ys, 0) + 4) / 5) * 5);
    // Labeled marks draw last so their labels win overlap resolution.
    const ordered = [...pts].sort((a, b) => Number(labeled.has(a.r.variant.id)) - Number(labeled.has(b.r.variant.id)) || Number(onFrontier.has(a.r.variant.id)) - Number(onFrontier.has(b.r.variant.id)));
    const series: EChartsOption["series"] = [
      ...links.map((v) => ({ type: "line" as const, id: `link-${v[0].r.model.id}`, data: v.map((p) => ({ id: p.r.variant.id, value: [p.x, p.r.score] })), showSymbol: false, lineStyle: { color: color.get(v[0].r.model.labId), width: 1, opacity: 0.35 }, silent: true, animationDuration: 500, z: 1 })),
      ...(view.frontier && frontier.length > 1 ? [{ type: "line" as const, id: "frontier", data: frontier.map((p) => ({ id: p.r.variant.id, value: [p.x, p.r.score] })), showSymbol: false, lineStyle: { color: pal.ink, width: 1.4 }, silent: true, animationDuration: 500, z: 2 }] : []),
      {
        type: "scatter", id: "marks", z: 3,
        data: ordered.map((p) => {
          const front = view.frontier && onFrontier.has(p.r.variant.id), show = labeled.has(p.r.variant.id);
          return { name: chartLabel(p.r), value: [p.x, p.r.score], id: p.r.variant.id, itemStyle: { color: color.get(p.r.model.labId), borderColor: front ? pal.ink : pal.bg, borderWidth: 1.5, opacity: show || front ? 1 : 0.8 }, symbolSize: front ? 11 : 9, label: { show }, extra: p };
        }),
        label: narrow ? { ...markLabel(pal), fontSize: 10.5 } : markLabel(pal),
        labelLayout: { hideOverlap: true, moveOverlap: "shiftY" },
        emphasis: { scale: 1.4, label: { show: true, fontWeight: 600 } },
        clip: true, universalTransition: { enabled: false },
        animationDurationUpdate: 350, animationEasingUpdate: "cubicOut",
      },
    ];
    const name = narrow && xShort ? xShort : xName;
    return {
      animation: true,
      grid: narrow ? { left: 38, right: 12, top: title ? 24 : 48, bottom: 40 } : { left: 48, right: 130, top: title ? 24 : 48, bottom: 44 },
      xAxis: {
        type: scale === "linear" ? "value" : scale, name, nameLocation: "end", nameGap: 8, scale: scale === "linear",
        nameTextStyle: { color: pal.grey, fontSize: 11, align: "right", verticalAlign: "top", padding: [26, 0, 0, 0] },
        // Log/time axes otherwise print odd extent values ($0.007, 12.78s) that collide with round ticks.
        axisLabel: scale === "time" ? { hideOverlap: true, showMinLabel: false, showMaxLabel: false } : { formatter: (v: number) => formatX(v), hideOverlap: true, showMinLabel: scale !== "log", showMaxLabel: scale !== "log" },
        ...(scale === "log" ? { min: (e: { min: number }) => e.min / 1.5, max: (e: { max: number }) => e.max * 1.8 } : {}),
      } as EChartsOption["xAxis"],
      yAxis: { type: "value", name: "Index score", nameTextStyle: { color: pal.grey, fontSize: 11, align: "left", padding: [0, 0, 0, narrow ? -22 : -30] }, min: yMin, max: yMax },
      tooltip: {
        trigger: "item", confine: true, formatter: (p: unknown) => {
          const d = (p as { data?: { extra?: ScatterPoint } }).data?.extra; if (!d) return "";
          const lab = labs.find((l) => l.id === d.r.model.labId)?.name ?? d.r.model.labId;
          return `<div style="font-weight:600">${escapeHtml(d.r.variant.sourceModel?.name ?? chartLabel(d.r))}</div><div style="color:${pal.grey};font-size:11px">${escapeHtml(lab)}${onFrontier.has(d.r.variant.id) ? " · on the frontier" : ""}</div><div style="font-family:var(--font-jetbrains);margin-top:4px">${d.r.score.toFixed(1)} · ${escapeHtml((formatValue ?? formatX)(d.raw ?? d.x))}${xUnit ? ` ${xUnit}` : ""}${tooltipExtra ? escapeHtml(tooltipExtra(d)) : ""}</div>`;
        },
      },
      series,
    };
  }, [pts, labs, better, frontier, view, narrow, xName, xShort, xUnit, scale, formatX, formatValue, tooltipExtra, title, pal]);
  const { ref, chart } = useEChart(option, [option]);
  const onFrontierIds = useMemo(() => new Set(frontier.map((p) => p.r.variant.id)), [frontier]);
  const getHtml = () => {
    const color = new Map(labs.map((l) => [l.id, l.color])), labeled = pickLabels(pts, better, view.density), ys = pts.map((p) => p.r.score);
    const byModel = new Map<string, ScatterPoint[]>();
    for (const p of pts) (byModel.get(p.r.model.id) ?? byModel.set(p.r.model.id, []).get(p.r.model.id)!).push(p);
    return scatterHtml({
      title: exportName, xName, scale, unit: unitOf(formatX),
      yMin: Math.max(0, Math.floor((Math.min(...ys, 100) - 6) / 5) * 5), yMax: Math.min(100, Math.ceil((Math.max(...ys, 0) + 4) / 5) * 5),
      points: pts.map((p) => ({ v: [p.x, p.r.score], c: color.get(p.r.model.labId) ?? "#A3A39B", n: chartLabel(p.r), s: labeled.has(p.r.variant.id), f: view.frontier && onFrontierIds.has(p.r.variant.id),
        t: `<b>${escapeHtml(p.r.variant.sourceModel?.name ?? chartLabel(p.r))}</b><div style="font-family:'JetBrains Mono',monospace;margin-top:4px">${p.r.score.toFixed(1)} · ${escapeHtml((formatValue ?? formatX)(p.raw ?? p.x))}${xUnit ? ` ${escapeHtml(xUnit)}` : ""}</div>` })),
      frontier: view.frontier ? frontier.map((p) => [p.x, p.r.score]) : [],
      links: view.links ? [...byModel.values()].filter((v) => v.length > 1).map((v) => ({ c: color.get(v[0].r.model.labId) ?? "#A3A39B", d: [...v].sort((a, b) => a.x - b.x).map((p) => [p.x, p.r.score] as [number, number]) })) : [],
    });
  };
  return (
    <div ref={wrapRef} id={anchor} className="max-sm:-mx-4 scroll-mt-20">
      {/* Untitled charts (gallery panels) float their controls over the plot's empty top margin. */}
      <div className={`flex flex-wrap items-center justify-between gap-x-4 gap-y-1 max-sm:px-4 min-h-8 ${title ? "mb-1" : "-mb-8 relative z-10 pointer-events-none"}`}>
        <div className="min-w-0">{title}</div>
        <div className="flex items-center gap-1 ml-auto pointer-events-auto">
          {actions}
          {anchor && <ChartLink id={anchor} name={exportName} />}
          <ChartExport name={exportName} frame getHtml={getHtml} getSvg={() => chart.current?.renderToSVGString()} getRows={() => pts.map((p) => ({ rank: p.r.rank, model: p.r.model.name, effort: p.r.variant.effort, score: +p.r.score.toFixed(2), lab: p.r.model.labId, [xName]: +(p.raw ?? p.x).toFixed(4), on_frontier: onFrontierIds.has(p.r.variant.id), ...extraRows?.(p) }))} />
        </div>
      </div>
      <div className="relative">
        <div ref={ref} role="img" aria-label={aria} style={{ width: "100%", height, overflow: "hidden", position: "relative", isolation: "isolate" }} />
        {!pts.length && <p className="cap absolute inset-0 grid place-items-center">No model in this view has this metric.</p>}
      </div>
    </div>
  );
}
