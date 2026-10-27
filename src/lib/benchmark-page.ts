import { clientSnapshot } from "@/data/client-snapshot";
import { SUBSCRIPTION_BENCHMARK } from "@/data/subscription";
import type { Snapshot } from "@/data/types";
import { DEFAULT_CUTOFF, type IndexConfig, type ViewOptions } from "@/engine";

/**
 * A benchmark's page ranks models by this one benchmark alone, so the browser only needs its results and
 * the subscription plan prices, not the whole snapshot.
 */
export function benchmarkSnapshot(snapshot: Snapshot, benchmarkId: string): Snapshot {
  const keep = new Set([benchmarkId, SUBSCRIPTION_BENCHMARK]);
  const observations = snapshot.observations.filter((o) => keep.has(o.benchmarkId));
  const variantIds = new Set(observations.map((o) => o.variantId.split("~")[0]));
  const variants = snapshot.variants.filter((v) => variantIds.has(v.id));
  const modelIds = new Set(variants.map((v) => v.modelId));
  const models = snapshot.models.filter((m) => modelIds.has(m.id));
  const labIds = new Set(models.map((m) => m.labId));
  return clientSnapshot({ ...snapshot, benchmarks: snapshot.benchmarks.filter((b) => keep.has(b.id)), observations, variants, models, labs: snapshot.labs.filter((l) => labIds.has(l.id)), series: [] });
}

/** Whether the benchmark publishes its own cost per task, which gives it a cost chart. */
export const hasOwnCost = (snapshot: Snapshot, benchmarkId: string) =>
  snapshot.observations.some((o) => o.benchmarkId === benchmarkId && typeof o.costUsd === "number" && o.costUsd > 0);

/** The ranking behind a benchmark's page: only this benchmark, every model that has a result, cost from the benchmark itself. */
export function benchmarkIndex(snapshot: Snapshot, benchmarkId: string): IndexConfig {
  const name = snapshot.benchmarks.find((b) => b.id === benchmarkId)?.name ?? benchmarkId;
  return {
    id: `benchmark-${benchmarkId}`, name, weights: { [benchmarkId]: 100 }, required: [benchmarkId], strictness: 100, cutoff: DEFAULT_CUTOFF,
    estimateMissing: false, variants: "all", releasedAfter: "",
  };
}

/** How to compute it: every model measured stays in (no superseded-version filter), and costs come from the benchmark itself when it publishes them. */
export const benchmarkView = (snapshot: Snapshot, benchmarkId: string): ViewOptions => ({ ...(hasOwnCost(snapshot, benchmarkId) ? { costBenchmark: benchmarkId } : {}) });
