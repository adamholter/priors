/**
 * Data access for the assistant: one place that turns "index score", "cost", "SWE-bench" and the like
 * into real values per model and effort, so answers and charts only ever show measured data.
 * Index scores come from the engine under the user's current mix (every effort ranked); benchmark
 * values are the observations as published (no estimates).
 */
import type { Observation, Snapshot } from "../data/types";
import { EFFORT_ORDER } from "../data/types";
import { computeIndex, type IndexConfig, type RankedVariant } from "../engine";
import { supersededModelIds } from "../engine/superseded";
import { taskMetricData } from "../data/task-metrics";
import { outputTokensPerTask } from "../lib/metrics";
import { resolveBenchmark, resolveLab, resolveModel, resolveVariant } from "./resolve";

export type MetricKey = string;
export interface Metric { key: MetricKey; name: string; unit: string; better: "higher" | "lower"; log?: boolean; benchmarkId?: string }
export interface Row { modelId: string; model: string; labId: string; variantId: string; effort: string; rank: number | null; values: Record<MetricKey, number | null> }

const BUILTIN: Metric[] = [
  { key: "index", name: "Index score", unit: "pts", better: "higher" },
  { key: "cost", name: "Cost per task", unit: "$", better: "lower", log: true },
  { key: "time", name: "Time per task", unit: "s", better: "lower", log: true },
  { key: "speed", name: "Output speed", unit: "tok/s", better: "higher" },
  { key: "latency", name: "Time to first token", unit: "s", better: "lower", log: true },
  { key: "tokens", name: "Output tokens per task", unit: "tok", better: "lower", log: true },
];
const ALIASES: Record<string, string> = {
  score: "index", "index score": "index", ranking: "index", "my index": "index", price: "cost", "cost per task": "cost", "time per task": "time", duration: "time",
  "output speed": "speed", "tokens per second": "speed", "tok/s": "speed", ttft: "latency", "time to first token": "latency", "output tokens": "tokens", verbosity: "tokens",
};
const UNIT: Record<string, string> = { percent: "%", score: "pts", elo: "Elo", usd: "$", seconds: "s", count: "" };

/** A metric by key, alias or benchmark name. */
export function resolveMetric(snapshot: Snapshot, name: string): Metric | null {
  const n = name.toLowerCase().trim(), key = ALIASES[n] ?? n;
  const builtin = BUILTIN.find((m) => m.key === key);
  if (builtin) return builtin;
  const id = resolveBenchmark(snapshot, name);
  const b = id ? snapshot.benchmarks.find((x) => x.id === id) : undefined;
  return b ? { key: b.id, name: b.shortName ?? b.name, unit: UNIT[b.unit] ?? "", better: b.higherIsBetter ? "higher" : "lower", benchmarkId: b.id, log: b.unit === "usd" || b.unit === "seconds" } : null;
}

const effortRank = (e: string) => { const i = EFFORT_ORDER.indexOf(e as (typeof EFFORT_ORDER)[number]); return i < 0 ? -1 : i; };
export const byEffort = (a: { effort: string }, b: { effort: string }) => effortRank(a.effort) - effortRank(b.effort);

/** Everything the tools read, computed once per request. */
export class DataView {
  readonly ranked: RankedVariant[];
  readonly bestRank: Map<string, number>;
  /** Models the site leaves out of an uncurated view as older versions of a newer one (as PAGE_VIEW does). Still scored, never ranked. */
  readonly olderVersions: Set<string>;
  private older: RankedVariant[];
  /** Most models a top-N or lab pick returns. */
  readonly maxRows: number;
  private obs = new Map<string, Map<string, Observation>>();
  private time; private iiId?: string;
  /**
   * `pageView`: rank as the site's ranking list does, where an index nobody curated leaves out superseded versions (engine PAGE_VIEW);
   * the MCP tools use it so their tables agree with rank_models. The in-app assistant keeps every version, which effort comparisons want.
   * Scores are the same either way.
   */
  constructor(readonly snapshot: Snapshot, readonly config: IndexConfig, opts: { maxRows?: number; pageView?: boolean } = {}) {
    this.maxRows = opts.maxRows ?? 40;
    const all = computeIndex(snapshot, { ...config, variants: "all" }).ranked;
    const curated = config.excludeModels !== undefined || config.onlyModels !== undefined;
    this.olderVersions = !opts.pageView || curated ? new Set() : supersededModelIds(all, (config.highlight ?? []).map((h) => h.split("@")[0]));
    this.ranked = all.filter((r) => !this.olderVersions.has(r.model.id));
    this.older = all.filter((r) => this.olderVersions.has(r.model.id));
    // Rank = the model's position in the user's ranking (best effort per model), as the builder shows it.
    this.bestRank = new Map();
    for (const r of this.ranked) if (!this.bestRank.has(r.model.id)) this.bestRank.set(r.model.id, this.bestRank.size + 1);
    for (const o of snapshot.observations) {
      const m = this.obs.get(o.benchmarkId) ?? this.obs.set(o.benchmarkId, new Map()).get(o.benchmarkId)!;
      if (!m.has(o.variantId) && !o.details?.priorsEstimate) m.set(o.variantId, o);
    }
    this.time = taskMetricData(snapshot, config.timeSource ?? "aa", "time");
    this.iiId = snapshot.benchmarks.filter((b) => b.id.startsWith("aa-intelligence-index")).sort((a, b) => b.id.localeCompare(a.id))[0]?.id;
  }

  /** A metric's value for one ranked variant; null when it isn't measured. */
  value(metric: Metric, r: RankedVariant): number | null {
    const id = r.variant.id, o = (b: string) => this.obs.get(b)?.get(id);
    const num = (x: unknown) => (typeof x === "number" && Number.isFinite(x) ? x : null);
    switch (metric.key) {
      case "index": return Number.isFinite(r.score) ? +r.score.toFixed(2) : null;
      case "cost": return num(r.costUsd);
      case "time": return num(this.time.get(id)?.value);
      case "speed": return num(r.speed);
      case "latency": return num(o("aa-ttft")?.value);
      case "tokens": { const x = this.iiId ? o(this.iiId) : undefined; return outputTokensPerTask(x?.details?.outputTokensPerTask) ?? num(x?.outputTokens); }
      default: return num(metric.benchmarkId ? o(metric.benchmarkId)?.value : undefined);
    }
  }

  /**
   * Variants for these models (names or ids), or the top n models of the ranking. Named models the
   * index doesn't rank still come back, unscored, so their published benchmark values can be read.
   */
  pick(models: string[] | undefined, top: number | undefined, efforts: "best" | "all" | string[], labs?: string[], weights?: "open" | "closed"): { rows: RankedVariant[]; unknown: string[]; unranked: string[]; older: string[]; available: number } {
    const unknown: string[] = [], unranked: string[] = [], older: string[] = [];
    let available = 0;
    // Open or closed weights; a model whose status isn't known matches neither.
    const flag = new Map(this.snapshot.models.map((m) => [m.id, m.openWeights]));
    const wanted = (id: string) => !weights || flag.get(id) === (weights === "open");
    let ids: string[];
    if (models?.length) {
      ids = [];
      for (const name of models) {
        const id = resolveModel(this.snapshot, name, this.bestRank);
        if (!id) { unknown.push(name); continue; }
        const named = this.snapshot.models.find((m) => m.id === id)?.name ?? name;
        if (this.olderVersions.has(id)) older.push(named); else if (!this.bestRank.has(id)) unranked.push(named);
        if (!ids.includes(id)) ids.push(id);
      }
    } else {
      const labIds = labs?.length ? new Set(labs.map((l) => resolveLab(this.snapshot, l)).filter((x): x is string => !!x)) : null;
      const lab = new Map(this.snapshot.models.map((m) => [m.id, m.labId]));
      if (labIds && !labIds.size) unknown.push(...labs!);
      // A lab filter alone means all of that lab's ranked models (up to 40); top caps it.
      const pool = [...this.bestRank.keys()].filter((id) => (!labIds || labIds.has(lab.get(id) ?? "")) && wanted(id));
      available = pool.length;
      ids = pool.slice(0, Math.min(Math.max(top ?? (labIds ? 40 : 10), 1), this.maxRows));
    }
    ids = ids.filter(wanted);
    const want = new Set(ids);
    const loose = ids.filter((id) => !this.bestRank.has(id) && !this.olderVersions.has(id)).flatMap((id) => {
      const model = this.snapshot.models.find((m) => m.id === id)!;
      // Configurations of one effort (harness or source variants) collapse to the first, as the builder shows them.
      return this.snapshot.variants.filter((v, i, all) => v.modelId === id && all.findIndex((x) => x.modelId === id && x.effort === v.effort) === i).map((variant): RankedVariant => ({ variant, model, score: NaN, coverage: 0, measuredShare: 0, values: [], onFrontier: false, rank: 0 }));
    });
    let rows = [...this.ranked.filter((r) => want.has(r.model.id)), ...this.older.filter((r) => want.has(r.model.id)), ...loose];
    if (efforts === "best") rows = rows.filter((r, i, a) => a.findIndex((x) => x.model.id === r.model.id) === i);
    else if (Array.isArray(efforts)) rows = rows.filter((r) => efforts.includes(r.variant.effort));
    rows.sort((a, b) => ids.indexOf(a.model.id) - ids.indexOf(b.model.id) || byEffort(a.variant, b.variant));
    return { rows, unknown, unranked, older, available };
  }

  /**
   * Exact variants ("GPT-5.6 Sol max", "Opus 5.5 low"): the named effort of each model, in the order given.
   * A name without an effort means that model's best effort. An effort the model doesn't have is reported, not guessed.
   */
  pickVariants(names: string[]): { rows: RankedVariant[]; unknown: string[]; unranked: string[]; older: string[]; available: number } {
    const rows: RankedVariant[] = [], unknown: string[] = [], unranked: string[] = [];
    for (const name of names) {
      const v = resolveVariant(this.snapshot, name, this.bestRank);
      if (!v) { unknown.push(`${name} (not in the data)`); continue; }
      if (v.missingEffort) { unknown.push(`${name} (no ${v.missingEffort} measured)`); continue; }
      let r: RankedVariant | undefined;
      if (v.variantId) {
        r = this.ranked.find((x) => x.variant.id === v.variantId) ?? this.older.find((x) => x.variant.id === v.variantId);
        if (!r) {
          const variant = this.snapshot.variants.find((x) => x.id === v.variantId), model = this.snapshot.models.find((m) => m.id === v.modelId);
          if (variant && model) r = { variant, model, score: NaN, coverage: 0, measuredShare: 0, values: [], onFrontier: false, rank: 0 };
        }
      } else r = this.pick([v.modelId], undefined, "best").rows[0];
      if (!r) { unknown.push(`${name} (no measured variant)`); continue; }
      if (!this.ranked.includes(r) && !this.older.includes(r)) unranked.push(`${r.model.name} ${r.variant.effort}`);
      if (!rows.some((x) => x.variant.id === r!.variant.id)) rows.push(r);
    }
    return { rows, unknown, unranked, older: [], available: 0 };
  }

  row(r: RankedVariant, metrics: Metric[]): Row {
    return { modelId: r.model.id, model: r.model.name, labId: r.model.labId, variantId: r.variant.id, effort: r.variant.effort, rank: this.bestRank.get(r.model.id) ?? null, values: Object.fromEntries(metrics.map((m) => [m.key, this.value(m, r)])) };
  }
}
