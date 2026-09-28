import type { Observation, Snapshot } from "./types";

/** Keep every field used by charting, calculation, imports, and source inspection.
 * Scraper-specific raw detail objects stay on the server. */
export function clientSnapshot(snapshot: Snapshot): Snapshot {
  return {
    ...snapshot,
    observations: snapshot.observations.map((observation): Observation => {
      const details = observation.details;
      if (!details) return observation;
      const realIndex = details.realIndex as { rawValue?: number; effortAttribution?: string } | undefined;
      const usedDetails = {
        ...(details.priorsEstimate !== undefined && { priorsEstimate: details.priorsEstimate }),
        ...(realIndex && { realIndex: { rawValue: realIndex.rawValue, effortAttribution: realIndex.effortAttribution } }),
        ...(details.estimatedDecodeSecondsPerTask !== undefined && { estimatedDecodeSecondsPerTask: details.estimatedDecodeSecondsPerTask }),
        ...(details.outputTokensPerTask !== undefined && { outputTokensPerTask: details.outputTokensPerTask }),
      };
      return Object.keys(usedDetails).length ? { ...observation, details: usedDetails } : { ...observation, details: undefined };
    }),
  };
}

/** Onboarding can show the lineup before downloading calculation rows. */
export function onboardingSnapshot(snapshot: Snapshot): Snapshot {
  return { ...snapshot, variants: [], observations: [], estimates: [], series: [], sources: [] };
}
