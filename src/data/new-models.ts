/**
 * How quickly a benchmark adds new models, measured from Priors' own daily history: for every notable model released since the
 * history began, the days between its release and the first day the benchmark had a published score for it. Worked out by the
 * snapshot build (`scripts/scrape/build.ts`) and kept on the benchmark as `newModels`, so the quality score reads it from the snapshot.
 */
import type { Snapshot } from "./types";

export interface NewModelStats {
  /** Notable models released while Priors has watched this benchmark, and how many of them it has scored. */
  of: number; added: number;
  /** Median days from a model's release to its first score here, over the ones it added. */
  medianDays?: number;
  /** 0 to 100: full credit for a model scored within `FAST_DAYS` of release, none past `SLOW_DAYS` or never; each model weighted by how widely it is tested. */
  score: number;
}

/**
 * A model counts once this many benchmarks have scored it, and counts in proportion to how many have: missing a model nearly every
 * benchmark runs costs far more than missing a small one, and a checkpoint nobody tests says nothing about a benchmark.
 */
export const NOTABLE_BENCHMARKS = 20;
export const FAST_DAYS = 7, SLOW_DAYS = 60;
/** A model this new is left out of a benchmark that has not scored it yet: nobody is late after a few days. */
const GRACE_DAYS = 14;
/** Fewer models than this say too little: the benchmark gets no measurement and quality falls back to coverage of today's top models. */
export const MIN_NEW_MODELS = 3;

const DAY = 86_400_000;
const days = (a: string, b: string) => Math.round((Date.parse(a) - Date.parse(b)) / DAY);
const credit = (lag: number) => lag <= FAST_DAYS ? 1 : lag >= SLOW_DAYS ? 0 : 1 - (lag - FAST_DAYS) / (SLOW_DAYS - FAST_DAYS);

/**
 * `firstSeen`: per benchmark, the first date each model had a published score (`HistoryArchive.firstSeen`, plus today's rows).
 * `start`: the history's first date. A score already there on a benchmark's first watched day says nothing about speed, so only models
 * released after the benchmark was first seen count.
 */
export function newModelStats(snapshot: Snapshot, firstSeen: Map<string, Map<string, string>>, start: string): Map<string, NewModelStats> {
  const today = snapshot.date, benchmarksOf = new Map<string, Set<string>>();
  for (const o of snapshot.observations) { const m = o.variantId.split("@")[0]; (benchmarksOf.get(m) ?? benchmarksOf.set(m, new Set()).get(m)!).add(o.benchmarkId); }
  const notable = snapshot.models.filter((m) => m.kind === "llm" && m.releaseDate && m.releaseDate > start && m.releaseDate <= today && (benchmarksOf.get(m.id)?.size ?? 0) >= NOTABLE_BENCHMARKS);
  const out = new Map<string, NewModelStats>();
  for (const b of snapshot.benchmarks) {
    const seen = firstSeen.get(b.id);
    if (!seen?.size) continue;
    const watchedFrom = [...seen.values()].sort()[0];
    const lags: number[] = [];
    let of = 0, total = 0, weight = 0;
    for (const m of notable) {
      if (m.releaseDate! <= watchedFrom) continue;
      const at = seen.get(m.id);
      if (!at && days(today, m.releaseDate!) < GRACE_DAYS) continue;
      const w = benchmarksOf.get(m.id)!.size;
      of++; weight += w;
      if (at) { const lag = Math.max(0, days(at, m.releaseDate!)); lags.push(lag); total += w * credit(lag); }
    }
    if (of < MIN_NEW_MODELS) continue;
    lags.sort((x, y) => x - y);
    const mid = lags.length >> 1;
    out.set(b.id, { of, added: lags.length, ...(lags.length ? { medianDays: lags.length % 2 ? lags[mid] : Math.round((lags[mid - 1] + lags[mid]) / 2) } : {}), score: Math.round(100 * total / weight) });
  }
  return out;
}

/** Today's rows on top of the archive's first-seen dates: a score that appears today is first seen today. */
export function withToday(firstSeen: Map<string, Map<string, string>>, snapshot: Snapshot, inferred: (o: Snapshot["observations"][number]) => boolean): Map<string, Map<string, string>> {
  for (const o of snapshot.observations) {
    if (inferred(o)) continue;
    const models = firstSeen.get(o.benchmarkId) ?? firstSeen.set(o.benchmarkId, new Map()).get(o.benchmarkId)!, m = o.variantId.split("@")[0];
    if (!models.has(m)) models.set(m, snapshot.date);
  }
  return firstSeen;
}
