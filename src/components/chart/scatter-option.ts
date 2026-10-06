import type { EChartsOption } from "echarts";
import type { Lab } from "../../data/types";
import type { RankedVariant } from "../../engine";
import { CONTAIN_AXIS_LABELS, dimColor, markColor, markLabel, type ChartPalette } from "./theme";
import { scatterLabelLayout } from "./scatter-label-layout";
import { chartLabel } from "../../lib/metrics";
import { labelScale } from "./label-size";

export interface ScatterPoint { x: number; r: RankedVariant; /** untransformed value for tooltips/export when x is transformed */ raw?: number }
export interface ScatterView { labelScale?: number; scale?: "log" | "linear"; density: number; frontier: boolean; links: boolean; /** The user explicitly toggled the frontier rather than saving an old default. */ frontierChosen?: boolean; /** Dashed axis guides for highlighted efforts (default on). */ guides?: boolean; kind?: "scatter" | "bars"; /** The user picked `kind` (vs. the chart default). */ kindChosen?: boolean }
/**
 * Emphasis for chosen models. `items` are model ids (feature that model's best effort) or variant ids
 * (feature exactly that effort); a model may have several featured efforts. Everything else recedes
 * (desaturated, faint, unlabeled); chosen models keep full color, featured efforts carry name labels
 * (other efforts get effort tags) and — with `guides` — dashed lines to both axes with value badges.
 */
export interface Highlight { items: string[]; guides: boolean }
/** The featured marks: one per item (a variant id, or a model's best effort), in item order. */
export function featuredPoints(pts: ScatterPoint[], items: string[]): ScatterPoint[] {
  const out: ScatterPoint[] = [], seen = new Set<string>();
  for (const it of items) {
    const p = it.includes("@") ? pts.find((x) => x.r.variant.id === it || x.r.variant.aliases?.includes(it)) : pts.filter((x) => x.r.model.id === it).sort((a, b) => b.r.score - a.r.score)[0];
    if (p && !seen.has(p.r.variant.id)) { seen.add(p.r.variant.id); out.push(p); }
  }
  return out;
}
/** Models touched by a highlight (a variant item highlights its whole model). */
export const highlightedModels = (items: string[]) => new Set(items.map((it) => it.split("@")[0]));
export const DEFAULT_VIEW: ScatterView = { density: 0.45, frontier: true, links: true, kind: "scatter" };

/** Preserve explicit choices while letting a changed chart default replace old implicit saves. */
export function restoreScatterView(kind: "bars" | "scatter" = "scatter", frontier = true, saved?: ScatterView | null): ScatterView {
  return {
    ...DEFAULT_VIEW, ...saved,
    labelScale: saved?.labelScale == null ? undefined : labelScale(saved.labelScale),
    scale: saved?.scale === "log" || saved?.scale === "linear" ? saved.scale : undefined,
    kind: saved?.kindChosen || saved?.kind === "bars" ? saved.kind : kind,
    frontier: !frontier && !saved?.frontierChosen ? false : saved?.frontier ?? frontier,
  };
}

/**
 * Stable label priority: cover models before repeating dominated efforts. Extra frontier efforts
 * compete with new models near the frontier, but precede models far below it. There is no gap cutoff:
 * increasing density eventually covers weak models too, without waiting for the All setting.
 * Set insertion order is priority order, also used when resolving label collisions.
 */
export function pickLabels(pts: ScatterPoint[], better: "lower" | "higher", density: number): Set<string> {
  if (!pts.length) return new Set();
  const ys = pts.map((p) => p.r.score), range = Math.max(1, Math.max(...ys) - Math.min(...ys));
  const sorted = [...pts].sort((a, b) => better === "lower" ? a.x - b.x : b.x - a.x);
  let run = -Infinity; const level = new Map<string, number>();
  for (let i = 0; i < sorted.length;) {
    let end = i + 1;
    while (end < sorted.length && sorted[end].x === sorted[i].x) end++;
    run = Math.max(run, ...sorted.slice(i, end).map(p => p.r.score));
    for (; i < end; i++) level.set(sorted[i].r.variant.id, run);
  }
  const gap = (p: ScatterPoint) => (level.get(p.r.variant.id)! - p.r.score) / range;
  const front = new Set(frontierOf(pts, better).map(p => p.r.variant.id));
  const order = [...pts].sort((a, b) => Number(front.has(b.r.variant.id)) - Number(front.has(a.r.variant.id)) || gap(a) - gap(b) || b.r.score - a.r.score || a.r.variant.id.localeCompare(b.r.variant.id));
  const models = new Set<string>(), frontierEfforts = new Map<string, number>(), priorities = new Map<string, number>();
  for (const p of order) {
    const id = p.r.variant.id, model = p.r.model.id, repeated = models.has(model);
    const effort = frontierEfforts.get(model) ?? 0;
    priorities.set(id, !repeated ? gap(p) : front.has(id) ? 0.12 + effort * 0.04 : 1 + gap(p));
    if (front.has(id)) frontierEfforts.set(model, effort + 1);
    models.add(model);
  }
  order.sort((a, b) => priorities.get(a.r.variant.id)! - priorities.get(b.r.variant.id)! || b.r.score - a.r.score || a.r.variant.id.localeCompare(b.r.variant.id));
  const sparse = new Set(pts.filter(p => front.has(p.r.variant.id)).map(p => p.r.model.id)).size;
  const d = Math.max(0, Math.min(1, density));
  const budget = Math.round(sparse + d * d * (pts.length - sparse));
  return new Set(order.slice(0, budget).map(p => p.r.variant.id));
}

/** The marks that get axis guide lines (when the chart's guides setting is on). */
export function guidePoints(pts: ScatterPoint[], highlight?: Highlight): ScatterPoint[] {
  return highlight?.guides && highlight.items.length ? featuredPoints(pts, highlight.items).slice(0, 8) : [];
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
 * The ECharts option behind ScoreScatter — shared verbatim by the browser chart and the
 * server-side share-card rasterizer. `hasTitle` mirrors the page's title row (gallery
 * panels are untitled and float their controls over the plot's empty top margin).
 */
export function scatterOption({ pts, labs, better, xName, xShort, xUnit = "", scale = "linear", formatX, formatValue, view, pal, narrow, hasTitle = false, tooltipExtra, width, height, highlight }: {
  pts: ScatterPoint[]; labs: Lab[]; better: "lower" | "higher"; xName: string; xShort?: string; xUnit?: string;
  scale?: "linear" | "log" | "time"; formatX: (x: number) => string; formatValue?: (x: number) => string;
  view: ScatterView; pal: ChartPalette; narrow: boolean; hasTitle?: boolean; tooltipExtra?: (p: ScatterPoint) => string;
  /** Canvas width at layout time, so point labels near the right edge flip inward instead of clipping. */
  width?: () => number | undefined;
  height?: () => number | undefined;
  highlight?: Highlight;
}): EChartsOption {
  const frontier = frontierOf(pts, better);
  const fontScale = labelScale(view.labelScale);
  const color = new Map(labs.map((l) => [l.id, markColor(l.color, pal, l.id)]));
  const onFrontier = new Set(frontier.map((p) => p.r.variant.id));
  const labeled = pickLabels(pts, better, narrow ? view.density ** 2 : view.density);
  const byModel = new Map<string, ScatterPoint[]>();
  for (const p of pts) (byModel.get(p.r.model.id) ?? byModel.set(p.r.model.id, []).get(p.r.model.id)!).push(p);
  const links = view.links ? [...byModel.values()].filter((v) => v.length > 1).map((v) => [...v].sort((a, b) => a.x - b.x)) : [];
  const ys = pts.map((p) => p.r.score);
  const yMin = Math.max(0, Math.floor((Math.min(...ys, 100) - 6) / 5) * 5), yMax = Math.min(100, Math.ceil((Math.max(...ys, 0) + 4) / 5) * 5);
  // ECharts resolves equal-sized overlapping labels in data order. Give the chosen labels their
  // selection priority so a repeat effort cannot hide a model's only label.
  const priority = new Map([...labeled].map((id, i) => [id, i]));
  const ordered = [...pts].sort((a, b) => (priority.get(a.r.variant.id) ?? Infinity) - (priority.get(b.r.variant.id) ?? Infinity));
  const hl = highlightedModels(highlight?.items ?? []), on = hl.size > 0;
  const featured = new Set(featuredPoints(pts, highlight?.items ?? []).map((p) => p.r.variant.id));
  const markOf = (p: ScatterPoint) => {
    const id = p.r.variant.id, c = color.get(p.r.model.labId), front = view.frontier && onFrontier.has(id);
    if (!on) { const show = labeled.has(id); return { itemStyle: { color: c, borderColor: front ? pal.ink : pal.bg, borderWidth: 1.5, opacity: show || front ? 1 : 0.8 }, symbolSize: front ? 11 : 9, label: { show } }; }
    if (!hl.has(p.r.model.id)) return { itemStyle: { color: dimColor(c, pal), borderColor: pal.bg, borderWidth: 1, opacity: pal.dark ? 0.55 : 0.6 }, symbolSize: 7, label: { show: false }, emphasis: { label: { show: true } } };
    const isBest = featured.has(p.r.variant.id);
    const label = isBest
      ? { show: true, fontWeight: 600, color: pal.ink }
      : { show: p.r.variant.effort !== "default", formatter: p.r.variant.effort.toUpperCase(), fontSize: 9 * fontScale, color: pal.grey, backgroundColor: "transparent", textBorderColor: pal.bg, textBorderWidth: 3, distance: 5 };
    return { itemStyle: { color: c, borderColor: pal.ink, borderWidth: isBest ? 1.8 : 1.2, opacity: 1 }, symbolSize: isBest ? 12 : 9, label, z: 10 };
  };
  // Chosen marks draw last so they sit on top and win label overlap.
  const drawOrder = on ? [...ordered].sort((a, b) => Number(hl.has(a.r.model.id)) - Number(hl.has(b.r.model.id))) : ordered;
  const marks = drawOrder.map((p) => ({ name: chartLabel(p.r), value: [p.x, p.r.score], id: p.r.variant.id, extra: p, ...markOf(p) }));
  const series: EChartsOption["series"] = [
    ...links.map((v) => { const mine = hl.has(v[0].r.model.id), c = color.get(v[0].r.model.labId); return { type: "line" as const, id: `link-${v[0].r.model.id}`, data: v.map((p) => ({ id: p.r.variant.id, value: [p.x, p.r.score] })), showSymbol: false, lineStyle: { color: on && !mine ? dimColor(c, pal) : c, width: mine ? 2 : 1, opacity: mine ? 1 : on ? 0.25 : pal.dark ? 0.45 : 0.35 }, silent: true, animationDuration: 500, z: mine ? 4 : 1 }; }),
    ...(view.frontier && frontier.length > 1 ? [{ type: "line" as const, id: "frontier", data: frontier.map((p) => ({ id: p.r.variant.id, value: [p.x, p.r.score] })), showSymbol: false, lineStyle: { color: pal.ink, width: 1.4, opacity: on ? 0.3 : 1 }, silent: true, animationDuration: 500, z: 2 }] : []),
    {
      // Keep marks and their label backgrounds above highlighted effort links (z: 4).
      type: "scatter", id: "marks", z: 5,
      data: marks,
      label: { ...markLabel(pal), fontSize: (narrow ? 10.5 : 11.5) * fontScale },
      labelLayout: scatterLabelLayout(width ?? (() => undefined), height ?? (() => undefined), marks.map(p => p.label.show)),
      emphasis: { scale: 1.4, label: { show: true, fontWeight: 600 } },
      clip: true, universalTransition: { enabled: false },
      animationDurationUpdate: 350, animationEasingUpdate: "cubicOut",
    },
  ];
  const name = narrow && xShort ? xShort : xName;
  return {
    animation: true,
    grid: { ...(narrow ? { left: 38, right: 12, top: hasTitle ? 24 : 48, bottom: 40 } : { left: 48, right: 130, top: hasTitle ? 24 : 48, bottom: 44 }), ...CONTAIN_AXIS_LABELS },
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
        return `<div style="font-weight:600">${escapeHtml(d.r.variant.sourceModel?.name ?? chartLabel(d.r))}</div><div style="color:${pal.grey};font-size:11px">${escapeHtml(lab)}${view.frontier && onFrontier.has(d.r.variant.id) ? " · on the frontier" : ""}</div><div style="font-family:var(--font-jetbrains);margin-top:4px">${d.r.score.toFixed(1)} · ${escapeHtml((formatValue ?? formatX)(d.raw ?? d.x))}${xUnit ? ` ${xUnit}` : ""}${tooltipExtra ? escapeHtml(tooltipExtra(d)) : ""}</div>`;
      },
    },
    series,
  };
}
