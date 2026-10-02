import { describe, expect, it } from "vitest";
import { churn, distance, movePairs, pairGap, toShares, toWeights } from "./solver";

describe("mix solver primitives", () => {
  it("measures weight moved as half the L1 distance of shares", () => {
    expect(distance({ a: 0.5, b: 0.5 }, { a: 0.5, b: 0.5 })).toBe(0);
    expect(distance({ a: 1 }, { b: 1 })).toBe(1);
    expect(distance(toShares({ a: 20, b: 20, c: 60 }), toShares({ a: 20, b: 20 }))).toBeCloseTo(0.6);
  });
  it("round-trips shares to URL weights at 0.1% precision", () => {
    expect(toWeights({ a: 0.12345, b: 0.87655 })).toEqual({ a: 12.3, b: 87.7 });
  });
  it("turns rank moves into pairwise requirements against the original order", () => {
    const before = ["a", "b", "c", "d", "e"];
    expect(movePairs({ moves: [{ model: "c", minRank: 5 }] }, before).map((p) => `${p.dir}:${p.other}`)).toEqual(["below:a", "below:b", "below:d", "below:e"]);
    expect(movePairs({ moves: [{ model: "e", maxRank: 2 }] }, before).map((p) => `${p.dir}:${p.other}`)).toEqual(["above:b", "above:c", "above:d"]);
    // A newly ranked model appearing above can't satisfy the drop: only named models count.
    const pairs = movePairs({ moves: [{ model: "a", below: "b" }] }, before);
    expect(pairGap(pairs, new Map([["new", 99], ["a", 80], ["b", 70]]))).toBeGreaterThan(0);
    expect(pairGap(pairs, new Map([["a", 60], ["b", 70]]))).toBe(0);
  });
  it("weights churn toward the top and ignores requested movers", () => {
    expect(churn(["a", "b", "c"], ["a", "b", "c"], new Set())).toBe(0);
    expect(churn(["a", "b", "c", "d"], ["b", "a", "c", "d"], new Set())).toBeGreaterThan(churn(["a", "b", "c", "d"], ["a", "b", "d", "c"], new Set()));
    expect(churn(["a", "b", "c"], ["b", "c", "a"], new Set(["a"]))).toBe(0);
  });
});
