import { clientSnapshot } from "@/data/client-snapshot";
import { CODEX_LIMITS_BENCHMARK, listPrices, SUBSCRIPTION_BENCHMARK, T3_USAGE_BENCHMARK } from "@/data/subscription";
import type { Snapshot } from "@/data/types";
import type { DirectoryItem } from "@/components/benchmark/BenchmarkDirectory";
import { DEFAULT_CUTOFF, inferredObservation, type IndexConfig, type ViewOptions } from "@/engine";

/**
 * A benchmark's page ranks models by this one benchmark alone, so the browser only needs its results and
 * what subscription prices are worked out from, not the whole snapshot. Plan pricing reads the plans, Codex's message
 * limits, each model's measured token mix and each model's list price, so all four stay or the page prices differently from the builder.
 */
export function benchmarkSnapshot(snapshot: Snapshot, benchmarkId: string): Snapshot {
  const pricing = [SUBSCRIPTION_BENCHMARK, CODEX_LIMITS_BENCHMARK, T3_USAGE_BENCHMARK];
  const keep = new Set([benchmarkId, ...pricing]);
  // Only what this benchmark itself published: no rows Priors estimated, and (below) no fallback to an older
  // version or calibrated route from another benchmark. Older versions are their own pages.
  const observations = snapshot.observations.filter((o) => keep.has(o.benchmarkId) && !(o.benchmarkId === benchmarkId && inferredObservation(o)));
  const variantIds = new Set(observations.map((o) => o.variantId.split("~")[0]));
  const series = snapshot.series.filter((x) => x.benchmarkId === benchmarkId);
  for (const x of series) variantIds.add(x.variantId);
  // A plan's share reads a model's first listed price, which may sit on a variant this page has no row for, and it must stay the first: a later one can differ.
  const pricedModels = new Set(snapshot.variants.filter((v) => variantIds.has(v.id)).map((v) => v.modelId)), firstPrice = new Set<string>();
  const variants = snapshot.variants.filter((v) => {
    const first = pricedModels.has(v.modelId) && !firstPrice.has(v.modelId) && !!listPrices(v.sourceModel?.metadata);
    if (first) firstPrice.add(v.modelId);
    return first || variantIds.has(v.id);
  });
  const modelIds = new Set(variants.map((v) => v.modelId));
  const models = snapshot.models.filter((m) => modelIds.has(m.id));
  const labIds = new Set(models.map((m) => m.labId));
  const benchmarks = snapshot.benchmarks.filter((b) => keep.has(b.id)).map((b) => b.id !== benchmarkId ? b : { ...b, estimationRoutes: undefined, versionPolicy: b.versionPolicy?.kind === "fallback" ? undefined : b.versionPolicy });
  const slim = clientSnapshot({ ...snapshot, benchmarks, observations, variants, models, labs: snapshot.labs.filter((l) => labIds.has(l.id)), series });
  // The page's breakdowns and notes read this benchmark's full details, which the shared client snapshot drops.
  slim.observations = slim.observations.map((o, i) => o.benchmarkId === benchmarkId ? { ...o, details: observations[i].details, note: observations[i].note }
    // Pricing only reads the token mix; the daily usage series behind it is large.
    : o.benchmarkId === T3_USAGE_BENCHMARK ? { ...o, details: o.details?.tokenMix ? { tokenMix: o.details.tokenMix } : undefined } : o);
  slim.series = series; // the shared client snapshot drops series; this page draws them
  return slim;
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

/**
 * The /benchmarks directory: every measured benchmark with its model count, quality (the onboarding's score: recency,
 * saturation, objectivity, frontier coverage), how many published pages weight it and the model on top. Proxies (token prices) stay out.
 */
export function directoryItems(snapshot: Snapshot, quality: Map<string, number>, pages: { indices: { weights: Record<string, number> }[] }[]): DirectoryItem[] {
  const models = new Map<string, Set<string>>(), best = new Map<string, { value: number; modelId: string }>();
  const higher = new Map(snapshot.benchmarks.map((b) => [b.id, b.higherIsBetter]));
  for (const o of snapshot.observations) if (!inferredObservation(o)) {
    const modelId = o.variantId.split("@")[0], top = best.get(o.benchmarkId);
    (models.get(o.benchmarkId) ?? models.set(o.benchmarkId, new Set()).get(o.benchmarkId)!).add(modelId);
    if (!top || (higher.get(o.benchmarkId) ? o.value > top.value : o.value < top.value)) best.set(o.benchmarkId, { value: o.value, modelId });
  }
  const modelById = new Map(snapshot.models.map((m) => [m.id, m])), labColor = new Map(snapshot.labs.map((l) => [l.id, l.color]));
  const leaderOf = (id: string) => { const m = modelById.get(best.get(id)?.modelId ?? ""); return m ? { leader: { name: m.name, labId: m.labId, color: labColor.get(m.labId) ?? "" } } : {}; };
  const uses = new Map<string, number>();
  for (const p of pages) for (const id of new Set(p.indices.flatMap((i) => Object.entries(i.weights).filter(([, w]) => w > 0).map(([k]) => k)))) uses.set(id, (uses.get(id) ?? 0) + 1);
  const superseded = new Set(snapshot.benchmarks.map((b) => b.versionPolicy?.kind === "fresh" ? b.versionPolicy.supersedes : b.versionPolicy?.kind === "fallback" ? b.versionPolicy.fallbackTo : undefined));
  const listed = snapshot.benchmarks.filter((b) => models.has(b.id) && !b.proxy);
  const splits = new Map<string, number>();
  for (const b of listed) if (b.variantOf) splits.set(b.variantOf, (splits.get(b.variantOf) ?? 0) + 1);
  const host = (u: string) => { try { return new URL(u).hostname.replace(/^www\./, ""); } catch { return ""; } };
  return listed.map((b) => ({
    id: b.id, name: b.name, shortName: b.shortName, sourceId: b.sourceId, category: b.category, ...(b.categories ? { categories: b.categories } : {}), description: b.description, host: host(b.url),
    models: models.get(b.id)!.size, quality: quality.get(b.id) ?? 50, uses: uses.get(b.id) ?? 0, lastUpdated: b.lastUpdated, ...leaderOf(b.id),
    ...(superseded.has(b.id) || b.stoppedPublishing ? { superseded: true } : {}), ...(b.variantOf ? { variantOf: b.variantOf } : {}), ...(splits.get(b.id) ? { splits: splits.get(b.id) } : {}),
  }));
}
