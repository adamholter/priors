import { describe, expect, it } from "vitest";
import { readRadarParams, radarParams, DEFAULT_RADAR, radarModelsFor } from "./radar-view";
import type { RankedVariant } from "@/engine";

const row = (model: string, effort: string, values: Record<string, number>, score = 50): RankedVariant => ({
  model: { id: model, name: model, labId: "lab" }, variant: { id: `${model}@${effort}`, modelId: model, effort }, score, rank: 1,
  values: Object.entries(values).map(([benchmarkId, value]) => ({ benchmarkId, value, estimated: false })),
} as unknown as RankedVariant);
const benches = ["a", "b", "c"].map((id) => ({ share: 100 / 3, required: false, benchmark: { id, name: id, description: "", unit: "score", category: "coding", higherIsBetter: true } })) as never;

describe("radar effort setting", () => {
  it("round-trips through chart links and stays out of the URL at its default", () => {
    expect(radarParams(DEFAULT_RADAR).re).toBeUndefined();
    expect(readRadarParams(new URLSearchParams(radarParams({ ...DEFAULT_RADAR, effort: "layers" }) as Record<string, string>)).effort).toBe("layers");
    expect(readRadarParams(new URLSearchParams("re=high")).effort).toBe("high");
    expect(readRadarParams(new URLSearchParams("re=bogus")).effort).toBeUndefined();
  });
  it("draws a model's other efforts as layers on the best effort's axes, the range reaching down to the lowest effort", () => {
    const best = [row("m", "max", { a: 80, b: 70, c: 60 }), row("n", "high", { a: 90, b: 60, c: 50 })];
    const layers = new Map([["m", [row("m", "high", { a: 70, b: 60, c: 50 }), row("m", "low", { a: 40, b: 30, c: 20 })]]]);
    const { models, axes } = radarModelsFor(best, benches, "field", "benchmarks", ["m", "n"], layers);
    const m = models.find((x) => x.id === "m")!;
    expect(m.effort).toBe("max");
    expect(m.layers!.map((l) => l.effort)).toEqual(["high", "low"]);
    expect(axes[0].min).toBeLessThanOrEqual(40);
    expect(m.layers![1].points.every((p) => (p.r ?? 0) > 0 && p.r! < m.points[0].r!)).toBe(true);
    expect(models.find((x) => x.id === "n")!.layers).toBeUndefined();
  });
});
