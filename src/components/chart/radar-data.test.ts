import { describe, expect, it } from "vitest";
import type { Benchmark, Model, Variant } from "@/data/types";
import type { IndexResult, RankedVariant } from "@/engine";
import { medianPoints, normalize, radarAxes, radarModels, type RadarAxis } from "./radar-data";

const bench = (id: string, category: Benchmark["category"], share: number) => ({
  benchmark: { id, name: id.toUpperCase(), sourceId: "t", url: "", description: "", unit: "percent", higherIsBetter: true, category } as Benchmark,
  share, required: false,
});
const row = (id: string, rank: number, values: Record<string, number>): RankedVariant => ({
  variant: { id: `${id}@high`, modelId: id, effort: "high" } as Variant,
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
});
