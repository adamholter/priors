import { describe, expect, it } from "vitest";
import type { RankedVariant } from "@/engine";
import type { FormulaInputs } from "./metrics";
import { placePoints, valueAt, axisIsLog } from "./three-d";

const row = (model: string, effort: string, score: number): RankedVariant => ({ variant: { id: `${model}@${effort}`, modelId: model, effort } as never, model: { id: model, name: model } as never, score, coverage: 1, measuredShare: 1, values: [], onFrontier: false, rank: 0 });
const rows = [row("a", "low", 50), row("a", "high", 60), row("b", "high", 55), row("c", "high", 40), row("d", "high", 70)];
const data: Record<string, { score: number; cost?: number; time?: number }> = {
  "a@low": { score: 50, cost: 0.1, time: 10 }, "a@high": { score: 60, cost: 1, time: 100 }, "b@high": { score: 55, cost: 0.5, time: 20 },
  "c@high": { score: 40, cost: 0.2, time: 50 }, "d@high": { score: 70, cost: 2 },
};
const inputs: FormulaInputs = { get: () => ({ variables: [], of: (r) => data[r.variant.id] as never }) };

describe("placePoints", () => {
  it("keeps one point per model, skipping rows missing an axis", () => {
    const { points } = placePoints(rows, inputs, ["time", "score", "cost"]);
    expect(points.map((p) => p.modelId).sort()).toEqual(["a", "b", "c"]);
    expect(points.find((p) => p.modelId === "a")!.r.variant.effort).toBe("high");
  });
  it("can keep every effort", () => {
    expect(placePoints(rows, inputs, ["time", "score", "cost"], true).points).toHaveLength(4);
  });
  it("puts the better end of every axis at 1, whichever way it runs", () => {
    const { points } = placePoints(rows, inputs, ["time", "score", "cost"], true);
    const fast = points.find((p) => p.id === "a@low")!, slow = points.find((p) => p.id === "a@high")!;
    expect(fast.pos[0]).toBeGreaterThan(slow.pos[0]);
    expect(slow.pos[1]).toBeGreaterThan(fast.pos[1]);
    expect(fast.pos[2]).toBeGreaterThan(slow.pos[2]);
  });
  it("marks the points nothing beats on all three axes", () => {
    const { points } = placePoints(rows, inputs, ["time", "score", "cost"], true);
    expect(Object.fromEntries(points.map((p) => [p.id, p.frontier]))).toEqual({ "a@low": true, "a@high": true, "b@high": true, "c@high": false });
  });
  it("reads tick values back from the unit cube", () => {
    const { axes } = placePoints(rows, inputs, ["time", "score", "cost"], true);
    expect(axisIsLog(axes[0])).toBe(true);
    expect(valueAt(axes[0], 1, true)).toBeCloseTo(10);
    expect(valueAt(axes[0], 0, true)).toBeCloseTo(100);
    expect(valueAt(axes[1], 1, false)).toBeCloseTo(60);
  });

  it("marks the zone that beats the median on every axis", () => {
    const { points, zone } = placePoints(rows, inputs, ["time", "score", "cost"], true);
    expect(zone.every((m) => m >= 0 && m <= 1)).toBe(true);
    for (const p of points) expect(p.inZone).toBe(p.pos.every((u, i) => u >= zone[i]));
  });
});
