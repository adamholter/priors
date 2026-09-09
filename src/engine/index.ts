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
  effortMatching?: "calibrated" | "nearest" | "strict";
  strictness?: number;
  optional?: string[];
  rankingVariants?: "all" | "best";
  paretoVariants?: "all" | "best";
  /** Optional filters */
  labs?: string[]; // include only these labIds
  excludeModels?: string[]; // modelIds
  releasedAfter?: string; // ISO date
}

export const DEFAULT_CUTOFF = 5;

export function strictnessOf(config: IndexConfig): number {
  return Math.min(100, Math.max(0, config.strictness ?? (config.cutoff <= 0 ? 100 : 50 * Math.log10(50 / config.cutoff))));
}

export function cutoffOf(config: IndexConfig): number {
  if (config.strictness == null) return config.cutoff;
  const s = strictnessOf(config);
  return s === 100 ? 0 : 50 * Math.pow(0.1, s / 50);
}

export function isBenchmarkRequired(config: IndexConfig, id: string, share: number): boolean {
  return config.required.includes(id) || (!config.optional?.includes(id) && share > cutoffOf(config));
}

export function chartVariantMode(config: IndexConfig, chart: "ranking" | "pareto"): "all" | "best" {
  return chart === "ranking" ? config.rankingVariants ?? "best" : config.paretoVariants ?? "all";
}

export function selectVariants(ranked: RankedVariant[], mode: "all" | "best"): RankedVariant[] {
  const seen = new Set<string>();
  const out = ranked.filter((r) => {
    if (mode === "best" && seen.has(r.model.id)) return false;
    seen.add(r.model.id);
    return true;
  }).map((r, i) => ({ ...r, rank: i + 1, onFrontier: false }));
  markFrontier(out);
  return out;
}

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

/** First-visit mix, matching the shared General frontier configuration. */
export function defaultConfig(_snapshot: Snapshot, id = "general", name = "General frontier"): IndexConfig {
  return {
    id, name,
    weights: { "deepswe-1.1": 43, "terminalbench-4": 54, "arc-agi-3": 9, "simplebench": 38, "bsbench-v2": 12, "aa-humanitys-last-exam": 37, "aa-omniscience": 24, "frontiermath-tier-4-v2": 42 },
    required: [], optional: ["deepswe-1.1"], strictness: 20, cutoff: 20,
    estimateMissing: true, variants: "best",
  };
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
  estimateKind?: "effort" | "calibrated-fallback" | "performance" | "peer";
  /** which concrete benchmark supplied it (fallback versions) */
  from?: string;
  sourceVariantId?: string;
  sourceUrl?: string;
  substituted?: boolean;
  effortFactor?: number;
  evidence?: string[];
}

export interface RankedVariant {
  variant: Variant;
  model: Model;
  score: number;
  /** share of total weight backed by observed (not estimated) values */
  coverage: number;
  values: BenchValue[];
  mixedEfforts?: boolean;
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
  for (const estimate of snapshot.estimates ?? []) {
    let m = idx.get(estimate.benchmarkId);
    if (!m) idx.set(estimate.benchmarkId, (m = new Map()));
    if (!m.has(estimate.variantId)) m.set(estimate.variantId, {
      benchmarkId: estimate.benchmarkId, variantId: estimate.variantId, value: estimate.value,
      observedAt: "", sourceUrl: estimate.sourceUrl ?? "", sourceModelId: estimate.sourceVariantId, details: { priorsEstimate: estimate },
    });
  }
  return idx;
}

function inferredObservation(o: Observation) {
  return Boolean(o.details?.priorsEstimate || (o.details?.realIndex as { effortAttribution?: string } | undefined)?.effortAttribution === "assumed-top");
}

/** Resolve a logical benchmark value through fallback chains. */
function lookup(idx: ObsIndex, benches: Map<string, Benchmark>, benchmarkId: string, variantId: string, depth = 0, allowEstimated = true, allowCrossEffort = true): { obs: Observation; from: string; value?: number; estimated?: boolean; evidence?: string[] } | undefined {
  const o = idx.get(benchmarkId)?.get(variantId);
  const explicitEstimate = o?.details?.priorsEstimate as { sourceBenchmarkId?: string; estimateKind?: string; evidence?: string[] } | undefined;
  const assumedTop = (o?.details?.realIndex as { effortAttribution?: string } | undefined)?.effortAttribution === "assumed-top";
  if (o && (!(explicitEstimate || assumedTop) || allowEstimated) && (allowCrossEffort || !["cross-effort", "performance"].includes(explicitEstimate?.estimateKind ?? ""))) return {
    obs: o, from: explicitEstimate?.sourceBenchmarkId ?? benchmarkId,
    estimated: Boolean(explicitEstimate || assumedTop), evidence: explicitEstimate?.evidence ?? (assumedTop ? ["Real Index Top-effort assumption; native effort not published"] : undefined),
  };
  const b = benches.get(benchmarkId);
  if (b?.versionPolicy?.kind === "fallback" && depth < 4) {
    const version = lookup(idx, benches, b.versionPolicy.fallbackTo, variantId, depth + 1, allowEstimated, allowCrossEffort);
    if (version) return version;
  }
  if (allowEstimated && depth < 4) {
    for (const route of b?.estimationRoutes ?? []) {
      const source = idx.get(route.sourceId)?.get(variantId);
      const factor = route.variantFactors?.[variantId] ?? route.factor;
      if (!source || inferredObservation(source) || !Number.isFinite(factor) || factor < 0) continue;
      return {
        obs: source, from: route.sourceId, value: clamp(source.value * factor, 0, 100), estimated: true,
        evidence: [route.evidenceId, ...(route.variantFactors?.[variantId] == null ? [] : ["Release-specific paired calibration"]), ...(route.pairedCount == null ? [] : [`${route.pairedCount} paired configurations`])],
      };
    }
  }
  return undefined;
}

function lookupEffort(idx: ObsIndex, benches: Map<string, Benchmark>, benchmarkId: string, variant: Variant, strictEffort: boolean, allowEstimated: boolean) {
  const exact = lookup(idx, benches, benchmarkId, variant.id, 0, allowEstimated, !strictEffort);
  if (exact || strictEffort) return exact;
  const order = ["none", "minimal", "low", "medium", "high", "xhigh", "max", "default"];
  const target = order.indexOf(variant.effort);
  const visited = new Set<string>();
  let id: string | undefined = benchmarkId;
  while (id && !visited.has(id)) {
    visited.add(id);
    const candidates = [...(idx.get(id)?.values() ?? [])].filter((o) => !inferredObservation(o) && o.variantId.startsWith(`${variant.modelId}@`) && o.variantId.split("~")[1] === variant.id.split("~")[1]);
    candidates.sort((a, b) => {
      const ai = order.indexOf(a.variantId.split("@")[1].split("~")[0]), bi = order.indexOf(b.variantId.split("@")[1].split("~")[0]);
      return Math.abs(ai - target) - Math.abs(bi - target) || ai - bi || a.variantId.localeCompare(b.variantId);
    });
    if (candidates.length) return { obs: candidates[0], from: id };
    const policy: Benchmark["versionPolicy"] = benches.get(id)?.versionPolicy;
    id = policy?.kind === "fallback" ? policy.fallbackTo : undefined;
  }
  return undefined;
}

function effortAdjustment(idx: ObsIndex, benches: Map<string, Benchmark>, normalize: Map<string, (v: number) => number>, targetBenchmark: string, target: Variant, source: Observation, strictness: number) {
  const order = ["none", "minimal", "low", "medium", "high", "xhigh", "max"];
  const from = order.indexOf(source.variantId.split("@")[1].split("~")[0]), to = order.indexOf(target.effort);
  if (from < 0 || to < 0 || strictness === 100 || (strictness >= 85 && Math.abs(from - to) > 1)) return undefined;
  const related = new Set([targetBenchmark, source.benchmarkId]);
  for (let changed = true; changed;) {
    changed = false;
    for (const b of benches.values()) {
      const link = b.versionPolicy?.kind === "fallback" ? b.versionPolicy.fallbackTo : b.versionPolicy?.supersedes;
      if (link && (related.has(b.id) || related.has(link)) && (!related.has(b.id) || !related.has(link))) {
        related.add(b.id); related.add(link); changed = true;
      }
    }
  }
  const comparisons: { id: string; numerator: number; denominator: number }[] = [];
  for (const b of benches.values()) {
    if (related.has(b.id) || b.proxy || ["cost", "speed", "composite"].includes(b.category)) continue;
    const a = idx.get(b.id)?.get(target.id), donor = idx.get(b.id)?.get(source.variantId);
    if (!a || !donor || inferredObservation(a) || inferredObservation(donor) || a.harness !== donor.harness || /estimated/i.test(`${a.note ?? ""} ${donor.note ?? ""}`)) continue;
    const denominator = normalize.get(b.id)!(donor.value), numerator = normalize.get(b.id)!(a.value);
    if (!Number.isFinite(numerator) || !Number.isFinite(denominator) || denominator < 5) continue;
    comparisons.push({ id: b.id, numerator, denominator });
  }
  const minimum = strictness >= 95 ? 3 : strictness >= 75 ? 2 : 1;
  if (comparisons.length < minimum) return undefined;
  comparisons.sort((a, b) => a.id.localeCompare(b.id));
  // Ratio of means over paired, directly measured benchmarks. Each benchmark counts once.
  const factor = comparisons.reduce((sum, c) => sum + c.numerator, 0) / comparisons.reduce((sum, c) => sum + c.denominator, 0);
  return { effortFactor: factor, evidence: comparisons.map((c) => c.id) };
}

/** Percent benchmarks are used raw; everything else is min-max scaled over the pool of values present. */
function makeNormalizer(b: Benchmark, values: number[]): (v: number) => number {
  if (b.normalization?.kind === "linear") {
    const { min, max } = b.normalization;
    return (v) => clamp((b.higherIsBetter ? (v - min) : (max - v)) / (max - min) * 100, 0, 100);
  }
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
  const strictness = strictnessOf(config);
  const shares = used.map(([id, w]) => ({ benchmark: benches.get(id)!, share: (w / total) * 100, required: isBenchmarkRequired(config, id, (w / total) * 100) }));
  const normalizeMeasured = new Map(snapshot.benchmarks.map((b) => [b.id, makeNormalizer(b, [...(idx.get(b.id)?.values() ?? [])].map((o) => o.value))]));

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
  type Resolved = { normalizedEstimate: boolean; raw: number; from: string; sourceVariantId: string; sourceUrl: string; substituted: boolean; estimateKind?: BenchValue["estimateKind"]; effortFactor?: number; evidence?: string[] };
  const rawByBench = new Map<string, Map<string, Resolved>>();
  for (const s of shares) {
    const m = new Map<string, Resolved>();
    for (const v of pool) {
      const r = lookupEffort(idx, benches, s.benchmark.id, v, config.effortMatching === "strict" || strictness === 100 || s.benchmark.proxy === true || ["cost", "speed"].includes(s.benchmark.category), strictness < 100);
      if (!r) continue;
      const substituted = r.obs.variantId !== v.id;
      const adjustment = substituted ? effortAdjustment(idx, benches, normalizeMeasured, s.benchmark.id, v, r.obs, strictness) : undefined;
      if (substituted && !adjustment) continue;
      const shippedKind = (r.obs.details?.priorsEstimate as { estimateKind?: string } | undefined)?.estimateKind;
      m.set(v.id, { normalizedEstimate: Boolean(r.obs.details?.priorsEstimate), raw: r.value ?? r.obs.value, from: r.from, sourceVariantId: (r.obs.details?.priorsEstimate as { sourceVariantId?: string } | undefined)?.sourceVariantId ?? r.obs.variantId, sourceUrl: r.obs.sourceUrl, substituted: substituted || r.estimated === true, estimateKind: r.estimated ? (shippedKind === "cross-effort" ? "effort" : shippedKind === "performance" ? "performance" : "calibrated-fallback") : substituted ? "effort" : undefined, ...adjustment, evidence: [...(r.evidence ?? []), ...(adjustment?.evidence ?? [])] });
    }
    rawByBench.set(s.benchmark.id, m);
  }
  const norm = new Map(shares.map((s) => [s.benchmark.id, makeNormalizer(s.benchmark, [...rawByBench.get(s.benchmark.id)!.values()].map((x) => x.raw))]));
  const normValue = (bid: string, vid: string) => { const r = rawByBench.get(bid)!.get(vid); return r ? { ...r, value: clamp(norm.get(bid)!(r.raw) * (r.effortFactor ?? 1), 0, 100) } : undefined; };
  const observedValue = (bid: string, vid: string) => { const v = normValue(bid, vid); return v?.substituted ? undefined : v; };

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
      if (nv) {
        const { raw, normalizedEstimate, ...publicValue } = nv;
        values.push({ benchmarkId: s.benchmark.id, ...publicValue, ...(normalizedEstimate || nv.estimateKind === "calibrated-fallback" ? {} : { raw }), estimated: nv.substituted });
        num += nv.value * s.share; den += s.share; if (!nv.substituted) covered += s.share; continue;
      }
      if (!config.estimateMissing || strictness === 100) continue; // renormalize: just skip
      const est = estimate(v, s.benchmark.id, pool, shares.map((x) => x.benchmark.id), observedValue, models, 5, strictness);
      if (est != null) { values.push({ benchmarkId: s.benchmark.id, value: est, estimated: true, estimateKind: "peer" }); num += est * s.share; den += s.share; }
    }
    if (den <= 0) continue;
    const cost = costFor(snapshot, idx, v.id, shares.map((s) => ({ id: s.benchmark.id, share: s.share })));
    const speedObs = idx.get(SPEED_BENCHMARK)?.get(v.id);
    ranked.push({ variant: v, model, score: num / den, coverage: Math.min(1, Math.round(covered * 1e4) / 1e6), values, mixedEfforts: values.some((value) => value.estimateKind === "effort"), costUsd: cost?.usd, costSource: cost?.source, speed: speedObs && speedObs.value > 0 ? speedObs.value : undefined, onFrontier: false, rank: 0 });
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
  normValue: (bid: string, vid: string) => { value: number } | undefined, models: Map<string, Model>, k = 5, strictness = 50,
): number | undefined {
  const tm = models.get(target.modelId);
  const tVals = new Map(benchIds.filter((b) => b !== benchmarkId).map((b) => [b, normValue(b, target.id)?.value]).filter((x): x is [string, number] => x[1] != null));
  if (tVals.size < 1) return undefined;
  const cands: { dist: number; adj: number }[] = [];
  for (const p of pool) {
    if (p.modelId === target.modelId) continue; // don't lean on sibling efforts; they share the gap
    const pv = normValue(benchmarkId, p.id); if (!pv) continue;
    const pm = models.get(p.modelId);
    if (tm?.releaseDate && pm?.releaseDate && Math.abs(daysBetween(tm.releaseDate, pm.releaseDate)) > 365 - strictness * 2.75) continue;
    if (tm?.priceTier && pm?.priceTier && tm.priceTier !== pm.priceTier) continue;
    let d = 0, n = 0, off = 0;
    for (const [b, tv] of tVals) { const x = normValue(b, p.id)?.value; if (x == null) continue; d += Math.abs(tv - x); off += tv - x; n++; }
    if (n < (strictness >= 75 ? 2 : 1)) continue;
    cands.push({ dist: d / n + (n < 2 ? 10 : 0), adj: pv.value + off / n });
  }
  if (!cands.length) return undefined;
  cands.sort((a, b) => a.dist - b.dist);
  const top = cands.slice(0, k);
  const wsum = top.reduce((a, c) => a + 1 / (1 + c.dist), 0);
  return clamp(top.reduce((a, c) => a + (c.adj * (1 / (1 + c.dist))) / wsum, 0), 0, 100);
}

function daysBetween(a: string, b: string) { return (new Date(a).getTime() - new Date(b).getTime()) / 86_400_000; }

function costFor(snapshot: Snapshot, idx: ObsIndex, variantId: string, benchWeights: { id: string; share: number }[]): { usd: number; source: string } | undefined {
  const perTask = benchWeights.map((b) => ({ ...b, obs: idx.get(b.id)?.get(variantId) }));
  if (perTask.length && perTask.every((b) => b.obs?.sourceModelId && b.obs.costUsd != null && b.obs.costUsd >= 0)) {
    return { usd: perTask.reduce((sum, b) => sum + b.obs!.costUsd! * b.share / 100, 0), source: "AA measured task costs, weighted by this mix" };
  }
  const benchIds = benchWeights.map((b) => b.id);
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
