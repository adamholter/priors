import { SUBSCRIPTION_BENCHMARK } from "./subscription";
import type { Observation, Snapshot } from "./types";

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
        // Daily turns per model and all models, for the usage-over-time chart.
        ...(observation.benchmarkId === "t3-usage-share" && details.daily !== undefined && { start: details.start, daily: details.daily, dayTotals: details.dayTotals }),
      };
      return Object.keys(usedDetails).length ? { ...observation, details: usedDetails } : { ...observation, details: undefined };
    }),
  };
}

/** Onboarding can show the lineup before downloading calculation rows. */
export function onboardingSnapshot(snapshot: Snapshot): Snapshot {
  return { ...snapshot, variants: [], observations: [], estimates: [], series: [], sources: [] };
}
