import { describe, expect, it, vi } from "vitest";
import type { Snapshot } from "../data/types";
import { GOLDEN_DATE, goldenConfigs, goldenJson } from "./golden-cases";
import { computeIndex, defaultConfig, EPOCH_ECI, PAGE_VIEW, rankScores, type IndexConfig, type RankedVariant, type ScoringMethod } from "./index";
import { columnsOf } from "../data/columns";

/** Scoring methods (`IndexConfig.scoring`) on one finished day of real data, the day the golden outputs use. */
const { readSnapshot } = await import("../data/load");
const snap = (await readSnapshot(GOLDEN_DATE))!;
const config: IndexConfig = { ...defaultConfig(snap), variants: "all" };
const METHODS: ScoringMethod[] = ["irt", "eci"];
const average = computeIndex(snap, config);
const by = Object.fromEntries(METHODS.map((m) => [m, computeIndex(snap, { ...config, scoring: m })])) as Record<ScoringMethod, typeof average>;
const rankOf = (xs: number[]) => { const order = xs.map((x, i) => [x, i] as const).sort((a, b) => b[0] - a[0]); const r = new Array<number>(xs.length); order.forEach(([, i], k) => (r[i] = k)); return r; };
const spearman = (a: number[], b: number[]) => { const ra = rankOf(a), rb = rankOf(b), n = a.length; let d = 0; for (let i = 0; i < n; i++) d += (ra[i] - rb[i]) ** 2; return 1 - 6 * d / (n * (n * n - 1)); };
const ids = (rows: RankedVariant[]) => rows.map((r) => r.variant.id).sort();
const width = (r: RankedVariant) => r.method!.range[1] - r.method!.range[0];

describe("the default method", () => {
  it("is what it was: no method on any row, and the same output with the field absent, undefined or on a config that never had it", () => {
    expect(average.ranked.every((r) => !("method" in r))).toBe(true);
    const bare = { ...config };
    delete bare.scoring;
    expect(goldenJson(computeIndex(snap, { ...config, scoring: undefined }))).toBe(goldenJson(computeIndex(snap, bare)));
    // Every golden config, page view included: an explicit `scoring: undefined` changes nothing but the echoed config.
    for (const { config: c, view } of goldenConfigs(snap, defaultConfig(snap), PAGE_VIEW).slice(0, 12)) {
      const a = computeIndex(snap, c, view ?? {}), b = computeIndex(snap, { ...c, scoring: undefined }, view ?? {});
      expect(goldenJson({ ...b, config: 0 })).toBe(goldenJson({ ...a, config: 0 }));
    }
  });
  it("runs no fit", async () => {
    vi.resetModules();
    vi.doMock("./scoring", async (original) => ({ ...(await original<typeof import("./scoring")>()), methodScorer: () => { throw new Error("a fit ran"); } }));
    const engine = await import("./index");
    expect(engine.computeIndex(snap, config).ranked.length).toBe(average.ranked.length);
    expect(engine.rankScores(columnsOf(snap), config).length).toBeGreaterThan(0);
    expect(() => engine.computeIndex(snap, { ...config, scoring: "irt" })).toThrow("a fit ran");
    vi.doUnmock("./scoring");
    vi.resetModules();
  });
});

describe.each(METHODS)("scoring: %s", (method) => {
  const result = by[method];
  it("ranks the same variants as the average, each with a finite score inside its interval", () => {
    expect(ids(result.ranked)).toEqual(ids(average.ranked));
    expect(ids(result.excluded.map((x) => ({ variant: x.variant }) as RankedVariant))).toEqual(ids(average.excluded.map((x) => ({ variant: x.variant }) as RankedVariant)));
    const averages = new Map(average.ranked.map((r) => [r.variant.id, r.score]));
    for (const r of result.ranked) {
      expect(Number.isFinite(r.score)).toBe(true);
      expect(r.method!.method).toBe(method);
      expect(r.method!.range[0]).toBeLessThanOrEqual(r.score);
      expect(r.method!.range[1]).toBeGreaterThanOrEqual(r.score);
      expect(r.method!.average).toBe(averages.get(r.variant.id));
      expect(r.method!.used).toBeGreaterThan(0);
      // Peer estimates never count toward the fit.
      expect(r.method!.used).toBeLessThanOrEqual(r.values.filter((v) => v.estimateKind !== "peer").length);
    }
    expect(result.ranked.map((r) => r.rank)).toEqual(result.ranked.map((_, i) => i + 1));
    for (let i = 1; i < result.ranked.length; i++) expect(result.ranked[i - 1].score).toBeGreaterThanOrEqual(result.ranked[i].score);
  });
  it("hands over the curves its scores came from, one per mix benchmark, and they reproduce every score", () => {
    const fit = result.fit!;
    expect(fit.method).toBe(method);
    expect(fit.curves.map((c) => c.benchmarkId).sort()).toEqual(result.benchmarks.map((b) => b.benchmark.id).sort());
    expect(fit.curves.reduce((t, c) => t + c.share, 0)).toBeCloseTo(1, 9);
    expect(fit.curves.every((c) => c.slope > 0 && Number.isFinite(c.difficulty) && c.floor >= 0 && c.floor < 1)).toBe(true);
    const expected = (x: number) => fit.curves.reduce((t, c) => t + c.share * 100 * (c.floor + (1 - c.floor) / (1 + Math.exp(-c.slope * (x - c.difficulty)))), 0);
    // IRT ability is the mix's expected average at the fitted ability; an ECI-style score is a straight line of the capability.
    for (const r of result.ranked) expect(r.score).toBeCloseTo(method === "irt" ? expected(r.method!.theta) : fit.shift + fit.scale * r.method!.theta, 6);
    expect(average.fit).toBeUndefined();
  });
  it("keeps the average's broad order without copying it", () => {
    const averages = new Map(average.ranked.map((r) => [r.variant.id, r.score]));
    expect(spearman(result.ranked.map((r) => r.score), result.ranked.map((r) => averages.get(r.variant.id)!))).toBeGreaterThan(0.95);
    expect(result.ranked.some((r, i) => r.variant.id !== average.ranked[i].variant.id)).toBe(true);
  });
  it("is deterministic: the same numbers on a second run and through the scores-only path", () => {
    const again = computeIndex(snap, { ...config, scoring: method });
    expect(again.ranked.map((r) => [r.variant.id, r.score, r.method!.range])).toEqual(result.ranked.map((r) => [r.variant.id, r.score, r.method!.range]));
    const scores = new Map(rankScores(columnsOf(snap), { ...config, scoring: method }).map((r) => [r.variant.id, r.score]));
    for (const r of result.ranked) expect(scores.get(r.variant.id)).toBe(r.score);
  });
  it("moves with the weights", () => {
    const first = Object.keys(config.weights)[0];
    const tilted = computeIndex(snap, { ...config, scoring: method, weights: Object.fromEntries(Object.keys(config.weights).map((id) => [id, id === first ? 100 : 1])) });
    const was = new Map(result.ranked.map((r) => [r.variant.id, r.rank]));
    expect(tilted.ranked.filter((r) => was.get(r.variant.id) !== r.rank).length).toBeGreaterThan(5);
  });
  it("is less sure of a model with fewer measured scores", () => {
    // A model measured on every benchmark of the mix, then with all but two of its scores taken away.
    const full = result.ranked.find((r) => r.values.length === result.benchmarks.length && r.values.every((v) => !v.estimated) && r.rank > 5 && r.rank < 60)!;
    expect(full).toBeDefined();
    const keep = new Set(full.values.slice(0, 2).map((v) => v.benchmarkId)), mix = new Set(result.benchmarks.map((b) => b.benchmark.id));
    const siblings = new Set(snap.variants.filter((v) => v.modelId === full.model.id).map((v) => v.id));
    const thin: Snapshot = { ...snap, observations: snap.observations.filter((o) => !(siblings.has(o.variantId) && mix.has(o.benchmarkId) && !(o.variantId === full.variant.id && keep.has(o.benchmarkId)))) };
    const row = computeIndex(thin, { ...config, scoring: method, strictness: 0 }).ranked.find((r) => r.variant.id === full.variant.id)!;
    expect(row).toBeDefined();
    expect(row.method!.used).toBe(2);
    expect(width(row)).toBeGreaterThan(width(computeIndex(snap, { ...config, scoring: method, strictness: 0 }).ranked.find((r) => r.variant.id === full.variant.id)!) * 1.2);
  });
  it("applies the coverage floor and Required gates as the average does", () => {
    for (const patch of [{ strictness: 90 }, { strictness: 0 }, { required: [Object.keys(config.weights)[1]] }, { estimateMissing: false }] as Partial<IndexConfig>[]) {
      expect(ids(computeIndex(snap, { ...config, ...patch, scoring: method }).ranked)).toEqual(ids(computeIndex(snap, { ...config, ...patch }).ranked));
    }
  });
  it("handles a one-benchmark mix, an empty mix and a pool of one", () => {
    const one = Object.keys(config.weights)[0];
    const single = computeIndex(snap, { ...config, scoring: method, weights: { [one]: 1 } });
    expect(single.ranked.length).toBeGreaterThan(5);
    expect(single.ranked.every((r) => Number.isFinite(r.score) && Number.isFinite(r.method!.range[0]) && Number.isFinite(r.method!.range[1]))).toBe(true);
    // One benchmark, one score per model: ECI-style can only keep that benchmark's order. IRT starts from each model's
    // ability across every benchmark it has, so with this little in the mix it follows the benchmark less closely.
    const plain = new Map(computeIndex(snap, { ...config, weights: { [one]: 1 } }).ranked.map((r) => [r.variant.id, r.score]));
    expect(spearman(single.ranked.map((r) => r.score), single.ranked.map((r) => plain.get(r.variant.id)!))).toBeGreaterThan(method === "eci" ? 0.999 : 0.95);
    expect(computeIndex(snap, { ...config, scoring: method, weights: {} }).ranked).toEqual([]);
    const lone = computeIndex(snap, { ...config, scoring: method, onlyModels: [average.ranked[0].model.id] });
    expect(lone.ranked.length).toBeGreaterThan(0);
    expect(lone.ranked.every((r) => Number.isFinite(r.score))).toBe(true);
  });
});

describe("IRT ability", () => {
  it("stays on the average's 0 to 100 scale", () => {
    for (const r of by.irt.ranked) { expect(r.score).toBeGreaterThanOrEqual(0); expect(r.score).toBeLessThanOrEqual(100); expect(r.method!.range[0]).toBeGreaterThanOrEqual(0); expect(r.method!.range[1]).toBeLessThanOrEqual(100); }
    const diffs = by.irt.ranked.map((r) => Math.abs(r.score - r.method!.average)).sort((a, b) => a - b);
    expect(diffs[diffs.length >> 1]).toBeLessThan(3);
  });
  it("does not refit when only the weights change", async () => {
    const irt = await import("./irt");
    const spy = vi.spyOn(irt, "fitIrt");
    computeIndex(snap, { ...config, scoring: "irt", weights: Object.fromEntries(Object.entries(config.weights).map(([id, w], i) => [id, w + i])) });
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });
});

describe("ECI-style score against Epoch's own index", () => {
  const epoch = new Map(snap.observations.filter((o) => o.benchmarkId === EPOCH_ECI).map((o) => [o.variantId, o.value]));
  const both = by.eci.ranked.filter((r) => epoch.has(r.variant.id));
  it("orders the models both score much as Epoch does", () => {
    expect(both.length).toBeGreaterThan(15);
    expect(spearman(both.map((r) => r.score), both.map((r) => epoch.get(r.variant.id)!))).toBeGreaterThan(0.9);
  });
  it("sits on Epoch's scale: about the same mean and spread over those models, and a small typical difference", () => {
    // The scale is set over every fitted variant Epoch scores with four mix scores, ranked or not, so these agree closely, not exactly.
    const mean = (v: number[]) => v.reduce((a, x) => a + x, 0) / v.length, sd = (v: number[]) => Math.sqrt(mean(v.map((x) => (x - mean(v)) ** 2)));
    const ours = both.map((r) => r.score), theirs = both.map((r) => epoch.get(r.variant.id)!);
    expect(Math.abs(mean(ours) - mean(theirs))).toBeLessThan(1.5);
    expect(sd(ours) / sd(theirs)).toBeGreaterThan(0.6);
    expect(sd(ours) / sd(theirs)).toBeLessThan(1.6);
    expect(mean(ours.map((x, i) => Math.abs(x - theirs[i])))).toBeLessThan(4);
  });
  it("is a different number from Epoch's, and does not need Epoch's index to rank", () => {
    expect(both.some((r) => Math.abs(r.score - epoch.get(r.variant.id)!) > 0.5)).toBe(true);
    const without: Snapshot = { ...snap, observations: snap.observations.filter((o) => o.benchmarkId !== EPOCH_ECI) };
    const unlinked = computeIndex(without, { ...config, scoring: "eci" });
    // Same order (the scale is a linear map), on the fallback scale centred at 150.
    expect(unlinked.ranked.map((r) => r.variant.id)).toEqual(by.eci.ranked.map((r) => r.variant.id));
    const sorted = unlinked.ranked.map((r) => r.score).sort((a, b) => a - b);
    expect(sorted[(sorted.length - 1) >> 1]).toBeGreaterThan(145);
    expect(sorted[sorted.length >> 1]).toBeLessThan(155);
  });
});
