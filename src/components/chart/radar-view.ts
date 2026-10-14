/**
 * Strengths radar, framework-free: settings ⇄ URL params, series building, and a self-contained SVG
 * string (inline colors and static fonts) shared by the PNG/SVG export, the HTML embed, `?c=strengths`
 * link previews and the "Radar" share card. The interactive chart is Radar.tsx.
 */
import type { Lab, Snapshot } from "../../data/types";
import { computeIndex, selectVariants, type IndexConfig, type IndexResult, type RankedVariant } from "../../engine";
import { fillFromSiblings, formatValue, medianPoints, radarAxes, radarModels, ringLabels, type RadarAxis, type RadarModel, type RadarNorm, type RadarPoint } from "./radar-data";

export interface RadarSeries { id: string; name: string; color: string; dash?: string; points: RadarPoint[] }
export type RadarCompare = "leader" | "median";
export type RadarColors = "lab" | "distinct";
/** `models` is a user pick; undefined follows the live top 4. */
export type RadarView = "radar" | "bars";
export interface RadarSettings { norm: RadarNorm; compare: RadarCompare; colors: RadarColors; median: boolean; view: RadarView; models?: string[] }
export const DEFAULT_RADAR: RadarSettings = { norm: "field", compare: "leader", colors: "lab", median: true, view: "radar" };
export const RADAR_TOP = 4;
/** Per-benchmark bar charts have room for more models than overlaid shapes do. */
export const BARS_TOP = 8;
export const RADAR_ANCHOR = "strengths";

export const RADAR_NORMS: { id: RadarNorm; label: string; hint: string }[] = [
  { id: "field", label: "Range", hint: "Each spoke runs from the worst to the best ranked model on that benchmark." },
  { id: "rank", label: "Percentile", hint: "Each spoke is the model's percentile among ranked models." },
  { id: "score", label: "Raw", hint: "The index's 0–100 score per benchmark, unstretched." },
];
/** Validated categorical palette (dataviz reference) for the "one color per model" option. */
const DISTINCT = { light: ["#2a78d6", "#eb6834", "#1baf7a", "#eda100", "#e87ba4", "#008300", "#4a3aa7", "#e34948"], dark: ["#3987e5", "#d95926", "#199e70", "#c98500", "#d55181", "#008300", "#9085e9", "#e66767"] };
const DASHES = [undefined, "7 4", "2 3", "10 3 2 3"];

/* ---------------- URL params ---------------- */

/** Radar params carried by `?c=strengths` links: rm (models), rs (scale), rc (small radars vs), rk (colors), rmed=0 (no median), rv=bars (a bar chart per benchmark). */
export const RADAR_PARAM_KEYS = ["rm", "rs", "rc", "rk", "rmed", "rv"] as const;

export function readRadarParams(params: URLSearchParams): RadarSettings {
  const rs = params.get("rs"), rc = params.get("rc"), rk = params.get("rk"), rm = params.get("rm");
  return {
    norm: RADAR_NORMS.some((n) => n.id === rs) ? rs as RadarNorm : DEFAULT_RADAR.norm,
    compare: rc === "median" ? "median" : "leader",
    colors: rk === "distinct" ? "distinct" : "lab",
    median: params.get("rmed") !== "0",
    view: params.get("rv") === "bars" ? "bars" : "radar",
    models: rm == null ? undefined : rm.split(",").filter(Boolean).slice(0, 12),
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
  };
}

/* ---------------- data ---------------- */

/** Best variant per ranked model, gaps filled from the model's other source configurations. */
export function radarRows(snapshot: Snapshot, config: IndexConfig, ranked: RankedVariant[], benchmarks: IndexResult["benchmarks"]): RankedVariant[] {
  // Strictness 0 ranks every variant with any value, so other configurations of a ranked model can fill its gaps.
  const siblings = computeIndex(snapshot, { ...config, strictness: 0, required: [], variants: "all" }).ranked;
  return fillFromSiblings(selectVariants(ranked, "best"), siblings, benchmarks.map((b) => b.benchmark.id));
}

export function radarModelsFor(rows: RankedVariant[], benchmarks: IndexResult["benchmarks"], norm: RadarNorm) {
  const axes = radarAxes(benchmarks, rows);
  return { axes, models: radarModels(rows, axes, norm), median: medianPoints(rows, axes, norm) };
}

/**
 * Series in index-rank order. Lab colors repeat within a lab, so later same-lab models get dashes;
 * distinct colors use a stable slot per model (`slotOf`) so removing one never repaints the rest.
 */
export function radarSeries(models: RadarModel[], selected: string[], colors: RadarColors, dark: boolean, labColor: (labId: string) => string, slotOf: (id: string) => number = (id) => selected.indexOf(id)): RadarSeries[] {
  const seen = new Map<string, number>();
  return models.filter((m) => selected.includes(m.id)).map((m) => {
    if (colors === "distinct") return { id: m.id, name: m.name, points: m.points, color: (dark ? DISTINCT.dark : DISTINCT.light)[Math.max(0, slotOf(m.id)) % 8] };
    const n = seen.get(m.labId) ?? 0; seen.set(m.labId, n + 1);
    return { id: m.id, name: m.name, points: m.points, color: labColor(m.labId), dash: DASHES[n % DASHES.length] };
  });
}

export function selectedModels(models: RadarModel[], picked?: string[]) {
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
 * Every value point carries a <title> so the HTML embed gets native hover tooltips.
 */
export function radarSvg({ axes, series, ghost, norm, pal, size = 400, meta, legend = true }: {
  axes: RadarAxis[]; series: RadarSeries[]; ghost?: RadarPoint[]; norm: RadarNorm; pal: RadarSvgPalette; size?: number;
  meta?: Map<string, { rank: number; score: number }>; legend?: boolean;
}): string {
  const padX = 116, padY = 32, legendW = legend ? 230 : 0;
  const R = size / 2, cx = padX + R, cy = padY + R, W = padX * 2 + size + legendW, H = Math.max(size + padY * 2, legend ? 60 + (series.length + 1) * 44 : 0);
  const n = axes.length;
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
    const d = shape(s.points);
    if (d) out.push(`<path d="${d}" fill="${s.color}" fill-opacity="${single ? 0.16 : 0.06}" stroke="${s.color}" stroke-width="2" stroke-linejoin="round"${s.dash ? ` stroke-dasharray="${s.dash}"` : ""}/>`);
  }
  for (const s of series) s.points.forEach((p, i) => {
    if (p.r == null) return;
    const [x, y] = at(i, p.r);
    out.push(`<circle cx="${r1(x)}" cy="${r1(y)}" r="3.4" fill="${p.estimated ? pal.bg : s.color}" stroke="${p.estimated ? s.color : pal.bg}" stroke-width="1.5"><title>${esc(`${s.name} · ${axes[i].name}: ${formatValue(p, axes[i])}${p.estimated ? " (estimated)" : ""}`)}</title></circle>`);
  });
  for (let i = 0; i < n; i++) {
    const a = spokeAngle(i, n), c = Math.cos(a), sn = Math.sin(a);
    const x = r1(cx + c * (R + 12)), y = r1(cy + sn * (R + 12) + (sn < -0.6 ? -4 : sn > 0.6 ? 12 : 4));
    const anchor = Math.abs(c) < 0.2 ? "middle" : c > 0 ? "start" : "end";
    out.push(`<text x="${x}" y="${y}" text-anchor="${anchor}" font-size="12" fill="${pal.ink2}"><title>${esc(axes[i].name)} · ${axes[i].share.toFixed(0)}% of index</title>${esc(trim(axes[i].label, 20))}</text>`);
  }
  if (legend) {
    const lx = padX * 2 + size - 40;
    let ly = Math.max(padY + 20, cy - ((series.length + (ghost ? 1 : 0)) * 44) / 2 + 14);
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
  const rows = radarRows(snapshot, config, r.ranked, r.benchmarks);
  const { axes, models, median } = radarModelsFor(rows, r.benchmarks, settings.norm);
  const labs = new Map(snapshot.labs.map((l) => [l.id, l]));
  const series = radarSeries(models, selectedModels(models, settings.models), settings.colors, dark, (id) => { const lab = labs.get(id); return lab ? labColor(lab) : "#A3A39B"; });
  return { axes, models, median, series, ghost: settings.median ? median : undefined, meta: new Map(models.map((m) => [m.id, { rank: m.rank, score: m.score }])) };
}
