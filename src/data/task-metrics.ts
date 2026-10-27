import { SUBSCRIPTION_BENCHMARK, type CostBasis } from "./subscription";
import type { Observation, Snapshot } from "./types";

export type TaskMetricSource = "aa" | "terminalbench-4" | "deepswe-1.1" | "frontierswe-v2";
export type TaskMetric = "cost" | "time";
export const TASK_METRIC_SOURCES: { id: TaskMetricSource; name: string }[] = [
  { id: "aa", name: "Artificial Analysis" },
  { id: "terminalbench-4", name: "Terminal-Bench 4.0" },
  { id: "deepswe-1.1", name: "DeepSWE 1.1" },
  { id: "frontierswe-v2", name: "FrontierSWE v2" },
];

export function isTaskMetricSource(value: string): value is TaskMetricSource {
  return TASK_METRIC_SOURCES.some((source) => source.id === value);
}

export function taskMetricDescription(source: TaskMetricSource, metric: TaskMetric): string {
  if (source === "terminalbench-4") return metric === "cost"
    ? "Terminal-Bench 4.0 · average cost per trial, including unsuccessful trials"
    : "Terminal-Bench 4.0 · average trial duration, including unsuccessful trials";
  if (source === "deepswe-1.1") return metric === "cost"
    ? "DeepSWE 1.1 · average cost per task run, mini-swe-agent"
    : "DeepSWE 1.1 · average task-run duration, mini-swe-agent";
  if (source === "frontierswe-v2") return metric === "cost"
    ? "FrontierSWE v2 · average cost per trial, Proximus, five trials per task"
    : "FrontierSWE v2 · average trial duration, Proximus, 20-hour budget";
  return metric === "cost"
    ? "Artificial Analysis · measured task costs, weighted by your mix when available"
    : "Artificial Analysis · estimated decode time per Intelligence Index task, excluding first-token wait and overhead";
}

/** Cost chart caption: the measurement, then how it is priced when not at API list prices. */
export function costDescription(source: TaskMetricSource, basis: CostBasis = "api"): string {
  const measured = taskMetricDescription(source, "cost");
  return basis === "subscription" ? `${measured} · subscription-priced where plan data exists (Real API Pricing, full allowance used)` : measured;
}

/** The subscription view needs the plan-price source, which older snapshots predate. */
export const hasSubscriptionPrices = (snapshot: Snapshot) => snapshot.benchmarks.some((b) => b.id === SUBSCRIPTION_BENCHMARK);

/** Measurements only. Match the same model, effort and configuration, including legacy aliases. */
/** `source` is a task-metric source, or any benchmark id whose observations carry their own `costUsd` / `durationSec`. */
export function taskMetricData(snapshot: Snapshot, source: string, metric: TaskMetric) {
  const benchmarkId = source !== "aa" ? source : metric === "cost" ? "aa-cost-per-task-index"
    : snapshot.benchmarks.filter((b) => b.id.startsWith("aa-intelligence-index")).sort((a, b) => b.id.localeCompare(a.id))[0]?.id;
  const rows = new Map<string, { value: number; observation: Observation }>();
  const models = new Set<string>();
  const variantModels = new Map(snapshot.variants.map((v) => [v.id, v.modelId]));
  for (const o of snapshot.observations) {
    if (o.benchmarkId !== benchmarkId || o.details?.priorsEstimate) continue;
    const value = source !== "aa" ? (metric === "cost" ? o.costUsd : o.durationSec)
      : metric === "cost" ? o.value : o.details?.estimatedDecodeSecondsPerTask;
    if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) continue;
    // Scraper order selects the published best-scoring harness when several share an identity.
    if (!rows.has(o.variantId)) rows.set(o.variantId, { value, observation: o });
    const modelId = variantModels.get(o.variantId);
    if (modelId) models.add(modelId);
  }
  const aliases = new Map(snapshot.variants.flatMap(v => (v.aliases ?? []).map(id => [id, v.id] as const)));
  return {
    modelCount: models.size,
    get: (variantId: string) => rows.get(aliases.get(variantId) ?? variantId),
  };
}

export function taskMetricOptions(snapshot: Snapshot, metric: TaskMetric) {
  return TASK_METRIC_SOURCES.map((source) => ({ ...source, modelCount: taskMetricData(snapshot, source.id, metric).modelCount }));
}
