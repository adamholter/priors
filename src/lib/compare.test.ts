import { describe, expect, it } from "vitest";
import { biggestGaps, mixLead, mixOverlap, mixRows, pairUp, rankCorrelation, topOverlap, verdict, type Placed } from "./compare";

const list = (ids: string[]): Placed[] => ids.map((id, i) => ({ modelId: id, name: id.toUpperCase(), labId: "x", rank: i + 1, score: 90 - i, effort: "max" }));
const bench = (id: string, share: number) => ({ benchmark: { id, name: id, shortName: id.toUpperCase() } as never, share, required: false });

describe("pairUp", () => {
  it("pairs models by id, A's order first, then B's extras", () => {
    const { pairs } = pairUp(list(["a", "b", "c"]), list(["c", "a", "d"]));
    expect(pairs.map((p) => p.modelId)).toEqual(["a", "b", "c", "d"]);
    expect(pairs[0]).toMatchObject({ shift: 1 - 2 }); // a: #1 for A, #2 for B
    expect(pairs[1].shift).toBeUndefined(); // b: A only
    expect(pairs[2].shift).toBe(3 - 1);
  });
  it("sameModels keeps shared models and ranks them again", () => {
    const { a, b, pairs } = pairUp(list(["a", "x", "b", "c"]), list(["b", "y", "a", "c"]), true);
    expect(a.map((p) => [p.modelId, p.rank])).toEqual([["a", 1], ["b", 2], ["c", 3]]);
    expect(b.map((p) => [p.modelId, p.rank])).toEqual([["b", 1], ["a", 2], ["c", 3]]);
    expect(pairs.find((p) => p.modelId === "a")!.shift).toBe(-1);
  });
});

describe("agreement", () => {
  it("counts the shared top models", () => {
    expect(topOverlap(list(["a", "b", "c", "d"]), list(["d", "a", "x", "y"]), 3)).toEqual({ shared: ["a"], n: 3 });
    expect(topOverlap(list(["a"]), list(["a", "b"]), 5).n).toBe(1);
  });
  it("rank correlation is 1 for the same order, -1 reversed, and needs three shared models", () => {
    expect(rankCorrelation(list(["a", "b", "c", "d"]), list(["a", "b", "c", "d"])).rho).toBeCloseTo(1);
    expect(rankCorrelation(list(["a", "b", "c", "d"]), list(["d", "c", "b", "a"])).rho).toBeCloseTo(-1);
    expect(rankCorrelation(list(["a", "b"]), list(["b", "a"])).rho).toBeNull();
  });
  it("ignores models only one side ranks", () => {
    const r = rankCorrelation(list(["a", "x", "b", "c"]), list(["a", "b", "y", "c"]));
    expect(r.common).toBe(3); expect(r.rho).toBeCloseTo(1);
  });
  it("finds the biggest rank gaps among models both rank", () => {
    const { pairs } = pairUp(list(["a", "b", "c", "d", "e", "f"]), list(["f", "b", "c", "d", "e", "a"]));
    expect(biggestGaps(pairs, 2).map((p) => [p.modelId, p.shift])).toEqual([["a", -5], ["f", 5]]);
    expect(biggestGaps(pairs, 5, 6)).toEqual([]);
    const far = pairUp(list(["a", "b", "c", "d", "e", "f", "g", "h"]), list(["a", "b", "c", "h", "e", "f", "g", "d"]));
    expect(biggestGaps(far.pairs, 3, 3, 4).map((p) => p.modelId)).toEqual(["d", "h"]); // #8 vs #4 counts, a gap that never reaches the top 4 does not
    expect(biggestGaps(far.pairs, 3, 3, 3)).toEqual([]);
  });
  it("words the verdict from the top lists and the gaps", () => {
    const a = list(["a", "b", "c", "d", "e", "f"]), b = list(["f", "b", "c", "d", "e", "a"]);
    const v = verdict(a, b, pairUp(a, b).pairs, { a: "You", b: "Tommaso" }, 3);
    expect(v.headline).toBe("2 of the top 3 are the same on both lists.");
    expect(v.gaps[0]).toBe("A is #1 for You and #6 for Tommaso");
  });
});

describe("mixRows", () => {
  it("lists every benchmark either side uses, biggest difference first", () => {
    const rows = mixRows([bench("x", 50), bench("y", 30), bench("z", 20)], [bench("x", 10), bench("y", 30), bench("w", 60)]);
    expect(rows.map((r) => [r.id, r.a, r.b])).toEqual([["w", 0, 60], ["x", 50, 10], ["z", 20, 0], ["y", 30, 30]]);
    expect(mixOverlap(rows)).toBe(40);
  });

  it("says where each side puts its weight in one sentence", () => {
    const rows = mixRows([bench("x", 100)], [bench("x", 40), bench("y", 35), bench("z", 25)]);
    const text = mixLead(rows, { a: "Ana", b: "Bo" });
    expect(text).toContain("Ana uses only X.");
    expect(text).toContain("Bo leans on X and Y.");
    expect(text).toContain("40% of the weight is on the same benchmarks.");
  });
});
