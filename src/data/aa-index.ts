import type { Benchmark, Snapshot } from "./types";

/** AA Intelligence Index v5.0's published weights (October 2026), for when no snapshot is at hand. Snapshots carry the fitted ones. */
export const AA_V5_WEIGHTS: Record<string, number> = {
  "aa-briefcase": 15, "aa-automationbench-aa": 5, "aa-gdp-pdf": 5,
  "aa-frontiercode-2-0": 15, "aa-terminalbench-v4-0": 10,
  "aa-terminalbench-science": 15, "aa-critpt-v2-hard": 10,
  "aa-omniscience-v1-1-accuracy": 10, "aa-omniscience-v1-1-non-hallucination": 5, "aa-hle-diamond": 10,
};

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
