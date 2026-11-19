import { describe, expect, it } from "vitest";
import { eciExpected, fitEci } from "./eci";
import { corr, synthetic } from "./synthetic-scores";

const rmse = (fit: ReturnType<typeof fitEci>, rows: [number, number, number][]) => Math.sqrt(rows.reduce((s, [i, j, y]) => s + (eciExpected(fit, j, fit.capability[i]) - y) ** 2, 0) / rows.length);

describe("fitEci", () => {
  it("recovers capabilities, difficulties and slopes from a known model, up to the linear rescaling ECI allows", () => {
    const { cells, theta, a, b, hidden } = synthetic();
    const fit = fitEci(cells);
    expect(corr(fit.capability, theta)).toBeGreaterThan(0.97);
    expect(corr(fit.difficulty, b)).toBeGreaterThan(0.97);
    // Stretching capabilities by k divides slopes by k, so slopes are compared as ratios to their mean.
    const mean = (v: ArrayLike<number>) => Array.from(v).reduce((x, y) => x + y) / v.length;
    expect(corr(Array.from(fit.slope, (x) => x / mean(fit.slope)), a.map((x) => x / mean(a)))).toBeGreaterThan(0.8);
    expect(rmse(fit, hidden)).toBeLessThan(0.06);
    expect(fit.sweeps).toBeLessThan(200);
  });
  it("is deterministic", () => {
    const { cells } = synthetic(60, 8, 3);
    const x = fitEci(cells), y = fitEci(cells);
    expect(Array.from(x.capability)).toEqual(Array.from(y.capability));
    expect(Array.from(x.slope)).toEqual(Array.from(y.slope));
    expect(x.loss).toBe(y.loss);
  });
  it("does not get worse with more sweeps, and stops on its own", () => {
    const { cells } = synthetic(90, 9, 21);
    const short = fitEci(cells, { sweeps: 3 }), full = fitEci(cells);
    expect(full.loss).toBeLessThanOrEqual(short.loss);
    expect(fitEci(cells, { sweeps: 2000 }).sweeps).toBe(full.sweeps);
  });
  it("gives a model with no scores no capability to be sure of, and a model with fewer scores a wider error", () => {
    const { cells } = synthetic(80, 10, 5);
    const none = fitEci({ ...cells, n: cells.n + 1 });
    expect(none.capability[cells.n]).toBe(0);
    expect(none.se[cells.n]).toBe(Infinity);
    let kept = 0;
    const keep = Array.from(cells.I, (i) => i !== 0 || kept++ < 2);
    const thin = { ...cells, I: cells.I.filter((_, q) => keep[q]), J: cells.J.filter((_, q) => keep[q]), Y: cells.Y.filter((_, q) => keep[q]) };
    expect(fitEci(thin).se[0]).toBeGreaterThan(fitEci(cells).se[0]);
  });
  it("lets a heavier benchmark pull harder on capability", () => {
    // Two benchmarks that disagree about models 0 and 1: weight decides who is ahead.
    const I: number[] = [], J: number[] = [], Y: number[] = [];
    const n = 30;
    for (let i = 0; i < n; i++) for (let j = 0; j < 2; j++) { I.push(i); J.push(j); Y.push(0.1 + 0.8 * i / (n - 1)); }
    const at = (i: number, j: number) => i * 2 + j;
    Y[at(10, 0)] = 0.8; Y[at(10, 1)] = 0.3; Y[at(11, 0)] = 0.3; Y[at(11, 1)] = 0.8;
    const cells = { n, k: 2, I: Int32Array.from(I), J: Int32Array.from(J), Y: Float64Array.from(Y) };
    const first = fitEci({ ...cells, w: Float64Array.of(1.8, 0.2) }), second = fitEci({ ...cells, w: Float64Array.of(0.2, 1.8) });
    expect(first.capability[10]).toBeGreaterThan(first.capability[11]);
    expect(second.capability[11]).toBeGreaterThan(second.capability[10]);
  });
  it("keeps slopes in Epoch's bounds and survives scores of exactly 0 and 1", () => {
    const { cells } = synthetic(50, 6, 9);
    const fit = fitEci({ ...cells, Y: cells.Y.map((y, q) => (q % 7 === 0 ? 0 : q % 11 === 0 ? 1 : y)) });
    for (const s of fit.slope) { expect(s).toBeGreaterThanOrEqual(0.1); expect(s).toBeLessThanOrEqual(10); }
    for (const c of fit.capability) expect(Number.isFinite(c)).toBe(true);
  });
});
