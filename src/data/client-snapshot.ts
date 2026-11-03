import { SUBSCRIPTION_BENCHMARK } from "./subscription";
import type { Benchmark, Lab, Model, Observation, Snapshot } from "./types";

/**
 * Observation fields the browser never reads, dropped to shrink the download and the parse: the scrape
 * time (the snapshot has one date), the source's model id (read only beside a measured cost, for AA's
 * mix-weighted cost) and any note except the "estimated" marker the engine checks before using a score as calibration.
 */
export function slimObservation(o: Observation): Observation {
  const { note, sourceModelId, observedAt: _observedAt, ...rest } = o;
  void _observedAt;
  return { ...rest, observedAt: "", ...(note && /estimated/i.test(note) ? { note } : {}), ...(sourceModelId && o.costUsd != null ? { sourceModelId } : {}) };
}

/** Source-model metadata the browser reads (release date, reasoning, API prices) or shows in the builder's
 * per-model detail. AA's creator and release records, links and modality flags stay on the server. */
const CLIENT_METADATA = ["releaseDate", "knowledgeCutoffDate", "isReasoning", "reasoningTokens", "effort", "isOpenWeights", "parameters", "activeParams", "inferenceParametersActiveBillions", "contextWindowTokens", "licenseName", "sizeClass", "deprecated", "price1mInputTokens", "price1mOutputTokens", "cacheHitPrice", "cacheWritePrice"];
function slimSource<T extends { metadata?: Record<string, unknown> }>(s: T): T {
  if (!s.metadata) return s;
  const metadata: Record<string, unknown> = {};
  for (const k of CLIENT_METADATA) if (s.metadata[k] !== undefined) metadata[k] = s.metadata[k];
  return { ...s, metadata };
}

/** Keep every field used by charting, calculation, imports, and source inspection.
 * Scraper-specific raw detail objects stay on the server. */
export function clientSnapshot(snapshot: Snapshot): Snapshot {
  return {
    ...snapshot,
    variants: snapshot.variants.map((v) => v.sourceModel || v.sourceModels ? { ...v, ...(v.sourceModel ? { sourceModel: slimSource(v.sourceModel) } : {}), ...(v.sourceModels ? { sourceModels: v.sourceModels.map(slimSource) } : {}) } : v),
    // Long per-model time series (Vending-Bench balances) are only drawn on the benchmark's own page.
    series: [],
    observations: snapshot.observations.map((full): Observation => {
      const observation = slimObservation(full);
      const details = observation.details;
      if (!details || observation.benchmarkId === SUBSCRIPTION_BENCHMARK) return observation;
      const usedDetails = {
        ...(details.priorsEstimate !== undefined && { priorsEstimate: details.priorsEstimate }),
        ...(details.estimatedDecodeSecondsPerTask !== undefined && { estimatedDecodeSecondsPerTask: details.estimatedDecodeSecondsPerTask }),
        ...(details.outputTokensPerTask !== undefined && { outputTokensPerTask: details.outputTokensPerTask }),
        ...(observation.benchmarkId === "t3-usage-share" && details.window !== undefined && { window: details.window }),
        ...(observation.benchmarkId === "t3-usage-share" && details.tokenMix !== undefined && { tokenMix: details.tokenMix }),
        // Daily turns per model and all models, for the usage-over-time chart.
        ...(observation.benchmarkId === "t3-usage-share" && details.daily !== undefined && { start: details.start, daily: details.daily, dayTotals: details.dayTotals }),
      };
      return Object.keys(usedDetails).length ? { ...observation, details: usedDetails } : { ...observation, details: undefined };
    }),
  };
}

/** The dataset the builder, model, compare and profile pages share (`/api/snapshot?view=core&packed=2`). Each benchmark's page has its own data, so the published intervals and ranks it alone shows stay out. */
export function coreSnapshot(snapshot: Snapshot): Snapshot {
  const client = clientSnapshot(snapshot);
  return {
    ...client,
    sources: client.sources.map(({ rawPath: _rawPath, ...source }) => { void _rawPath; return source; }) as Snapshot["sources"],
    observations: client.observations.map(({ ci: _ci, rank: _rank, ...o }) => { void _ci; void _rank; return o; }),
  };
}

/** What the ranking onboarding shows before anyone asks for a fit: the rankable models and each benchmark's label. The search downloads the calculation rows when it starts. */
export type OnboardingModel = Pick<Model, "id" | "name" | "labId" | "kind" | "releaseDate" | "priceTier" | "reasoning">;
export type OnboardingBenchmark = Pick<Benchmark, "id" | "name" | "shortName" | "category" | "proxy">;
export interface OnboardingSnapshot { date: string; generatedAt: string; labs: Lab[]; models: OnboardingModel[]; benchmarks: OnboardingBenchmark[] }

export function onboardingSnapshot(snapshot: Snapshot, modelIds: Iterable<string>): OnboardingSnapshot {
  const keep = new Set(modelIds);
  return {
    date: snapshot.date, generatedAt: snapshot.generatedAt, labs: snapshot.labs,
    models: snapshot.models.filter((m) => keep.has(m.id)).map(({ id, name, labId, kind, releaseDate, priceTier, reasoning }) => ({ id, name, labId, kind, releaseDate, priceTier, reasoning })),
    benchmarks: snapshot.benchmarks.map(({ id, name, shortName, category, proxy }) => ({ id, name, shortName, category, proxy })),
  };
}
