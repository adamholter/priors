"use client";
import { ChartExport, type ExportRow } from "./ChartExport";
import type { EChartsOption } from "echarts";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { Lab } from "@/data/types";
import { DARK_PALETTE, markColor, useChartPalette, useEChart } from "./echarts";
import { scatterHtml, unitOf } from "./embed";
import { ChartLink, type ChartLinkParams } from "./ChartLink";
import { useChartExpand } from "./ChartExpand";
import { chartLabel } from "@/lib/metrics";
import { scatterOption, frontierOf, pickLabels, DEFAULT_VIEW, type ScatterPoint, type ScatterView } from "./scatter-option";

export { chartLabel, pickLabels, frontierOf, DEFAULT_VIEW };
export type { ScatterPoint, ScatterView };

/** Per-chart display preferences (label density, frontier, effort lines), remembered in localStorage. */
export function useScatterView(key: string, defaultKind: "bars" | "scatter" = "scatter"): [ScatterView, (v: ScatterView, persist?: boolean) => void] {
  const [view, setView] = useState<ScatterView>({ ...DEFAULT_VIEW, kind: defaultKind });
  useEffect(() => {
    const raf = requestAnimationFrame(() => {
      try {
        const s = JSON.parse(localStorage.getItem(`priors:chart:${key}`) ?? "null") as ScatterView | null;
        // Older saves stored the then-default "scatter" without marking a choice; only an explicit
        // pick (or bars, which was never a default) overrides the chart's own default.
        if (s) setView({ ...DEFAULT_VIEW, ...s, kind: s.kindChosen || s.kind === "bars" ? s.kind : defaultKind });
      } catch { /* ignore */ }
    });
    return () => cancelAnimationFrame(raf);
  }, [key, defaultKind]);
  return [view, (v, persist = true) => {
    const next = v.kind !== view.kind ? { ...v, kindChosen: true } : v;
    setView(next);
    if (persist) try { localStorage.setItem(`priors:chart:${key}`, JSON.stringify(next)); } catch { /* ignore */ }
  }];
}

function escapeHtml(s: string) { return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!)); }

/**
 * Index score vs one metric. Lab-colored marks, reasoning efforts of one model joined by a thin line,
 * Pareto frontier traced in ink, labels thinned by density. Title, settings and export share one row.
 */
export function ScoreScatter({ pts, labs, better, xName, xShort, xUnit = "", scale = "linear", formatX, formatValue, height = 420, aria, title, actions, view, exportName, extraRows, tooltipExtra, anchor, linkParams }: {
  pts: ScatterPoint[]; labs: Lab[]; better: "lower" | "higher"; xName: string; xShort?: string; xUnit?: string;
  scale?: "linear" | "log" | "time"; formatX: (x: number) => string; formatValue?: (x: number) => string;
  height?: number; aria: string; title?: ReactNode; actions?: ReactNode; view: ScatterView; exportName: string;
  extraRows?: (p: ScatterPoint) => ExportRow; tooltipExtra?: (p: ScatterPoint) => string; anchor?: string; linkParams?: ChartLinkParams;
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
  const option = useMemo<EChartsOption>(() => scatterOption({ pts, labs, better, xName, xShort, xUnit, scale, formatX, formatValue, view, pal, narrow, hasTitle: !!title, tooltipExtra }),
    [pts, labs, better, view, narrow, xName, xShort, xUnit, scale, formatX, formatValue, tooltipExtra, title, pal]);
  const { ref, chart } = useEChart(option, [option]);
  const expand = useChartExpand(exportName);
  const onFrontierIds = useMemo(() => new Set(frontier.map((p) => p.r.variant.id)), [frontier]);
  const getHtml = () => {
    const color = new Map(labs.map((l) => [l.id, l.color])), labeled = pickLabels(pts, better, view.density), ys = pts.map((p) => p.r.score);
    const byModel = new Map<string, ScatterPoint[]>();
    for (const p of pts) (byModel.get(p.r.model.id) ?? byModel.set(p.r.model.id, []).get(p.r.model.id)!).push(p);
    return scatterHtml({
      title: exportName, xName, scale, unit: unitOf(formatX),
      yMin: Math.max(0, Math.floor((Math.min(...ys, 100) - 6) / 5) * 5), yMax: Math.min(100, Math.ceil((Math.max(...ys, 0) + 4) / 5) * 5),
      points: pts.map((p) => ({ v: [p.x, p.r.score], c: color.get(p.r.model.labId) ?? "#A3A39B", d: markColor(color.get(p.r.model.labId), DARK_PALETTE, p.r.model.labId), n: chartLabel(p.r), s: labeled.has(p.r.variant.id), f: view.frontier && onFrontierIds.has(p.r.variant.id),
        t: `<b>${escapeHtml(p.r.variant.sourceModel?.name ?? chartLabel(p.r))}</b><div style="font-family:'JetBrains Mono',monospace;margin-top:4px">${p.r.score.toFixed(1)} · ${escapeHtml((formatValue ?? formatX)(p.raw ?? p.x))}${xUnit ? ` ${escapeHtml(xUnit)}` : ""}</div>` })),
      frontier: view.frontier ? frontier.map((p) => [p.x, p.r.score]) : [],
      links: view.links ? [...byModel.values()].filter((v) => v.length > 1).map((v) => ({ c: color.get(v[0].r.model.labId) ?? "#A3A39B", d: markColor(color.get(v[0].r.model.labId), DARK_PALETTE, v[0].r.model.labId), p: [...v].sort((a, b) => a.x - b.x).map((p) => [p.x, p.r.score] as [number, number]) })) : [],
    });
  };
  return (
    <>{expand.backdrop}<div ref={wrapRef} id={anchor} className={`max-sm:-mx-4 scroll-mt-20 ${expand.expanded ? "chart-expanded" : ""}`} role={expand.expanded ? "dialog" : undefined} aria-modal={expand.expanded || undefined} aria-label={expand.expanded ? exportName : undefined}>
      {/* Untitled charts (gallery panels) float their controls over the plot's empty top margin. */}
      <div className={`flex flex-wrap items-center justify-between gap-x-4 gap-y-1 max-sm:px-4 min-h-8 ${title || expand.expanded ? "mb-1" : "-mb-8 relative z-10 pointer-events-none"}`}>
        <div className="min-w-0">{title ?? (expand.expanded && <h2 className="text-[22px]">{exportName}</h2>)}</div>
        <div className="flex items-center gap-1 ml-auto pointer-events-auto">
          {actions}
          {anchor && <ChartLink id={anchor} name={exportName} params={linkParams} />}
          <ChartExport name={exportName} frame getHtml={getHtml} getSvg={() => chart.current?.renderToSVGString()} getRows={() => pts.map((p) => ({ rank: p.r.rank, model: p.r.model.name, effort: p.r.variant.effort, score: +p.r.score.toFixed(2), lab: p.r.model.labId, [xName]: +(p.raw ?? p.x).toFixed(4), on_frontier: onFrontierIds.has(p.r.variant.id), ...extraRows?.(p) }))} />
          {expand.button}
        </div>
      </div>
      <div className={`relative ${expand.expanded ? "flex-1 min-h-0" : ""}`}>
        <div ref={ref} role="img" aria-label={aria} style={{ width: "100%", height: expand.expanded ? "100%" : height, overflow: "hidden", position: "relative", isolation: "isolate" }} />
        {!pts.length && <p className="cap absolute inset-0 grid place-items-center">No model in this view has this metric.</p>}
      </div>
    </div></>
  );
}
