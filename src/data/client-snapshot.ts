import { SUBSCRIPTION_BENCHMARK } from "./subscription";
import type { Observation, Snapshot } from "./types";

/** Keep every field used by charting, calculation, imports, and source inspection.
 * Scraper-specific raw detail objects stay on the server. */
export function clientSnapshot(snapshot: Snapshot): Snapshot {
  return {
    ...snapshot,
    observations: snapshot.observations.map((observation): Observation => {
      const details = observation.details;
      if (!details || observation.benchmarkId === SUBSCRIPTION_BENCHMARK) return observation;
      const usedDetails = {
        ...(details.priorsEstimate !== undefined && { priorsEstimate: details.priorsEstimate }),
        ...(details.estimatedDecodeSecondsPerTask !== undefined && { estimatedDecodeSecondsPerTask: details.estimatedDecodeSecondsPerTask }),
        ...(details.outputTokensPerTask !== undefined && { outputTokensPerTask: details.outputTokensPerTask }),
        ...(observation.benchmarkId === "t3-usage-share" && details.window !== undefined && { window: details.window }),
      };
      return Object.keys(usedDetails).length ? { ...observation, details: usedDetails } : { ...observation, details: undefined };
    }),
  };
}

/** Onboarding can show the lineup before downloading calculation rows. */
export function onboardingSnapshot(snapshot: Snapshot): Snapshot {
  return { ...snapshot, variants: [], observations: [], estimates: [], series: [], sources: [] };
}
