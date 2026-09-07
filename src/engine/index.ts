import type { Benchmark, Model, Observation, Snapshot, Variant } from "../data/types";

/* ------------------------------------------------------------------ */
/* Config                                                              */
/* ------------------------------------------------------------------ */

export interface IndexConfig {
  id: string;
  name: string;
  /** benchmarkId -> weight (any positive scale; shares are computed). 0 or absent = not included. */
  weights: Record<string, number>;
  /** Explicitly required benchmarks: a variant without a value here is excluded. */
  required: string[];
  /** Any benchmark whose share of total weight exceeds this percent is implicitly required. Default 5. */
  cutoff: number;
  /** For missing non-required benchmarks: estimate from peers (true) or renormalize weights (false). */
  estimateMissing: boolean;
  /** Rank every reasoning-effort variant, or only each model's best variant. */
  variants: "all" | "best";
  /** Optional filters */
  labs?: string[]; // include only these labIds
  excludeModels?: string[]; // modelIds
  releasedAfter?: string; // ISO date
}

export const DEFAULT_CUTOFF = 5;

/** Preferred starter mix, applied only where coverage of the current frontier is high. */
const STARTER: Record<string, number> = {
  "aa-terminalbench-v2-1": 15, "deepswe-1.1": 15, "arena-agent": 15, "aa-gdpval-aa": 15,
  "aa-tau3-banking": 10, "aa-humanitys-last-exam": 10, "aa-briefcase": 10, "simplebench": 10,
  "terminalbench-4": 15, "frontierswe-v2": 15, "arc-agi-2": 10, "bsbench-v2": 10,
};

/** Models that matter right now: the top of the newest AA intelligence index (fallback: most-observed models). */
export function frontierModels(snapshot: Snapshot, n = 30): Set<string> {
  const ii = snapshot.benchmarks.filter((b) => b.id.startsWith("aa-intelligence-index")).sort((a, b) => b.id.localeCompare(a.id))[0];
  if (ii) {
    const top = snapshot.observations.filter((o) => o.benchmarkId === ii.id).sort((a, b) => b.value - a.value).slice(0, n);
    const set = new Set(top.map((o) => o.variantId.split("@")[0]));
    if (set.size >= 8) return set;
  }
  const count = new Map<string, number>();
  for (const o of snapshot.observations) { const m = o.variantId.split("@")[0]; count.set(m, (count.get(m) ?? 0) + 1); }
  return new Set([...count.entries()].sort((a, b) => b[1] - a[1]).slice(0, n).map(([m]) => m));
}

/**
 * Default index: benchmarks that cover almost all currently relevant models, so the default
 * page ranks the frontier rather than the intersection of small leaderboards. Users add the
 * narrower benchmarks themselves (and control the cutoff).
 */
export function defaultConfig(snapshot: Snapshot, id = "general", name = "General frontier", minCoverage = 0.75, max = 7): IndexConfig {
  const relevant = frontierModels(snapshot);
  const cands = snapshot.benchmarks
    .filter((b) => b.eligibleForDefault && !b.proxy && b.category !== "speed" && b.category !== "cost")
    .map((b) => ({ b, cov: coverageOf(snapshot, b.id, relevant), w: STARTER[b.id] ?? b.defaultWeight ?? 5 }))
    .filter((x) => x.cov >= minCoverage)
    .sort((a, b) => b.w - a.w || b.cov - a.cov)
    .slice(0, max);
  const weights: Record<string, number> = {};
  for (const c of cands) weights[c.b.id] = c.w;
  if (!Object.keys(weights).length) for (const b of snapshot.benchmarks) if (b.eligibleForDefault && b.defaultWeight) weights[b.id] = b.defaultWeight;
  return { id, name, weights, required: [], cutoff: DEFAULT_CUTOFF, estimateMissing: true, variants: "all" };
}

/* ------------------------------------------------------------------ */
/* Results                                                             */
/* ------------------------------------------------------------------ */

export interface BenchValue {
  benchmarkId: string;
  /** normalized 0-100 (percent benchmarks are raw; others min-max over the pool, inverted if lower is better) */
  value: number;
  raw?: number;
  estimated: boolean;
  /** which concrete benchmark supplied it (fallback versions) */
  from?: string;
}

export interface RankedVariant {
  variant: Variant;
  model: Model;
  score: number;
  /** share of total weight backed by observed (not estimated) values */
  coverage: number;
  values: BenchValue[];
  /** measured cost per task, when known */
  costUsd?: number;
  costSource?: string;
  /** output speed tok/s when known */
  speed?: number;
  onFrontier: boolean;
  rank: number;
}

export interface IndexResult {
  config: IndexConfig;
  /** benchmarks actually used (weight > 0), with resolved shares */
  benchmarks: { benchmark: Benchmark; share: number; required: boolean }[];
  ranked: RankedVariant[];
  /** variants excluded and why */
  excluded: { variant: Variant; model: Model; missing: string[] }[];
}

/* ------------------------------------------------------------------ */
/* Engine                                                              */
/* ------------------------------------------------------------------ */

type ObsIndex = Map<string, Map<string, Observation>>; // benchmarkId -> variantId -> obs

function indexObservations(snapshot: Snapshot): ObsIndex {
  const idx: ObsIndex = new Map();
  for (const o of snapshot.observations) {
    let m = idx.get(o.benchmarkId);
    if (!m) idx.set(o.benchmarkId, (m = new Map()));
    // prefer rows without harness (source's canonical) or first seen
    if (!m.has(o.variantId)) m.set(o.variantId, o);
  }
  return idx;
}

/** Resolve a logical benchmark value through fallback chains. */
function lookup(idx: ObsIndex, benches: Map<string, Benchmark>, benchmarkId: string, variantId: string, depth = 0): { obs: Observation; from: string } | undefined {
  const o = idx.get(benchmarkId)?.get(variantId);
  if (o) return { obs: o, from: benchmarkId };
  const b = benches.get(benchmarkId);
  if (b?.versionPolicy?.kind === "fallback" && depth < 4) return lookup(idx, benches, b.versionPolicy.fallbackTo, variantId, depth + 1);
  return undefined;
}

/** Percent benchmarks are used raw; everything else is min-max scaled over the pool of values present. */
function makeNormalizer(b: Benchmark, values: number[]): (v: number) => number {
  if (b.unit === "percent" && b.higherIsBetter) return (v) => clamp(v, 0, 100);
  if (b.unit === "percent" && !b.higherIsBetter) return (v) => clamp(100 - v, 0, 100);
  const finite = values.filter(Number.isFinite);
  if (finite.length < 2) return () => 50;
  // log scale for cost-like units so a 10x cheaper model isn't crushed into the corner
  const tf = b.unit === "usd" ? (x: number) => Math.log10(Math.max(x, 1e-6)) : (x: number) => x;
  const t = finite.map(tf);
  const lo = Math.min(...t), hi = Math.max(...t);
  if (hi - lo < 1e-9) return () => 50;
  return (v) => { const s = ((tf(v) - lo) / (hi - lo)) * 100; return b.higherIsBetter ? s : 100 - s; };
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

export const COST_BENCHMARK_PREFERENCE = ["aa-cost-per-task-index"];
export const SPEED_BENCHMARK = "aa-output-speed";

export function computeIndex(snapshot: Snapshot, config: IndexConfig): IndexResult {
  const benches = new Map(snapshot.benchmarks.map((b) => [b.id, b]));
  const models = new Map(snapshot.models.map((m) => [m.id, m]));
  const idx = indexObservations(snapshot);

  const used = Object.entries(config.weights).filter(([id, w]) => w > 0 && benches.has(id));
  const total = used.reduce((a, [, w]) => a + w, 0);
  if (!used.length || total <= 0) return { config, benchmarks: [], ranked: [], excluded: [] };
  const shares = used.map(([id, w]) => ({ benchmark: benches.get(id)!, share: (w / total) * 100, required: config.required.includes(id) || (w / total) * 100 > config.cutoff }));

  // pool: llm variants with at least one used benchmark value, passing filters
  const pool = snapshot.variants.filter((v) => {
    const m = models.get(v.modelId);
    if (!m || m.kind !== "llm") return false;
    if (config.labs?.length && !config.labs.includes(m.labId)) return false;
    if (config.excludeModels?.includes(m.id)) return false;
    if (config.releasedAfter && m.releaseDate && m.releaseDate < config.releasedAfter) return false;
    return shares.some((s) => lookup(idx, benches, s.benchmark.id, v.id));
  });

  // raw values per benchmark over the pool -> normalizers
  const rawByBench = new Map<string, Map<string, { raw: number; from: string }>>();
  for (const s of shares) {
    const m = new Map<string, { raw: number; from: string }>();
    for (const v of pool) { const r = lookup(idx, benches, s.benchmark.id, v.id); if (r) m.set(v.id, { raw: r.obs.value, from: r.from }); }
    rawByBench.set(s.benchmark.id, m);
  }
  const norm = new Map(shares.map((s) => [s.benchmark.id, makeNormalizer(s.benchmark, [...rawByBench.get(s.benchmark.id)!.values()].map((x) => x.raw))]));
  const normValue = (bid: string, vid: string) => { const r = rawByBench.get(bid)!.get(vid); return r ? { value: norm.get(bid)!(r.raw), raw: r.raw, from: r.from } : undefined; };

  // eligibility
  const ranked: RankedVariant[] = [];
  const excluded: IndexResult["excluded"] = [];
  for (const v of pool) {
    const model = models.get(v.modelId)!;
    const missingRequired = shares.filter((s) => s.required && !rawByBench.get(s.benchmark.id)!.has(v.id)).map((s) => s.benchmark.id);
    if (missingRequired.length) { excluded.push({ variant: v, model, missing: missingRequired }); continue; }

    const values: BenchValue[] = [];
    let num = 0, den = 0, covered = 0;
    for (const s of shares) {
      const nv = normValue(s.benchmark.id, v.id);
      if (nv) { values.push({ benchmarkId: s.benchmark.id, value: nv.value, raw: nv.raw, estimated: false, from: nv.from }); num += nv.value * s.share; den += s.share; covered += s.share; continue; }
      if (!config.estimateMissing) continue; // renormalize: just skip
      const est = estimate(v, s.benchmark.id, pool, shares.map((x) => x.benchmark.id), normValue, models);
      if (est != null) { values.push({ benchmarkId: s.benchmark.id, value: est, estimated: true }); num += est * s.share; den += s.share; }
    }
    if (den <= 0) continue;
    const cost = costFor(snapshot, idx, v.id, shares.map((s) => s.benchmark.id));
    const speedObs = idx.get(SPEED_BENCHMARK)?.get(v.id);
    ranked.push({ variant: v, model, score: num / den, coverage: Math.min(1, Math.round(covered * 1e4) / 1e6), values, costUsd: cost?.usd, costSource: cost?.source, speed: speedObs && speedObs.value > 0 ? speedObs.value : undefined, onFrontier: false, rank: 0 });
  }

  let out = ranked;
  if (config.variants === "best") {
    const best = new Map<string, RankedVariant>();
    for (const r of ranked) { const b = best.get(r.model.id); if (!b || r.score > b.score) best.set(r.model.id, r); }
    out = [...best.values()];
  }
  out.sort((a, b) => b.score - a.score);
  out.forEach((r, i) => (r.rank = i + 1));
  markFrontier(out);
  return { config, benchmarks: shares, ranked: out, excluded };
}

/**
 * Peer estimate for a missing benchmark: k nearest variants (by mean abs diff on shared
 * normalized scores) that do have the benchmark, restricted to a release window when dates
 * exist. Returns the peers' value shifted by the target's average offset on shared benchmarks.
 */
function estimate(
  target: Variant, benchmarkId: string, pool: Variant[], benchIds: string[],
  normValue: (bid: string, vid: string) => { value: number } | undefined, models: Map<string, Model>, k = 5,
): number | undefined {
  const tm = models.get(target.modelId);
  const tVals = new Map(benchIds.filter((b) => b !== benchmarkId).map((b) => [b, normValue(b, target.id)?.value]).filter((x): x is [string, number] => x[1] != null));
  if (tVals.size < 1) return undefined;
  const cands: { dist: number; adj: number }[] = [];
  for (const p of pool) {
    if (p.modelId === target.modelId) continue; // don't lean on sibling efforts; they share the gap
    const pv = normValue(benchmarkId, p.id); if (!pv) continue;
    const pm = models.get(p.modelId);
    if (tm?.releaseDate && pm?.releaseDate && Math.abs(daysBetween(tm.releaseDate, pm.releaseDate)) > 270) continue;
    if (tm?.priceTier && pm?.priceTier && tm.priceTier !== pm.priceTier) continue;
    let d = 0, n = 0, off = 0;
    for (const [b, tv] of tVals) { const x = normValue(b, p.id)?.value; if (x == null) continue; d += Math.abs(tv - x); off += tv - x; n++; }
    if (n < 1) continue;
    cands.push({ dist: d / n + (n < 2 ? 10 : 0), adj: pv.value + off / n });
  }
  if (!cands.length) return undefined;
  cands.sort((a, b) => a.dist - b.dist);
  const top = cands.slice(0, k);
  const wsum = top.reduce((a, c) => a + 1 / (1 + c.dist), 0);
  return clamp(top.reduce((a, c) => a + (c.adj * (1 / (1 + c.dist))) / wsum, 0), 0, 100);
}

function daysBetween(a: string, b: string) { return (new Date(a).getTime() - new Date(b).getTime()) / 86_400_000; }

function costFor(snapshot: Snapshot, idx: ObsIndex, variantId: string, benchIds: string[]): { usd: number; source: string } | undefined {
  for (const b of COST_BENCHMARK_PREFERENCE) { const o = idx.get(b)?.get(variantId); if (o && o.value > 0) return { usd: o.value, source: b }; }
  const costs: number[] = [];
  for (const b of benchIds) { const o = idx.get(b)?.get(variantId); if (o?.costUsd && o.costUsd > 0) costs.push(o.costUsd); }
  if (costs.length) return { usd: costs.reduce((a, c) => a + c, 0) / costs.length, source: "mean of benchmark run costs" };
  void snapshot;
  return undefined;
}

/** Pareto frontier over (cost asc, score): a point is on the frontier if no cheaper point scores >= it. */
export function markFrontier(ranked: RankedVariant[]) {
  const pts = ranked.filter((r) => r.costUsd != null).sort((a, b) => a.costUsd! - b.costUsd! || b.score - a.score);
  let best = -Infinity;
  for (const p of pts) { p.onFrontier = p.score > best; if (p.onFrontier) best = p.score; }
}

/* ------------------------------------------------------------------ */
/* Default view: benchmarks with high coverage of currently relevant models */
/* ------------------------------------------------------------------ */

export function coverageOf(snapshot: Snapshot, benchmarkId: string, relevant: Set<string>): number {
  const have = new Set(snapshot.observations.filter((o) => o.benchmarkId === benchmarkId).map((o) => o.variantId.split("@")[0]));
  let n = 0; for (const m of relevant) if (have.has(m)) n++;
  return relevant.size ? n / relevant.size : 0;
}
