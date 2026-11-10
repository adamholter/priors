import { describe, expect, it } from "vitest";
import { LABS } from "@/data/normalize";
import { SUBSCRIPTION_BENCHMARK, subscriptionPrices } from "@/data/subscription";
import type { Snapshot } from "@/data/types";
import { planPrices } from "./plan-prices";

const mix = { cache: 0.97, input: 0.025, output: 0.005 };
const listPrice = { cached: 0.2, input: 4, output: 20 };

function snap(): Snapshot {
  const models = [
    { id: "a", name: "A", labId: "anthropic", kind: "llm", reasoning: true, aliases: [] },
    { id: "b", name: "B", labId: "openai", kind: "llm", reasoning: true, aliases: [] },
    { id: "f", name: "F", labId: "google", kind: "llm", reasoning: false, aliases: [] },
    { id: "n", name: "No plan", labId: "google", kind: "llm", reasoning: false, aliases: [] },
  ] as Snapshot["models"];
  const variants = [{ id: "a@high", modelId: "a", effort: "high" }, { id: "a@max", modelId: "a", effort: "max" }, { id: "b@default", modelId: "b", effort: "default" }, { id: "f@default", modelId: "f", effort: "default" }, { id: "n@default", modelId: "n", effort: "default" }] as Snapshot["variants"];
  const o = (benchmarkId: string, variantId: string, value: number, sourceUrl = "", details?: Record<string, unknown>) => ({ benchmarkId, variantId, value, observedAt: "", sourceUrl, details });
  const plans = [{ plan: "Claude Pro", feeUsd: 20, usdPerMtok: 0.02, confidence: "high" }, { plan: "Claude Max 20x", feeUsd: 200, usdPerMtok: 0.01, confidence: "medium" }];
  const observations = [
    o("aa-index", "a@max", 60, "https://artificialanalysis.ai/models/model-a"), o("aa-index", "a@high", 55, "https://artificialanalysis.ai/models/model-a-high"),
    o("aa-index", "b@default", 50, "https://artificialanalysis.ai/models/model-b"), o("other", "b@default", 50, "https://example.com/models/not-aa"),
    o("aa-index", "n@default", 40, "https://artificialanalysis.ai/models/no-plan"),
    o(SUBSCRIPTION_BENCHMARK, "a@max", 0.01, "", { plan: "Claude Max 20x", feeUsd: 200, confidence: "medium", mix, listPrice, plans }),
    o(SUBSCRIPTION_BENCHMARK, "b@default", 0.07, "", { plan: "ChatGPT Plus", feeUsd: 20, confidence: "high", ratio: 0.07, mix, plans: [] }),
    o(SUBSCRIPTION_BENCHMARK, "f@default", 0, "", { plan: "Free tier", confidence: "high", ratio: 0, free: true, mix, plans: [], paid: { plan: "Google AI Pro", feeUsd: 20, confidence: "medium", ratio: 0.3, value: 1, mix, plans: [] } }),
  ];
  return { version: 1, date: "2026-11-10", generatedAt: "", labs: LABS, models, variants, benchmarks: [], observations, series: [], sources: [] } as unknown as Snapshot;
}

describe("plan prices", () => {
  const out = planPrices(snap()), model = (id: string) => out.models.find((m) => m.id === id);

  it("gives each model with a plan its share of API price and its Artificial Analysis slugs", () => {
    const a = model("a")!, expected = subscriptionPrices(snap()).get("a")!;
    expect(a.ratio).toBeCloseTo(expected.ratio, 4);
    expect(a.ratio).toBeGreaterThan(0);
    expect(a.ratio).toBeLessThan(1);
    expect(a.aa).toEqual(["model-a", "model-a-high"]);
    // A plan the lab renamed is given under its current name.
    expect(a.plan).toBe("Claude Ultra");
    expect(model("b")).toMatchObject({ ratio: 0.07, plan: "ChatGPT Plus", feeUsd: 20, aa: ["model-b"] });
    expect(out.date).toBe("2026-11-10");
  });

  it("leaves out a model no plan sells", () => {
    expect(model("n")).toBeUndefined();
  });

  it("marks a free model and still says what it costs on a paid plan", () => {
    expect(model("f")).toMatchObject({ free: true, ratio: 0, paid: { plan: "Google AI Pro", ratio: 0.3 } });
  });

  it("lists a lab's plans and each model's share on them when the lab sells more than one", () => {
    expect(out.labs).toEqual([{ id: "anthropic", name: "Anthropic", plans: [{ plan: "Claude Pro", feeUsd: 20 }, { plan: "Claude Ultra", feeUsd: 200 }] }]);
    const plans = model("a")!.plans!;
    expect(Object.keys(plans)).toEqual(["Claude Pro", "Claude Ultra"]);
    expect(plans["Claude Pro"].ratio).toBeCloseTo(plans["Claude Ultra"].ratio * 2, 4);
    expect(model("b")!.plans).toBeUndefined();
  });
});
