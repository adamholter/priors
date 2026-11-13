import { SUBSCRIPTION_BENCHMARK, type CostBasis } from "./subscription";
import { columnsOf, observationsOf } from "./columns";
import { onAaPerformanceV3 } from "./series-breaks";
import type { Observation, Snapshot } from "./types";

export type TaskMetricSource = "aa" | "terminalbench-4" | "deepswe-1.1" | "frontierswe-v2" | "t3-code";
export type TaskMetric = "cost" | "time";
export const TASK_METRIC_SOURCES: { id: TaskMetricSource; name: string }[] = [
  { id: "aa", name: "Artificial Analysis" },
  { id: "terminalbench-4", name: "Terminal-Bench 4" },
  { id: "deepswe-1.1", name: "DeepSWE 1.1" },
  { id: "frontierswe-v2", name: "FrontierSWE v2" },
  { id: "t3-code", name: "T3 Code (real use)" },
];

export function isTaskMetricSource(value: string): value is TaskMetricSource {
  return TASK_METRIC_SOURCES.some((source) => source.id === value);
}

/** `date` is the snapshot's: older snapshots keep the description of the method they were measured with. */
export function taskMetricDescription(source: TaskMetricSource, metric: TaskMetric, date?: string): string {
  if (source === "terminalbench-4") return metric === "cost"
    ? "Terminal-Bench 4 · average cost per trial, including unsuccessful trials (4.1 re-grades 4.0's trials, so both share them)"
    : "Terminal-Bench 4 · average trial duration, including unsuccessful trials (4.1 re-grades 4.0's trials, so both share them)";
  if (source === "deepswe-1.1") return metric === "cost"
    ? "DeepSWE 1.1 · average cost per task run, mini-swe-agent"
    : "DeepSWE 1.1 · average task-run duration, mini-swe-agent";
  if (source === "t3-code") return metric === "cost"
    ? "T3 Code · API cost of an average turn in real coding sessions, its tokens by kind at the model's list price, last 30 days"
    : "T3 Code · average time per completed turn in real coding sessions, tool and wait time included, last 30 days";
  if (source === "frontierswe-v2") return metric === "cost"
    ? "FrontierSWE v2 · average cost per trial, Proximus, five trials per task"
    : "FrontierSWE v2 · average trial duration, Proximus, 20-hour budget";
  return metric === "cost"
    ? "Artificial Analysis · measured task costs, weighted by your mix when available"
    : onAaPerformanceV3(date)
      ? "Artificial Analysis · computed, not timed: output tokens per Intelligence Index task divided by output speed, without tool time. Method changed Nov 4, 2026"
      : "Artificial Analysis · estimated decode time per Intelligence Index task, excluding first-token wait and overhead";
}

/** Cost chart caption: the measurement, then how it is priced when not at API list prices. */
export function costDescription(source: TaskMetricSource, basis: CostBasis = "api"): string {
  const measured = taskMetricDescription(source, "cost");
  return basis === "subscription" ? `${measured}, then priced by subscription where plan data exists (Real API Pricing, full allowance used)` : measured;
}

/** The subscription view needs the plan-price source, which older snapshots predate. */
export const hasSubscriptionPrices = (snapshot: Snapshot) => snapshot.benchmarks.some((b) => b.id === SUBSCRIPTION_BENCHMARK);

/** Measurements only. Match the same model, effort and configuration, including legacy aliases. */
/** `source` is a task-metric source, or any benchmark id whose observations carry their own `costUsd` / `durationSec`. */
/**
 * The task-metric source "terminalbench-4" (the id saved links and Convex carry) reads tbench.ai's current 4.x board: 4.1
 * re-grades 4.0's trials, so cost and duration per trial are the same. Snapshots from before 4.1 read 4.0.
 */
const tbBoard = (snapshot: Snapshot) => snapshot.benchmarks.some((b) => b.id === "terminalbench-4.1") ? "terminalbench-4.1" : "terminalbench-4";

export function taskMetricData(snapshot: Snapshot, source: string, metric: TaskMetric) {
  const benchmarkId = source === "terminalbench-4" ? tbBoard(snapshot) : source === "t3-code" ? "t3-usage-share" : source !== "aa" ? source : metric === "cost" ? "aa-cost-per-task-index"
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

export function taskMetricOptions(snapshot: Snapshot, metric: TaskMetric) {
  return TASK_METRIC_SOURCES.map((source) => ({ ...source, modelCount: taskMetricData(snapshot, source.id, metric).modelCount }));
}
