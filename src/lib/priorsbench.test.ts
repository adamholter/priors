import { describe, expect, it } from "vitest";
import { dedupe, history, rate, type Ranking } from "./priorsbench";

const DAY = 86_400_000, now = Date.parse("2026-11-22T00:00:00Z");
const many = (lineup: string[], n: number, start = now - 30 * DAY): Ranking[] => Array.from({ length: n }, (_, i) => ({ lineup, focus: "general", createdAt: start + i * 3_600_000 * 25 }));

describe("PriorsBench", () => {
  it("rates the model people put first highest, and leaves out models in too few rankings", () => {
    const r = rate([...many(["a", "b", "c"], 20), ...many(["b", "c", "d"], 3)], { asOf: now });
    expect(r.map((x) => x.modelId)).toEqual(["a", "b", "c"]);
    expect(r[0].rating).toBeGreaterThan(r[1].rating);
  });
  it("counts the same lineup saved twice within a day once", () => {
    const one = { lineup: ["a", "b"], focus: "general", createdAt: now - DAY };
    expect(dedupe([one, { ...one, createdAt: one.createdAt + 60_000 }, { ...one, createdAt: one.createdAt + 2 * DAY }])).toHaveLength(2);
  });
  it("lets recent rankings outweigh old ones", () => {
    const old = many(["a", "b"], 20, now - 200 * DAY), recent = many(["b", "a"], 20, now - 25 * DAY);
    expect(rate([...old, ...recent], { asOf: now })[0].modelId).toBe("b");
  });
  it("ignores unknown focuses and caps a day flooded with rankings", () => {
    const steady = Array.from({ length: 150 }, (_, i) => ({ lineup: ["a", "b", `s${i}`], focus: "general", createdAt: now - (2 + Math.floor(i / 5)) * DAY + i }));
    const flood = Array.from({ length: 2000 }, (_, i) => ({ lineup: ["b", "a", `x${i}`], focus: "general", createdAt: now - DAY + i }));
    const junk = Array.from({ length: 2000 }, (_, i) => ({ lineup: ["b", "a", `y${i}`], focus: "spam", createdAt: now - 2 * DAY + i }));
    expect(rate([...steady, ...flood, ...junk], { asOf: now })[0].modelId).toBe("a");
  });
  it("gives an interval around each rating and a weekly history", () => {
    const rankings = [...many(["a", "b", "c"], 15), ...many(["a", "c", "b"], 15)];
    const [top] = rate(rankings, { asOf: now, bootstrap: 30 });
    expect(top.ci![0]).toBeLessThanOrEqual(top.rating);
    expect(top.ci![1]).toBeGreaterThanOrEqual(top.rating);
    expect(history(rankings, { now }).at(-1)!.date).toBe("2026-11-22");
  });
});
