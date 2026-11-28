import { EFFORT_ORDER } from "@/data/types";
import type { BenchRow, ModelView, ViewBenchmark } from "@/lib/model-view";

/** Lowest to highest: `default` first (a model with one has no other), unknown labels last. */
const ORDER: string[] = ["default", ...EFFORT_ORDER];
export const effortIdx = (e: string) => { const i = ORDER.indexOf(e); return i < 0 ? ORDER.length : i; };
/** Highest effort first, the order every effort list on a model page uses. */
export const byEffortDesc = <T extends { effort: string }>(list: T[]) => [...list].sort((a, b) => effortIdx(b.effort) - effortIdx(a.effort));

/** An effort is the best value when it costs the least among those scoring within this share of the top score. */
export const BEST_VALUE_TOL = 0.05;
export const BEST_VALUE_NOTE = "Indigo is the cheapest effort within 5% of the best score.";
export const BEST_VALUE_TITLE = "Best value: the cheapest effort within 5% of the top score";

export interface Eff {
  id: string; effort: string; score: number; rank: number;
  /** Scored with estimates: the ranking is loose and this effort is not fully measured. */
  est: boolean;
  cost?: number; tpt?: number; tokens?: number;
  /** Displayed score minus the displayed score of the effort below; null on the lowest effort. */
  step: number | null;
  best: boolean;
}
export interface EffortsData {
  /** Highest effort first. */
  list: Eff[];
  /** The best-value effort, if two or more efforts have a cost. */
  best: string | null;
  hasCost: boolean; hasTime: boolean; hasTokens: boolean;
  /** Costs are a subscriber's plan price rather than API price. */
  plan: boolean;
  /** Variants in the ranking, the denominator of each rank. */
  total: number;
}

/** The cheapest effort with a cost whose score is within BEST_VALUE_TOL of the top score. Ties go to the lower effort; none when fewer than two efforts have a cost. */
export function bestValue(list: { id: string; effort: string; score: number; cost?: number }[]): string | null {
  const priced = list.filter((r) => r.cost != null && r.cost >= 0);
  if (priced.length < 2) return null;
  const top = Math.max(...list.map((r) => r.score));
  const near = priced.filter((r) => r.score >= (1 - BEST_VALUE_TOL) * top).sort((a, b) => a.cost! - b.cost! || effortIdx(a.effort) - effortIdx(b.effort));
  return near[0]?.id ?? null;
}

const tenths = (v: number) => Math.round(Number(v.toFixed(1)) * 10);

/** The efforts section's rows: this model's efforts in the ranking joined with cost, time and tokens, in fixed order. */
export function buildEfforts(view: Pick<ModelView, "mine" | "total" | "cost" | "model" | "loose" | "costBasis">): EffortsData {
  const cost = new Map(view.cost.rows.filter((r) => r.modelId === view.model.id).map((r) => [r.id, r]));
  const rows = view.mine.map((m) => {
    const c = cost.get(m.id);
    return { id: m.id, effort: m.effort, score: m.score, rank: m.rank, est: view.loose && m.measuredShare < 1, cost: c?.costUsd != null && c.costUsd >= 0 ? c.costUsd : undefined, tpt: c?.tpt, tokens: c?.tokens };
  });
  const best = bestValue(rows);
  const asc = [...rows].sort((a, b) => effortIdx(a.effort) - effortIdx(b.effort));
  const list: Eff[] = asc.map((r, i) => ({ ...r, best: r.id === best, step: i ? (tenths(r.score) - tenths(asc[i - 1].score)) / 10 : null })).reverse();
  return { list, best, hasCost: rows.some((r) => r.cost != null), hasTime: rows.some((r) => r.tpt != null), hasTokens: rows.some((r) => r.tokens != null), plan: view.costBasis === "subscription", total: view.total };
}

/* ---------- formatters ---------- */

export const fmtStep = (s: number) => (s < 0 ? `-${Math.abs(s).toFixed(1)}` : `+${s.toFixed(1)}`);
/** Cost per task with enough digits that neighbouring efforts stay apart ($0.029, $0.030, $0.15). */
export const usd = (v: number) => (v >= 10 ? `$${Math.round(v)}` : v >= 1 ? `$${v.toFixed(1).replace(/\.0$/, "")}` : v >= 0.1 ? `$${v.toFixed(2)}` : v >= 0.01 ? `$${v.toFixed(3)}` : v === 0 ? "free" : `$${v.toPrecision(2)}`);
export const secs = (v: number) => (v >= 60 ? `${(v / 60).toFixed(v >= 600 ? 0 : 1)} min` : `${v.toFixed(v >= 10 ? 0 : 1)}s`);
export const tokens = (v: number) => (v >= 1000 ? `${(v / 1000).toFixed(v >= 10000 ? 0 : 1)}k` : `${Math.round(v)}`);

/** Where a result placed among `of` results, 0 to 1 (1 = beat every other). */
export const placeOf = (rank: number, of: number) => (of > 1 ? 1 - (rank - 1) / (of - 1) : 1);

/** One benchmark card's rows for this model in fixed order (highest effort first), with the benchmark's best marked. `single` when the card has nothing to compare: a benchmark with its own setting, or one effort. */
export function cardRows(b: Pick<ViewBenchmark, "effortBasis">, mine: BenchRow[]) {
  const rows = byEffortDesc(mine);
  const best = rows.reduce<BenchRow | undefined>((a, r) => (!a || r.rank < a.rank ? r : a), undefined);
  return { rows, best, single: !!b.effortBasis || rows.length < 2 };
}
