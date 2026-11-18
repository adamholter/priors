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

/** Where a raw value sits on an axis: 0 at the worse end, 1 at the better end. */
export function unitOf(axis: Axis, v: number, log: boolean): number {
  const lo = axis.meta.better === "higher" ? axis.min : axis.max, hi = axis.meta.better === "higher" ? axis.max : axis.min;
  if (log && axis.min > 0) { const a = Math.log10(lo), b = Math.log10(hi); return a === b ? 0.5 : (Math.log10(v) - a) / (b - a); }
  return lo === hi ? 0.5 : (v - lo) / (hi - lo);
}

/** Round values to mark on an axis, inside its range: 1, 2 and 5 steps on a log axis, a round step on a linear one. About `count` of them. */
export function axisTicks(axis: Axis, count = 5): { value: number; u: number; label: string }[] {
  const log = axisIsLog(axis), values: number[] = [];
  if (axis.max > axis.min) {
    const decades = log ? Math.log10(axis.max / axis.min) : 0, seconds = axis.name === "time" || axis.name === "latency";
    if (log && decades >= 1.2) {
      const steps = decades > count * 0.8 ? [1] : decades > count * 0.4 ? [1, 3] : [1, 2, 5];
      for (let e = Math.floor(Math.log10(axis.min)); e <= Math.ceil(Math.log10(axis.max)); e++) for (const s of steps) { const v = s * 10 ** e; if (v >= axis.min && v <= axis.max) values.push(+v.toPrecision(3)); }
    } else {
      // A narrow log axis gets plain steps too: 1-2-5 would leave one or two marks. Durations step in whole minutes once they reach them.
      const rough = (axis.max - axis.min) / count, power = 10 ** Math.floor(Math.log10(rough)), minutes = [60, 120, 300, 600, 900, 1800, 3600, 7200].find((s) => s >= rough);
      const step = seconds && rough >= 30 && minutes ? minutes : [1, 2, 2.5, 5, 10].map((m) => m * power).find((s) => s >= rough)!;
      for (let v = Math.ceil(axis.min / step) * step; v <= axis.max + step * 1e-9; v += step) values.push(+v.toPrecision(10));
    }
  }
  return values.map((value) => ({ value, u: unitOf(axis, value, log), label: axis.meta.format(value) }));
}

/** A face of the frontier surface: four corners in unit-cube coordinates (1 = the better end), and the axis it faces along. */
export interface Face { corners: [[number, number, number], [number, number, number], [number, number, number], [number, number, number]]; axis: 0 | 1 | 2 }

/**
 * The Pareto frontier as a surface: the outer boundary of everything the frontier models beat. Each frontier model claims the box from
 * the worst corner to its own point; the union of those boxes is a staircase whose outer corners are the frontier models, and any model
 * under it is beaten on all three axes by one of them. Built on the grid of the frontier's own coordinates, keeping each cell wall that
 * separates a beaten cell from an open one (or from the cube's better wall). `edges` is the staircase's outline: wall edges that are not
 * shared by two walls in the same plane, so the drawing shows steps, not the grid.
 */
export function frontierSurface(points: Pick<Point3, "pos" | "frontier">[]): { faces: Face[]; edges: [[number, number, number], [number, number, number]][] } {
  const front = points.filter((p) => p.frontier).map((p) => p.pos);
  if (front.length < 2) return { faces: [], edges: [] };
  const cuts = [0, 1, 2].map((i) => [...new Set([0, ...front.map((p) => p[i])])].sort((a, b) => a - b));
  const n = cuts.map((c) => c.length - 1);
  // A cell is beaten when one frontier model is at least as good as the cell's best corner on every axis.
  const beaten = (i: number, j: number, k: number) => i < n[0] && j < n[1] && k < n[2] && front.some((p) => p[0] >= cuts[0][i + 1] && p[1] >= cuts[1][j + 1] && p[2] >= cuts[2][k + 1]);
  const faces: Face[] = [];
  for (let i = 0; i < n[0]; i++) for (let j = 0; j < n[1]; j++) for (let k = 0; k < n[2]; k++) {
    if (!beaten(i, j, k)) continue;
    const lo = [cuts[0][i], cuts[1][j], cuts[2][k]], hi = [cuts[0][i + 1], cuts[1][j + 1], cuts[2][k + 1]], idx = [i, j, k];
    for (const axis of [0, 1, 2] as const) {
      const next = [...idx]; next[axis]++;
      if (beaten(next[0], next[1], next[2])) continue;
      const [a, b] = [0, 1, 2].filter((x) => x !== axis) as [0 | 1 | 2, 0 | 1 | 2];
      const corner = (ua: number, ub: number) => { const v = [0, 0, 0] as [number, number, number]; v[axis] = hi[axis]; v[a] = ua; v[b] = ub; return v; };
      faces.push({ axis, corners: [corner(lo[a], lo[b]), corner(hi[a], lo[b]), corner(hi[a], hi[b]), corner(lo[a], hi[b])] });
    }
  }
  const key = (p: number[]) => p.map((x) => x.toFixed(6)).join(",");
  const seen = new Map<string, { count: number; ends: [[number, number, number], [number, number, number]] }>();
  for (const f of faces) for (let e = 0; e < 4; e++) {
    const a = f.corners[e], b = f.corners[(e + 1) % 4], [p, q] = key(a) < key(b) ? [a, b] : [b, a];
    const id = `${f.axis}|${f.corners[0][f.axis].toFixed(6)}|${key(p)}|${key(q)}`;
    const s = seen.get(id); if (s) s.count++; else seen.set(id, { count: 1, ends: [p, q] });
  }
  const outline = new Map<string, [[number, number, number], [number, number, number]]>();
  for (const s of seen.values()) if (s.count === 1) outline.set(`${key(s.ends[0])}|${key(s.ends[1])}`, s.ends);
  return { faces, edges: [...outline.values()] };
}
