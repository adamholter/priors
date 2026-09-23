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

  it("scores Terminal-Bench 4 above its superseded 2.1 version", () => {
    const result = benchmarkQuality(snapshot([benchmark("terminalbench-4"), benchmark("aa-terminalbench-v2-1")], []));
    expect(result.find((x) => x.id === "terminalbench-4")!.score).toBeGreaterThan(result.find((x) => x.id === "aa-terminalbench-v2-1")!.score);
  });

  it("adds the +15 preferred-benchmark contribution", () => {
    const q = benchmarkQuality(snapshot([benchmark("deepswe-1.1")], [["deepswe-1.1", "a@low", 40], ["deepswe-1.1", "b@low", 60]]))[0];
    expect(q.preferred).toBe(true);
    const base = Math.round(0.15 * q.coverage + 0.15 * q.frontierCoverage + 0.2 * q.recency + 0.3 * q.saturation + 0.2 * q.objectivity);
    expect(q.score).toBe(Math.min(100, base + 15));
  });

  it("downweights publisher results that predate the September 22 frontier releases", () => {
    const fresh = { ...benchmark("fresh"), lastUpdated: "2026-09-22" };
    const stale = { ...benchmark("stale"), lastUpdated: "2026-09-21" };
    const values: Array<[string, string, number]> = [
      ["fresh", "claude-opus-5.5@max", 20], ["fresh", "gpt-6-sol@max", 30],
      ["stale", "claude-opus-5.5@max", 20], ["stale", "gpt-6-sol@max", 30],
    ];
    const result = benchmarkQuality(snapshot([fresh, stale], values, "2026-09-23"));
    expect(result.find((q) => q.id === "fresh")?.staleFrontier).toBe(false);
    expect(result.find((q) => q.id === "stale")?.staleFrontier).toBe(true);
    expect(result.find((q) => q.id === "fresh")!.score - result.find((q) => q.id === "stale")!.score).toBe(20);
  });

  it("rewards measured top models rather than only the total row count", () => {
    const full = benchmark("full"), gaps = benchmark("gaps");
    const values: Array<[string, string, number]> = [
      ["full", "claude-opus-5.5@max", 20], ["full", "gpt-6-sol@max", 40], ["full", "gpt-6-luna@max", 60],
      ["gaps", "claude-opus-5.5@max", 20], ["gaps", "other-a@max", 40], ["gaps", "other-b@max", 60],
    ];
    const result = benchmarkQuality(snapshot([full, gaps], values, "2026-09-23"));
    const a = result.find((q) => q.id === "full")!, b = result.find((q) => q.id === "gaps")!;
    expect(a.coverage).toBe(b.coverage);
    expect(a.frontierMeasured).toBe(3);
    expect(b.frontierMeasured).toBe(1);
    expect(a.score).toBeGreaterThan(b.score);
  });

  it("scores broader measured coverage higher with other inputs held equal", () => {
    const narrow = benchmark("narrow"), broad = benchmark("broad");
    const flat = (benchmarkId: string, n: number): Array<[string, string, number]> =>
      Array.from({ length: n }, (_, i): [string, string, number] => [benchmarkId, `m${i}@low`, 50]);
    const result = benchmarkQuality(snapshot([narrow, broad], [...flat("narrow", 10), ...flat("broad", 60)]));
    const qNarrow = result.find((x) => x.id === "narrow")!, qBroad = result.find((x) => x.id === "broad")!;
    expect(qNarrow.coverage).toBe(25);
    expect(qBroad.coverage).toBe(100);
    expect(qNarrow.recency).toBe(qBroad.recency);
    expect(qNarrow.saturation).toBe(qBroad.saturation);
    expect(qNarrow.objectivity).toBe(qBroad.objectivity);
    expect(qNarrow.score).toBeLessThan(qBroad.score);
  });
});
