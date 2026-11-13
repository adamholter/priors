/**
 * Strengths radar, framework-free: settings ⇄ URL params, series building, and a self-contained SVG
 * string (inline colors and static fonts) shared by the PNG/SVG export, the HTML embed, `?c=strengths`
 * link previews and the "Radar" share card. The interactive chart is Radar.tsx.
 */
import { EFFORT_ORDER, type Effort, type Lab, type Snapshot } from "../../data/types";
import { computeIndex, selectVariants, type IndexConfig, type IndexResult, type RankedVariant } from "../../engine";
import { benchmarkBlurb } from "../../lib/benchmark-blurb";
import { categoryName, categoryOrder, normalizeCategory } from "../../data/categories";
import { radarLabels, textWidth } from "./radar-labels";
import { fillFromSiblings, formatValue, medianPoints, radarAxes, radarModels, ringLabels, zoomAxes, type RadarAxis, type RadarLayer, type RadarModel, type RadarNorm, type RadarPoint } from "./radar-data";

export interface RadarSeries { id: string; name: string; color: string; dash?: string; points: RadarPoint[]; layers?: RadarLayer[]; effort?: Effort }
/**
 * Which effort each model is drawn at. "best": its best-scoring effort (the index's pick). "layers": that best effort's outline,
 * with each of its other efforts as an unoutlined fill of the same color, so the shape darkens toward the center where low
 * efforts overlap. An effort: every model at that effort, models without it left out.
 */
export type RadarEffort = "best" | "layers" | Exclude<Effort, "default">;
export type RadarCompare = "leader" | "median";
export type RadarColors = "lab" | "distinct";
/** `models` is a user pick; undefined follows the live top 4. */
export type RadarView = "radar" | "bars";
/** What a spoke is: one benchmark, or every benchmark of a category rolled into one. */
export type RadarSpokes = "benchmarks" | "categories";
/** `spokes` undefined follows the index: benchmarks, or categories once there are too many benchmarks to read. */
export interface RadarSettings { norm: RadarNorm; compare: RadarCompare; colors: RadarColors; median: boolean; view: RadarView; models?: string[]; spokes?: RadarSpokes; effort?: RadarEffort }
/** Past this many benchmarks a radar is a hairball, so it draws one spoke per category unless told otherwise. */
export const RADAR_MAX_BENCHMARK_SPOKES = 12;
/** Id prefix of a category spoke, which stands for several benchmarks. */
export const CATEGORY_SPOKE = "cat:";
export const DEFAULT_RADAR: RadarSettings = { norm: "field", compare: "leader", colors: "lab", median: true, view: "radar" };
export const RADAR_TOP = 4;
/** Per-benchmark bar charts have room for more models than overlaid shapes do. */
export const BARS_TOP = 8;
export const RADAR_ANCHOR = "strengths";

export const RADAR_NORMS: { id: RadarNorm; label: string; hint: string }[] = [
  { id: "field", label: "Range", hint: "Each spoke runs from just below the lowest model shown to the best ranked model, so the models shown spread out. The field median appears only when it is inside that range." },
  { id: "rank", label: "Percentile", hint: "Each spoke is the model's percentile among ranked models." },
  { id: "score", label: "Raw", hint: "The index's 0–100 score per benchmark, unstretched." },
];
/** Validated categorical palette (dataviz reference) for the "one color per model" option. */
const DISTINCT = { light: ["#2a78d6", "#eb6834", "#1baf7a", "#eda100", "#e87ba4", "#008300", "#4a3aa7", "#e34948"], dark: ["#3987e5", "#d95926", "#199e70", "#c98500", "#d55181", "#008300", "#9085e9", "#e66767"] };
const DASHES = [undefined, "7 4", "2 3", "10 3 2 3"];
/** Each effort layer's fill. Layers stack, so where every effort reaches (the center) is darkest. Fainter when models overlap. */
export const LAYER_OPACITY = 0.09;
export const layerOpacity = (seriesCount: number) => seriesCount > 1 ? 0.045 : LAYER_OPACITY;

/* ---------------- URL params ---------------- */

/** Radar params carried by `?c=strengths` links: rm (models), rs (scale), rc (small radars vs), rk (colors), rmed=0 (no median), rv=bars (a bar chart per benchmark), rg (spokes: cat or bench), re (effort: layers or an effort). */
export const RADAR_PARAM_KEYS = ["rm", "rs", "rc", "rk", "rmed", "rv", "rg", "re"] as const;
const isRadarEffort = (v: string | null): v is RadarEffort => v === "layers" || (EFFORT_ORDER as string[]).includes(v ?? "");

export function readRadarParams(params: URLSearchParams): RadarSettings {
  const rs = params.get("rs"), rc = params.get("rc"), rk = params.get("rk"), rm = params.get("rm"), rg = params.get("rg");
  return {
    norm: RADAR_NORMS.some((n) => n.id === rs) ? rs as RadarNorm : DEFAULT_RADAR.norm,
    compare: rc === "median" ? "median" : "leader",
    colors: rk === "distinct" ? "distinct" : "lab",
    median: params.get("rmed") !== "0",
    view: params.get("rv") === "bars" ? "bars" : "radar",
    models: rm == null ? undefined : rm.split(",").filter(Boolean).slice(0, 12),
    ...(rg === "cat" ? { spokes: "categories" as const } : rg === "bench" ? { spokes: "benchmarks" as const } : {}),
    ...(isRadarEffort(params.get("re")) ? { effort: params.get("re") as RadarEffort } : {}),
  };
}

/** Only non-default values; undefined means "remove from the URL". */
export function radarParams(s: RadarSettings): Record<(typeof RADAR_PARAM_KEYS)[number], string | undefined> {
  return {
    rm: s.models ? s.models.join(",") : undefined,
    rs: s.norm !== DEFAULT_RADAR.norm ? s.norm : undefined,
    rc: s.compare !== DEFAULT_RADAR.compare ? s.compare : undefined,
    rk: s.colors !== DEFAULT_RADAR.colors ? s.colors : undefined,
    rmed: s.median ? undefined : "0",
    rv: s.view !== DEFAULT_RADAR.view ? s.view : undefined,
    rg: s.spokes === "categories" ? "cat" : s.spokes === "benchmarks" ? "bench" : undefined,
    re: s.effort && s.effort !== "best" ? s.effort : undefined,
  };
}

/* ---------------- data ---------------- */

/** Best variant per ranked model, gaps filled from the model's other source configurations. */
export function radarRows(snapshot: Snapshot, config: IndexConfig, ranked: RankedVariant[], benchmarks: IndexResult["benchmarks"]): RankedVariant[] {
  // Strictness 0 ranks every variant with any value, so other configurations of a ranked model can fill its gaps.
  const siblings = computeIndex(snapshot, { ...config, strictness: 0, required: [], variants: "all" }).ranked;
  return fillFromSiblings(selectVariants(ranked, "best"), siblings, benchmarks.map((b) => b.benchmark.id));
}

/**
 * The index's benchmarks rolled up by main category: one spoke per category, worth the sum of its
 * benchmarks' shares. A model's value there is the share-weighted mean of its 0-100 values on the
 * category's benchmarks it has (estimated if any of those is); with none it has no point.
 */
export function radarByCategory(rows: RankedVariant[], benchmarks: IndexResult["benchmarks"]): { rows: RankedVariant[]; benchmarks: IndexResult["benchmarks"] } {
  const groups = new Map<string, IndexResult["benchmarks"]>();
  for (const b of benchmarks) { const c = normalizeCategory(b.benchmark.category); groups.set(c, [...(groups.get(c) ?? []), b]); }
  const order = [...groups.keys()].sort((a, b) => categoryOrder(a) - categoryOrder(b));
  const list = (names: string[]) => names.length < 2 ? names.join("") : `${names.slice(0, -1).join(", ")} and ${names.at(-1)}`;
  const spokes: IndexResult["benchmarks"] = order.map((c) => {
    const members = groups.get(c)!, share = members.reduce((n, m) => n + m.share, 0);
    return { share, required: false, benchmark: { ...members[0].benchmark, id: `${CATEGORY_SPOKE}${c}`, name: categoryName(c), shortName: undefined, unit: "score" as const, higherIsBetter: true,
      description: `${members.length === 1 ? "One benchmark" : `${members.length} benchmarks`} of this index, weighted as the index weights ${members.length === 1 ? "it" : "them"}: ${list(members.map((m) => m.benchmark.shortName ?? m.benchmark.name))}.` } };
  });
  const grouped = rows.map((row) => {
    const mine = new Map(row.values.map((v) => [v.benchmarkId, v]));
    const values = order.flatMap((c) => {
      const have = groups.get(c)!.flatMap((m) => { const v = mine.get(m.benchmark.id); return v ? [{ v, share: m.share }] : []; });
      const weight = have.reduce((n, h) => n + h.share, 0);
      return have.length && weight > 0 ? [{ benchmarkId: `${CATEGORY_SPOKE}${c}`, value: have.reduce((n, h) => n + h.v.value * h.share, 0) / weight, estimated: have.some((h) => h.v.estimated) }] : [];
    });
    return { ...row, values };
  });
  return { rows: grouped, benchmarks: spokes };
}

/** The words for an effort in the radar's legend and menus. */
export const effortName = (e: Effort) => e === "xhigh" ? "xhigh" : e === "none" ? "no reasoning" : e;

/**
 * Rows for an effort setting other than "best". `best` is radarRows' output (one row per model, index order). For one effort,
 * each model's variant at it (the ranked one if the index ranks it, else the best-covered configuration), keeping the model's
 * index rank; a model with no run at that effort drops out. For "layers", the best rows stay and each model's other efforts
 * come back as layers, highest effort first. Gaps fill from the model's other configurations, as in radarRows.
 */
export function radarEffortRows(snapshot: Snapshot, config: IndexConfig, best: RankedVariant[], benchmarks: IndexResult["benchmarks"], effort: Exclude<RadarEffort, "best">): { rows: RankedVariant[]; layers: Map<string, RankedVariant[]>; efforts: Effort[] } {
  const all = computeIndex(snapshot, { ...config, variants: "all" }).ranked;
  const siblings = computeIndex(snapshot, { ...config, strictness: 0, required: [], variants: "all" }).ranked;
  const ids = benchmarks.map((b) => b.benchmark.id);
  const group = (list: RankedVariant[]) => { const m = new Map<string, RankedVariant[]>(); for (const r of list) m.set(r.model.id, [...(m.get(r.model.id) ?? []), r]); return m; };
  const ranked = group(all), loose = group(siblings);
  const at = (modelId: string, e: Effort) => ranked.get(modelId)?.filter((r) => r.variant.effort === e).sort((a, b) => b.score - a.score)[0]
    ?? loose.get(modelId)?.filter((r) => r.variant.effort === e).sort((a, b) => b.values.length - a.values.length)[0];
  const effortsOf = (modelId: string) => EFFORT_ORDER.filter((e) => [...(ranked.get(modelId) ?? []), ...(loose.get(modelId) ?? [])].some((r) => r.variant.effort === e));
  const efforts = EFFORT_ORDER.filter((e) => best.some((b) => effortsOf(b.model.id).includes(e)));
  const fill = (rows: RankedVariant[]) => fillFromSiblings(rows, siblings, ids);
  if (effort === "layers") {
    const layers = new Map<string, RankedVariant[]>();
    for (const b of best) {
      const others = effortsOf(b.model.id).filter((e) => e !== b.variant.effort).reverse().flatMap((e) => { const v = at(b.model.id, e); return v ? [v] : []; });
      if (others.length) layers.set(b.model.id, fill(others));
    }
    return { rows: best, layers, efforts };
  }
  // Ranked by score at this effort, so the rank beside each name matches its score and the top models are the top at this effort.
  const rows = best.flatMap((b) => { const v = at(b.model.id, effort); return v ? [{ ...v, model: { ...v.model, name: `${v.model.name} ${effortName(effort)}` } }] : []; })
    .sort((a, b) => b.score - a.score).map((r, i) => ({ ...r, rank: i + 1 }));
  return { rows: fill(rows), layers: new Map(), efforts };
}

/** The efforts any of these models has a variant at, lowest first: the effort picker's choices. */
export function radarEfforts(snapshot: Snapshot, rows: RankedVariant[]): Effort[] {
  const models = new Set(rows.map((r) => r.model.id)), have = new Set(snapshot.variants.filter((v) => models.has(v.modelId)).map((v) => v.effort));
  return EFFORT_ORDER.filter((e) => have.has(e));
}

/** Which spokes a radar of these benchmarks draws: the asked-for kind, else categories once benchmarks are too many. Categories need three to enclose an area. */
export function radarSpokes(benchmarks: IndexResult["benchmarks"], asked?: RadarSpokes): { spokes: RadarSpokes; canGroup: boolean } {
  const canGroup = new Set(benchmarks.map((b) => normalizeCategory(b.benchmark.category))).size >= 3;
  return { canGroup, spokes: canGroup && (asked ?? (benchmarks.length > RADAR_MAX_BENCHMARK_SPOKES ? "categories" : "benchmarks")) === "categories" ? "categories" : "benchmarks" };
}

/** `shown`: the models the chart draws. On the Range scale each spoke then starts just below the lowest of them. */
export function radarModelsFor(rows: RankedVariant[], benchmarks: IndexResult["benchmarks"], norm: RadarNorm, asked?: RadarSpokes, shown?: string[], layers?: Map<string, RankedVariant[]>) {
  const { spokes, canGroup } = radarSpokes(benchmarks, asked);
  const use = spokes === "categories" ? radarByCategory(rows, benchmarks) : { rows, benchmarks };
  const layerRows = new Map([...(layers ?? [])].map(([id, list]) => [id, spokes === "categories" ? radarByCategory(list, benchmarks).rows : list]));
  // On the Range scale the spokes start below the lowest effort drawn, so the inner layers stay on the chart.
  const layerAll = [...layerRows.values()].flat();
  const field = radarAxes(use.benchmarks, use.rows).map((a) => {
    const low = Math.min(a.min, ...layerAll.flatMap((r) => r.values.filter((v) => v.benchmarkId === a.id).map((v) => v.value)));
    return low < a.min ? { ...a, min: low } : a;
  });
  const axes = norm === "field" && shown?.length ? zoomAxes(field, [...use.rows, ...layerAll], shown) : field;
  const models = radarModels(use.rows, axes, norm).map((m, k) => {
    const list = layerRows.get(m.id);
    return list?.length ? { ...m, effort: use.rows[k].variant.effort, layers: radarModels(list, axes, norm, use.rows).map((l, i) => ({ effort: list[i].variant.effort, points: l.points })) } : m;
  });
  return { axes, models, median: medianPoints(use.rows, axes, norm), spokes, canGroup };
}

/**
 * Series in index-rank order. Lab colors repeat within a lab, so later same-lab models get dashes;
 * distinct colors use a stable slot per model (`slotOf`) so removing one never repaints the rest.
 */
export function radarSeries(models: RadarModel[], selected: string[], colors: RadarColors, dark: boolean, labColor: (labId: string) => string, slotOf: (id: string) => number = (id) => selected.indexOf(id)): RadarSeries[] {
  const seen = new Map<string, number>();
  return models.filter((m) => selected.includes(m.id)).map((m) => {
    if (colors === "distinct") return { id: m.id, name: m.name, points: m.points, layers: m.layers, effort: m.effort, color: (dark ? DISTINCT.dark : DISTINCT.light)[Math.max(0, slotOf(m.id)) % 8] };
    const n = seen.get(m.labId) ?? 0; seen.set(m.labId, n + 1);
    return { id: m.id, name: m.name, points: m.points, layers: m.layers, effort: m.effort, color: labColor(m.labId), dash: DASHES[n % DASHES.length] };
  });
}

export function selectedModels(models: { id: string }[], picked?: string[]) {
  const known = new Set(models.map((m) => m.id));
  return picked ? picked.filter((id) => known.has(id)) : models.slice(0, RADAR_TOP).map((m) => m.id);
}

/* ---------------- static SVG ---------------- */

export interface RadarSvgPalette { bg: string; ink: string; ink2: string; grey: string; hair: string; ring: string; ghost: string }
export const SANS = "Inter, system-ui, sans-serif", MONO = "'JetBrains Mono', Menlo, monospace";
const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" }[c]!));
const r1 = (n: number) => +n.toFixed(1);
const trim = (s: string, n: number) => s.length > n ? `${s.slice(0, n - 1)}…` : s;
const spokeAngle = (i: number, n: number) => (i / n) * Math.PI * 2 - Math.PI / 2;

/**
 * Overlaid radar with a legend on the right. `meta` adds rank/score under each legend name.
 * Every value point carries a <title> so the HTML embed gets native hover tooltips; a benchmark
 * name's title also says what it measures. Names wrap in full, and the canvas and the legend are
 * placed from the labels' measured extent, so a long name can neither clip nor run under the legend.
 */
export function radarSvg({ axes, series, ghost, norm, pal, size = 400, meta, legend = true }: {
  axes: RadarAxis[]; series: RadarSeries[]; ghost?: RadarPoint[]; norm: RadarNorm; pal: RadarSvgPalette; size?: number;
  meta?: Map<string, { rank: number; score: number }>; legend?: boolean;
}): string {
  const R = size / 2, n = axes.length, edge = 12;
  const lay = radarLabels(axes.map((a) => a.label), { R, px: 12, maxW: 132 });
  const legendRows = legend ? series.length + (ghost ? 1 : 0) : 0;
  const legendW = legendRows ? Math.ceil(32 + Math.max(ghost ? textWidth("Field median", 13) : 0, ...series.map((s) => Math.max(textWidth(trim(s.name, 22), 14), meta?.has(s.id) ? 90 : 0)))) : 0;
  const cx = Math.ceil(-lay.minX) + edge, lx = Math.ceil(cx + lay.maxX) + 28;
  const top = Math.ceil(-lay.minY) + edge, bodyH = top + Math.ceil(lay.maxY) + edge, H = Math.max(bodyH, legendRows ? legendRows * 44 + 24 : 0);
  const cy = top + (H - bodyH) / 2, W = legendRows ? lx + legendW + edge : Math.ceil(cx + lay.maxX) + edge;
  const at = (i: number, r: number) => [cx + Math.cos(spokeAngle(i, n)) * R * r, cy + Math.sin(spokeAngle(i, n)) * R * r];
  const shape = (pts: RadarPoint[]) => {
    const xy = pts.flatMap((p, i) => p.r == null ? [] : [at(i, p.r).map(r1).join(",")]);
    return xy.length ? `M${xy.join("L")}Z` : "";
  };
  const out: string[] = [`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" font-family="${SANS}">`];
  for (const t of [0.25, 0.5, 0.75, 1]) out.push(`<circle cx="${cx}" cy="${cy}" r="${r1(R * t)}" fill="none" stroke="${t === 1 ? pal.hair : pal.ring}" stroke-width="1"/>`);
  for (let i = 0; i < n; i++) { const [x, y] = at(i, 1); out.push(`<line x1="${cx}" y1="${cy}" x2="${r1(x)}" y2="${r1(y)}" stroke="${pal.ring}" stroke-width="1"/>`); }
  const capAngle = -Math.PI / 2 + Math.PI / Math.max(3, n); // midway between the first two spokes
  ringLabels(norm).forEach((c, i) => { if (c) out.push(`<text x="${r1(cx + Math.cos(capAngle) * R * (i + 1) / 4 + 3)}" y="${r1(cy + Math.sin(capAngle) * R * (i + 1) / 4 - 3)}" font-family="${MONO}" font-size="9.5" fill="${pal.grey}">${c}</text>`); });
  if (ghost) { const d = shape(ghost); if (d) out.push(`<path d="${d}" fill="${pal.ghost}" fill-opacity="0.6" stroke="${pal.grey}" stroke-width="1" stroke-dasharray="2 3"><title>Field median</title></path>`); }
  const single = series.length === 1;
  for (const s of series) {
    for (const l of s.layers ?? []) { const ld = shape(l.points); if (ld) out.push(`<path d="${ld}" fill="${s.color}" fill-opacity="${layerOpacity(series.length)}" stroke="none"><title>${esc(`${s.name} · ${effortName(l.effort)}`)}</title></path>`); }
    const d = shape(s.points);
    if (d) out.push(`<path d="${d}" fill="${s.color}" fill-opacity="${s.layers?.length ? layerOpacity(series.length) : single ? 0.16 : 0.06}" stroke="${s.color}" stroke-width="2" stroke-linejoin="round"${s.dash ? ` stroke-dasharray="${s.dash}"` : ""}/>`);
  }
  for (const s of series) s.points.forEach((p, i) => {
    if (p.r == null) return;
    const [x, y] = at(i, p.r);
    out.push(`<circle cx="${r1(x)}" cy="${r1(y)}" r="3.4" fill="${p.estimated ? pal.bg : s.color}" stroke="${p.estimated ? s.color : pal.bg}" stroke-width="1.5"><title>${esc(`${s.name} · ${axes[i].name}: ${formatValue(p, axes[i])}${p.estimated ? " (estimated)" : ""}`)}</title></circle>`);
  });
  lay.labels.forEach((l, i) => {
    const x = r1(cx + l.x), what = benchmarkBlurb(axes[i].name, axes[i].description);
    out.push(`<text x="${x}" y="${r1(cy + l.y)}" text-anchor="${l.anchor}" font-size="12" fill="${pal.ink2}"><title>${esc(`${axes[i].name} · ${axes[i].share.toFixed(0)}% of index${what ? `\n${what}` : ""}`)}</title>${l.lines.map((line, k) => `<tspan x="${x}" dy="${k ? lay.lineHeight : 0}">${esc(line)}</tspan>`).join("")}</text>`);
  });
  if (legendRows) {
    let ly = cy - (legendRows * 44) / 2 + 22;
    for (const s of series) {
      const m = meta?.get(s.id);
      out.push(`<line x1="${lx}" y1="${ly - 4}" x2="${lx + 22}" y2="${ly - 4}" stroke="${s.color}" stroke-width="2.5" stroke-linecap="round"${s.dash ? ` stroke-dasharray="${s.dash}"` : ""}/>`);
      out.push(`<text x="${lx + 32}" y="${ly}" font-size="14" fill="${pal.ink}">${esc(trim(s.name, 22))}</text>`);
      if (m) out.push(`<text x="${lx + 32}" y="${ly + 17}" font-family="${MONO}" font-size="11" fill="${pal.grey}">#${m.rank} · ${m.score.toFixed(1)}</text>`);
      ly += 44;
    }
    if (ghost) {
      out.push(`<rect x="${lx + 2}" y="${ly - 9}" width="18" height="10" rx="2" fill="${pal.ghost}" stroke="${pal.grey}" stroke-dasharray="2 2"/>`);
      out.push(`<text x="${lx + 32}" y="${ly}" font-size="13" fill="${pal.grey}">Field median</text>`);
    }
  }
  out.push("</svg>");
  return out.join("");
}

/** Light/dark radar palettes, matching the site's chart palettes and hairline tokens. */
export const RADAR_PALETTES: Record<"light" | "dark", RadarSvgPalette> = {
  light: { bg: "#FBFBF9", ink: "#1A1A1A", ink2: "#4A4A46", grey: "#8A8A80", hair: "#DDDBD4", ring: "#ECEAE3", ghost: "#ECEAE3" },
  dark: { bg: "#141413", ink: "#EDECE6", ink2: "#C2C1B9", grey: "#8C8B83", hair: "#34342F", ring: "#242422", ghost: "#2A2A27" },
};

/** Everything a static radar needs, resolved from an index and settings (server cards and exports). */
export function radarSnapshotView(snapshot: Snapshot, config: IndexConfig, settings: RadarSettings, dark: boolean, labColor: (lab: Lab) => string) {
  const r = computeIndex(snapshot, { ...config, variants: "all" });
  const best = radarRows(snapshot, config, r.ranked, r.benchmarks);
  const byEffort = settings.effort && settings.effort !== "best" ? radarEffortRows(snapshot, config, best, r.benchmarks, settings.effort) : undefined;
  const rows = byEffort?.rows ?? best;
  const { axes, models, median } = radarModelsFor(rows, r.benchmarks, settings.norm, settings.spokes, selectedModels(rows.map((x) => ({ id: x.model.id })), settings.models), byEffort?.layers);
  const labs = new Map(snapshot.labs.map((l) => [l.id, l]));
  const series = radarSeries(models, selectedModels(models, settings.models), settings.colors, dark, (id) => { const lab = labs.get(id); return lab ? labColor(lab) : "#A3A39B"; });
  return { axes, models, median, series, ghost: settings.median ? median : undefined, meta: new Map(models.map((m) => [m.id, { rank: m.rank, score: m.score }])) };
}
