import { describe, expect, it } from "vitest";
import { adjustSnapshot, commonLabDefaults, isCommonPlan, labPlanMultiples, naturalPlanName, validAdjustment, withCommonDefaults } from "./plan-defaults";
import { SUBSCRIPTION_BENCHMARK, subscriptionPrices } from "./subscription";
import type { Snapshot } from "./types";

const LIST = { input: 10, output: 50, cached: 1 }, MIX = { cache: 0.9, input: 0.08, output: 0.02 };
// API price of a million tokens at MIX: 0.9 * 1 + 0.08 * 10 + 0.02 * 50 = 2.7. A plan's multiple is 2.7 / usdPerMtok.
const API = 2.7;
type P = [plan: string, multiple: number, feeUsd?: number];
const row = (model: string, plans: P[], start = plans[0][0]) => {
  const list = plans.map(([plan, x, feeUsd]) => ({ plan, feeUsd, usdPerMtok: API / x, confidence: "high" }));
  const own = list.find((p) => p.plan === start)!;
  return { benchmarkId: SUBSCRIPTION_BENCHMARK, variantId: `${model}@max`, value: own.usdPerMtok, observedAt: "", details: { plan: start, feeUsd: own.feeUsd, confidence: "high", mix: MIX, listPrice: LIST, plans: list } };
};
const snapshot = (models: { id: string; lab: string; released: string; plans: P[]; start?: string }[]): Snapshot => ({
  version: 1, date: "2026-11-19", generatedAt: "", labs: [], benchmarks: [{ id: SUBSCRIPTION_BENCHMARK }], series: [], sources: [],
  models: models.map((m) => ({ id: m.id, name: m.id, labId: m.lab, releaseDate: m.released })),
  variants: models.map((m) => ({ id: `${m.id}@max`, modelId: m.id, effort: "max" })),
  observations: models.map((m) => row(m.id, m.plans, m.start)),
} as unknown as Snapshot);
const planOf = (s: Snapshot, id: string) => subscriptionPrices(s).get(id)?.plan;

describe("common plans", () => {
  it("counts a lab's own current plans and widely used resellers, not legacy, peak, team, student or unpopular ones", () => {
    expect(isCommonPlan("Claude Max 5x", "anthropic")).toBe(true);
    expect(isCommonPlan("OpenCode Go", "zhipu")).toBe(true);
    // The X Subscription replaced SuperGrok (2026-10-12): its tiers are xAI's own plans; the SuperGrok ones are legacy now.
    for (const plan of ["X Plus", "X Premium", "X Super", "X Ultra"]) expect(isCommonPlan(plan, "xai")).toBe(true);
    expect(isCommonPlan("SuperGrok Plus, legacy", "xai")).toBe(false);
    expect(isCommonPlan("Ollama Pro", "deepseek")).toBe(true);
    for (const plan of ["Command Code GOAT", "Droid Max", "Mistral Vibe Pro", "OpenCode Go Teams", "Claude Team Premium", "GLM Coding Pro ¥538 (peak)", "GLM Coding Pro ¥149, existing subscribers (off-peak)", "Kimi Allegro, legacy", "Google AI Pro (Student)"]) expect(isCommonPlan(plan, "zhipu"), plan).toBe(false);
    expect(isCommonPlan("Mistral Vibe Pro", "mistral")).toBe(true);
    expect(isCommonPlan("GLM Coding Pro ¥538 (off-peak)", "zhipu")).toBe(true);
    expect(isCommonPlan("MiniMax Token Plan Plus", "minimax", ["MiniMax Token Plan Plus (Global)"])).toBe(false);
    expect(naturalPlanName("GLM Coding Pro ¥538 (off-peak)")).toBe("GLM Coding Pro (off-peak)");
  });

  it("moves a model off a plan nobody uses onto its best common plan, the cheaper fee on a tie", () => {
    const s = snapshot([{ id: "gpt", lab: "openai", released: "2026-11-01", start: "Command Code GOAT", plans: [["Command Code GOAT", 40, 10], ["ChatGPT Pro 20x", 30, 200], ["ChatGPT Pro 10x", 30, 100], ["ChatGPT Plus", 15, 20]] }]);
    const { snapshot: out, moved } = withCommonDefaults(s);
    expect(moved).toBe(1);
    expect(planOf(out, "gpt")).toBe("ChatGPT Pro 10x");
    expect(1 / subscriptionPrices(out).get("gpt")!.ratio).toBeCloseTo(30, 6);
    // Running it again changes nothing.
    expect(withCommonDefaults(out).moved).toBe(0);
  });

  it("gives a lab its flagship's best common plan, which a model takes unless it costs that model more than 10%", () => {
    const s = snapshot([
      { id: "k3", lab: "moonshot", released: "2026-11-10", plans: [["Kimi Max", 13, 99], ["OpenCode Go", 1.5, 10]] },
      { id: "k2", lab: "moonshot", released: "2026-08-01", plans: [["OpenCode Go", 20, 10], ["Kimi Max", 18.5, 99]] },
      { id: "k1", lab: "moonshot", released: "2026-05-01", plans: [["OpenCode Go", 20, 10], ["Kimi Max", 9, 99]] },
    ]);
    expect(commonLabDefaults(s).get("moonshot")).toBe("Kimi Max");
    const out = withCommonDefaults(s).snapshot;
    expect(planOf(out, "k3")).toBe("Kimi Max");
    // Within 10% of its own best: the lab's plan, so the lab reads as one plan.
    expect(planOf(out, "k2")).toBe("Kimi Max");
    // Kimi Max would cost k1 more than half its subsidy: its own best common plan.
    expect(planOf(out, "k1")).toBe("OpenCode Go");
  });

  it("leaves a model sold only on Command Code without a default, so it is priced at the API", () => {
    const s = snapshot([{ id: "q", lab: "alibaba", released: "2026-11-01", plans: [["Command Code GOAT", 4, 10]] }]);
    const { snapshot: out, dropped } = withCommonDefaults(s);
    expect(dropped).toEqual(["q"]);
    expect(subscriptionPrices(out).has("q")).toBe(false);
  });

  it("gives each lab's plans their median subsidy over the lab's models", () => {
    const s = snapshot([{ id: "a", lab: "anthropic", released: "2026-11-01", plans: [["Claude Pro", 80, 20], ["Claude Max 5x", 60, 100]] }, { id: "b", lab: "anthropic", released: "2026-10-01", plans: [["Claude Pro", 40, 20]] }]);
    const m = labPlanMultiples(s).get("anthropic")!;
    expect(m.get("Claude Pro")).toBeCloseTo(60, 6);
    expect(m.get("Claude Max 5x")).toBeCloseTo(60, 6);
  });
});

describe("plan adjustments", () => {
  const s = snapshot([{ id: "sol", lab: "openai", released: "2026-11-01", plans: [["ChatGPT Pro 10x", 30, 100], ["ChatGPT Plus", 15, 20]] }, { id: "opus", lab: "anthropic", released: "2026-11-01", plans: [["Claude Max 5x", 60, 100]] }]);
  it("scales a plan's allowance for the lab's models, on the default and on a pick, and leaves other labs alone", () => {
    const out = adjustSnapshot(s, [{ kind: "subsidy", factor: 2, lab: "openai", plan: "Pro 10x", note: "bonus credits" }]);
    expect(1 / subscriptionPrices(out).get("sol")!.ratio).toBeCloseTo(60, 6);
    expect(1 / subscriptionPrices(out, { openai: "ChatGPT Plus" }).get("sol")!.ratio).toBeCloseTo(15, 6);
    expect(1 / subscriptionPrices(out).get("opus")!.ratio).toBeCloseTo(60, 6);
    // Cached: the same adjustments give the same snapshot, so charts do not redraw for nothing.
    expect(adjustSnapshot(s, [{ kind: "subsidy", factor: 2, lab: "openai", plan: "Pro 10x", note: "bonus credits" }])).toBe(out);
  });
  it("scales a model's cost figures, and ignores adjustments that are not plausible", () => {
    const withCost = { ...s, observations: [...s.observations, { benchmarkId: "t3-turn-time", variantId: "sol@max", value: 2, costUsd: 4, observedAt: "" }] } as Snapshot;
    expect(adjustSnapshot(withCost, [{ kind: "cost", factor: 0.5, model: "sol", note: "discount" }]).observations.at(-1)!.costUsd).toBe(2);
    expect(validAdjustment({ kind: "subsidy", factor: 1000, note: "x" })).toBe(false);
    expect(validAdjustment({ kind: "cost", factor: 2, note: "x" })).toBe(false);
    expect(adjustSnapshot(s, [{ kind: "subsidy", factor: -1, note: "x" }])).toBe(s);
  });
});
