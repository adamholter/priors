import { describe, expect, it } from "vitest";
import type { Benchmark, Snapshot } from "../data/types";
import { benchmarkQuality } from "./quality";

const benchmark = (id: string, name = id): Benchmark => ({
  id, name, sourceId: "test", url: "https://example.com", description: "Test benchmark",
  unit: "percent", higherIsBetter: true, category: "reasoning",
});

function snapshot(benchmarks: Benchmark[], values: Array<[string, string, number]>, date = "2026-09-08"): Snapshot {
  const modelIds = [...new Set(values.map(([, variantId]) => variantId.split("@")[0]))];
  return {
    version: 1, date, generatedAt: `${date}T00:00:00Z`, labs: [],
    models: modelIds.map((id) => ({ id, name: id, labId: "lab", kind: "llm", reasoning: true, aliases: [] })),
    variants: [...new Set(values.map(([, variantId]) => variantId))].map((id) => ({ id, modelId: id.split("@")[0], effort: id.split("@")[1] as "low" | "high" })),
    benchmarks,
    observations: values.map(([benchmarkId, variantId, value]) => ({ benchmarkId, variantId, value, observedAt: date, sourceUrl: "https://example.com" })),
    series: [], sources: [],
  };
}

describe("benchmarkQuality", () => {
  it("does not let duplicate effort rows inflate headroom and spread", () => {
    const b = benchmark("simplebench");
    const base = benchmarkQuality(snapshot([b], [[b.id, "a@high", 40], [b.id, "b@low", 60]]))[0];
    const duplicate = benchmarkQuality(snapshot([b], [[b.id, "a@low", 20], [b.id, "a@high", 40], [b.id, "b@low", 60]]))[0];
    expect(duplicate.saturation).toBe(base.saturation);
    expect(duplicate.coverage).toBe(base.coverage);
  });

  it("uses verified dates while holding unknown dates at neutral recency", () => {
    const result = benchmarkQuality(snapshot([benchmark("arc-agi-3"), benchmark("aa-humanitys-last-exam"), benchmark("arena-text")], []));
    expect(result.find((x) => x.id === "arc-agi-3")).toMatchObject({ releaseDate: "2026-03-25", dateConfidence: "verified" });
    expect(result.find((x) => x.id === "aa-humanitys-last-exam")!.recency).toBeLessThan(result.find((x) => x.id === "arc-agi-3")!.recency);
    expect(result.find((x) => x.id === "arena-text")).toMatchObject({ recency: 50, dateConfidence: "unknown" });
  });

  it("penalizes a saturated ceiling and a non-discriminative floor", () => {
    const high = benchmarkQuality(snapshot([benchmark("high")], [["high", "a@low", 100], ["high", "b@low", 100]]))[0];
    const flat = benchmarkQuality(snapshot([benchmark("flat")], [["flat", "a@low", 0], ["flat", "b@low", 0]]))[0];
    const diverse = benchmarkQuality(snapshot([benchmark("diverse")], [["diverse", "a@low", 0], ["diverse", "b@low", 25], ["diverse", "c@low", 50], ["diverse", "d@low", 75]]))[0];
    expect(high.saturation).toBeLessThan(flat.saturation);
    expect(flat.saturation).toBeLessThan(diverse.saturation);
  });

  it("lowers subjective arena grading regardless of percent unit", () => {
    const arena = benchmark("arena-percent", "Creative Arena");
    arena.description = "Pairwise human judge preference";
    expect(benchmarkQuality(snapshot([arena], []))[0].objectivity).toBe(40);
  });
});
