import { describe, expect, it } from "vitest";
import { computeIndex } from "@/engine";
import { loadSnapshot } from "@/data/load";
import { subscriptionPrices } from "@/data/subscription";
import { benchmarkIndex, benchmarkSnapshot, benchmarkView, directoryItems, hasOwnCost } from "./benchmark-page";

describe("benchmark pages", async () => {
  const snap = (await loadSnapshot())!;
  const id = "frontiercode-1.1-main";

  it("names the directory's top model from published scores, lowest first where lower is better, never an estimate", () => {
    const [a, b] = snap.models, variant = (m: typeof a) => `${m.id}@default`;
    const benchmark = snap.benchmarks[0], row = { benchmarkId: "t", value: 0 } as (typeof snap.observations)[number];
    const fake = (higherIsBetter: boolean) => ({ ...snap, benchmarks: [{ ...benchmark, id: "t", proxy: undefined, higherIsBetter }], observations: [
      { ...row, variantId: variant(a), value: 10 }, { ...row, variantId: variant(b), value: 20 }, { ...row, variantId: variant(a), value: 99, details: { priorsEstimate: true } },
    ] });
    expect(directoryItems(fake(true), new Map(), [])[0].leader?.name).toBe(b.name);
    expect(directoryItems(fake(false), new Map(), [])[0].leader?.name).toBe(a.name);
  });

  it("ranks the same from the trimmed snapshot as from the full one", () => {
    const small = benchmarkSnapshot(snap, id);
    expect(small.observations.length).toBeLessThan(snap.observations.length / 5);
    const a = computeIndex(snap, benchmarkIndex(snap, id), benchmarkView(snap, id)), b = computeIndex(small, benchmarkIndex(small, id), benchmarkView(small, id));
    expect(b.ranked.length).toBeGreaterThan(10);
    expect(b.ranked.map((r) => [r.variant.id, r.score, r.costUsd])).toEqual(a.ranked.map((r) => [r.variant.id, r.score, r.costUsd]));
  });

  it("prices every model at the same plan share as the builder, on every benchmark's page", () => {
    const openAiPlans = { openai: "ChatGPT Plus" };
    for (const chosen of [{}, openAiPlans]) {
      const full = subscriptionPrices(snap, chosen);
      for (const b of snap.benchmarks) {
        if (b.proxy) continue;
        const small = benchmarkSnapshot(snap, b.id), page = subscriptionPrices(small, chosen);
        const shown = new Set(computeIndex(small, benchmarkIndex(small, b.id), benchmarkView(small, b.id)).ranked.map((r) => r.model.id));
        for (const id of shown) expect([b.id, id, page.get(id)?.plan, page.get(id)?.ratio]).toEqual([b.id, id, full.get(id)?.plan, full.get(id)?.ratio]);
      }
    }
  }, 120_000);

  it("keeps a model priced from Codex limits subsidized on the benchmark page, and leaves out the usage series", () => {
    const estimated = [...subscriptionPrices(snap)].filter(([, p]) => /Codex Plus message limits/.test(p.confidence ?? "")).map(([model]) => model);
    const usageSize = (s: typeof snap) => JSON.stringify(s.observations.filter((o) => o.benchmarkId === "t3-usage-share")).length;
    for (const model of estimated) {
      const b = snap.observations.find((o) => o.costUsd != null && o.benchmarkId !== "aa-cost" && o.variantId.startsWith(`${model}@`))?.benchmarkId;
      if (!b) continue;
      const small = benchmarkSnapshot(snap, b), ranked = computeIndex(small, benchmarkIndex(small, b), benchmarkView(small, b)).ranked.filter((r) => r.model.id === model);
      for (const r of ranked) if (r.costUsd != null) expect(r.costPlan?.ratio).toBeGreaterThan(0);
    }
    expect(usageSize(benchmarkSnapshot(snap, id))).toBeLessThan(usageSize(snap));
  });

  it("takes cost from the benchmark and adjusts it by subscription plan", () => {
    const cfg = benchmarkIndex(snap, id);
    expect(hasOwnCost(snap, id)).toBe(true);
    const view = benchmarkView(snap, id);
    expect(view.costBenchmark).toBe(id);
    const api = computeIndex(snap, { ...cfg, costBasis: "api" }, view).ranked, sub = computeIndex(snap, cfg, view).ranked;
    const raw = new Map(snap.observations.filter((o) => o.benchmarkId === id).map((o) => [o.variantId, o.costUsd]));
    const priced = api.filter((r) => r.costUsd != null);
    expect(priced.length).toBeGreaterThan(5);
    for (const r of priced) expect(r.costUsd).toBeCloseTo(raw.get(r.variant.id)!, 6);
    const adjusted = sub.filter((r) => r.costPlan);
    expect(adjusted.length).toBeGreaterThan(0);
    for (const r of adjusted) expect(r.costUsd).toBeCloseTo(raw.get(r.variant.id)! * r.costPlan!.ratio, 6);
  });

  it("shows only what the benchmark published: no older-version fallback, no estimates", () => {
    const fb = snap.benchmarks.find((b) => b.versionPolicy?.kind === "fallback");
    expect(fb).toBeDefined();
    const small = benchmarkSnapshot(snap, fb!.id);
    const r = computeIndex(small, benchmarkIndex(small, fb!.id), benchmarkView(small, fb!.id));
    const own = new Set(snap.observations.filter((o) => o.benchmarkId === fb!.id && !o.details?.priorsEstimate).map((o) => o.variantId));
    expect(r.ranked.length).toBeGreaterThan(0);
    for (const x of r.ranked) {
      expect(own.has(x.variant.id)).toBe(true);
      expect(x.values.every((v) => !v.estimated)).toBe(true);
    }
    expect(small.observations.every((o) => o.benchmarkId !== fb!.id || !o.details?.priorsEstimate)).toBe(true);
  });

  it("keeps the benchmark's series and full details, which the shared client snapshot drops", () => {
    const withSeries = { ...snap, series: [{ benchmarkId: id, variantId: snap.observations.find((o) => o.benchmarkId === id)!.variantId, x: [1, 2], y: [3, 4], xLabel: "Day", yLabel: "Balance", sourceUrl: "" }] };
    expect(benchmarkSnapshot(withSeries, id).series).toHaveLength(1);
    const detailed = snap.observations.find((o) => o.benchmarkId === "vals-mmlu-pro" && o.details);
    if (detailed) expect(benchmarkSnapshot(snap, "vals-mmlu-pro").observations.find((o) => o.variantId === detailed.variantId && o.benchmarkId === "vals-mmlu-pro")?.details).toEqual(detailed.details);
  });
});
