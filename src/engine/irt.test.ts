import { describe, expect, it } from "vitest";
import { fitIrt, irtExpected } from "./irt";
import { corr, synthetic } from "./synthetic-scores";

describe("fitIrt", () => {
  it("recovers abilities and predicts hidden scores from a known model", () => {
    const { cells, theta, hidden } = synthetic();
    const fit = fitIrt(cells);
    expect(corr(fit.theta, theta)).toBeGreaterThan(0.95);
    const err = hidden.map(([i, j, y]) => irtExpected(fit, j, fit.theta[i]) - y);
    expect(Math.sqrt(err.reduce((s, e) => s + e * e, 0) / err.length)).toBeLessThan(0.06);
    expect(fit.sweeps).toBeLessThan(200);
  });
  it("is deterministic and gives a model with no cells the prior ability", () => {
    const { cells } = synthetic(40, 6, 3);
    const extra = { ...cells, n: cells.n + 1 };
    const a = fitIrt(extra), b = fitIrt(extra);
    expect(Array.from(a.theta)).toEqual(Array.from(b.theta));
    expect(Array.from(a.a)).toEqual(Array.from(b.a));
    expect(a.theta[cells.n]).toBe(0);
  });
  it("keeps predictions above a benchmark's chance floor", () => {
    const { cells } = synthetic(60, 5, 11);
    const floor = new Float64Array(5).fill(0.25);
    const fit = fitIrt({ ...cells, Y: cells.Y.map((y) => 0.25 + 0.75 * y), floor });
    expect(irtExpected(fit, 0, -10)).toBeGreaterThanOrEqual(0.25);
  });
  it("is less sure of a model with fewer scores", () => {
    const { cells } = synthetic(80, 10, 5);
    // Model 0 keeps two of its cells.
    let kept = 0;
    const keep = Array.from(cells.I, (i) => i !== 0 || kept++ < 2);
    const thin = { ...cells, I: cells.I.filter((_, q) => keep[q]), J: cells.J.filter((_, q) => keep[q]), Y: cells.Y.filter((_, q) => keep[q]) };
    expect(fitIrt(thin).se[0]).toBeGreaterThan(fitIrt(cells).se[0]);
  });
});
