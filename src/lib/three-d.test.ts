import { describe, expect, it } from "vitest";
import type { RankedVariant } from "@/engine";
import type { FormulaInputs } from "./metrics";
import { frontierSurface, placePoints, valueAt, axisIsLog } from "./three-d";

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

describe("frontierSurface", () => {
  const p = (pos: [number, number, number], frontier = true) => ({ pos, frontier });
  // Area of the surface's walls facing along each axis.
  const area = (faces: ReturnType<typeof frontierSurface>["faces"], axis: number) => faces.filter((f) => f.axis === axis).reduce((s, f) => {
    const [a, b] = [0, 1, 2].filter((x) => x !== axis);
    return s + Math.abs(f.corners[2][a] - f.corners[0][a]) * Math.abs(f.corners[2][b] - f.corners[0][b]);
  }, 0);

  it("is the outer wall of everything the frontier models beat", () => {
    const { faces } = frontierSurface([p([1, 0.5, 0.5]), p([0.5, 1, 0.5]), p([0.5, 0.5, 1])]);
    // Seen along each axis, the walls cover the union's shadow exactly once: two 1 x 0.5 strips overlapping in a 0.5 x 0.5 square, 0.75.
    for (const axis of [0, 1, 2]) expect(area(faces, axis)).toBeCloseTo(0.75, 9);
    // Every wall sits at a frontier model's coordinate on its axis.
    for (const f of faces) expect([0.5, 1]).toContain(f.corners[0][f.axis]);
  });
  it("ignores models under the frontier and needs two frontier models", () => {
    const one = frontierSurface([p([0.9, 0.9, 0.9]), p([0.2, 0.2, 0.2], false)]);
    expect(one.faces).toEqual([]);
    const two = frontierSurface([p([1, 0.2, 0.6]), p([0.3, 1, 0.4]), p([0.1, 0.1, 0.1], false)]);
    expect(two.faces.every((f) => f.corners.every((c) => c.every((x) => x >= 0 && x <= 1)))).toBe(true);
    expect(two.faces.length).toBeGreaterThan(0);
  });
  it("outlines the steps, not the grid inside a flat wall", () => {
    // A single box split by another model's coordinates: its top stays one rectangle in the outline.
    const { faces, edges } = frontierSurface([p([1, 1, 0.5]), p([0.4, 0.3, 1])]);
    const top = faces.filter((f) => f.axis === 2 && f.corners[0][2] === 0.5);
    expect(top.length).toBeGreaterThan(1);
    const inside = edges.filter(([a, b]) => a[2] === 0.5 && b[2] === 0.5 && ((a[0] === 0.4 && b[0] === 0.4) || (a[1] === 0.3 && b[1] === 0.3)) && Math.max(a[0], b[0]) > 0.4 && Math.max(a[1], b[1]) > 0.3);
    expect(inside).toEqual([]);
  });
});
