import { planResetBoosts } from "../data/plan-resets";
import { effectiveBasis, subscriptionPrices, type CostBasis, type SubscriptionPrice } from "../data/subscription";
import { supersededModelIds } from "./superseded";
import { progressEstimates, type ScoreEstimate } from "./progress-estimate";
import { taskMetricData, taskMetricDescription, type TaskMetricSource } from "../data/task-metrics";
import type { Benchmark, FocusId, Model, Observation, Snapshot, SpeedTierId, Variant } from "../data/types";
import { columnsOf, DEFAULT_RANK, effortLocked, ROW_FLAGS, type Columns, type EstimationRoute } from "../data/columns";
import { AA_V5_WEIGHTS, aaComponentWeights } from "../data/aa-index";

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
  /** Legacy field: `cut=` URLs derive strictness from it via strictnessOf. Default 5. */
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
  /** Reasoning efforts the cost, time and speed charts show; unset shows every effort except `none`. Models without effort levels always show. */
  efforts?: string[];
  /** Efforts the ranking list shows; unset shows them all. */
  rankingEfforts?: string[];
  /** Speed tiers the cost, time and speed charts show (`standard`, `flex`, `fast`, `ultrafast`); unset is standard only. A model without a picked tier stays at standard. */
  speedTiers?: string[];
  costSource?: TaskMetricSource;
  /** Price cost per task at API list prices (default) or at the lab's subscription plan. */
  costBasis?: CostBasis;
  /** `true`: plans are cheaper by what limit resets gave their subscribers in the last 30 days. Off by default: the plan is priced as measured. Only matters on the subscription basis. (`false` is what older saved configs carry: the same as unset.) */
  planResets?: boolean;
  /** `false`: a model free today is priced on its paid plans, or API price with none. Unset counts free tiers. Only matters on the subscription basis. */
  freeTiers?: boolean;
  /** Which reading of a model's plan rate to use where there are two (Fable 5.2: unset is the shared weekly limit, "own" counts only the Fable a plan can buy). Only matters on the subscription basis. */
  planReading?: string;
  /** Subscription basis: the plan to price each lab's models at (lab id → plan name, from the source's plan list). A lab not named, or a model without that plan, uses its median plan. */
  subscriptionPlans?: Record<string, string>;
  timeSource?: TaskMetricSource;
  /** Optional filters */
  labs?: string[]; // include only these labIds
  excludeModels?: string[]; // modelIds
  /** Legacy allowlist. New visibility choices use `excludeModels` so future models can rank. */
  onlyModels?: string[];
  releasedAfter?: string; // ISO date
  /** Highlighted models on charts: model ids (their best effort) or variant ids (that effort). Ranking ignores it. */
  highlight?: string[];
  /** Onboarding focus preset that produced this index; ranking ignores it. */
  focus?: FocusId;
}

export const DEFAULT_CUTOFF = 5;

export function strictnessOf(config: IndexConfig): number {
  return Math.min(100, Math.max(0, config.strictness ?? (config.cutoff <= 0 ? 100 : 50 * Math.log10(50 / config.cutoff))));
}

export function isBenchmarkRequired(config: IndexConfig, id: string): boolean {
  return config.required.includes(id);
}

/** Minimum share of index weight a variant must have measured data for: strictness percent as a fraction. */
export function minMeasuredShare(config: IndexConfig): number {
  return strictnessOf(config) / 100;
}

export function chartVariantMode(config: IndexConfig, chart: "ranking" | "pareto"): "all" | "best" {
  return chart === "ranking" ? config.rankingVariants ?? "best" : config.paretoVariants ?? "all";
}

/** The efforts an index shows on its metric charts when it names none: `none` is off. */
export const EFFORT_CHOICES = ["none", "low", "medium", "high", "xhigh", "max"] as const;
export const DEFAULT_EFFORTS: string[] = EFFORT_CHOICES.filter((e) => e !== "none");

/** Ranked variants limited to the chosen efforts. `minimal` counts as `low`; a variant with no effort levels (`default`) always stays. */
export function filterEfforts<T extends { variant: { effort: string } }>(ranked: T[], efforts?: string[], unset: readonly string[] = DEFAULT_EFFORTS): T[] {
  const on = new Set(efforts ?? unset);
  return ranked.filter(({ variant: { effort } }) => effort === "default" || on.has(effort === "minimal" ? "low" : effort));
}

/** The ranking list: the efforts the index shows there (unset: all, since a model's best effort may be `none`), then best or all per model. */
export function rankingRows(ranked: RankedVariant[], config: IndexConfig): RankedVariant[] {
  return selectVariants(filterEfforts(ranked, config.rankingEfforts, EFFORT_CHOICES), chartVariantMode(config, "ranking"));
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

/** First-visit mix, matching the shared General frontier configuration. */
/** Six months before the given (or current) date — the default model-age cutoff. */
export function defaultReleasedAfter(from?: string): string {
  // UTC throughout: local-time month math shifts the date across DST and timezones, so server
  // (UTC) and browser would pick different cutoffs and render different rankings.
  const d = from ? new Date(from) : new Date();
  d.setUTCMonth(d.getUTCMonth() - 6);
  return d.toISOString().slice(0, 10);
}

/**
 * The index every visitor starts with: Artificial Analysis' Intelligence Index evaluations at AA's weights (the newest
 * version in the snapshot, else v5.0's), since AA runs every new model on all of them. Unlike the Artificial Analysis
 * preset it keeps the usual coverage floor and peer estimates, so a model missing one evaluation is still ranked.
 */
export function defaultConfig(snapshot: Snapshot, id = "general", name = "General frontier"): IndexConfig {
  return {
    id, name,
    weights: (snapshot?.benchmarks && aaComponentWeights(snapshot)) || { ...AA_V5_WEIGHTS },
    required: [], strictness: 50, cutoff: DEFAULT_CUTOFF,
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
  /** peer estimates only: typical range, in the same units as `value` */
  estimateRange?: [number, number];
  /** peer estimates only: the models whose scores produced it, heaviest first */
  donors?: PeerDonor[];
}

export interface PeerDonor { variantId: string; value: number; weight: number }

export interface RankedVariant {
  variant: Variant;
  model: Model;
  score: number;
  /** share of total weight backed by observed (not estimated) values */
  coverage: number;
  /** share of total weight backed by measured values (observed or effort-substituted) */
  measuredShare: number;
  values: BenchValue[];
  mixedEfforts?: boolean;
  /** measured cost per task, when known */
  costUsd?: number;
  costSource?: string;
  /** Set when `costUsd` is priced at this subscription plan instead of the API. */
  costPlan?: SubscriptionPrice;
  /** output speed tok/s when known */
  speed?: number;
  onFrontier: boolean;
  rank: number;
  /** Not ranked: the index could not score this model, so its score is estimated (see `progressEstimates`). */
  scoreEstimate?: ScoreEstimate;
  /** A chart row for this model on a speed tier (`src/data/speed-tiers.ts`), not a row the index ranked. */
  speedTier?: AppliedSpeedTier;
}

export interface AppliedSpeedTier {
  id: SpeedTierId; name: string;
  /** The row this one was made from. */
  baseVariantId: string;
  priceMultiple: number; speedMultiple?: number; speedSource?: string; errorRate?: number;
  /** On subscription pricing: this tier is billed at API rates, because no plan covers it. */
  apiRates?: boolean;
  /** On subscription pricing: how fast it spends the plan's allowance, and the plan it is priced on. */
  usageMultiple?: number; plan?: string;
}

export interface IndexResult {
  config: IndexConfig;
  /** benchmarks actually used (weight > 0), with resolved shares */
  benchmarks: { benchmark: Benchmark; share: number; required: boolean }[];
  ranked: RankedVariant[];
  /** variants dropped for missing required benchmarks or insufficient measured coverage (distinct from config.excludeModels display-filtering) */
  excluded: { variant: Variant; model: Model; missing: string[]; reason: "required" | "coverage"; measuredShare: number }[];
  /** modelIds that pass every filter except the user's model visibility picks (for the model picker) */
  candidateModelIds: string[];
  /** Older versions of a model line that a default view leaves out (see `supersededModelIds`); empty when it was applied. */
  autoHidden: string[];
  /** Models left out for coverage, with a score estimated from AA's Progress Index: the release-date chart draws them, nothing ranks them. A default view drops superseded ones as it does for `ranked`. */
  estimated: RankedVariant[];
}

/* ------------------------------------------------------------------ */
/* Engine                                                              */
/* ------------------------------------------------------------------ */

export function inferredObservation(o: Observation) {
  return Boolean(o.details?.priorsEstimate || (o.details?.realIndex as { effortAttribution?: string } | undefined)?.effortAttribution === "assumed-top");
}

// Plain locals: the loops below read these millions of times, and tsx (the scrape, the library) turns an import into a getter.
const { ROW_ASSUMED_TOP, ROW_CROSS_EFFORT, ROW_INFERRED, ROW_NOTE_ESTIMATED, ROW_PERFORMANCE } = ROW_FLAGS;
// Where the last lookup landed: the benchmark holding the row, whose variant it is, and the conversion if it took one.
let foundBench = 0, foundVariant = 0, foundValue = 0, foundRoute: EstimationRoute | undefined;

/** Resolve a logical benchmark value through fallback chains: the row, or -1. */
function lookup(c: Columns, b: number, v: number, depth = 0, allowEstimated = true, allowCrossEffort = true): number {
  const r = c.at[v * c.nb + b];
  if (r >= 0) {
    const f = c.flags[r];
    if ((!(f & ROW_INFERRED) || allowEstimated) && (allowCrossEffort || !(f & (ROW_CROSS_EFFORT | ROW_PERFORMANCE)))) { foundBench = b; foundRoute = undefined; return r; }
  }
  if (depth >= 4) return -1;
  const fallback = c.fallback[b];
  if (fallback >= 0) {
    const version = lookup(c, fallback, v, depth + 1, allowEstimated, allowCrossEffort);
    if (version >= 0) return version;
  }
  const routes = allowEstimated ? c.routes[b] : undefined;
  if (routes) for (const route of routes) {
    const source = c.at[v * c.nb + route.source], factor = route.variantFactors?.[c.variantIds[v]] ?? route.factor;
    if (source < 0 || c.flags[source] & ROW_INFERRED || !Number.isFinite(factor) || factor < 0) continue;
    foundBench = route.source; foundRoute = route; foundValue = clamp(c.value[source] * factor, 0, 100);
    return source;
  }
  return -1;
}

function lookupEffort(c: Columns, b: number, v: number, target: number, siblings: number, strictEffort: boolean, allowEstimated: boolean): number {
  foundVariant = v;
  const exact = lookup(c, b, v, 0, allowEstimated, !strictEffort);
  if (exact >= 0 || strictEffort || siblings < 0) return exact;
  const members = c.siblings[siblings];
  // Bounded by the benchmark count, which also ends a chain that loops.
  for (let id = b, steps = 0; id >= 0 && steps <= c.nb; id = c.fallback[id], steps++) {
    let best = -1, bestVariant = -1, bestRank = 0;
    for (let i = 0; i < members.length; i++) {
      const u = members[i], r = c.at[u * c.nb + id];
      if (r < 0 || c.flags[r] & ROW_INFERRED) continue;
      const rank = c.idRank[u];
      if (best < 0 || (Math.abs(rank - target) - Math.abs(bestRank - target) || rank - bestRank || c.variantIds[u].localeCompare(c.variantIds[bestVariant])) < 0) { best = r; bestVariant = u; bestRank = rank; }
    }
    if (best >= 0) { foundBench = id; foundRoute = undefined; foundVariant = bestVariant; return best; }
  }
  return -1;
}

function measuredNormalizer(c: Columns, b: number) {
  let norm = c.measured[b];
  if (!norm) {
    const values: number[] = [];
    for (let v = 0, slot = b; v < c.nv; v++, slot += c.nb) if (c.at[slot] >= 0) values.push(c.value[c.at[slot]]);
    norm = c.measured[b] = makeNormalizer(c.bench[b]!, values);
  }
  return norm;
}

/** Paired benchmarks it takes for an effort ratio to count for half its measured size. */
export const EFFORT_PRIOR_PAIRS = 2;
/**
 * A ratio from one or two paired benchmarks is mostly that benchmark's quirk: BullshitBench v2 scores Qwen 3.8 27B at 79
 * with no reasoning and 29 at max, and that ×2.7 once lifted its no-reasoning Arena WebDev estimate to 100. So the ratio
 * is capped at 4× either way and pulled toward 1 in log space by n / (n + EFFORT_PRIOR_PAIRS). Evidence that less effort
 * scores above more (`step` < 0: estimating a lower effort than the source), or more below less, gives no estimate.
 */
export function shrinkEffortFactor(ratio: number, pairs: number, step: number): number | undefined {
  if ((step < 0 && ratio > 1) || (step > 0 && ratio < 1)) return undefined;
  return Math.exp(Math.log(clamp(ratio, 0.25, 4)) * pairs / (pairs + EFFORT_PRIOR_PAIRS));
}

/** Published fixed scales for benchmarks whose snapshots predate a `normalization` field. */
const FIXED_SCALES: Record<string, { min: number; max: number }> = { "aa-omniscience": { min: -100, max: 100 } };

/**
 * Percent and fixed-scale benchmarks are used as published. Other units are never stretched so the
 * best model reads 100: Elo becomes the expected win rate against the pool's median model, and other
 * open-ended units map through a logistic around the pool median (spread-scaled), so leaders sit well
 * below 100 unless they are far ahead.
 */
function makeNormalizer(b: Benchmark, values: number[]): (v: number) => number {
  const fixed = b.normalization?.kind === "linear" ? b.normalization : FIXED_SCALES[b.id];
  if (fixed) {
    const { min, max } = fixed;
    return (v) => clamp((b.higherIsBetter ? (v - min) : (max - v)) / (max - min) * 100, 0, 100);
  }
  if (b.unit === "percent" && b.higherIsBetter) return (v) => clamp(v, 0, 100);
  if (b.unit === "percent" && !b.higherIsBetter) return (v) => clamp(100 - v, 0, 100);
  const finite = values.filter(Number.isFinite);
  if (finite.length < 2) return () => 50;
  // log scale for cost- and time-like units so a 10x cheaper model isn't crushed into the corner
  const tf = b.unit === "usd" || b.unit === "seconds" ? (x: number) => Math.log10(Math.max(x, 1e-6)) : (x: number) => x;
  const t = finite.map(tf).sort((x, y) => x - y);
  const median = t.length % 2 ? t[(t.length - 1) / 2] : (t[t.length / 2 - 1] + t[t.length / 2]) / 2;
  const sign = b.higherIsBetter ? 1 : -1;
  if (b.unit === "elo") return (v) => 100 / (1 + 10 ** (sign * (median - v) / 400));
  const mad = t.map((x) => Math.abs(x - median)).sort((x, y) => x - y)[Math.floor(t.length / 2)];
  const spread = Math.max(1.4826 * mad, (t[t.length - 1] - t[0]) / 6, 1e-9);
  if (t[t.length - 1] - t[0] < 1e-9) return () => 50;
  return (v) => 100 / (1 + Math.exp(-sign * (tf(v) - median) / spread));
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/** "1.5%" / "12%" — a plan's cost as a share of API price. */
export const subscriptionShare = (ratio: number) => `${(ratio * 100).toFixed(ratio < 0.1 ? 1 : 0).replace(/\.0$/, "")}%`;

export const SPEED_BENCHMARK = "aa-output-speed";

/** Pages that show an index pass `PAGE_VIEW` so an uncurated one leaves out superseded model versions; internal callers see every model. */
export interface ViewOptions {
  defaultView?: boolean;
  /** Peer estimation method. Default blends the mix match with a full-panel ratio match; "mix" is the original, kept for backtests. */
  peerMethod?: "blend" | "mix";
  /** Price cost per task from this benchmark's own measured cost (its observations' `costUsd`) instead of the index's task-metric source. A benchmark's page sets it; it is not part of a stored index. */
  costBenchmark?: string;
}
export const PAGE_VIEW: ViewOptions = { defaultView: true };

export function computeIndex(snapshot: Snapshot, config: IndexConfig, view: ViewOptions = {}): IndexResult {
  const c = columnsOf(snapshot);
  const shares = sharesOf(c, config);
  if (!shares.length) return { config, benchmarks: [], ranked: [], excluded: [], candidateModelIds: [], autoHidden: [], estimated: [] };
  const plans = effectiveBasis(config.costBasis) === "subscription" ? subscriptionPrices(snapshot, config.subscriptionPlans, { free: config.freeTiers !== false, reading: config.planReading }) : undefined;
  const detail: Detail = {
    costData: taskMetricData(snapshot, view.costBenchmark ?? config.costSource ?? "aa", "cost"), plans,
    resetBoosts: plans && config.planResets === true ? planResetBoosts(snapshot) : undefined,
    excluded: [], candidateModelIds: [],
  };
  const ranked = rankVariants(c, config, shares, view, detail), excluded = detail.excluded;
  let out = ordered(ranked, config);
  markFrontier(out);
  // A view nobody has curated leaves out superseded, off-frontier versions. Scores are unchanged: the models still shaped the normalization.
  const keep = (config.highlight ?? []).map((h) => h.split("@")[0]);
  const superseded = view.defaultView ? supersededModelIds(out, keep) : new Set<string>();
  const curated = !view.defaultView || config.excludeModels !== undefined || config.onlyModels !== undefined;
  let estimated = progressEstimates(snapshot, ranked, excluded, config.variants === "best");
  // Estimates never change which ranked models a view drops; they only go when a newer version replaces them.
  if (!curated && estimated.length) { const gone = supersededModelIds([...out, ...estimated], keep); estimated = estimated.filter((r) => !gone.has(r.model.id)); }
  if (!curated && superseded.size) { out = out.filter((r) => !superseded.has(r.model.id)); out.forEach((r, i) => (r.rank = i + 1)); }
  return { config, benchmarks: shares, ranked: out, excluded, candidateModelIds: detail.candidateModelIds, autoHidden: curated ? [] : [...superseded], estimated };
}

/** Scores alone, for a walk over many dates: rows carry no per-benchmark values, costs or exclusions. The same arithmetic as `computeIndex`. */
export function rankScores(c: Columns, config: IndexConfig): RankedVariant[] {
  const shares = sharesOf(c, config);
  return shares.length ? ordered(rankVariants(c, config, shares, {}), config) : [];
}

function sharesOf(c: Columns, config: IndexConfig): IndexResult["benchmarks"] {
  const used = Object.entries(config.weights).filter(([id, w]) => { if (!(w > 0)) return false; const b = c.benchIndex.get(id); return b !== undefined && c.bench[b] !== undefined; });
  const total = used.reduce((a, [, w]) => a + w, 0);
  if (!used.length || total <= 0) return [];
  return used.map(([id, w]) => ({ benchmark: c.bench[c.benchIndex.get(id)!]!, share: (w / total) * 100, required: isBenchmarkRequired(config, id) }));
}

function ordered(ranked: RankedVariant[], config: IndexConfig): RankedVariant[] {
  let out = ranked;
  if (config.variants === "best") {
    const best = new Map<string, RankedVariant>();
    for (const r of ranked) { const b = best.get(r.model.id); if (!b || r.score > b.score) best.set(r.model.id, r); }
    out = [...best.values()];
  }
  out.sort((a, b) => b.score - a.score);
  out.forEach((r, i) => (r.rank = i + 1));
  return out;
}

/** What a full result adds to the scores. */
interface Detail {
  costData: ReturnType<typeof taskMetricData>;
  plans?: Map<string, SubscriptionPrice>;
  resetBoosts?: ReturnType<typeof planResetBoosts>;
  excluded: IndexResult["excluded"];
  candidateModelIds: string[];
}

// A resolved value's state, per cell (pool position × share).
const CELL_PRESENT = 1, CELL_SUBSTITUTED = 2, CELL_ESTIMATED = 4, CELL_EFFORT = 8;
const DONORS = 5;
/** More than the rounding between a mean of log differences and the mean of the logs of ratios. */
const ROUNDING = 1e-9;

/** `xs[k]` of the first `n` values once sorted; reorders them. */
function select(xs: Float64Array, n: number, k: number): number {
  let lo = 0, hi = n - 1;
  while (lo < hi) {
    const pivot = xs[(lo + hi) >> 1];
    let i = lo, j = hi;
    while (i <= j) {
      while (xs[i] < pivot) i++;
      while (xs[j] > pivot) j--;
      if (i <= j) { const t = xs[i]; xs[i] = xs[j]; xs[j] = t; i++; j--; }
    }
    if (k <= j) hi = j; else if (k >= i) lo = i; else break;
  }
  return xs[k];
}

const weigh = (list: Nearest, soft: number, methods: number, total: number) => {
  let sum = 0;
  for (let i = 0; i < list.n; i++) sum += 1 / (soft + list.dist[i]);
  for (let i = 0; i < list.n; i++) total += list.pred[i] * ((1 / (soft + list.dist[i])) / sum / methods);
  return total;
};
/** The up to `DONORS` closest donors, ties in the order they came. */
class Nearest {
  n = 0; dist = new Float64Array(DONORS); pred = new Float64Array(DONORS); peer = new Int32Array(DONORS);
  add(dist: number, pred: number, peer: number) {
    if (this.n === DONORS && !(dist < this.dist[DONORS - 1])) return;
    let i = this.n < DONORS ? this.n++ : DONORS - 1;
    for (; i > 0 && dist < this.dist[i - 1]; i--) { this.dist[i] = this.dist[i - 1]; this.pred[i] = this.pred[i - 1]; this.peer[i] = this.peer[i - 1]; }
    this.dist[i] = dist; this.pred[i] = pred; this.peer[i] = peer;
  }
}

function rankVariants(c: Columns, config: IndexConfig, shares: IndexResult["benchmarks"], view: ViewOptions, detail?: Detail): RankedVariant[] {
  const { nb, at, value, flags, panelLog, harness, variants, models, vIndex, vModel, vRank, vSiblings, mLlm, mReleaseMs, mTier, idRank, family, pairable, panel } = c;
  const S = shares.length, strictness = strictnessOf(config);
  const shareBench = Int32Array.from(shares, (s) => c.benchIndex.get(s.benchmark.id)!), shareOf = Float64Array.from(shares, (s) => s.share);

  // pool: llm variants with at least one used benchmark value, passing filters
  const after = config.releasedAfter === undefined ? defaultReleasedAfter(c.date) : config.releasedAfter;
  const allowed = new Uint8Array(models.length);
  for (let i = 0; i < models.length; i++) {
    const m = models[i];
    allowed[i] = mLlm[i] && !(config.labs?.length && !config.labs.includes(m.labId)) && !(after && m.releaseDate && m.releaseDate < after) ? 1 : 0;
  }
  const hidden = config.excludeModels?.length ? new Set(config.excludeModels) : undefined, only = config.onlyModels && new Set(config.onlyModels);
  const candidateModels = detail && new Set<string>();
  const pooled = new Int32Array(variants.length);
  let P = 0;
  for (let pos = 0; pos < variants.length; pos++) {
    const m = vModel[pos];
    if (m < 0 || !allowed[m]) continue;
    let any = false;
    for (let s = 0; s < S && !any; s++) any = lookup(c, shareBench[s], vIndex[pos]) >= 0;
    if (!any) continue;
    const modelId = variants[pos].modelId;
    candidateModels?.add(modelId);
    if (!hidden?.has(modelId) && (!only || only.has(modelId))) pooled[P++] = pos;
  }
  if (detail) detail.candidateModelIds = [...candidateModels!];

  // Resolve every cell: raw values per benchmark over the pool, then their normalizers.
  const n = S * P;
  const cell = new Uint8Array(n), raw = new Float64Array(n), norm = new Float64Array(n), observed = new Float64Array(n).fill(NaN);
  const cellRow = detail && new Int32Array(n), cellBench = detail && new Int32Array(n), cellVariant = detail && new Int32Array(n), cellFactor = detail && new Float64Array(n);
  const cellRoute = detail && new Map<number, EstimationRoute>(), cellEvidence = detail && new Map<number, number[]>();
  const strict = Uint8Array.from(shares, (s) => config.effortMatching === "strict" || strictness === 100 || effortLocked(s.benchmark) ? 1 : 0);
  // Effort pairs repeat across a variant's benchmarks, so the paired evidence is read once for each donor.
  const pairBench = new Int32Array(pairable.length), pairNum = new Float64Array(pairable.length), pairDen = new Float64Array(pairable.length);
  const minimumPairs = strictness >= 95 ? 3 : strictness >= 75 ? 2 : 1;
  for (let pp = 0; pp < P; pp++) {
    const pos = pooled[pp], v = vIndex[pos];
    const to = vRank[pos] === DEFAULT_RANK ? -1 : vRank[pos];
    let pairDonor = -1, pairs = 0;
    for (let s = 0; s < S; s++) {
      const row = lookupEffort(c, shareBench[s], v, vRank[pos], vSiblings[pos], strict[s] === 1, strictness < 100);
      if (row < 0) continue;
      const k = pp * S + s, donor = foundVariant, from = foundBench, route = foundRoute, f = flags[row];
      const estimated = route !== undefined || (donor === v && (f & ROW_INFERRED) !== 0), substituted = donor !== v;
      let factor = NaN;
      if (substituted) {
        const was = idRank[donor] === DEFAULT_RANK ? -1 : idRank[donor];
        if (was < 0 || to < 0 || strictness === 100 || (strictness >= 85 && Math.abs(was - to) > 1)) continue;
        if (pairDonor !== donor) {
          pairDonor = donor; pairs = 0;
          const a0 = v * nb, d0 = donor * nb;
          for (let i = 0; i < pairable.length; i++) {
            const b = pairable[i], a = at[a0 + b], d = at[d0 + b];
            if (a < 0 || d < 0 || (flags[a] | flags[d]) & (ROW_INFERRED | ROW_NOTE_ESTIMATED) || harness[a] !== harness[d]) continue;
            const measure = measuredNormalizer(c, b), denominator = measure(value[d]), numerator = measure(value[a]);
            if (!Number.isFinite(numerator) || !Number.isFinite(denominator) || denominator < 5) continue;
            pairBench[pairs] = b; pairNum[pairs] = numerator; pairDen[pairs] = denominator; pairs++;
          }
        }
        // Ratio of means over paired, directly measured benchmarks outside the two version families. Each benchmark counts once.
        const f1 = family[shareBench[s]], f2 = family[from];
        let count = 0, top = 0, bottom = 0;
        for (let i = 0; i < pairs; i++) { const g = family[pairBench[i]]; if (g !== f1 && g !== f2) { top += pairNum[i]; bottom += pairDen[i]; count++; } }
        if (count < minimumPairs) continue;
        const adjusted = shrinkEffortFactor(top / bottom, count, to - was);
        if (adjusted === undefined) continue;
        factor = adjusted;
        if (cellEvidence) { const list: number[] = []; for (let i = 0; i < pairs; i++) { const g = family[pairBench[i]]; if (g !== f1 && g !== f2) list.push(pairBench[i]); } cellEvidence.set(k, list); }
      }
      cell[k] = CELL_PRESENT | (substituted || estimated ? CELL_SUBSTITUTED : 0) | (estimated ? CELL_ESTIMATED : 0)
        | ((estimated ? f & ROW_CROSS_EFFORT : substituted) ? CELL_EFFORT : 0);
      raw[k] = route ? foundValue : value[row];
      norm[k] = factor;
      if (detail) { cellRow![k] = row; cellBench![k] = from; cellVariant![k] = donor; cellFactor![k] = factor; if (route) cellRoute!.set(k, route); }
    }
  }
  const normalizers = shares.map((share, s) => {
    const values: number[] = [];
    for (let k = s; k < n; k += S) if (cell[k]) values.push(raw[k]);
    return makeNormalizer(share.benchmark, values);
  });
  for (let s = 0; s < S; s++) {
    const f = normalizers[s];
    for (let k = s; k < n; k += S) {
      if (!cell[k]) continue;
      const factor = norm[k];
      norm[k] = clamp(f(raw[k]) * (factor === factor ? factor : 1), 0, 100);
      if (!(cell[k] & CELL_SUBSTITUTED)) observed[k] = norm[k];
    }
  }

  // Peer estimates. A missing cell has no observed value and no panel score of its own (either would have resolved), so what a
  // target shares with a peer does not depend on which benchmark is missing: it is worked out once per target.
  const window = 365 - strictness * 2.75, needShared = strictness >= 75 ? 3 : strictness >= 50 ? 2 : 1, needObserved = strictness >= 50 ? 2 : 1, minPanel = strictness >= 75 ? 10 : 8;
  let peers: Int32Array | undefined, peerCount = 0, mixShared: Int32Array, mixGap: Float64Array, mixOffset: Float64Array, panelNear: Float64Array, panelDist: Float64Array, panelRatio: Float64Array;
  let panelFor = -1, panelCount = 0, poolLog: Float64Array | undefined;
  const targetObserved = new Int32Array(S), targetPanelAt = new Int32Array(panel.length), targetPanelValue = new Float64Array(panel.length), targetPanelLog = new Float64Array(panel.length), ratios = new Float64Array(panel.length);
  let observedCount = 0;
  const preparePeers = (pp: number) => {
    if (!peers) { peers = new Int32Array(P); mixShared = new Int32Array(P); mixGap = new Float64Array(P); mixOffset = new Float64Array(P); panelNear = new Float64Array(P); panelDist = new Float64Array(P); panelRatio = new Float64Array(P); }
    const tm = vModel[pooled[pp]], tMs = mReleaseMs[tm], tTier = mTier[tm];
    peerCount = 0;
    for (let q = 0; q < P; q++) {
      const pm = vModel[pooled[q]];
      if (variants[pooled[q]].modelId === variants[pooled[pp]].modelId) continue; // don't lean on sibling efforts; they share the gap
      // NaN (no release date) compares false, so it never excludes.
      if (Math.abs((tMs - mReleaseMs[pm]) / 86_400_000) > window) continue;
      if (tTier && mTier[pm] && tTier !== mTier[pm]) continue;
      peers[peerCount++] = q;
    }
    observedCount = 0;
    const t0 = pp * S;
    for (let s = 0; s < S; s++) if (observed[t0 + s] === observed[t0 + s]) targetObserved[observedCount++] = s;
    for (let i = 0; i < peerCount; i++) {
      const q0 = peers[i] * S;
      let d = 0, shared = 0, off = 0;
      for (let j = 0; j < observedCount; j++) {
        const s = targetObserved[j], x = observed[q0 + s];
        if (x !== x) continue;
        const tv = observed[t0 + s];
        d += Math.abs(tv - x); off += tv - x; shared++;
      }
      mixShared[i] = shared; mixGap[i] = d; mixOffset[i] = off;
    }
  };
  // Ranks peers by the difference of logs, which costs a subtraction and is within rounding of the ratio's log. Only the peers that can make the top get the exact figures.
  const preparePanel = (pp: number) => {
    panelFor = pp;
    if (!poolLog) {
      poolLog = new Float64Array(P * panel.length);
      for (let q = 0, k = 0; q < P; q++) {
        const v0 = vIndex[pooled[q]] * nb;
        for (let i = 0; i < panel.length; i++, k++) { const r = at[v0 + panel[i]]; poolLog[k] = r < 0 ? NaN : panelLog[r]; }
      }
    }
    const t = vIndex[pooled[pp]] * nb, np = panel.length;
    panelCount = 0;
    for (let i = 0; i < np; i++) {
      const r = at[t + panel[i]];
      if (r < 0 || flags[r] & ROW_INFERRED || !Number.isFinite(value[r]) || value[r] <= 0) continue;
      targetPanelAt[panelCount] = i; targetPanelValue[panelCount] = value[r]; targetPanelLog[panelCount++] = Math.log(value[r]);
    }
    for (let i = 0; i < peerCount; i++) {
      const q = peers![i] * np;
      let shared = 0, d = 0;
      for (let j = 0; j < panelCount; j++) {
        const x = poolLog[q + targetPanelAt[j]];
        if (x === x) { d += Math.abs(targetPanelLog[j] - x); shared++; }
      }
      panelNear[i] = shared < minPanel ? NaN : d / shared; panelDist[i] = NaN;
    }
  };
  const panelExact = (i: number) => {
    const q = vIndex[pooled[peers![i]]] * nb;
    let shared = 0, d = 0;
    for (let j = 0; j < panelCount; j++) {
      const r = at[q + panel[targetPanelAt[j]]];
      if (r < 0 || panelLog[r] !== panelLog[r]) continue;
      const ratio = targetPanelValue[j] / value[r];
      ratios[shared++] = ratio; d += Math.abs(Math.log(ratio));
    }
    panelDist[i] = d / shared; panelRatio[i] = select(ratios, shared, Math.floor(shared / 2));
  };
  const mix = new Nearest(), byPanel = new Nearest(), near = new Nearest();
  let estimateValue = 0;
  /**
   * Peer estimate for a missing benchmark: the weighted average of up to two guesses.
   * Mix match: the k variants closest on the benchmarks in the mix, each shifted by the target's average offset on them.
   * Panel match (percent benchmarks, unless `peerMethod` is "mix"): the k variants whose scores are closest, as ratios, across every
   * benchmark both have; each is scaled by the median ratio. Restricted to a release window, price tier and other
   * models. The range is the spread between the donors' own guesses, never narrower than 1.5 points.
   */
  const estimate = (pp: number, s: number): boolean => {
    // Above moderate strictness a target needs real measured evidence of its own —
    // a single strong benchmark must not seed estimates across the whole mix.
    if (observedCount < needObserved) return false;
    const b = shares[s].benchmark, usePanel = view.peerMethod !== "mix" && b.unit === "percent" && b.higherIsBetter;
    if (usePanel && panelFor !== pp) preparePanel(pp);
    mix.n = byPanel.n = near.n = 0;
    for (let i = 0; i < peerCount; i++) {
      const q = peers![i], pv = observed[q * S + s];
      if (pv !== pv) continue;
      const shared = mixShared[i];
      // Shrink the peer offset by evidence: off/(n+1) applies half the gap on
      // one shared benchmark, converging to the full offset as evidence grows.
      if (shared >= needShared) mix.add(mixGap[i] / shared + (shared < 2 ? 10 : 0), pv + mixOffset[i] / (shared + 1), q);
      if (usePanel && panelNear[i] === panelNear[i]) near.add(panelNear[i], 0, i);
    }
    if (near.n) {
      const reach = near.n < DONORS ? Infinity : near.dist[DONORS - 1] + ROUNDING;
      for (let i = 0; i < peerCount; i++) {
        if (!(panelNear[i] <= reach)) continue;
        const q = peers![i], pv = observed[q * S + s];
        if (pv !== pv) continue;
        if (panelDist[i] !== panelDist[i]) panelExact(i);
        byPanel.add(panelDist[i], pv * panelRatio[i], q);
      }
    }
    if (!mix.n && !byPanel.n) return false;
    const methods = (mix.n ? 1 : 0) + (byPanel.n ? 1 : 0);
    let total = 0;
    total = weigh(mix, 1, methods, total); total = weigh(byPanel, 0.05, methods, total);
    estimateValue = clamp(total, 0, 100);
    return true;
  };
  const peerDetail = (value: number) => {
    const methods = (mix.n ? 1 : 0) + (byPanel.n ? 1 : 0);
    const guesses: { variantId: string; pred: number; weight: number }[] = [];
    for (const [list, soft] of [[mix, 1], [byPanel, 0.05]] as const) {
      if (!list.n) continue;
      let sum = 0;
      for (let i = 0; i < list.n; i++) sum += 1 / (soft + list.dist[i]);
      for (let i = 0; i < list.n; i++) guesses.push({ variantId: variants[pooled[list.peer[i]]].id, pred: list.pred[i], weight: (1 / (soft + list.dist[i])) / sum / methods });
    }
    const sd = Math.sqrt(guesses.reduce((sum, g) => sum + g.weight * (g.pred - value) ** 2, 0));
    const half = Math.max(1.5, 1.5 * sd);
    const byVariant = new Map<string, PeerDonor>();
    for (const g of guesses) { const prev = byVariant.get(g.variantId); byVariant.set(g.variantId, { variantId: g.variantId, value: g.pred, weight: (prev?.weight ?? 0) + g.weight }); }
    return { range: [clamp(value - half, 0, 100), clamp(value + half, 0, 100)] as [number, number], donors: [...byVariant.values()].sort((x, y) => y.weight - x.weight) };
  };

  // eligibility: explicit required gates first, then the measured-coverage floor —
  // a variant is ranked only when observed or effort-substituted values cover at
  // least strictness% of the index's weight. Peer-estimated values do not count.
  const ranked: RankedVariant[] = [];
  const floor = minMeasuredShare(config);
  const speedBench = c.benchIndex.get(SPEED_BENCHMARK);
  for (let pp = 0; pp < P; pp++) {
    const pos = pooled[pp], v = variants[pos], t0 = pp * S, vi = vIndex[pos];
    let measured = 0, missingRequired = false;
    for (let s = 0; s < S; s++) {
      const f = cell[t0 + s];
      if (f && (!(f & CELL_SUBSTITUTED) || f & CELL_EFFORT)) measured += shareOf[s];
      if (!f && shares[s].required) missingRequired = true;
    }
    const measuredShare = measured / 100;
    if (missingRequired) { detail?.excluded.push({ variant: v, model: models[vModel[pos]], missing: shares.filter((x, s) => x.required && !cell[t0 + s]).map((x) => x.benchmark.id), reason: "required", measuredShare }); continue; }
    if (measuredShare < floor - 1e-9) {
      detail?.excluded.push({ variant: v, model: models[vModel[pos]], missing: shares.filter((_, s) => { const f = cell[t0 + s]; return !(f && (!(f & CELL_SUBSTITUTED) || f & CELL_EFFORT)); }).map((x) => x.benchmark.id), reason: "coverage", measuredShare });
      continue;
    }

    const values: BenchValue[] = [];
    let num = 0, den = 0, covered = 0, prepared = false;
    for (let s = 0; s < S; s++) {
      const k = t0 + s, f = cell[k], share = shareOf[s];
      if (f) {
        const substituted = (f & CELL_SUBSTITUTED) !== 0;
        if (detail) values.push(benchValue(c, shares[s].benchmark.id, f, norm[k], raw[k], cellRow![k], cellBench![k], cellVariant![k] !== vi, cellFactor![k], cellRoute!.size ? cellRoute!.get(k) : undefined, cellEvidence!.size ? cellEvidence!.get(k) : undefined, v.id));
        num += norm[k] * share; den += share; if (!substituted) covered += share; continue;
      }
      if (!config.estimateMissing || strictness === 100) continue; // renormalize: just skip
      if (!prepared) { preparePeers(pp); prepared = true; }
      if (estimate(pp, s)) {
        if (detail) { const { range, donors } = peerDetail(estimateValue); values.push({ benchmarkId: shares[s].benchmark.id, value: estimateValue, estimated: true, estimateKind: "peer", estimateRange: range, donors }); }
        num += estimateValue * share; den += share;
      }
    }
    if (den <= 0) continue;
    const model = models[vModel[pos]];
    const coverage = Math.min(1, Math.round(covered * 1e4) / 1e6);
    if (!detail) { ranked.push({ variant: v, model, score: num / den, coverage, measuredShare, values, onFrontier: false, rank: 0 }); continue; }
    const measuredCost = detail.costData.get(v.id);
    // Preserve AA's mix-weighted cost when every selected benchmark publishes it.
    let weightedAaCost: number | undefined;
    if (!view.costBenchmark && (config.costSource ?? "aa") === "aa") {
      weightedAaCost = 0;
      for (let s = 0; s < S; s++) {
        const r = at[vi * nb + shareBench[s]], o = r >= 0 ? c.rows[r] : undefined;
        if (!(o?.sourceModelId && o.costUsd != null && Number.isFinite(o.costUsd) && o.costUsd >= 0)) { weightedAaCost = undefined; break; }
        weightedAaCost += o.costUsd * shareOf[s] / 100;
      }
    }
    const viewCost = view.costBenchmark ? c.bench[c.benchIndex.get(view.costBenchmark) ?? -1] : undefined;
    const cost = weightedAaCost != null ? { usd: weightedAaCost, source: "AA measured task costs, weighted by this mix" } : measuredCost ? { usd: measuredCost.value, source: (view.costBenchmark ? `${viewCost?.name ?? view.costBenchmark} · measured cost per task` : taskMetricDescription(config.costSource ?? "aa", "cost")) + (measuredCost.observation.harness ? ` · ${measuredCost.observation.harness}` : "") } : undefined;
    // Subscription basis: the measured API cost scaled by the share of API price the plan works out to.
    // Models without a first-party plan keep their API cost — that is what they cost to use.
    // Limit resets (src/data/plan-resets.ts) give the plan's subscribers extra usage, so its share of API price falls by that factor.
    const listed = cost && detail.plans?.get(model.id), reset = listed && listed.ratio > 0 ? detail.resetBoosts?.get(model.labId) : undefined;
    const plan = listed && reset && reset.boost > 1 ? { ...listed, ratio: listed.ratio / reset.boost, ...(listed.aaCostRatio ? { aaCostRatio: listed.aaCostRatio / reset.boost } : {}) } : listed;
    if (cost && plan) { cost.usd *= (!view.costBenchmark && (config.costSource ?? "aa") === "aa" ? plan.aaCostRatio : undefined) ?? plan.ratio; cost.source += plan.ratio === 0 ? ` · free on ${plan.plan}` : ` · ${plan.plan}, ${subscriptionShare(plan.ratio)} of API price at full use${reset && reset.boost > 1 ? `, with ${reset.resets} limit resets in 30 days` : ""}`; }
    const speedRow = speedBench === undefined ? -1 : at[vi * nb + speedBench];
    ranked.push({ variant: v, model, score: num / den, coverage, measuredShare, values, mixedEfforts: values.some((value) => value.estimateKind === "effort"), costUsd: cost?.usd, costSource: cost?.source, costPlan: plan || undefined, speed: speedRow >= 0 && value[speedRow] > 0 ? value[speedRow] : undefined, onFrontier: false, rank: 0 });
  }
  return ranked;
}

/** A resolved cell as the charts and the model detail read it. */
function benchValue(c: Columns, benchmarkId: string, f: number, normalized: number, raw: number, row: number, from: number, substituted: boolean, factor: number, route: EstimationRoute | undefined, evidence: number[] | undefined, variantId: string): BenchValue {
  const o = c.rows[row], explicit = o.details?.priorsEstimate as { sourceBenchmarkId?: string; sourceVariantId?: string; evidence?: string[] } | undefined;
  const estimated = (f & CELL_ESTIMATED) !== 0, rf = c.flags[row];
  const kind: BenchValue["estimateKind"] = estimated ? (rf & ROW_CROSS_EFFORT ? "effort" : rf & ROW_PERFORMANCE ? "performance" : "calibrated-fallback") : substituted ? "effort" : undefined;
  const found = route ? [route.evidenceId, ...(route.variantFactors?.[variantId] == null ? [] : ["Release-specific paired calibration"]), ...(route.pairedCount == null ? [] : [`${route.pairedCount} paired configurations`])]
    : substituted ? undefined : explicit?.evidence ?? (rf & ROW_ASSUMED_TOP ? ["Real Index Top-effort assumption; native effort not published"] : undefined);
  const list = found ? [...found] : [];
  if (evidence) for (const b of evidence) list.push(c.benchIds[b]);
  return {
    benchmarkId, from: explicit?.sourceBenchmarkId ?? c.benchIds[from], sourceVariantId: explicit?.sourceVariantId ?? o.variantId, sourceUrl: o.sourceUrl,
    substituted: (f & CELL_SUBSTITUTED) !== 0, estimateKind: kind, ...(factor === factor ? { effortFactor: factor } : {}), evidence: list, value: normalized,
    ...(explicit || kind === "calibrated-fallback" ? {} : { raw }), estimated: (f & CELL_SUBSTITUTED) !== 0,
  };
}

/** Pareto frontier over (cost asc, score): a point is on the frontier if no cheaper point scores >= it. */
export function markFrontier(ranked: RankedVariant[]) {
  const pts = ranked.filter((r) => r.costUsd != null).sort((a, b) => a.costUsd! - b.costUsd! || b.score - a.score);
  let best = -Infinity;
  for (const p of pts) { p.onFrontier = p.score > best; if (p.onFrontier) best = p.score; }
}
