"use client";
import { useScoreAxis } from "./score-axis";
import { ChartExport, type ExportRow, type ChartExportHandle } from "./ChartExport";
import { decodeEditor, encodeEditor, type EditorState } from "@/lib/export-editor";
import { chartLinkUrl } from "@/lib/highlight-link";
import type { ECharts, EChartsOption } from "echarts";
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
import { dimColor, type ChartPalette } from "./theme";
import { IconX } from "@tabler/icons-react";
import { labelScale } from "./label-size";
import { ChartContextMenu, useChartContextMenu, useChartVisibility } from "./ChartContextMenu";
import { useGravity } from "@/lib/konami";
import { FORMULA_MAX } from "@/lib/formula";
import { focusPoints } from "@/lib/chart-focus";
import type { FallingDot } from "./GravityLayer";

const GravityLayer = dynamic(() => import("./GravityLayer"), { ssr: false });
const ExportEditor = dynamic(() => import("./ExportEditor"), { ssr: false });

export { chartLabel };
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
  const out: OwnerView = { kind: v.kind, scale: v.scale, frontier: v.frontier, links: v.links, guides: v.guides, density: v.density, labelScale: v.labelScale, formula: v.formula?.trim().slice(0, FORMULA_MAX) || undefined, formulaBetter: v.formula?.trim() ? v.formulaBetter : undefined, allModels: v.allModels || undefined, ...(mode ? { mode } : {}) };
  for (const k of Object.keys(out) as (keyof OwnerView)[]) if (out[k] === undefined) delete out[k];
  return out;
}
export type OwnerView = { kind?: "scatter" | "bars"; mode?: "all" | "best"; scale?: "log" | "linear"; frontier?: boolean; links?: boolean; guides?: boolean; density?: number; labelScale?: number; formula?: string; formulaBetter?: "higher" | "lower"; allModels?: boolean };

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
/** The selected point's details, pinned to the chart's lower right so it never covers the marks it describes. */
function PointCard({ point, labs, pal, onFrontier, format, unit, extra, onClose }: { point: ScatterPoint; labs: Lab[]; pal: ChartPalette; onFrontier: boolean; format: (v: number) => string; unit: string; extra?: string; onClose?: () => void }) {
  const axis = useScoreAxis();
  const lab = labs.find((l) => l.id === point.r.model.labId)?.name ?? point.r.model.labId;
  return <div role="status" aria-label="Selected model" className="absolute right-3 bottom-12 z-10 w-[min(250px,calc(100%-24px))] rounded-[4px] border px-3 py-2.5 text-[12px] leading-[1.45] pointer-events-none" style={{ background: pal.tipBg, borderColor: pal.tipBorder, color: pal.ink }}>
    <div className="flex items-start justify-between gap-2"><div className="font-semibold">{point.r.variant.sourceModel?.name ?? chartLabel(point.r)}</div>{onClose && <button type="button" aria-label="Close selection" className="pointer-events-auto -mr-1 -mt-0.5 p-0.5" style={{ color: pal.grey }} onClick={onClose}><IconX size={13} aria-hidden="true" /></button>}</div>
    <div style={{ color: pal.grey, fontSize: 11 }}>{lab}{onFrontier ? " · on the frontier" : ""}</div>
    <div className="mt-1.5 font-mono">{axis.format(point.r.score)} · {format(point.raw ?? point.x)}{unit ? ` ${unit}` : ""}{extra}</div>
  </div>;
}

type ScatterProps = {
  pts: ScatterPoint[]; labs: Lab[]; better: "lower" | "higher"; xName: string; xShort?: string; xUnit?: string;
  scale?: "linear" | "log" | "time"; formatX: (x: number) => string; formatValue?: (x: number) => string;
  height?: number; aria: string; title?: ReactNode; actions?: ReactNode; view: ScatterView; exportName: string;
  extraRows?: (p: ScatterPoint) => ExportRow; tooltipExtra?: (p: ScatterPoint) => string; anchor?: string; linkParams?: ChartLinkParams;
  /** The screenshot editor's own copy: the plot only, no toolbar or link, sized by its container. */ bare?: boolean; chartRef?: { current: ECharts | null };
};

export function ScoreScatter(props: ScatterProps) {
  const axis = useScoreAxis();
  const { pts: chartPoints, labs, better, xName: baseXName, xShort: baseXShort, xUnit = "", scale: defaultScale = "linear", formatX, formatValue, height = 420, aria, title, actions, view, exportName, extraRows, tooltipExtra, anchor, linkParams, bare, chartRef } = props;
  const scale = defaultScale === "time" ? "time" : view.scale ?? defaultScale;
  const xName = scale === "linear" ? baseXName.replace(/, log| \(log\)/g, "") : baseXName;
  const xShort = scale === "linear" ? baseXShort?.replace(/, log| \(log\)/g, "") : baseXShort;
  const wrapRef = useRef<HTMLDivElement>(null);
  const [plotW, setPlotW] = useState(0), [plotH, setPlotH] = useState(height);
  // Before anyone picks models, a Pareto chart shows its frontier and the current flagships only (src/lib/chart-focus.ts); "All models" in its settings shows the rest.
  const hl = useHighlight();
  const trimmed = defaultScale !== "time" && !view.allModels && !hl?.curated;
  const keepKey = (hl?.items ?? []).join(",");
  const allPoints = useMemo(() => trimmed ? focusPoints(chartPoints, better, keepKey ? keepKey.split(",") : []) : chartPoints, [trimmed, chartPoints, better, keepKey]);
  const trimmedModels = trimmed ? new Set(chartPoints.map((p) => p.r.model.id)).size - new Set(allPoints.map((p) => p.r.model.id)).size : 0;
  const effectiveLinkParams = { ...linkParams, ls: Math.round(labelScale(view.labelScale) * 100), extra: { ...linkParams?.extra, cf: view.allModels ? "all" : undefined, xs: plotW > 0 ? `${plotW}x${Math.round(plotH)}` : undefined } };
  const visibility = useChartVisibility(allPoints, anchor ?? exportName, effectiveLinkParams), pts = visibility.points;
  const context = useChartContextMenu();
  const exportControl = useRef<ChartExportHandle>(null);
  const contextPick = useRef(context.pointMenu);
  useEffect(() => { contextPick.current = context.pointMenu; });
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
  // Where the marks are drawn, so labels can steer around them. Set once the chart exists; the next layout pass uses it.
  const handle = useRef<ECharts | null>(null);
  const dots = useCallback(() => {
    const c = handle.current; if (!c) return undefined;
    try { return pts.map((p) => { const [x, y] = c.convertToPixel({ xAxisIndex: 0, yAxisIndex: 0 }, [p.x, p.r.score]) as number[]; return { x, y }; }); } catch { return undefined; }
  }, [pts]);
  const hlItems = hl?.items;
  const highlight = useMemo<Highlight | undefined>(() => hlItems?.length ? { items: hlItems, guides: view.guides !== false } : undefined, [hlItems, view.guides]);
  // Easter egg (Konami code): marks off the frontier drop to the x-axis. See GravityLayer.
  const gravity = useGravity() && !!view.frontier;
  const fallen = useMemo(() => { if (!gravity) return undefined; const on = new Set(frontier.map((p) => p.r.variant.id)); return new Set(pts.filter((p) => !on.has(p.r.variant.id)).map((p) => p.r.variant.id)); }, [gravity, pts, frontier]);
  // Where each label landed after the layout ran, so draw() can join a label that was nudged off its dot back to it.
  const labelAt = useRef(new Map<string, { x: number; y: number; align: "left" | "right" }>());
  const onLabel = useCallback((id: string, at: { x: number; y: number; align: "left" | "right" } | null) => { if (at) labelAt.current.set(id, at); else labelAt.current.delete(id); }, []);
  // `dots` only reads the chart handle later, when ECharts runs the label layout (never while this renders).
  // eslint-disable-next-line react-hooks/refs
  const option = useMemo<EChartsOption>(() => scatterOption({ axis, pts, labs, better, xName, xShort, xUnit, scale, formatX, formatValue, view, pal, narrow, hasTitle: !!title, tooltipExtra, width: plotWidth, height: plotHeight, dots, onLabel, highlight, fallen }),
    [axis, pts, labs, better, view, narrow, xName, xShort, xUnit, scale, formatX, formatValue, tooltipExtra, title, pal, plotWidth, plotHeight, dots, onLabel, highlight, fallen]);
  const [hover, setHover] = useState<ScatterPoint | null>(null), [pinned, setPinned] = useState<ScatterPoint | null>(null);
  // Clicking a mark toggles that exact effort's highlight (several efforts per model are allowed).
  const pick = useRef<(p: ScatterPoint) => void>(() => {});
  useEffect(() => { pick.current = (p) => { setPinned((cur) => (cur?.r.variant.id === p.r.variant.id ? null : p)); if (hl) hl.set(togglePoint(hl.items, pts, p)); }; }, [hl, pts]);
  // Rebuild series so mark traversal follows the new label priority after slider/filter changes.
  // Merge mode retains the previous graphic order even when the data array is reordered.
  const { ref, chart } = useEChart(option, [option], (c) => {
    handle.current = c;
    c.on("click", (e) => { const d = (e.data as { extra?: ScatterPoint } | undefined)?.extra; if (d) pick.current(d); });
    c.on("mouseover", (e) => { const d = (e.data as { extra?: ScatterPoint } | undefined)?.extra; if (d) setHover(d); });
    c.on("mouseout", () => setHover(null));
    c.getZr().on("click", (e) => { if (!e.target) setPinned(null); });
    c.on("contextmenu", (e) => {
      const d = (e.data as { extra?: ScatterPoint } | undefined)?.extra;
      const event = e.event?.event as MouseEvent | undefined;
      if (d && event) { event.preventDefault(); event.stopPropagation(); contextPick.current(d, event.clientX, event.clientY); }
    });
  }, true);

  useEffect(() => { if (chartRef) chartRef.current = chart.current; });
  // The screenshot editor opens from the toolbar, or from a link (`xe` on this chart's own `c=`), and closing it leaves the page as it was.
  const [editor, setEditor] = useState<(EditorState & { viewOnly?: boolean }) | null>(null);
  useEffect(() => {
    if (bare || !anchor) return;
    const raf = requestAnimationFrame(() => {
      const url = new URL(window.location.href);
      const state = url.searchParams.get("c") === anchor ? decodeEditor(url.searchParams.get("xe")) : null;
      if (state) setEditor({ ...state, viewOnly: true });
    });
    return () => cancelAnimationFrame(raf);
  }, [bare, anchor]);
  const openEditor = () => setEditor({ w: Math.round(wrapRef.current?.getBoundingClientRect().width ?? 960), h: Math.round(Math.max(height * (pal.size?.height ?? 1), 320)), view: {} });
  const closeEditor = () => {
    setEditor(null);
    const url = new URL(window.location.href);
    if (url.searchParams.has("xe")) { url.searchParams.delete("xe"); window.history.replaceState(null, "", url.toString()); }
  };

  // A long press on a touch screen sends a plain contextmenu event to the wrapper, which ECharts never matches to a mark,
  // so find the dot under (or near, for a fingertip) the press ourselves and open its menu instead of the chart's.
  const onContextMenu = (event: React.MouseEvent) => {
    const c = chart.current, box = event.currentTarget.getBoundingClientRect();
    if (c) {
      const x = event.clientX - box.left, y = event.clientY - box.top;
      let best: ScatterPoint | undefined, bestD = 22;
      for (const p of pts) {
        let px: number[]; try { px = c.convertToPixel({ xAxisIndex: 0, yAxisIndex: 0 }, [p.x, p.r.score]) as number[]; } catch { continue; }
        const d = Math.hypot(px[0] - x, px[1] - y);
        if (Number.isFinite(d) && d < bestD) { best = p; bestD = d; }
      }
      if (best) { event.preventDefault(); contextPick.current(best, event.clientX, event.clientY); return; }
    }
    context.onContextMenu(event);
  };

  // Guide lines for highlighted models, drawn in pixel space so they stop exactly at the axes on every
  // scale (log, linear, time) and carry value badges on the axes. Part of the SVG, so exports include them.
  // The point under the cursor, or the one a click pinned (a tap on touch screens), is drawn with crosshair guides and described in a corner card.
  const focus = useMemo(() => {
    const pick = hover ?? pinned;
    return pick ? pts.find((p) => p.r.variant.id === pick.r.variant.id) ?? null : null;
  }, [hover, pinned, pts]);
  const guides = useMemo(() => {
    const base = guidePoints(pts, highlight);
    return focus && !base.some((p) => p.r.variant.id === focus.r.variant.id) ? [...base, focus] : base;
  }, [pts, highlight, focus]);
  useEffect(() => {
    const c = chart.current; if (!c) return;
    const colorOf = new Map(labs.map((l) => [l.id, markColor(l.color, pal, l.id)]));
    const present = () => ((c.getOption().graphic as { elements?: { id?: string }[] }[] | undefined) ?? []).some((g) => g.elements?.some((e) => e.id === "guides"));
    let last = "";
    const draw = () => {
      const grid = ((c as unknown as { getModel: () => unknown }).getModel() as { getComponent: (t: string, i: number) => { coordinateSystem?: { getRect: () => { x: number; y: number; width: number; height: number } } } | undefined }).getComponent("grid", 0)?.coordinateSystem?.getRect();
      if (!grid) return;
      const bottom = grid.y + grid.height, on = pal.dark ? "#141413" : "#FFFFFF";
      const badge = { fontSize: 10.5 * (pal.size?.text ?? 1), fontFamily: "JetBrains Mono, Menlo, monospace", fill: on, padding: [2, 4], borderRadius: 2 };
      // Badges that would collide slide apart along their axis (never off the canvas): x badges stay in
      // one row under the axis, y badges in one column left of it, each still tinted like its line.
      const placed = guides.map((p) => ({ p, px: c.convertToPixel({ seriesId: "marks" }, [p.x, p.r.score]) as unknown as number[] | undefined })).filter((g): g is { p: ScatterPoint; px: number[] } => !!g.px && Number.isFinite(g.px[0]) && Number.isFinite(g.px[1]));
      const W = c.getWidth();
      const xs = placed.map(({ p, px }) => { const text = formatX(p.x); return { text, at: px[0], size: text.length * 6.6 + 10 }; });
      const ys = placed.map(({ p, px }) => ({ text: axis.format(p.r.score), at: px[1], size: 16 }));
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
      // A thin leader from each label that sits away from its own dot, so a crowded label still says which point it names.
      const byId = new Map(pts.map((p) => [p.r.variant.id, p]));
      const leaders = [...labelAt.current].flatMap(([id, at]) => {
        const p = byId.get(id); if (!p || fallen?.has(id)) return [];
        const px = c.convertToPixel({ seriesId: "marks" }, [p.x, p.r.score]) as unknown as number[] | undefined;
        if (!px || !Number.isFinite(px[0]) || !Number.isFinite(px[1]) || Math.hypot(at.x - px[0], at.y - px[1]) < 15) return [];
        return [{ type: "line", shape: { x1: Math.round(px[0]), y1: Math.round(px[1]), x2: Math.round(at.x + (at.align === "left" ? -3 : 3)), y2: Math.round(at.y) }, style: { stroke: pal.grey, lineWidth: 0.8, opacity: 0.7 }, z: 3, silent: true }];
      });
      const key = JSON.stringify([...children, ...leaders]);
      if (key === last && (present() || !children.length)) return;
      last = key;
      // `$action: replace` matters: a merge pairs children by index, so a shorter list leaves the old dashed lines behind.
      // Guides stay behind model labels; only the axis badges draw above the series.
      c.setOption({ graphic: [{ id: "guides", $action: "replace", type: "group", silent: true, z: 3, children: [...children, ...leaders] }] } as EChartsOption, { replaceMerge: ["graphic"] });
    };
    let frame = requestAnimationFrame(draw);
    const scheduleDraw = () => { cancelAnimationFrame(frame); frame = requestAnimationFrame(draw); };
    c.on("finished", scheduleDraw);
    return () => { cancelAnimationFrame(frame); c.off("finished", scheduleDraw); };
  }, [axis, guides, labs, pal, formatX, chart, option, pts, fallen]);
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
          t: `<b>${escapeHtml(p.r.variant.sourceModel?.name ?? chartLabel(p.r))}</b><div style="font-family:'JetBrains Mono',monospace;margin-top:4px">${escapeHtml(axis.format(p.r.score))} · ${escapeHtml((formatValue ?? formatX)(p.raw ?? p.x))}${xUnit ? ` ${escapeHtml(xUnit)}` : ""}</div>` };
      }),
      frontier: view.frontier ? frontier.map((p) => [p.x, p.r.score]) : [],
      links: view.links ? [...byModel.values()].filter((v) => v.length > 1).map((v) => {
        const light = markColor(color.get(v[0].r.model.labId), LIGHT_PALETTE, v[0].r.model.labId), dark = markColor(color.get(v[0].r.model.labId), DARK_PALETTE, v[0].r.model.labId);
        return { m: v[0].r.model.id, h: focusedModels.has(v[0].r.model.id), c: light, d: dark, dc: dimColor(light, LIGHT_PALETTE), dd: dimColor(dark, DARK_PALETTE), p: [...v].sort((a, b) => a.x - b.x).map((p) => [p.x, p.r.score] as [number, number]) };
      }) : [],
    });
  };
  return (
    <>{expand.backdrop}<div ref={wrapRef} id={bare ? undefined : anchor} className={`${bare ? "" : "max-sm:-mx-4 "}scroll-mt-20 ${expand.expanded ? "chart-expanded" : ""}`} role={expand.expanded ? "dialog" : undefined} aria-modal={expand.expanded || undefined} aria-label={expand.expanded ? exportName : undefined}>
      {/* Untitled charts (gallery panels) float their controls over the plot's empty top margin. */}
      {!bare && <div className={`chart-toolbar flex flex-wrap items-center justify-between gap-x-4 gap-y-1 max-sm:px-4 min-h-8 ${title || expand.expanded ? "mb-1" : "-mb-8 relative z-10 pointer-events-none"}`}>
        <div className="min-w-0">{title ?? (expand.expanded && <h2 className="text-[22px]">{exportName}</h2>)}<HighlightList /></div>
        <div className="flex items-center gap-1 ml-auto pointer-events-auto">
          <HighlightMenu label={exportName} />
          {visibility.canUndo && <button type="button" className="cap hover:text-ink" onClick={visibility.undo} aria-label="Undo chart removal">Undo</button>}
          {trimmedModels > 0 && <span className="cap max-sm:hidden" title="Older versions and models off the frontier are hidden. Show them with All models in this chart's settings.">{trimmedModels} more in settings</span>}
          {actions}
          {anchor && <ChartLink id={anchor} name={exportName} params={{ ...effectiveLinkParams, hidden: visibility.hidden }} />}
          <ChartExport ref={exportControl} name={exportName} frame onEdit={anchor ? openEditor : undefined} getHtml={getHtml} getSvg={() => chart.current?.renderToSVGString()} getRows={() => pts.map((p) => ({ rank: p.r.rank, model: p.r.model.name, effort: p.r.variant.effort, score: +p.r.score.toFixed(2), lab: p.r.model.labId, [xName]: +(p.raw ?? p.x).toFixed(4), on_frontier: onFrontierIds.has(p.r.variant.id), ...extraRows?.(p) }))} />
          {expand.button}
        </div>
      </div>}
      <div className={`relative ${expand.expanded ? "flex-1 min-h-0" : ""}`}>
        <div ref={ref} role="img" aria-label={aria} data-points={pts.map((p) => p.r.variant.id).sort().join(",")} tabIndex={0} onContextMenu={onContextMenu} onKeyDown={context.onKeyDown} style={{ width: "100%", height: expand.expanded ? "100%" : bare ? height : Math.round(height * (pal.size?.height ?? 1)), overflow: "hidden", position: "relative", isolation: "isolate" }} />
        {fall && !!fallen?.size && <GravityLayer key={fall.run} dots={fall.dots} width={fall.width} height={fall.height} floor={fall.floor} left={fall.left} right={fall.right} stroke={pal.bg} />}
        {!pts.length && <p className="cap absolute inset-0 grid place-items-center">No model in this view has this metric.</p>}
        {focus && <PointCard point={focus} labs={labs} pal={pal} onFrontier={view.frontier && onFrontierIds.has(focus.r.variant.id)} format={formatValue ?? formatX} unit={xUnit} extra={tooltipExtra?.(focus)} onClose={pinned && !hover ? () => setPinned(null) : undefined} />}
      </div>
      {!bare && <ChartContextMenu exportControl={exportControl} state={context.menu} close={context.close} name={exportName} points={pts} visibility={visibility} chart={chart} wrap={wrapRef} expanded={expand.expanded} anchor={anchor} />}
      {editor && <ExportEditor name={exportName} initial={editor} viewOnly={editor.viewOnly} defaultScale={defaultScale === "log" ? "log" : "linear"} base={view} showScale={defaultScale !== "time"} onClose={closeEditor}
        link={(xe) => chartLinkUrl(window.location.href, anchor ?? exportName, { ...effectiveLinkParams, hidden: visibility.hidden, extra: { ...effectiveLinkParams.extra, xe: encodeEditor(xe) } }, hl ?? undefined).toString()}
        plot={(v, h, ref) => <ScoreScatter {...props} bare view={v} height={h} chartRef={ref} />} />}
    </div></>
  );
}
