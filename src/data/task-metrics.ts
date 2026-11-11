import { SUBSCRIPTION_BENCHMARK, type CostBasis } from "./subscription";
import { columnsOf, observationsOf } from "./columns";
import { onAaPerformanceV3 } from "./series-breaks";
import type { Benchmark, Observation, Snapshot } from "./types";

export type TaskMetric = "cost" | "time";
/** Artificial Analysis' own figures (its index cost per task, its computed decode time): what stands in where a mix publishes neither. */
export const AA_SOURCE = "aa";

/** Cost per task is the mix's own blend: each benchmark at its measured cost, weighted by its share. */
export const MIX_COST_DESCRIPTION = "Each benchmark in the mix at its own measured cost per task, weighted by its share. Where a mix publishes no costs, Artificial Analysis' Intelligence Index cost per task stands in";

/** The same measurement, short, for a row's `costSource`. */
export const MIX_COST_CAPTION = "Weighted by this mix, from each benchmark's own measured cost";

/** The same blend over measured run durations, with AA's computed figure standing in where a mix has none. */
export const MIX_TIME_DESCRIPTION = "Each benchmark in the mix at its own measured run duration, weighted by its share. Where a mix publishes no durations, Artificial Analysis' computed time per task stands in";

/** The same measurement, short, for a row's `timeSource`. */
export const MIX_TIME_CAPTION = "Weighted by this mix, from each benchmark's own measured run duration";

/** Artificial Analysis' time per task, which is computed rather than timed. `date` is the snapshot's: older snapshots keep the method they were measured with. */
export function aaTimeDescription(date?: string): string {
  return onAaPerformanceV3(date)
    ? "Artificial Analysis · computed, not timed: output tokens per Intelligence Index task divided by output speed, without tool time. Method changed Nov 4, 2026"
    : "Artificial Analysis · estimated decode time per Intelligence Index task, excluding first-token wait and overhead";
}

/** `computed` owns the fallback a mixed chart used: one benchmark published durations, another did not. */
export const timeDescription = (date?: string, measured = false, computed = false) => !measured ? aaTimeDescription(date)
  : computed ? `${MIX_TIME_DESCRIPTION}. A model with no measured duration shows Artificial Analysis' computed figure`
  : MIX_TIME_DESCRIPTION;

/** A measured run, which a speed tier cannot scale: it also holds the time tools take. */
export const hasMeasuredTime = (rows: { timeSec?: number; timeComputed?: boolean }[]) => rows.some((r) => r.timeSec != null && !r.timeComputed);

/** AA's computed decode time, the only time a speed tier can scale. Tiers are offered only then. */
export const hasComputedTime = (rows: { timeSec?: number; timeComputed?: boolean }[]) => rows.some((r) => r.timeSec != null && r.timeComputed === true);

/** Cost chart caption for one benchmark's own measured cost per task. */
export const benchmarkCostDescription = (benchmark: Pick<Benchmark, "name">) => `${benchmark.name} · measured cost per task`;

/** A row's `costSource`: the blend, a benchmark page's own benchmark, or AA's index figure standing in. */
export const costCaption = (benchmark?: string) => benchmark ? `${benchmark} · measured cost per task` : MIX_COST_DESCRIPTION;

/** Cost chart caption: the measurement, then how it is priced when not at API list prices. */
export function costDescription(basis: CostBasis = "api", benchmark?: Pick<Benchmark, "name">): string {
  const measured = benchmark ? benchmarkCostDescription(benchmark) : MIX_COST_DESCRIPTION;
  return basis === "subscription" ? `${measured}, then priced by subscription where plan data exists (Real API Pricing, full allowance used)` : measured;
}

/** The subscription view needs the plan-price source, which older snapshots predate. */
export const hasSubscriptionPrices = (snapshot: Snapshot) => snapshot.benchmarks.some((b) => b.id === SUBSCRIPTION_BENCHMARK);

/** Measurements only. Match the same model, effort and configuration, including legacy aliases. */
/** `source` is `aa` for Artificial Analysis' index figures, or any benchmark id whose observations carry their own `costUsd` / `durationSec`. */
/**
 * The task-metric source "terminalbench-4" (the id saved links and Convex carry) reads tbench.ai's current 4.x board: 4.1
 * re-grades 4.0's trials, so cost and duration per trial are the same. Snapshots from before 4.1 read 4.0.
 */
const tbBoard = (snapshot: Snapshot) => snapshot.benchmarks.some((b) => b.id === "terminalbench-4.1") ? "terminalbench-4.1" : "terminalbench-4";

export function taskMetricData(snapshot: Snapshot, source: string, metric: TaskMetric) {
  const benchmarkId = source === "terminalbench-4" ? tbBoard(snapshot) : source !== "aa" ? source : metric === "cost" ? "aa-cost-per-task-index"
    : snapshot.benchmarks.filter((b) => b.id.startsWith("aa-intelligence-index")).sort((a, b) => b.id.localeCompare(a.id))[0]?.id;
  const rows = new Map<string, { value: number; observation: Observation }>();
  for (const o of benchmarkId === undefined ? [] : observationsOf(snapshot, benchmarkId)) {
    if (o.details?.priorsEstimate) continue;
    const value = source !== "aa" ? (metric === "cost" ? o.costUsd : o.durationSec)
      : metric === "cost" ? o.value : o.details?.estimatedDecodeSecondsPerTask;
    if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) continue;
    // Scraper order selects the published best-scoring harness when several share an identity.
    if (!rows.has(o.variantId)) rows.set(o.variantId, { value, observation: o });
  }
  const { aliases, modelOf } = columnsOf(snapshot);
  return {
    get modelCount() { return new Set([...rows.keys()].map((id) => modelOf.get(id)).filter(Boolean)).size; },
    get: (variantId: string) => rows.get(aliases.get(variantId) ?? variantId),
  };
}
