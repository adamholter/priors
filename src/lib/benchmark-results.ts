import type { Benchmark, Observation, Variant } from "@/data/types";
import type { RankedVariant } from "@/engine";
import { subscriptionShare } from "@/engine";
import type { CostBasis } from "@/data/subscription";
import { formatBenchValue } from "./benchmark-format";
import { formatMetric, type BenchMetric } from "./benchmark-metrics";

/** What a benchmark page hands its "All results" section. */
export type ResultsInput = { table: RankedVariant[]; b: Benchmark; hasCost: boolean; basis: CostBasis; apiObs: Map<string, Observation>; ci: boolean; harness: boolean; standard: BenchMetric[] };

export const usd = (v: number) => v === 0 ? "free" : `$${v >= 10 ? v.toFixed(0) : v >= 1 ? v.toFixed(2) : v.toFixed(v >= 0.1 ? 2 : 3)}`;

export type MeasureKey = "cost" | "api" | "steps" | "durationSec" | "outputTokens";
/** One number a result can carry besides its score. `label` heads a column, `name` is the tooltip. */
export type Measure = { key: MeasureKey; label: string; name: string; fmt: (v: number) => string };

/** One result: a model at one effort. */
export type Row = {
  id: string; variant: Variant; modelId: string; name: string; labId: string;
  /** The reasoning effort, empty when the benchmark has one setting or keeps each model's best across settings. */
  effort: string;
  /** What the table prints for it: the effort, "best measured" when the board keeps each model's best, else "default". */
  effortLabel: string;
  /** The value drawn on score axes: the published value, else the index score. */
  score: number; text: string;
  half?: string; intervalTitle?: string; note?: string; planTitle?: string;
  launch: boolean;
  v: Partial<Record<MeasureKey, number>>;
  harness?: string;
};

export type ResultsModel = {
  rows: Row[]; measures: Measure[];
  /** The one harness every row shares, else undefined. */
  harnessConst?: string;
  /** Rows come from several harnesses, so each result names its own. */
  harnessVaries: boolean;
  /** Lower raw values are better (refusal rates and the like): axes run best to the right. */
  flip: boolean; hasInterval: boolean;
};

const LABEL: Record<string, string> = { steps: "Steps", durationSec: "Time", outputTokens: "Tokens" };

/** Every result of the page's benchmark as plain rows, with the measures the page publishes for them. */
export function buildResults({ table, b, hasCost, basis, apiObs, ci, harness, standard }: ResultsInput): ResultsModel {
  const sub = basis === "subscription";
  const measures: Measure[] = [];
  if (hasCost) measures.push({ key: "cost", label: sub ? "Plan cost" : "Cost", name: sub ? "Plan cost per task (what a subscription pays)" : "Cost per task", fmt: usd });
  if (hasCost && sub) measures.push({ key: "api", label: "API cost", name: "API cost per task (pay as you go)", fmt: usd });
  for (const m of standard) measures.push({ key: m.key as MeasureKey, label: LABEL[m.key] ?? m.label, name: m.label, fmt: (v) => formatMetric(m.kind, v) });
  const rows: Row[] = table.map((r) => {
    const o = apiObs.get(r.variant.id), raw = r.values[0]?.raw;
    const interval = ci && o?.ci ? o.ci : undefined;
    const half = interval ? (interval[1] - interval[0]) / 2 : undefined;
    const v: Row["v"] = {};
    if (r.costUsd != null) v.cost = r.costUsd;
    if (o?.costUsd != null && hasCost && sub) v.api = o.costUsd;
    for (const m of standard) { const x = m.values.get(r.variant.id); if (x != null) v[m.key as MeasureKey] = x; }
    return {
      id: r.variant.id, variant: r.variant, modelId: r.model.id, name: r.model.name, labId: r.model.labId,
      effort: b.effortBasis || r.variant.effort === "default" ? "" : r.variant.effort,
      effortLabel: b.effortBasis ? "best measured" : r.variant.effort === "default" ? "default" : r.variant.effort,
      score: raw ?? r.score, text: raw != null ? formatBenchValue(b, raw) : r.score.toFixed(1),
      half: half != null ? formatBenchValue(b, half).replace("%", "") : undefined,
      intervalTitle: interval ? `interval ${formatBenchValue(b, interval[0])} to ${formatBenchValue(b, interval[1])}` : undefined,
      note: o?.note, launch: o?.details?.launchClaim != null, v, harness: o?.harness,
      planTitle: r.costPlan ? `${r.costPlan.plan}: ${subscriptionShare(r.costPlan.ratio)} of API price${r.costPlan.preliminary ? `. ${r.costPlan.preliminary.label}: ${r.costPlan.preliminary.short}` : ""}` : undefined,
    };
  });
  const harnesses = new Set(rows.map((x) => x.harness).filter(Boolean));
  const harnessConst = harness && harnesses.size === 1 && rows.length > 0 && rows.every((x) => x.harness) ? [...harnesses][0] : undefined;
  const has = (key: MeasureKey) => rows.some((x) => x.v[key] != null);
  return { rows, measures: measures.filter((m) => has(m.key)), harnessConst, harnessVaries: harness && !harnessConst, flip: b.higherIsBetter === false, hasInterval: rows.some((x) => x.half != null) };
}

/* ---------- one row per model ---------- */

/** A model's results: its best first, then its other efforts in the table's order. */
export type Group = { id: string; rows: Row[]; best: Row; /** 1 for the best model. */ rank: number };

/** Rows (best first) folded into one group per model, in the order each model first appears. */
export function groupModels(rows: Row[]): Group[] {
  const by = new Map<string, Row[]>();
  for (const r of rows) { const list = by.get(r.modelId); if (list) list.push(r); else by.set(r.modelId, [r]); }
  return [...by].map(([id, list], i) => ({ id, rows: list, best: list[0], rank: i + 1 }));
}

/** Every word typed has to be in the model's name, its id or one effort. */
export function matchesRow(x: Row, query: string) {
  const words = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  if (!words.length) return true;
  const hay = `${x.name} ${x.effort} ${x.modelId}`.toLowerCase();
  return words.every((w) => hay.includes(w));
}
/** Whether a model's name or id alone answers the search (otherwise an effort did, and its detail is worth opening). */
export function matchesName(g: Group, query: string) {
  const hay = `${g.best.name} ${g.id}`.toLowerCase();
  return query.trim().toLowerCase().split(/\s+/).filter(Boolean).every((w) => hay.includes(w));
}
export function searchGroups(groups: Group[], query: string): Group[] {
  return query.trim() ? groups.filter((g) => g.rows.some((r) => matchesRow(r, query))) : groups;
}

export type SortKey = "score" | MeasureKey;
export type Sort = { key: SortKey; rev: boolean };
/** Rank order: score, best first. */
export const RANK: Sort = { key: "score", rev: false };
export const isRank = (s: Sort) => s.key === "score" && !s.rev;

/** Models in the order asked: by score (the table's own order) or by their lowest value of a measure, ties by rank, models without it last. */
export function sortGroups(groups: Group[], s: Sort): Group[] {
  if (s.key === "score") return s.rev ? [...groups].reverse() : groups;
  const k = s.key, dir = s.rev ? -1 : 1;
  const low = (g: Group) => { let min: number | undefined; for (const r of g.rows) { const x = r.v[k]; if (x != null && (min === undefined || x < min)) min = x; } return min; };
  const keyed = groups.map((g) => ({ g, x: low(g) }));
  return keyed.sort((a, c) => a.x == null && c.x == null ? a.g.rank - c.g.rank : a.x == null ? 1 : c.x == null ? -1 : a.x === c.x ? a.g.rank - c.g.rank : dir * (a.x - c.x)).map((k2) => k2.g);
}

/** A header click: the first sort of a column is best first, the second reverses it. Score cycles with rank order. */
export function cycleSort(cur: Sort, key: SortKey): Sort {
  if (key === "score") return isRank(cur) ? { key: "score", rev: true } : RANK;
  if (cur.key !== key) return { key, rev: false };
  return cur.rev ? RANK : { key, rev: true };
}

/** The lowest value among a model's results for a column, only when two or more results have one (so there is a best to point at). */
export function bestOf(g: Group, key: SortKey, flip: boolean): number | undefined {
  const xs: number[] = [];
  for (const r of g.rows) { const x = key === "score" ? r.score : r.v[key]; if (x != null) xs.push(x); }
  if (xs.length < 2) return undefined;
  return key === "score" && !flip ? Math.max(...xs) : Math.min(...xs);
}

/* ---------- the score axis ---------- */

export type Axis = { lo: number; hi: number; ticks: number[]; flip: boolean; pos: (v: number) => number };
const round = (v: number) => Math.round(v * 1e6) / 1e6;
const niceStep = (range: number, n: number) => { const raw = range / Math.max(1, n), p = 10 ** Math.floor(Math.log10(raw)), f = raw / p; return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 5 ? 5 : 10) * p; };

/** A linear axis with round ends. `zero` anchors the left end at 0. */
export function linearAxis(min: number, max: number, zero: boolean, flip = false, n = 4): Axis {
  if (!Number.isFinite(min) || !Number.isFinite(max)) { min = 0; max = 1; }
  if (zero) min = Math.min(0, min);
  if (max <= min) max = min + (Math.abs(min) || 1) * 0.2;
  const step = niceStep(max - min, n);
  const lo = zero ? 0 : Math.floor(min / step) * step, hi = Math.ceil(max / step) * step;
  const ticks: number[] = [];
  for (let v = lo; v <= hi + step / 1e6; v += step) ticks.push(round(v));
  const span = hi - lo;
  return { lo, hi, ticks, flip, pos: (v) => { const t = (v - lo) / span; return flip ? 1 - t : t; } };
}

/** The score axis: percent counts from 0; Elo, indexes and the rest fit a round range around the best `top` results, so a long tail never squeezes the leaders into one corner (the tail clamps to the left end). */
export function scoreAxis(rows: Row[], b: Pick<Benchmark, "unit">, flip: boolean, top = 30): Axis {
  const lead = top >= rows.length ? rows : [...rows].sort((a, c) => flip ? a.score - c.score : c.score - a.score).slice(0, top);
  const xs = lead.map((x) => x.score);
  if (!xs.length) return linearAxis(0, 1, false, flip);
  const mn = Math.min(...xs), mx = Math.max(...xs);
  const zero = b.unit === "percent" && mn >= 0;
  return linearAxis(zero ? 0 : mn, mx, zero, flip);
}
export function tickText(b: Pick<Benchmark, "unit">, v: number) { return b.unit === "percent" ? `${v}%` : b.unit === "usd" ? `$${v}` : v.toLocaleString("en-US"); }

/** Where a value sits along the axis, 0 to 100, clamped so a tail result still shows a sliver. */
export const axisPct = (a: Axis, v: number) => Math.max(0.012, Math.min(1, a.pos(v))) * 100;

/**
 * Where a model's other efforts sit on its bar, as notches: each effort at its own score, leaving out any that would sit within
 * 1.5 percent of the one before (so they never stack). The best effort is the bar itself.
 */
export function notches(g: Group, a: Axis): { row: Row; x: number }[] {
  const out: { row: Row; x: number }[] = [];
  let last = axisPct(a, g.best.score);
  for (const r of g.rows.slice(1)) { const x = axisPct(a, r.score); if (Math.abs(last - x) < 1.5) continue; last = x; out.push({ row: r, x }); }
  return out;
}
