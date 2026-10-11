"use client";
import { ChartExport, type ExportRow, type ChartExportHandle } from "./ChartExport";
import type { EChartsOption } from "echarts";
import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { Lab } from "@/data/types";
import { DARK_PALETTE, LIGHT_PALETTE, markColor, useChartPalette, useEChart } from "./echarts";
import { HighlightList, HighlightMenu, togglePoint, useHighlight } from "./highlight";
import { scatterHtml, unitOf } from "./embed";
import { ChartLink, type ChartLinkParams } from "./ChartLink";
import { useChartExpand } from "./ChartExpand";
import { chartLabel } from "@/lib/metrics";
import { scatterOption, frontierOf, featuredPoints, guidePoints, highlightedModels, pickLabels, DEFAULT_VIEW, restoreScatterView, type Highlight, type ScatterPoint, type ScatterView } from "./scatter-option";
import { dimColor } from "./theme";
import { labelScale } from "./label-size";
import { ChartContextMenu, useChartContextMenu, useChartVisibility } from "./ChartContextMenu";
import { useGravity } from "@/lib/konami";
import type { FallingDot } from "./GravityLayer";

const GravityLayer = dynamic(() => import("./GravityLayer"), { ssr: false });

export { chartLabel, pickLabels, frontierOf, DEFAULT_VIEW };
export type { Highlight, ScatterPoint, ScatterView };

/** Per-chart display preferences (label density, frontier, effort lines), remembered in localStorage. */
/** An owner default as a saved view: an explicit kind/frontier counts as chosen, so chart defaults don't override it. */
export function ownerBase(owner?: OwnerView | null): ScatterView | null {
  if (!owner) return null;
  const { mode: _mode, ...v } = owner; void _mode;
  return { ...DEFAULT_VIEW, ...v, ...(v.kind ? { kindChosen: true } : {}), ...(v.frontier != null ? { frontierChosen: true } : {}) } as ScatterView;
}
/** Only the fields an owner default stores. */
export function toOwnerView(v: ScatterView, mode?: "all" | "best"): OwnerView {
  const out: OwnerView = { kind: v.kind, scale: v.scale, frontier: v.frontier, links: v.links, guides: v.guides, density: v.density, labelScale: v.labelScale, ...(mode ? { mode } : {}) };
  for (const k of Object.keys(out) as (keyof OwnerView)[]) if (out[k] === undefined) delete out[k];
  return out;
}
export type OwnerView = { kind?: "scatter" | "bars"; mode?: "all" | "best"; scale?: "log" | "linear"; frontier?: boolean; links?: boolean; guides?: boolean; density?: number; labelScale?: number };

/**
 * A chart's view state. Visitors start from the page owner's default (`owner`) and keep their own
 * tweaks in localStorage. While the owner edits (`onOwner` set), changes become the page default
 * instead, and the owner's own local override is cleared so they see what visitors see.
 */
export function useScatterView(key: string, defaultKind: "bars" | "scatter" = "scatter", defaultFrontier = true, owner?: OwnerView | null, onOwner?: (v: ScatterView) => void): [ScatterView, (v: ScatterView, persist?: boolean) => void] {
  const base = ownerBase(owner);
  const [view, setView] = useState<ScatterView>(() => restoreScatterView(defaultKind, defaultFrontier, base));
  const editing = !!onOwner;
  const baseKey = JSON.stringify(owner ?? null);
  useEffect(() => {
    const raf = requestAnimationFrame(() => {
      const b = ownerBase(owner);
      if (editing) { setView(restoreScatterView(defaultKind, defaultFrontier, b)); return; }
      try {
        const s = JSON.parse(localStorage.getItem(`priors:chart:${key}`) ?? "null") as ScatterView | null;
        const saved = s ? { ...b, ...s } : b;
        if (saved) setView(current => ({ ...restoreScatterView(defaultKind, defaultFrontier, saved), ...(current.scale && !b?.scale ? { scale: current.scale } : {}), ...(current.labelScale != null && b?.labelScale == null ? { labelScale: current.labelScale } : {}), ...(current.kindChosen && !b?.kind ? { kind: current.kind, kindChosen: true } : {}) }));
      } catch { /* ignore */ }
    });
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, defaultKind, defaultFrontier, baseKey, editing]);
  return [view, (v, persist = true) => {
    const next = v.kind !== view.kind ? { ...v, kindChosen: true } : v;
    setView(next);
    if (onOwner) { onOwner(next); try { localStorage.removeItem(`priors:chart:${key}`); } catch { /* ignore */ } return; }
    if (persist) try { localStorage.setItem(`priors:chart:${key}`, JSON.stringify(next)); } catch { /* ignore */ }
  }];
}

function escapeHtml(s: string) { return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!)); }

/**
 * Index score vs one metric. Lab-colored marks, reasoning efforts of one model joined by a thin line,
 * Pareto frontier traced in ink, labels thinned by density. Title, settings and export share one row.
 */
export function ScoreScatter({ pts: allPoints, labs, better, xName: baseXName, xShort: baseXShort, xUnit = "", scale: defaultScale = "linear", formatX, formatValue, height = 420, aria, title, actions, view, exportName, extraRows, tooltipExtra, anchor, linkParams }: {
  pts: ScatterPoint[]; labs: Lab[]; better: "lower" | "higher"; xName: string; xShort?: string; xUnit?: string;
  scale?: "linear" | "log" | "time"; formatX: (x: number) => string; formatValue?: (x: number) => string;
  height?: number; aria: string; title?: ReactNode; actions?: ReactNode; view: ScatterView; exportName: string;
  extraRows?: (p: ScatterPoint) => ExportRow; tooltipExtra?: (p: ScatterPoint) => string; anchor?: string; linkParams?: ChartLinkParams;
}) {
  const scale = defaultScale === "time" ? "time" : view.scale ?? defaultScale;
  const xName = scale === "linear" ? baseXName.replace(/, log| \(log\)/g, "") : baseXName;
  const xShort = scale === "linear" ? baseXShort?.replace(/, log| \(log\)/g, "") : baseXShort;
  const wrapRef = useRef<HTMLDivElement>(null);
  const effectiveLinkParams = { ...linkParams, ls: Math.round(labelScale(view.labelScale) * 100) };
  const visibility = useChartVisibility(allPoints, anchor ?? exportName, effectiveLinkParams), pts = visibility.points;
  const context = useChartContextMenu();
  const exportControl = useRef<ChartExportHandle>(null);
  const contextPick = useRef(context.pointMenu);
  useEffect(() => { contextPick.current = context.pointMenu; });
  const [plotW, setPlotW] = useState(0), [plotH, setPlotH] = useState(height);
  const narrow = plotW > 0 && plotW < 560;
  useEffect(() => {
    const el = wrapRef.current; if (!el) return;
    const ro = new ResizeObserver(([e]) => setPlotW(Math.round(e.contentRect.width / 4) * 4));
    ro.observe(el); return () => ro.disconnect();
  }, []);
  useEffect(() => {
    const el = wrapRef.current?.querySelector<HTMLElement>('[role="img"]'); if (!el) return;
    const ro = new ResizeObserver(([e]) => setPlotH(Math.round(e.contentRect.height)));
    ro.observe(el); return () => ro.disconnect();
  }, []);
  const frontier = useMemo(() => frontierOf(pts, better), [pts, better]);
  const pal = useChartPalette();
  const plotWidth = useCallback(() => plotW || undefined, [plotW]);
  const plotHeight = useCallback(() => plotH, [plotH]);
  const hl = useHighlight();
  const hlItems = hl?.items;
  const highlight = useMemo<Highlight | undefined>(() => hlItems?.length ? { items: hlItems, guides: view.guides !== false } : undefined, [hlItems, view.guides]);
  // Easter egg (Konami code): marks off the frontier drop to the x-axis. See GravityLayer.
  const gravity = useGravity() && !!view.frontier;
  const fallen = useMemo(() => { if (!gravity) return undefined; const on = new Set(frontier.map((p) => p.r.variant.id)); return new Set(pts.filter((p) => !on.has(p.r.variant.id)).map((p) => p.r.variant.id)); }, [gravity, pts, frontier]);
  const option = useMemo<EChartsOption>(() => scatterOption({ pts, labs, better, xName, xShort, xUnit, scale, formatX, formatValue, view, pal, narrow, hasTitle: !!title, tooltipExtra, width: plotWidth, height: plotHeight, highlight, fallen }),
    [pts, labs, better, view, narrow, xName, xShort, xUnit, scale, formatX, formatValue, tooltipExtra, title, pal, plotWidth, plotHeight, highlight, fallen]);
  // Clicking a mark toggles that exact effort's highlight (several efforts per model are allowed).
  const pick = useRef<(p: ScatterPoint) => void>(() => {});
  useEffect(() => { pick.current = (p) => { if (hl) hl.set(togglePoint(hl.items, pts, p)); }; }, [hl, pts]);
  // Rebuild series so mark traversal follows the new label priority after slider/filter changes.
  // Merge mode retains the previous graphic order even when the data array is reordered.
  const { ref, chart } = useEChart(option, [option], (c) => {
    c.on("click", (e) => { const d = (e.data as { extra?: ScatterPoint } | undefined)?.extra; if (d) pick.current(d); });
    c.on("contextmenu", (e) => {
      const d = (e.data as { extra?: ScatterPoint } | undefined)?.extra;
      const event = e.event?.event as MouseEvent | undefined;
      if (d && event) { event.preventDefault(); event.stopPropagation(); contextPick.current(d, event.clientX, event.clientY); }
    });
  }, true);

  // Guide lines for highlighted models, drawn in pixel space so they stop exactly at the axes on every
  // scale (log, linear, time) and carry value badges on the axes. Part of the SVG, so exports include them.
  const guides = useMemo(() => guidePoints(pts, highlight), [pts, highlight]);
  useEffect(() => {
    const c = chart.current; if (!c) return;
    const colorOf = new Map(labs.map((l) => [l.id, markColor(l.color, pal, l.id)]));
    const present = () => ((c.getOption().graphic as { elements?: { id?: string }[] }[] | undefined) ?? []).some((g) => g.elements?.some((e) => e.id === "guides"));
    let last = "";
    const draw = () => {
      const grid = ((c as unknown as { getModel: () => unknown }).getModel() as { getComponent: (t: string, i: number) => { coordinateSystem?: { getRect: () => { x: number; y: number; width: number; height: number } } } | undefined }).getComponent("grid", 0)?.coordinateSystem?.getRect();
      if (!grid) return;
      const bottom = grid.y + grid.height, on = pal.dark ? "#141413" : "#FFFFFF";
      const badge = { fontSize: 10.5, fontFamily: "JetBrains Mono, Menlo, monospace", fill: on, padding: [2, 4], borderRadius: 2 };
      // Badges that would collide slide apart along their axis (never off the canvas): x badges stay in
      // one row under the axis, y badges in one column left of it, each still tinted like its line.
      const placed = guides.map((p) => ({ p, px: c.convertToPixel({ seriesId: "marks" }, [p.x, p.r.score]) as unknown as number[] | undefined })).filter((g): g is { p: ScatterPoint; px: number[] } => !!g.px && Number.isFinite(g.px[0]) && Number.isFinite(g.px[1]));
      const W = c.getWidth();
      const xs = placed.map(({ p, px }) => { const text = formatX(p.x); return { text, at: px[0], size: text.length * 6.6 + 10 }; });
      const ys = placed.map(({ p, px }) => ({ text: p.r.score.toFixed(1), at: px[1], size: 16 }));
      const spread = (items: { at: number; size: number }[], lo: number, hi: number) => {
        const order = items.map((it, i) => i).sort((i, j) => items[i].at - items[j].at), pos = items.map((it) => it.at);
        for (let k = 0; k < order.length; k++) { const i = order[k], prev = order[k - 1]; pos[i] = Math.max(pos[i], lo + items[i].size / 2, prev == null ? -Infinity : pos[prev] + (items[prev].size + items[i].size) / 2 + 3); }
        for (let k = order.length - 1; k >= 0; k--) { const i = order[k], next = order[k + 1]; pos[i] = Math.min(pos[i], hi - items[i].size / 2, next == null ? Infinity : pos[next] - (items[next].size + items[i].size) / 2 - 3); }
        return pos;
      };
      const xAt = spread(xs, 2, W - 2), yAt = spread(ys, grid.y - 6, bottom + 6);
      const children = placed.flatMap(({ p, px }, i) => {
        const col = colorOf.get(p.r.model.labId) ?? pal.ink, dash = { stroke: col, lineDash: [4, 3], lineWidth: 1.2, opacity: 0.9 };
        return [
          { type: "line", shape: { x1: px[0], y1: px[1], x2: px[0], y2: bottom }, style: dash, z: 3 },
          { type: "line", shape: { x1: grid.x, y1: px[1], x2: px[0], y2: px[1] }, style: dash, z: 3 },
          { type: "text", x: xAt[i], y: bottom + 5, style: { ...badge, text: xs[i].text, backgroundColor: col, align: "center", verticalAlign: "top" }, z: 20 },
          { type: "text", x: grid.x - 5, y: yAt[i], style: { ...badge, text: ys[i].text, backgroundColor: col, align: "right", verticalAlign: "middle" }, z: 20 },
        ];
      });
      const key = JSON.stringify(children);
      if (key === last && (present() || !children.length)) return;
      last = key;
      // Guides stay behind model labels; only the axis badges draw above the series.
      c.setOption({ graphic: [{ id: "guides", type: "group", silent: true, z: 3, children }] } as EChartsOption, { replaceMerge: ["graphic"] });
    };
    let frame = requestAnimationFrame(draw);
    const scheduleDraw = () => { cancelAnimationFrame(frame); frame = requestAnimationFrame(draw); };
    c.on("finished", scheduleDraw);
    return () => { cancelAnimationFrame(frame); c.off("finished", scheduleDraw); };
  }, [guides, labs, pal, formatX, chart, option]);
  // Where each dropped mark starts, measured from the laid-out chart. The least Pareto-optimal
  // (furthest below the frontier at its position) lets go first.
  const [fall, setFall] = useState<{ dots: FallingDot[]; width: number; height: number; floor: number; left: number; right: number; run: number } | null>(null);
  useEffect(() => {
    if (!fallen?.size) return;
    let second = 0;
    const first = requestAnimationFrame(() => { second = requestAnimationFrame(() => {
      const c = chart.current; if (!c) return;
      const grid = ((c as unknown as { getModel: () => unknown }).getModel() as { getComponent: (t: string, i: number) => { coordinateSystem?: { getRect: () => { x: number; y: number; width: number; height: number } } } | undefined }).getComponent("grid", 0)?.coordinateSystem?.getRect();
      if (!grid) return;
      const colorOf = new Map(labs.map((l) => [l.id, markColor(l.color, pal, l.id)]));
      const gap = (p: ScatterPoint) => Math.max(0, ...frontier.filter((f) => (better === "lower" ? f.x <= p.x : f.x >= p.x)).map((f) => f.r.score - p.r.score));
      const placed = pts.filter((p) => fallen.has(p.r.variant.id)).map((p) => ({ p, gap: gap(p), px: c.convertToPixel({ seriesId: "marks" }, [p.x, p.r.score]) as unknown as number[] | undefined }))
        .filter((d): d is { p: ScatterPoint; gap: number; px: number[] } => !!d.px && Number.isFinite(d.px[0]) && Number.isFinite(d.px[1])).sort((a, b) => b.gap - a.gap);
      const every = Math.min(45, 1800 / Math.max(1, placed.length));
      setFall((prev) => ({ dots: placed.map(({ p, px }, i) => ({ x: px[0], y: px[1], r: 4.5, color: colorOf.get(p.r.model.labId) ?? pal.ink, delay: 250 + i * every })), width: c.getWidth(), height: c.getHeight(), floor: grid.y + grid.height, left: grid.x, right: grid.x + grid.width, run: (prev?.run ?? 0) + 1 }));
    }); });
    return () => { cancelAnimationFrame(first); cancelAnimationFrame(second); };
  }, [fallen, pts, frontier, better, labs, pal, chart, plotW, plotH, scale]);
  const expand = useChartExpand(exportName);
  const onFrontierIds = useMemo(() => new Set(frontier.map((p) => p.r.variant.id)), [frontier]);
  const getHtml = () => {
    const color = new Map(labs.map((l) => [l.id, l.color])), labeled = pickLabels(pts, better, view.density), ys = pts.map((p) => p.r.score);
    const labelPriority = new Map([...labeled].map((id, i) => [id, i]));
    const items = highlight?.items ?? [], focusedModels = highlightedModels(items), featured = new Set(featuredPoints(pts, items).map((p) => p.r.variant.id));
    const guides = new Set(guidePoints(pts, highlight).map((p) => p.r.variant.id));
    const byModel = new Map<string, ScatterPoint[]>();
    for (const p of pts) (byModel.get(p.r.model.id) ?? byModel.set(p.r.model.id, []).get(p.r.model.id)!).push(p);
    return scatterHtml({
      title: exportName, xName, scale, unit: unitOf(formatX), highlight: items, guides: view.guides !== false, labelScale: labelScale(view.labelScale),
      yMin: Math.max(0, Math.floor((Math.min(...ys, 100) - 6) / 5) * 5), yMax: Math.min(100, Math.ceil((Math.max(...ys, 0) + 4) / 5) * 5),
      points: [...pts].sort((a, b) => (labelPriority.get(a.r.variant.id) ?? Infinity) - (labelPriority.get(b.r.variant.id) ?? Infinity)).map((p) => {
        const light = markColor(color.get(p.r.model.labId), LIGHT_PALETTE, p.r.model.labId), dark = markColor(color.get(p.r.model.labId), DARK_PALETTE, p.r.model.labId);
        return { v: [p.x, p.r.score], c: light, d: dark, dc: dimColor(light, LIGHT_PALETTE), dd: dimColor(dark, DARK_PALETTE),
          m: p.r.model.id, id: p.r.variant.id, e: p.r.variant.effort, h: focusedModels.has(p.r.model.id), a: featured.has(p.r.variant.id), g: guides.has(p.r.variant.id),
          gx: guides.has(p.r.variant.id) ? formatX(p.x) : undefined,
          n: chartLabel(p.r), s: labeled.has(p.r.variant.id), f: view.frontier && onFrontierIds.has(p.r.variant.id),
          t: `<b>${escapeHtml(p.r.variant.sourceModel?.name ?? chartLabel(p.r))}</b><div style="font-family:'JetBrains Mono',monospace;margin-top:4px">${p.r.score.toFixed(1)} · ${escapeHtml((formatValue ?? formatX)(p.raw ?? p.x))}${xUnit ? ` ${escapeHtml(xUnit)}` : ""}</div>` };
      }),
      frontier: view.frontier ? frontier.map((p) => [p.x, p.r.score]) : [],
      links: view.links ? [...byModel.values()].filter((v) => v.length > 1).map((v) => {
        const light = markColor(color.get(v[0].r.model.labId), LIGHT_PALETTE, v[0].r.model.labId), dark = markColor(color.get(v[0].r.model.labId), DARK_PALETTE, v[0].r.model.labId);
        return { m: v[0].r.model.id, h: focusedModels.has(v[0].r.model.id), c: light, d: dark, dc: dimColor(light, LIGHT_PALETTE), dd: dimColor(dark, DARK_PALETTE), p: [...v].sort((a, b) => a.x - b.x).map((p) => [p.x, p.r.score] as [number, number]) };
      }) : [],
    });
  };
  return (
    <>{expand.backdrop}<div ref={wrapRef} id={anchor} className={`max-sm:-mx-4 scroll-mt-20 ${expand.expanded ? "chart-expanded" : ""}`} role={expand.expanded ? "dialog" : undefined} aria-modal={expand.expanded || undefined} aria-label={expand.expanded ? exportName : undefined}>
      {/* Untitled charts (gallery panels) float their controls over the plot's empty top margin. */}
      <div className={`chart-toolbar flex flex-wrap items-center justify-between gap-x-4 gap-y-1 max-sm:px-4 min-h-8 ${title || expand.expanded ? "mb-1" : "-mb-8 relative z-10 pointer-events-none"}`}>
        <div className="min-w-0">{title ?? (expand.expanded && <h2 className="text-[22px]">{exportName}</h2>)}<HighlightList /></div>
        <div className="flex items-center gap-1 ml-auto pointer-events-auto">
          <HighlightMenu label={exportName} />
          {visibility.canUndo && <button type="button" className="cap hover:text-ink" onClick={visibility.undo} aria-label="Undo chart removal">Undo</button>}
          {actions}
          {anchor && <ChartLink id={anchor} name={exportName} params={{ ...effectiveLinkParams, hidden: visibility.hidden }} />}
          <ChartExport ref={exportControl} name={exportName} frame getHtml={getHtml} getSvg={() => chart.current?.renderToSVGString()} getRows={() => pts.map((p) => ({ rank: p.r.rank, model: p.r.model.name, effort: p.r.variant.effort, score: +p.r.score.toFixed(2), lab: p.r.model.labId, [xName]: +(p.raw ?? p.x).toFixed(4), on_frontier: onFrontierIds.has(p.r.variant.id), ...extraRows?.(p) }))} />
          {expand.button}
        </div>
      </div>
      <div className={`relative ${expand.expanded ? "flex-1 min-h-0" : ""}`}>
        <div ref={ref} role="img" aria-label={aria} tabIndex={0} onContextMenu={context.onContextMenu} onKeyDown={context.onKeyDown} style={{ width: "100%", height: expand.expanded ? "100%" : height, overflow: "hidden", position: "relative", isolation: "isolate" }} />
        {fall && !!fallen?.size && <GravityLayer key={fall.run} dots={fall.dots} width={fall.width} height={fall.height} floor={fall.floor} left={fall.left} right={fall.right} stroke={pal.bg} />}
        {!pts.length && <p className="cap absolute inset-0 grid place-items-center">No model in this view has this metric.</p>}
      </div>
      <ChartContextMenu exportControl={exportControl} state={context.menu} close={context.close} name={exportName} points={pts} visibility={visibility} chart={chart} wrap={wrapRef} expanded={expand.expanded} anchor={anchor} />
    </div></>
  );
}
