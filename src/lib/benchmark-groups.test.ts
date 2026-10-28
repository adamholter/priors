import { describe, expect, it } from "vitest";
import type { Benchmark } from "@/data/types";
import type { BenchmarkQuality } from "@/onboarding/quality";
import { groupBySource, isOldOrNiche, sourceFamily, tierBenchmarks } from "./benchmark-groups";

const bench = (id: string, sourceId = "x"): Benchmark => ({ id, name: id, sourceId, url: "", description: "", unit: "percent", higherIsBetter: true, category: "reasoning" });
const q = (id: string, over: Partial<BenchmarkQuality> = {}): BenchmarkQuality => ({ id, name: id, score: 60, recency: 0, saturation: 0, objectivity: 0, preferred: false, dateConfidence: "unknown", reason: "", sourceUrl: "", coverage: 100, frontierCoverage: 0, frontierMeasured: 6, frontierTotal: 10, staleFrontier: false, ...over });

describe("tierBenchmarks", () => {
  it("sets apart what no top model has run, what scores poorly, what predates the era and what is superseded or archived", () => {
    expect(isOldOrNiche(bench("hellaswag"), q("hellaswag", { frontierMeasured: 0 }))).toBe(true);
    expect(isOldOrNiche(bench("weak"), q("weak", { score: 30 }))).toBe(true);
    expect(isOldOrNiche(bench("mmlu"), q("mmlu", { releaseDate: "2020-09-07", dateConfidence: "verified" }))).toBe(true);
    expect(isOldOrNiche(bench("arc-agi-1"), q("arc-agi-1"))).toBe(true);
    expect(isOldOrNiche(bench("vals-aime", "vals-archived"), q("vals-aime"))).toBe(true);
    expect(isOldOrNiche(bench("good"), q("good"))).toBe(false);
    // The best model on it shipped over a year before today: nothing current has topped it.
    expect(isOldOrNiche(bench("aged"), q("aged"), "2025-06-01", "2026-10-19")).toBe(true);
    expect(isOldOrNiche(bench("fresh"), q("fresh"), "2026-01-01", "2026-10-19")).toBe(false);
    expect(isOldOrNiche(bench("unscored"), undefined)).toBe(false);
  });
  it("lifts the preferred and best-scoring current benchmarks to the top and keeps the rest in quality order", () => {
    const list = ["a", "b", "c", "aa-terminalbench-v4-0", "old"].map((id) => bench(id));
    const quality = new Map([q("a", { score: 90 }), q("b", { score: 70 }), q("c", { score: 80 }), q("aa-terminalbench-v4-0", { score: 50 }), q("old", { frontierMeasured: 0 })].map((x) => [x.id, x]));
    const t = tierBenchmarks(list, quality);
    expect(t.old.map((b) => b.id)).toEqual(["old"]);
    expect(t.popular.map((b) => b.id)).toEqual(["aa-terminalbench-v4-0", "a", "c", "b"]);
    expect(t.main).toEqual([]);
  });
});

describe("groupBySource", () => {
  it("names publishers and gathers the small ones", () => {
    expect(sourceFamily("aa")).toBe("Artificial Analysis");
    expect(sourceFamily("vals-sage")).toBe("Vals AI");
    const list = [...["1", "2", "3"].map((n) => bench(`aa${n}`, "aa")), bench("solo-a", "alpha"), bench("solo-b", "beta")];
    const g = groupBySource(list);
    expect(g.map(([n, l]) => [n, l.length])).toEqual([["Artificial Analysis", 3], ["Independent", 2]]);
  });
});
