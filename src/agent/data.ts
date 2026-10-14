/**
 * Data access for the assistant: one place that turns "index score", "cost", "SWE-bench" and the like
 * into real values per model and effort, so answers and charts only ever show measured data.
 * Index scores come from the engine under the user's current mix (every effort ranked); benchmark
 * values are the observations as published (no estimates).
 */
import type { Observation, Snapshot } from "../data/types";
import { EFFORT_ORDER } from "../data/types";
import { computeIndex, type IndexConfig, type RankedVariant } from "../engine";
import { taskMetricData } from "../data/task-metrics";
import { resolveBenchmark, resolveLab, resolveModel } from "./resolve";

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
  private obs = new Map<string, Map<string, Observation>>();
  private time; private iiId?: string;
  constructor(readonly snapshot: Snapshot, readonly config: IndexConfig) {
    this.ranked = computeIndex(snapshot, { ...config, variants: "all" }).ranked;
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
      case "tokens": { const x = this.iiId ? o(this.iiId) : undefined; return num(x?.details?.outputTokensPerTask ?? x?.outputTokens); }
      default: return num(metric.benchmarkId ? o(metric.benchmarkId)?.value : undefined);
    }
  }

  /**
   * Variants for these models (names or ids), or the top n models of the ranking. Named models the
   * index doesn't rank still come back, unscored, so their published benchmark values can be read.
   */
  pick(models: string[] | undefined, top: number | undefined, efforts: "best" | "all" | string[], labs?: string[]): { rows: RankedVariant[]; unknown: string[]; unranked: string[] } {
    const unknown: string[] = [], unranked: string[] = [];
    let ids: string[];
    if (models?.length) {
      ids = [];
      for (const name of models) {
        const id = resolveModel(this.snapshot, name, this.bestRank);
        if (!id) { unknown.push(name); continue; }
        if (!this.bestRank.has(id)) unranked.push(this.snapshot.models.find((m) => m.id === id)?.name ?? name);
        if (!ids.includes(id)) ids.push(id);
      }
    } else {
      const labIds = labs?.length ? new Set(labs.map((l) => resolveLab(this.snapshot, l)).filter((x): x is string => !!x)) : null;
      const lab = new Map(this.snapshot.models.map((m) => [m.id, m.labId]));
      if (labIds && !labIds.size) unknown.push(...labs!);
      // A lab filter alone means all of that lab's ranked models (up to 40); top caps it.
      ids = [...this.bestRank.keys()].filter((id) => !labIds || labIds.has(lab.get(id) ?? "")).slice(0, Math.min(Math.max(top ?? (labIds ? 40 : 10), 1), 40));
    }
    const want = new Set(ids);
    const loose = ids.filter((id) => !this.bestRank.has(id)).flatMap((id) => {
      const model = this.snapshot.models.find((m) => m.id === id)!;
      // Configurations of one effort (harness or source variants) collapse to the first, as the builder shows them.
      return this.snapshot.variants.filter((v, i, all) => v.modelId === id && all.findIndex((x) => x.modelId === id && x.effort === v.effort) === i).map((variant): RankedVariant => ({ variant, model, score: NaN, coverage: 0, measuredShare: 0, values: [], onFrontier: false, rank: 0 }));
    });
    let rows = [...this.ranked.filter((r) => want.has(r.model.id)), ...loose];
    if (efforts === "best") rows = rows.filter((r, i, a) => a.findIndex((x) => x.model.id === r.model.id) === i);
    else if (Array.isArray(efforts)) rows = rows.filter((r) => efforts.includes(r.variant.effort));
    rows.sort((a, b) => ids.indexOf(a.model.id) - ids.indexOf(b.model.id) || byEffort(a.variant, b.variant));
    return { rows, unknown, unranked };
  }

  row(r: RankedVariant, metrics: Metric[]): Row {
    return { modelId: r.model.id, model: r.model.name, labId: r.model.labId, variantId: r.variant.id, effort: r.variant.effort, rank: this.bestRank.get(r.model.id) ?? null, values: Object.fromEntries(metrics.map((m) => [m.key, this.value(m, r)])) };
  }
}
