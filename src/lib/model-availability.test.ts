import { describe, expect, it } from "vitest";
import { computeIndex, defaultConfig } from "@/engine";
import { clientSnapshot } from "@/data/client-snapshot";
import { loadSnapshot } from "@/data/load";
import { featuredMixes } from "./featured-mixes";
import { modelAvailability, planSubsidies, plansOf } from "./model-availability";
import { compareNeighbor, compareView, modelView } from "./model-view";
import type { PlanPriceModel } from "./plan-prices";
import { rankStability } from "./rank-stability";

const model = (over: Partial<PlanPriceModel>): PlanPriceModel => ({ id: "m", name: "M", lab: "l", aa: [], plan: "Pro", ratio: 0.1, confidence: "medium", ...over });

describe("plans of a model", () => {
  it("lists one row per plan, cheapest first, without peak-hour and student repeats", () => {
    const rows = plansOf(model({ plan: "Max (off-peak)", plans: { "Max (off-peak)": { ratio: 0.1, feeUsd: 100 }, "Max (peak)": { ratio: 0.2, feeUsd: 100 }, "Max (mixed)": { ratio: 0.15, feeUsd: 100 }, "Lite (Student)": { ratio: 0.01, feeUsd: 5 }, Lite: { ratio: 0.05, feeUsd: 10 } } }));
    expect(rows.map((p) => p.plan)).toEqual(["Lite", "Max (off-peak)"]);
  });
  it("marks a share taken from another model, and names the plan without that note", () => {
    expect(plansOf(model({ plan: "Pro (assumed same as X)", confidence: "assumed", feeUsd: 20 }))).toEqual([{ plan: "Pro", feeUsd: 20, ratio: 0.1, assumed: true }]);
  });
  it("puts a free tier first, then the paid plan behind it", () => {
    const rows = plansOf(model({ plan: "Zen free tier", ratio: 0, feeUsd: 0, free: true, paid: { plan: "Go", ratio: 0.2, feeUsd: 10, confidence: "medium" } }));
    expect(rows.map((p) => [p.plan, p.free ?? false])).toEqual([["Zen free tier", true], ["Go", false]]);
  });
});

describe("on today's snapshot", async () => {
  const snapshot = (await loadSnapshot())!, config = defaultConfig(snapshot);
  const ranked = computeIndex(snapshot, { ...config, variants: "all" }).ranked, ids = [...new Set(ranked.map((r) => r.model.id))];

  it("subsidies are positive, sorted by median and name real models", () => {
    const plans = planSubsidies(snapshot);
    expect(plans.length).toBeGreaterThan(5);
    expect(plans.map((p) => p.median)).toEqual([...plans.map((p) => p.median)].sort((a, b) => b - a));
    const known = new Set(snapshot.models.map((m) => m.id));
    for (const p of plans) for (const m of p.models) { expect(m.multiple).toBeGreaterThan(0); expect(known.has(m.id)).toBe(true); }
  });

  it("a model sold on a plan shows that plan", () => {
    const sold = planSubsidies(snapshot)[0].models[0];
    expect(modelAvailability(snapshot, sold.id)?.plans.length).toBeGreaterThan(0);
  });

  it("featured mixes are few and each ranks models; a category is 25 points of AA's index", () => {
    const mixes = featuredMixes(snapshot);
    expect(mixes.length).toBeGreaterThan(0); expect(mixes.length).toBeLessThanOrEqual(4);
    for (const mix of mixes) expect(computeIndex(snapshot, { ...mix, variants: "all" }).ranked.length).toBeGreaterThan(0);
    for (const mix of mixes.slice(1)) expect(Object.values(mix.weights).reduce((n, w) => n + w, 0)).toBe(25);
  });

  it("rank stability repeats exactly and each band holds the median", () => {
    const one = rankStability(snapshot, config, { runs: 12 }), two = rankStability(snapshot, config, { runs: 12 });
    expect(two).toEqual(one);
    for (const m of one.models) { expect(m.p10).toBeLessThanOrEqual(m.median); expect(m.median).toBeLessThanOrEqual(m.p90); }
  });

  it("compares two models from the same numbers as their model pages", () => {
    const [a, b] = ids, view = compareView(snapshot, a, b, config, config), page = modelView(snapshot, a, config, config);
    expect(view.a.score).toBe(page.mine[0].score);
    expect(view.a.rank).toBe(1); expect(view.b.rank).toBe(2);
    expect(view.benches.length).toBeGreaterThan(0);
    for (const x of view.benches) { expect(x.aRank).toBeLessThanOrEqual(x.of); expect(x.aPlace).toBeGreaterThanOrEqual(0); expect(x.bPlace).toBeLessThanOrEqual(1); }
    const gaps = view.benches.map((x) => Math.abs(x.aPlace - x.bPlace));
    expect(gaps).toEqual([...gaps].sort((p, q) => q - p));
  });

  it("provider lists stay out of the browser's dataset", () => {
    const withLists = { ...snapshot, observations: snapshot.observations.map((o) => o.benchmarkId === "openrouter-providers" ? { ...o, details: { endpoints: [{ provider: "X", input: 1, output: 2 }] } } : o.benchmarkId === "aa-output-speed" ? { ...o, details: { providers: [{ provider: "X" }] } } : o) };
    for (const o of clientSnapshot(withLists).observations) { expect(o.details?.endpoints).toBeUndefined(); expect(o.details?.providers).toBeUndefined(); }
  });

  it("opens a comparison on the neighbor in the ranking", () => {
    expect(compareNeighbor(snapshot, ids[0], config)).toBe(ids[1]);
    expect(compareNeighbor(snapshot, ids[3], config)).toBe(ids[2]);
  });
});
