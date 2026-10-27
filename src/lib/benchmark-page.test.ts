import { describe, expect, it } from "vitest";
import { computeIndex } from "@/engine";
import { loadSnapshot } from "@/data/load";
import { benchmarkIndex, benchmarkSnapshot, benchmarkView, hasOwnCost } from "./benchmark-page";

describe("benchmark pages", async () => {
  const snap = (await loadSnapshot())!;
  const id = "frontiercode-1.1-main";

  it("ranks the same from the trimmed snapshot as from the full one", () => {
    const small = benchmarkSnapshot(snap, id);
    expect(small.observations.length).toBeLessThan(snap.observations.length / 5);
    const a = computeIndex(snap, benchmarkIndex(snap, id), benchmarkView(snap, id)), b = computeIndex(small, benchmarkIndex(small, id), benchmarkView(small, id));
    expect(b.ranked.length).toBeGreaterThan(10);
    expect(b.ranked.map((r) => [r.variant.id, r.score, r.costUsd])).toEqual(a.ranked.map((r) => [r.variant.id, r.score, r.costUsd]));
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
});
