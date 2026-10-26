import { describe, expect, it } from "vitest";
import type { Snapshot } from "../data/types";
import { DEFAULT_PRIORS_MIX, defaultPriorsMix, LEGACY_DEFAULTS, defaultLineup, savedLineup, savedMix } from "./defaults";
import { encodeIndex } from "../lib/url";

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
    expect(lineup).toHaveLength(16);
    expect(new Set(lineup).size).toBe(16);
    expect(lineup).toEqual(Array.from({ length: 16 }, (_, i) => `m${i}`));
  });

  it("respects a smaller n", () => {
    expect(defaultLineup(snapshot(20), 5)).toEqual(["m0", "m1", "m2", "m3", "m4"]);
  });
  it("adds a new leading model from the saved mix without changing a stored lineup", () => {
    const before = snapshot(20);
    const after = snapshot(20);
    after.models.push({ id: "new-model", name: "new-model", labId: "lab", kind: "llm", reasoning: true, aliases: [] });
    after.variants.push({ id: "new-model@max", modelId: "new-model", effort: "max" });
    after.observations.push(...benchmarkIds.map((benchmarkId) => ({ benchmarkId, variantId: "new-model@max", value: 100, observedAt: after.date, sourceUrl: "https://example.com" })));
    const mix = savedMix(encodeURIComponent(encodeIndex(DEFAULT_PRIORS_MIX)), after);
    expect(mix).not.toBeNull();
    expect(defaultLineup(before, 5, mix!)).toEqual(["m0", "m1", "m2", "m3", "m4"]);
    expect(defaultLineup(after, 5, mix!)).toEqual(["new-model", "m0", "m1", "m2", "m3"]);
  });
  it("uses the newest AA composite and never fills the lineup with an unmeasured Pro model", () => {
    const s = snapshot(20);
    s.benchmarks.push({ ...s.benchmarks[0], id: "aa-intelligence-index-v4.10" });
    s.observations.push(...s.models.map((m, i) => ({ ...s.observations[0], benchmarkId: "aa-intelligence-index-v4.10", variantId: `${m.id}@max`, value: i })));
    s.models.push({ ...s.models[0], id: "gpt-6-pro" });
    s.variants.push({ id: "gpt-6-pro@max", modelId: "gpt-6-pro", effort: "max" });
    expect(defaultPriorsMix(s).weights).toEqual({ "aa-intelligence-index-v4.10": 100 });
    expect(defaultPriorsMix(s).strictness).toBe(50);
    expect(defaultLineup(s)).toEqual(Array.from({ length: 16 }, (_, i) => `m${19 - i}`));
  });
  it("respects a saved coverage floor and counts each model once even with all efforts", () => {
    const s = snapshot(20);
    s.benchmarks.push({ ...s.benchmarks[0], id: "second" });
    s.variants.push({ id: "m0@low", modelId: "m0", effort: "low" });
    s.observations.push({ ...s.observations[0], variantId: "m0@low", value: 99 });
    const mix = { ...DEFAULT_PRIORS_MIX, weights: { [benchmarkIds[0]]: 49, second: 51 }, rankingVariants: "all" as const, strictness: 50 };
    expect(defaultLineup(s, 16, mix)).toEqual([]);
    const loose = defaultLineup(s, 16, { ...mix, strictness: 0 });
    expect(loose).toHaveLength(16);
    expect(new Set(loose).size).toBe(16);
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
