import type { Observation, Snapshot } from "./types";

export type TaskMetricSource = "aa" | "terminalbench-4";
export type TaskMetric = "cost" | "time";
export const TASK_METRIC_SOURCES: { id: TaskMetricSource; name: string }[] = [
  { id: "aa", name: "Artificial Analysis" },
  { id: "terminalbench-4", name: "Terminal-Bench 4.0" },
];

export function taskMetricDescription(source: TaskMetricSource, metric: TaskMetric): string {
  if (source === "terminalbench-4") return metric === "cost"
    ? "Terminal-Bench 4.0 · average cost per trial, including unsuccessful trials"
    : "Terminal-Bench 4.0 · average trial duration, including unsuccessful trials";
  return metric === "cost"
    ? "Artificial Analysis · measured task costs, weighted by your mix when available"
    : "Artificial Analysis · estimated decode time per Intelligence Index task, excluding first-token wait and overhead";
}

/** Measurements only. Match the same model and effort; never substitute another effort or source. */
export function taskMetricData(snapshot: Snapshot, source: TaskMetricSource, metric: TaskMetric) {
  const benchmarkId = source === "terminalbench-4" ? source : metric === "cost" ? "aa-cost-per-task-index"
    : snapshot.benchmarks.filter((b) => b.id.startsWith("aa-intelligence-index")).sort((a, b) => b.id.localeCompare(a.id))[0]?.id;
  const rows = new Map<string, { value: number; observation: Observation }>();
  const models = new Set<string>();
  const variantModels = new Map(snapshot.variants.map((v) => [v.id, v.modelId]));
  for (const o of snapshot.observations) {
    if (o.benchmarkId !== benchmarkId || o.details?.priorsEstimate) continue;
    const value = source === "terminalbench-4" ? (metric === "cost" ? o.costUsd : o.durationSec)
      : metric === "cost" ? o.value : o.details?.estimatedDecodeSecondsPerTask;
    if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) continue;
    // Scraper order selects the published best-scoring harness when several share an identity.
    if (!rows.has(o.variantId)) rows.set(o.variantId, { value, observation: o });
    const modelId = variantModels.get(o.variantId);
    if (modelId) models.add(modelId);
  }
  const baseRows = new Map<string, { value: number; observation: Observation }>();
  for (const [id, row] of rows) if (!baseRows.has(id.split("~")[0])) baseRows.set(id.split("~")[0], row);
  return {
    modelCount: models.size,
    get: (variantId: string) => rows.get(variantId) ?? (variantId.includes("~") ? rows.get(variantId.split("~")[0]) : baseRows.get(variantId)),
  };
}

export function taskMetricOptions(snapshot: Snapshot, metric: TaskMetric) {
  return TASK_METRIC_SOURCES.map((source) => ({ ...source, modelCount: taskMetricData(snapshot, source.id, metric).modelCount }));
}
