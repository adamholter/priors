import { describe, expect, it } from "vitest";
import { maxMarginMix, simplex, sparseMixes } from "./lp";

describe("simplex", () => {
  it("solves a small LP", () => {
    const r = simplex([[1, 1], [1, 3]], [4, 6], [3, 2]);
    expect(r?.value).toBeCloseTo(12);
    expect(r?.x[0]).toBeCloseTo(4);
  });
});

describe("maxMarginMix", () => {
  const columns = [
    { id: "a", score: [90, 60, 30], present: [true, true, true] },
    { id: "b", score: [10, 50, 80], present: [true, true, true] },
    { id: "c", score: [40, 90, 20], present: [true, true, true] },
  ];
  it("finds weights that order the lineup with a positive margin", () => {
    const r = maxMarginMix(columns, 3, 0)!;
    expect(r.margin).toBeGreaterThan(0);
    expect(r.weights.a).toBeGreaterThan(0);
  });
  it("reports a non-positive margin when no mix can order the lineup", () => {
    const r = maxMarginMix([{ id: "x", score: [10, 20, 30], present: [true, true, true] }], 3, 0)!;
    expect(r.margin).toBeLessThanOrEqual(0);
  });
  it("builds progressively sparser ordered mixes", () => {
    const ladder = sparseMixes(columns, 3, 0);
    expect(ladder.length).toBeGreaterThan(0);
    expect(ladder.every((x) => x.margin > 0)).toBe(true);
  });
});
