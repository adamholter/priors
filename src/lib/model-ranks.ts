import { computeIndex, defaultConfig, defaultReleasedAfter, strictnessOf, type IndexConfig } from "@/engine";
import { categoriesOf } from "@/data/categories";
import type { Snapshot } from "@/data/types";
import { OWN_LABEL } from "./model-ranking-param";
import type { RankSummary, Standing, Unranked } from "./model-rank-text";

/**
 * Where a model stands across rankings, for the model page's header: its place in each ranking on offer, why a ranking leaves it
 * out, and the ranking made for a model no standard ranking places. Pure, so the server works it out for the standard rankings
 * and the browser for a visitor's own. Needs the engine; the words for it are in model-rank-text.ts, which the page loads up front.
 */

const bestOrder = new WeakMap<Snapshot, Map<string, string[]>>();

/** Model ids in a ranking, best first, one per model. `loose` ranks with estimates (strictness 0) like the model page does when a model misses the floor. */
function order(snapshot: Snapshot, config: IndexConfig, loose: boolean): string[] {
  const key = `${loose ? "loose" : "strict"}|${JSON.stringify(config)}`;
  const forSnapshot = bestOrder.get(snapshot) ?? bestOrder.set(snapshot, new Map()).get(snapshot)!;
  let ids = forSnapshot.get(key);
  if (!ids) {
    const seen = new Set<string>();
    ids = computeIndex(snapshot, { ...config, variants: "all", ...(loose ? { strictness: 0 } : {}) }).ranked.flatMap((r) => (seen.has(r.model.id) ? [] : (seen.add(r.model.id), [r.model.id])));
    forSnapshot.set(key, ids);
  }
  return ids;
}

/** The model's place in a ranking: among the models it ranks, else among those it ranks with estimates, else none. */
export function standingIn(snapshot: Snapshot, config: IndexConfig, modelId: string): Standing | null {
  const strict = order(snapshot, config, false), at = strict.indexOf(modelId);
  if (at >= 0) return { rank: at + 1, of: strict.length, loose: false };
  const loose = order(snapshot, config, true), where = loose.indexOf(modelId);
  return where >= 0 ? { rank: where + 1, of: loose.length, loose: true } : null;
}

/** How many benchmarks a ranking weighs and whether it needs all of them. */
export const sizeOf = (config: IndexConfig): Omit<RankSummary, "standing"> => ({ benchmarks: Object.values(config.weights).filter((w) => w > 0).length, allRequired: strictnessOf(config) >= 100 });

export const summarize = (snapshot: Snapshot, config: IndexConfig, modelId: string): RankSummary => ({ ...sizeOf(config), standing: standingIn(snapshot, config, modelId) });

/* ------------------------------------------------------------------ */
/* Why a ranking leaves a model out                                    */
/* ------------------------------------------------------------------ */

/** The reason a ranking has no place for a model, from the benchmarks it has a result on: too little of the mix measured, else released before the ranking's cutoff. */
export function whyUnranked(mix: IndexConfig, measured: Iterable<string>, releaseDate: string | undefined, snapshotDate: string): Unranked {
  const have = new Set(measured), weights = Object.entries(mix.weights).filter(([, w]) => w > 0);
  const total = weights.reduce((n, [, w]) => n + w, 0) || 1;
  const share = weights.filter(([id]) => have.has(id)).reduce((n, [, w]) => n + w, 0) / total;
  const floor = strictnessOf(mix) / 100;
  const cutoff = mix.releasedAfter === undefined ? defaultReleasedAfter(snapshotDate) : mix.releasedAfter;
  return { reason: share + 1e-9 >= floor && cutoff && releaseDate && releaseDate < cutoff ? "release" : "coverage", share, floor, cutoff };
}

/* ------------------------------------------------------------------ */
/* The model's own ranking                                             */
/* ------------------------------------------------------------------ */

/** Units a score in an equal-weight mix can sit on together. */
const OWN_UNITS = new Set(["percent", "elo", "score"]);
const NOT_A_SKILL = new Set(["cost", "speed", "reliability"]);
const OWN_SIZE = 8, OWN_MIN = 3;

export interface OwnRanking { config: IndexConfig; benchmarks: { id: string; name: string; models: number }[] }

const holders = new WeakMap<Snapshot, Map<string, Set<string>>>();
/** The models with a result on each benchmark, worked out once per snapshot. */
function modelsByBenchmark(snapshot: Snapshot): Map<string, Set<string>> {
  let by = holders.get(snapshot);
  if (by) return by;
  by = new Map();
  const modelOf = new Map(snapshot.variants.map((v) => [v.id, v.modelId]));
  for (const o of snapshot.observations) {
    const m = modelOf.get(o.variantId) ?? modelOf.get(o.variantId.split("~")[0]) ?? o.variantId.split("@")[0];
    (by.get(o.benchmarkId) ?? by.set(o.benchmarkId, new Set()).get(o.benchmarkId)!).add(m);
  }
  holders.set(snapshot, by);
  return by;
}

const owns = new WeakMap<Snapshot, Map<string, OwnRanking | null>>();

/**
 * A ranking made of one model's own benchmarks: the eight current ones that the most models have a result on, at equal weight,
 * with the usual floor, every model and every release date. It places any model with at least three such benchmarks, so a model
 * no standard ranking places still gets a score and a place. Its scores are not comparable with a standard ranking's.
 */
export function ownRanking(snapshot: Snapshot, modelId: string): OwnRanking | null {
  const forSnapshot = owns.get(snapshot) ?? owns.set(snapshot, new Map()).get(snapshot)!;
  if (forSnapshot.has(modelId)) return forSnapshot.get(modelId) ?? null;
  const older = new Set(snapshot.benchmarks.map((b) => (b.versionPolicy?.kind === "fresh" ? b.versionPolicy.supersedes : b.versionPolicy?.kind === "fallback" ? b.versionPolicy.fallbackTo : undefined)));
  const eligible = new Map(snapshot.benchmarks.filter((b) => !b.proxy && !b.variantOf && !b.stoppedPublishing && !older.has(b.id) && OWN_UNITS.has(b.unit) && !categoriesOf(b).every((c) => NOT_A_SKILL.has(c)) && !NOT_A_SKILL.has(b.category)).map((b) => [b.id, b]));
  const named = new Set<string>();
  // Two benchmarks can share a short name (the same eval run by two publishers): the one with more models stands for both, so it is not counted twice.
  const mine = [...modelsByBenchmark(snapshot)].filter(([id, set]) => eligible.has(id) && set.has(modelId)).sort((a, b) => b[1].size - a[1].size || a[0].localeCompare(b[0]))
    .filter(([id]) => { const b = eligible.get(id)!, n = (b.shortName ?? b.name).toLowerCase(); if (named.has(n)) return false; named.add(n); return true; }).slice(0, OWN_SIZE);
  const out: OwnRanking | null = mine.length < OWN_MIN ? null : {
    config: { ...defaultConfig(snapshot, "its", OWN_LABEL), weights: Object.fromEntries(mine.map(([id]) => [id, 1])), releasedAfter: "", strictness: 50, variants: "all" },
    benchmarks: mine.map(([id, set]) => ({ id, name: eligible.get(id)!.shortName ?? eligible.get(id)!.name, models: set.size })),
  };
  forSnapshot.set(modelId, out);
  return out;
}
