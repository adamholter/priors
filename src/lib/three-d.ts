import type { RankedVariant } from "@/engine";
import type { FormulaInputs } from "./metrics";
import { money } from "./metrics";

/** What each plottable measure means: which end is better, whether a log axis suits it, and how its values read. */
export interface AxisMeta { better: "higher" | "lower"; log: boolean; format: (v: number) => string }

const secs = (v: number) => (v >= 3600 ? `${(v / 3600).toFixed(1)} h` : v >= 120 ? `${Math.round(v / 60)} min` : v >= 10 ? `${Math.round(v)} s` : `${v.toFixed(1)} s`);
const compact = (v: number) => (v >= 1e6 ? `${(v / 1e6).toFixed(1)}M` : v >= 1000 ? `${(v / 1000).toFixed(v >= 1e4 ? 0 : 1)}k` : `${Math.round(v)}`);

export const AXIS_META: Record<string, AxisMeta> = {
  score: { better: "higher", log: false, format: (v) => v.toFixed(1) },
  cost: { better: "lower", log: true, format: money },
  time: { better: "lower", log: true, format: secs },
  speed: { better: "higher", log: true, format: (v) => `${compact(v)} tok/s` },
  latency: { better: "lower", log: true, format: secs },
  tokens: { better: "lower", log: true, format: (v) => `${compact(v)} tok` },
  uptime: { better: "higher", log: false, format: (v) => `${v.toFixed(v >= 99 ? 2 : 1)}%` },
  usage: { better: "higher", log: true, format: (v) => `${v >= 10 ? v.toFixed(0) : v.toFixed(1)}%` },
  age: { better: "lower", log: false, format: (v) => `${Math.round(v)} d` },
};
export const metaFor = (name: string): AxisMeta => AXIS_META[name] ?? { better: "higher", log: false, format: (v) => v.toPrecision(3) };

export interface Point3 {
  id: string;
  modelId: string;
  r: RankedVariant;
  /** Raw values on the three axes, in the order chosen. */
  raw: [number, number, number];
  /** Place in the unit cube, 1 = the better end of that axis, so the best corner is always (1, 1, 1). */
  pos: [number, number, number];
  frontier: boolean;
  /** Distance from the best corner in the unit cube; smaller is better. */
  gap: number;
  /** Better than the median model on all three axes: inside the best-corner zone. */
  inZone: boolean;
}

export interface Axis { name: string; min: number; max: number; meta: AxisMeta }

/** Points with a value on all three axes, one per model (its best-scoring row) unless `all`; placed in the unit cube. */
export function placePoints(ranked: RankedVariant[], inputs: FormulaInputs, axes: [string, string, string], all = false): { points: Point3[]; axes: [Axis, Axis, Axis]; zone: [number, number, number] } {
  const { of } = inputs.get();
  const rows: { r: RankedVariant; raw: [number, number, number] }[] = [];
  for (const r of ranked) {
    const v = of(r);
    const raw = axes.map((a) => v[a]) as (number | undefined)[];
    if (raw.every((x): x is number => x != null && Number.isFinite(x) && x >= 0)) rows.push({ r, raw: raw as [number, number, number] });
  }
  const kept = all ? rows : [...rows.reduce((m, x) => { const b = m.get(x.r.model.id); if (!b || x.r.score > b.r.score) m.set(x.r.model.id, x); return m; }, new Map<string, (typeof rows)[number]>()).values()];
  const dims = axes.map((name, i) => {
    const meta = metaFor(name);
    const vals = kept.map((k) => k.raw[i]);
    const log = meta.log && vals.every((v) => v > 0);
    const t = (v: number) => (log ? Math.log10(v) : v);
    const lo = Math.min(...vals.map(t)), hi = Math.max(...vals.map(t));
    return { name, meta, log, t, lo, span: hi - lo || 1, min: Math.min(...vals), max: Math.max(...vals) };
  });
  const unit = (d: (typeof dims)[number], v: number) => { const u = (d.t(v) - d.lo) / d.span; return d.meta.better === "higher" ? u : 1 - u; };
  const points = kept.map((k): Point3 => {
    const pos = k.raw.map((v, i) => unit(dims[i], v)) as [number, number, number];
    return { id: k.r.variant.id, modelId: k.r.model.id, r: k.r, raw: k.raw, pos, frontier: false, gap: Math.hypot(1 - pos[0], 1 - pos[1], 1 - pos[2]), inZone: false };
  });
  // The best-corner zone runs from the median model on each axis to the better end, like the shaded quadrant on a 2D chart.
  const median = (i: number) => { const v = points.map((p) => p.pos[i]).sort((a, b) => a - b); return v.length ? (v[(v.length - 1) >> 1] + v[v.length >> 1]) / 2 : 0.5; };
  const zone: [number, number, number] = [median(0), median(1), median(2)];
  for (const p of points) p.inZone = p.pos.every((u, i) => u >= zone[i]);
  // On the frontier when no other point is at least as good on every axis and better on one.
  for (const p of points) p.frontier = !points.some((q) => q !== p && q.pos.every((u, i) => u >= p.pos[i]) && q.pos.some((u, i) => u > p.pos[i]));
  return { points, zone, axes: dims.map(({ name, meta, min, max }) => ({ name, meta, min, max })) as [Axis, Axis, Axis] };
}

/** The axis value at fraction `u` of the way from the worse end to the better end, for tick labels. */
export function valueAt(axis: Axis, u: number, log: boolean): number {
  const lo = axis.meta.better === "higher" ? axis.min : axis.max, hi = axis.meta.better === "higher" ? axis.max : axis.min;
  return log && axis.min > 0 ? 10 ** (Math.log10(lo) + (Math.log10(hi) - Math.log10(lo)) * u) : lo + (hi - lo) * u;
}
export const axisIsLog = (axis: Axis) => axis.meta.log && axis.min > 0;
