import { describe, expect, it } from "vitest";
import type { Benchmark, Model, Variant } from "@/data/types";
import type { IndexResult, RankedVariant } from "@/engine";
import { fillFromSiblings, medianPoints, normalize, radarAxes, radarModels, type RadarAxis } from "./radar-data";

const bench = (id: string, category: Benchmark["category"], share: number) => ({
  benchmark: { id, name: id.toUpperCase(), sourceId: "t", url: "", description: "", unit: "percent", higherIsBetter: true, category } as Benchmark,
  share, required: false,
});
const row = (id: string, rank: number, values: Record<string, number>, variant = `${id}@high`, effort: Variant["effort"] = "high"): RankedVariant => ({
  variant: { id: variant, modelId: id, effort } as Variant,
  model: { id, name: id, labId: "lab", kind: "llm", reasoning: true, aliases: [] } as Model,
  score: 100 - rank, coverage: 1, measuredShare: 1, onFrontier: false, rank,
  values: Object.entries(values).map(([benchmarkId, value]) => ({ benchmarkId, value, estimated: false })),
});
const benchmarks: IndexResult["benchmarks"] = [bench("know", "knowledge", 20), bench("code", "coding", 50), bench("agent", "agentic", 30)];
const rows = [row("a", 1, { code: 80, agent: 60, know: 40 }), row("b", 2, { code: 60, agent: 70, know: 50 }), row("c", 3, { code: 40, know: 30 })];

describe("radar data", () => {
  it("orders spokes by category and records the field range", () => {
    const axes = radarAxes(benchmarks, rows);
    expect(axes.map((a) => a.id)).toEqual(["code", "agent", "know"]);
    expect(axes[0]).toMatchObject({ min: 40, max: 80, median: 60 });
  });

  it("normalizes each mode into 0-1 with a visible floor", () => {
    const axis = { min: 40, max: 80 } as RadarAxis;
    expect(normalize(80, axis, "field", [])).toBe(1);
    expect(normalize(40, axis, "field", [])).toBeCloseTo(0.1);
    expect(normalize(60, axis, "score", [])).toBe(0.6);
    expect(normalize(80, axis, "rank", [40, 60, 80])).toBe(1);
    expect(normalize(40, axis, "rank", [40, 60, 80])).toBeCloseTo(0.1);
  });

  it("leaves missing benchmarks empty rather than inventing a value", () => {
    const axes = radarAxes(benchmarks, rows);
    const c = radarModels(rows, axes, "field").find((m) => m.id === "c")!;
    expect(c.points[1]).toEqual({ r: null, estimated: false });
    expect(medianPoints(rows, axes, "score").map((p) => p.value)).toEqual([60, 70, 40]);
  });

  it("fills a gap from the same model's other source configuration", () => {
    const ranked = row("m", 1, { code: 70 }, "m@max~aa-x", "max");
    const vals = row("m", 9, { agent: 44 }, "m@max~vals-y", "max");
    const lower = row("m", 9, { know: 30 }, "m@low", "low");
    const substituted = { ...row("m", 9, {}, "m@max", "max"), values: [{ benchmarkId: "agent", value: 40, estimated: true, estimateKind: "effort" as const }] };
    const [filled] = fillFromSiblings([ranked], [ranked, substituted, vals, lower], ["code", "agent", "know"]);
    expect(filled.values.find((v) => v.benchmarkId === "agent")).toMatchObject({ value: 44, estimated: false, sourceVariantId: "m@max~vals-y" });
    expect(filled.values.find((v) => v.benchmarkId === "know")).toMatchObject({ value: 30, estimated: true });
    expect(filled.score).toBe(ranked.score);
  });
});

import { radarByCategory, radarModelsFor, radarSpokes, readRadarParams, radarParams, DEFAULT_RADAR, RADAR_MAX_BENCHMARK_SPOKES } from "./radar-view";

describe("category spokes", () => {
  const bm = (id: string, category: string, share: number) => ({ required: false, share, benchmark: { id, name: id.toUpperCase(), sourceId: "s", url: "", description: "", unit: "percent" as const, higherIsBetter: true, category: category as never } });
  const benchmarks = [bm("a", "coding", 30), bm("b", "coding", 10), bm("c", "math", 40), bm("d", "science", 20)];
  const row = (id: string, values: Record<string, number>, estimated: string[] = []) => ({ model: { id, name: id, labId: "l" }, variant: { id: `${id}@x`, effort: "high" }, score: 1, rank: 1, values: Object.entries(values).map(([benchmarkId, value]) => ({ benchmarkId, value, estimated: estimated.includes(benchmarkId) })) }) as never;
  it("rolls an index's benchmarks up by category, weighted as the index weights them", () => {
    const g = radarByCategory([row("m", { a: 80, b: 40, c: 50 }, ["b"])], benchmarks);
    expect(g.benchmarks.map((x) => [x.benchmark.id, x.benchmark.name, x.share])).toEqual([["cat:coding", "Coding", 40], ["cat:science", "Science & research", 20], ["cat:math", "Math", 40]]);
    expect(g.benchmarks[0].benchmark.description).toBe("2 benchmarks of this index, weighted as the index weights them: A and B.");
    const values = (g.rows[0] as unknown as { values: { benchmarkId: string; value: number; estimated: boolean }[] }).values;
    expect(values).toEqual([{ benchmarkId: "cat:coding", value: 70, estimated: true }, { benchmarkId: "cat:math", value: 50, estimated: false }]);
  });
  it("draws categories when asked, or by itself once benchmarks are too many, and never with fewer than three", () => {
    expect(radarSpokes(benchmarks)).toEqual({ spokes: "benchmarks", canGroup: true });
    expect(radarSpokes(benchmarks, "categories").spokes).toBe("categories");
    const many = Array.from({ length: RADAR_MAX_BENCHMARK_SPOKES + 1 }, (_, i) => bm(`x${i}`, ["coding", "math", "science"][i % 3], 1));
    expect(radarSpokes(many).spokes).toBe("categories");
    expect(radarSpokes(many, "benchmarks").spokes).toBe("benchmarks");
    expect(radarSpokes([bm("a", "coding", 50), bm("b", "math", 50)], "categories")).toEqual({ spokes: "benchmarks", canGroup: false });
    expect(radarModelsFor([row("m", { a: 80, b: 40, c: 50, d: 10 })], benchmarks, "score", "categories").axes.map((a) => a.id)).toEqual(["cat:coding", "cat:science", "cat:math"]);
  });
  it("carries the choice in chart links", () => {
    expect(radarParams({ ...DEFAULT_RADAR, spokes: "categories" }).rg).toBe("cat");
    expect(radarParams(DEFAULT_RADAR).rg).toBeUndefined();
    expect(readRadarParams(new URLSearchParams("rg=cat")).spokes).toBe("categories");
    expect(readRadarParams(new URLSearchParams("")).spokes).toBeUndefined();
  });
});
