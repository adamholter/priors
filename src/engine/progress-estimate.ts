import type { Snapshot } from "../data/types";
import type { IndexResult, RankedVariant } from "./index";

/** How an index score was estimated for a model the index could not score: AA's Progress Index, mapped through a fit on the models that have both. */
export interface ScoreEstimate { benchmarkId: string; progress: number; pairs: number; r2: number }

const MIN_PAIRS = 8, MIN_R2 = 0.9;

/** AA's newest Progress Index: one capability scale across model generations, published for nearly every model AA lists. */
export const progressBenchmarkId = (snapshot: Snapshot) => snapshot.benchmarks.filter((b) => b.id.startsWith("aa-progress-index")).map((b) => b.id).sort().at(-1);

/**
 * Index scores for models the index leaves out for coverage (Artificial Analysis runs its current
 * evaluations only on recent models, so older ones lack most of an index built from them).
 * Fits log(score) = a + b × Progress Index over the ranked variants that have both, and maps each left-out
 * variant's Progress Index through it. Only with enough pairs and a close fit (R² ≥ 0.9), never above the
 * highest paired Progress Index, and never for a model the index scores or a benchmark the user required.
 * Only the release-date chart draws these: they place a model in time, they do not rank it.
 */
export function progressEstimates(snapshot: Snapshot, ranked: RankedVariant[], excluded: IndexResult["excluded"], bestOnly: boolean): RankedVariant[] {
  const id = progressBenchmarkId(snapshot);
  if (!id) return [];
  const progress = new Map<string, number>();
  for (const o of snapshot.observations) if (o.benchmarkId === id && Number.isFinite(o.value)) progress.set(o.variantId, o.value);
  const pairs = ranked.flatMap((r) => { const p = progress.get(r.variant.id); return p != null && r.score > 0 ? [[p, r.score] as const] : []; });
  if (pairs.length < MIN_PAIRS) return [];
  const n = pairs.length, mx = pairs.reduce((s, [x]) => s + x, 0) / n, my = pairs.reduce((s, [, y]) => s + Math.log(y), 0) / n;
  const sxx = pairs.reduce((s, [x]) => s + (x - mx) ** 2, 0);
  if (sxx <= 0) return [];
  const b = pairs.reduce((s, [x, y]) => s + (x - mx) * (Math.log(y) - my), 0) / sxx, a = my - b * mx;
  const fit = (x: number) => Math.exp(a + b * x);
  const mean = pairs.reduce((s, [, y]) => s + y, 0) / n;
  const r2 = 1 - pairs.reduce((s, [x, y]) => s + (y - fit(x)) ** 2, 0) / pairs.reduce((s, [, y]) => s + (y - mean) ** 2, 0);
  if (!(b > 0) || !(r2 >= MIN_R2)) return [];
  const top = Math.max(...pairs.map(([x]) => x)), scored = new Set(ranked.map((r) => r.model.id));
  const out: RankedVariant[] = [];
  for (const e of excluded) {
    const p = progress.get(e.variant.id);
    if (e.reason !== "coverage" || p == null || p > top || scored.has(e.model.id)) continue;
    const scoreEstimate: ScoreEstimate = { benchmarkId: id, progress: p, pairs: n, r2 };
    out.push({ variant: e.variant, model: e.model, score: fit(p), coverage: 0, measuredShare: e.measuredShare, values: [], onFrontier: false, rank: 0, scoreEstimate });
  }
  if (!bestOnly) return out;
  const best = new Map<string, RankedVariant>();
  for (const r of out) if (!best.has(r.model.id) || r.score > best.get(r.model.id)!.score) best.set(r.model.id, r);
  return [...best.values()];
}
