import { describe, expect, it } from "vitest";
import type { Snapshot } from "../data/types";
import { DEFAULT_PRIORS_MIX, LEGACY_DEFAULTS, defaultLineup, savedLineup } from "./defaults";

const benchmarkIds = Object.keys(DEFAULT_PRIORS_MIX.weights);

function snapshot(n: number): Snapshot {
  // Model i scores 90-i on every mix benchmark, so the mix ranks m0, m1, ... in order.
  const models = Array.from({ length: n }, (_, i) => `m${i}`);
  return {
    version: 1, date: "2026-09-23", generatedAt: "2026-09-23T00:00:00Z", labs: [],
    models: models.map((id) => ({ id, name: id, labId: "lab", kind: "llm", reasoning: true, aliases: [] })),
    variants: models.map((id) => ({ id: `${id}@max`, modelId: id, effort: "max" as const })),
    benchmarks: benchmarkIds.map((id) => ({ id, name: id, sourceId: "test", url: "https://example.com", description: "", unit: "percent" as const, higherIsBetter: true, category: "reasoning" as const })),
    observations: models.flatMap((id, i) => benchmarkIds.map((benchmarkId) => ({ benchmarkId, variantId: `${id}@max`, value: 90 - i, observedAt: "2026-09-23", sourceUrl: "https://example.com" }))),
    series: [], sources: [],
  };
}

describe("defaultLineup", () => {
  it("returns n unique model ids in the mix's rank order", () => {
    const lineup = defaultLineup(snapshot(20));
    expect(lineup).toHaveLength(14);
    expect(new Set(lineup).size).toBe(14);
    expect(lineup).toEqual(Array.from({ length: 14 }, (_, i) => `m${i}`));
  });

  it("respects a smaller n", () => {
    expect(defaultLineup(snapshot(20), 5)).toEqual(["m0", "m1", "m2", "m3", "m4"]);
  });
});

describe("savedLineup", () => {
  const known = new Set(["a", "b", "c", ...LEGACY_DEFAULTS[0]]);
  const isKnown = (id: string) => known.has(id);

  it("restores a v2 payload", () => {
    expect(savedLineup(JSON.stringify({ v: 2, lineup: ["b", "a", "c"] }), isKnown)).toEqual(["b", "a", "c"]);
  });

  it("ignores a legacy bare array equal to an earlier default", () => {
    for (const legacy of LEGACY_DEFAULTS) expect(savedLineup(JSON.stringify(legacy), isKnown)).toBeNull();
  });

  it("restores a user-edited legacy array", () => {
    expect(savedLineup(JSON.stringify(["c", "a", "b"]), isKnown)).toEqual(["c", "a", "b"]);
  });

  it("drops unknown ids and needs at least two survivors", () => {
    expect(savedLineup(JSON.stringify({ v: 2, lineup: ["a", "ghost", "b"] }), isKnown)).toEqual(["a", "b"]);
    expect(savedLineup(JSON.stringify({ v: 2, lineup: ["a", "ghost"] }), isKnown)).toBeNull();
    expect(savedLineup("not json", isKnown)).toBeNull();
    expect(savedLineup(null, isKnown)).toBeNull();
  });
});
