import { describe, expect, it } from "vitest";
import { computeIndex, defaultConfig } from "@/engine";
import { aaComponentWeights } from "@/data/aa-index";
import { clientSnapshot } from "@/data/client-snapshot";
import { loadSnapshot } from "@/data/load";
import { featuredMixes } from "./featured-mixes";
import { existsSync } from "node:fs";
import { modelAvailability, planSubsidies, plansOf, subsidySellers } from "./model-availability";
import { compareView, modelView } from "./model-view";
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
    for (const p of plans) for (const m of p.models) { if (m.multiple != null) expect(m.multiple).toBeGreaterThan(0); expect(known.has(m.id)).toBe(true); }
  });

  it("groups every plan under its seller, with the plan most models use first and a logo for each", () => {
    const sellers = subsidySellers(snapshot), counted = sellers.flatMap((s) => s.plans.map((p) => p.plan)).sort();
    expect(counted).toEqual(planSubsidies(snapshot).map((p) => p.plan).sort());
    for (const s of sellers) { expect(s.logo).toBe(true); expect(existsSync(`public/logos/${s.id}.png`)).toBe(true); }
    expect(sellers.find((s) => s.id === "anthropic")!.plans.every((p) => p.plan.startsWith("Claude"))).toBe(true);
    expect(sellers.map((s) => s.plans[0].median)).toEqual(sellers.map((s) => s.plans[0].median).sort((a, b) => b - a));
  });

  it("shows a model a plan lists before anyone has measured it, and leads Google with the plan selling its best model", () => {
    const row = (modelId: string, plans: string[]) => ({ benchmarkId: "plan-listed-models", variantId: `${modelId}@max`, value: plans.length, observedAt: "", sourceUrl: "https://antigravity.google/docs/models", details: { plans: plans.map((plan) => ({ plan })) } });
    const ultra = ["Google AI Ultra 5x", "Google AI Ultra 20x"], listed = { ...snapshot, observations: [...snapshot.observations, row("claude-opus-5.5", ["Google AI Pro", ...ultra]), row("gemini-4-carbon", ultra)] };
    const opus = modelAvailability(listed, "claude-opus-5.5")!.plans.find((p) => p.plan === "Google AI Ultra 5x")!;
    expect(opus.ratio).toBeUndefined(); expect(opus.feeUsd).toBeGreaterThan(0);
    const google = subsidySellers(listed).find((s) => s.id === "google")!, plan = google.plans[0];
    expect(plan.plan).toBe("Google AI Ultra 5x");
    expect(plan.models.find((m) => m.id === "gemini-4-carbon")?.multiple).toBeGreaterThan(0);
    expect(plan.models.at(-1)!.multiple).toBeUndefined();
    expect(plan.models.some((m) => m.id === "claude-opus-5.5")).toBe(true);
    expect(plan.median).toBeGreaterThan(0);
  });

  it("opens a reseller on the plan covering the most models, cheapest first", () => {
    const go = subsidySellers(snapshot).find((s) => s.id === "ollama")!;
    expect(go.plans[0].feeUsd).toBe(Math.min(...go.plans.filter((p) => p.models.length === go.plans[0].models.length).map((p) => p.feeUsd ?? Infinity)));
  });

  it("never opens a company on a plan it no longer sells", () => {
    for (const s of subsidySellers(snapshot)) if (s.plans.some((p) => !/legacy|existing subscribers/i.test(p.plan))) expect(s.plans[0].plan).not.toMatch(/legacy|existing subscribers/i);
  });

  it("a model sold on a plan shows that plan", () => {
    const sold = planSubsidies(snapshot)[0].models[0];
    expect(modelAvailability(snapshot, sold.id)?.plans.length).toBeGreaterThan(0);
  });

  it("featured mixes are few, each a real mix of benchmarks that ranks a field of models", () => {
    const mixes = featuredMixes(snapshot);
    expect(mixes.length).toBe(4);
    for (const mix of mixes) {
      expect(Object.keys(mix.weights).length).toBeGreaterThanOrEqual(7);
      expect(new Set(computeIndex(snapshot, { ...mix, variants: "all" }).ranked.map((r) => r.model.id)).size).toBeGreaterThanOrEqual(20);
    }
  });

  it("the Intelligence Index is Artificial Analysis' evaluations at its weights, not its one composite", () => {
    const [index] = featuredMixes(snapshot);
    expect(index.weights).toEqual(aaComponentWeights(snapshot));
    expect(Object.keys(index.weights).some((id) => id.startsWith("aa-intelligence-index"))).toBe(false);
  });

  it("drops a mix that lost too much of its weight", () => {
    const names = (benchmarks: typeof snapshot.benchmarks) => featuredMixes({ benchmarks }).map((m) => m.name);
    expect(names(snapshot.benchmarks.filter((b) => !["aa-frontiercode-2-0"].includes(b.id)))).toContain("Science & reasoning");
    expect(names(snapshot.benchmarks.filter((b) => !["aa-terminalbench-science", "aa-critpt-v2", "aa-hle-diamond"].includes(b.id)))).not.toContain("Science & reasoning");
  });

  it("rank stability repeats exactly and each band holds the median", () => {
    const one = rankStability(snapshot, config, { runs: 12 }), two = rankStability(snapshot, config, { runs: 12 });
    expect(two).toEqual(one);
    for (const m of one.models) { expect(m.p10).toBeLessThanOrEqual(m.median); expect(m.median).toBeLessThanOrEqual(m.p90); }
  });

  it("compares two models from the same numbers as their model pages", () => {
    const [a, b] = ids, view = compareView(snapshot, a, b, config, config), page = modelView(snapshot, a, config, config);
    expect(view.a.score).toBe(page.mine[0].score);
    expect(view.a.rank).toBe(1); expect(view.b?.rank).toBe(2);
    expect(view.benches.length).toBeGreaterThan(0);
    for (const x of view.benches) { expect(x.aRank).toBeLessThanOrEqual(x.of); expect(x.aPlace).toBeGreaterThanOrEqual(0); expect(x.bPlace).toBeLessThanOrEqual(1); }
    const gaps = view.benches.map((x) => Math.abs(x.aPlace - x.bPlace));
    expect(gaps).toEqual([...gaps].sort((p, q) => q - p));
  });

  it("provider lists stay out of the browser's dataset", () => {
    const withLists = { ...snapshot, observations: snapshot.observations.map((o) => o.benchmarkId === "openrouter-providers" ? { ...o, details: { endpoints: [{ provider: "X", input: 1, output: 2 }] } } : o.benchmarkId === "aa-output-speed" ? { ...o, details: { providers: [{ provider: "X" }] } } : o) };
    for (const o of clientSnapshot(withLists).observations) { expect(o.details?.endpoints).toBeUndefined(); expect(o.details?.providers).toBeUndefined(); }
  });

  it("with no second model it offers the field and compares nothing", () => {
    const view = compareView(snapshot, ids[0], undefined, config, config);
    expect(view.b).toBeUndefined(); expect(view.benches).toEqual([]);
    expect(view.options.slice(0, 3).map((o) => [o.id, o.rank])).toEqual([[ids[0], 1], [ids[1], 2], [ids[2], 3]]);
    expect(view.options[0].labName).toBeTruthy();
  });
});
