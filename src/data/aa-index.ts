import type { Benchmark, Snapshot } from "./types";

export const AA_METHODOLOGY_URL = "https://artificialanalysis.ai/methodology/intelligence-benchmarking";

/** The newest Artificial Analysis Intelligence Index in a snapshot (v5.0 over v4.3.2 over v4.10, by version number). */
export function latestAAIndex(snapshot: Pick<Snapshot, "benchmarks">): Benchmark | undefined {
  return snapshot.benchmarks.filter((b) => b.id.startsWith("aa-intelligence-index"))
    .sort((a, b) => b.id.localeCompare(a.id, undefined, { numeric: true }))[0];
}

/**
 * AA's index as a mix of its own evaluations at AA's weights, so a ranking on it shows each model's strengths
 * evaluation by evaluation. Undefined unless every component is in the snapshot: a partial copy would not be AA's index.
 */
export function aaComponentWeights(snapshot: Pick<Snapshot, "benchmarks">): Record<string, number> | undefined {
  const parts = latestAAIndex(snapshot)?.components;
  if (!parts || !Object.keys(parts).length) return undefined;
  const have = new Set(snapshot.benchmarks.map((b) => b.id));
  return Object.keys(parts).every((id) => have.has(id)) ? { ...parts } : undefined;
}
