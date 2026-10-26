import { describe, expect, it } from "vitest";
import type { Snapshot } from "./types";
import { LABS } from "./normalize";
import { computeIndex, type IndexConfig } from "../engine";
import { decodeIndex, encodeIndex } from "../lib/url";
import { clientSnapshot } from "./client-snapshot";
import { blendedApiPrice, subscriptionPrices, SUBSCRIPTION_BENCHMARK, type SubscriptionDetails } from "./subscription";

const standard = { cache: 0.97, input: 0.025, output: 0.005 };
const plan = (name: string, extra: Partial<SubscriptionDetails> = {}): Record<string, unknown> => ({ plan: name, feeUsd: 20, confidence: "high", mix: standard, plans: [], ...extra });

function snap(): Snapshot {
  const models = [
    { id: "a", name: "A", labId: "anthropic", kind: "llm", reasoning: true, aliases: [], releaseDate: "2026-06-01" },
    { id: "b", name: "B", labId: "openai", kind: "llm", reasoning: true, aliases: [], releaseDate: "2026-05-01" },
    { id: "c", name: "C", labId: "google", kind: "llm", reasoning: false, aliases: [], releaseDate: "2026-07-01" },
  ] as Snapshot["models"];
  const aa = (input: number, output: number, cacheHitPrice: number | null, cacheWritePrice: number | null) => ({ id: "x", slug: "x", name: "x", url: "", metadata: { price1mInputTokens: input, price1mOutputTokens: output, cacheHitPrice, cacheWritePrice } });
  const variants = [
    { id: "a@high", modelId: "a", effort: "high", sourceModel: aa(4, 20, 0.2, 5) }, { id: "a@max", modelId: "a", effort: "max", sourceModel: aa(4, 20, 0.2, 5) },
    { id: "b@xhigh", modelId: "b", effort: "xhigh", sourceModel: aa(2, 10, null, null) }, { id: "c@default", modelId: "c", effort: "default" },
  ] as Snapshot["variants"];
  const benchmarks = [
    { id: "swe", name: "SWE", sourceId: "s", url: "", description: "", unit: "percent", higherIsBetter: true, category: "coding" },
    { id: "aa-cost-per-task-index", name: "Cost", sourceId: "s", url: "", description: "", unit: "usd", higherIsBetter: false, category: "cost" },
    { id: SUBSCRIPTION_BENCHMARK, name: "Subscription price", sourceId: "realapipricing", url: "", description: "", unit: "usd", higherIsBetter: false, category: "cost", proxy: true },
  ] as Snapshot["benchmarks"];
  const o = (benchmarkId: string, variantId: string, value: number, details?: Record<string, unknown>) => ({ benchmarkId, variantId, value, observedAt: "", sourceUrl: "", details });
  const observations = [
    o("swe", "a@high", 70), o("swe", "a@max", 80), o("swe", "b@xhigh", 75), o("swe", "c@default", 60),
    o("aa-cost-per-task-index", "a@max", 12), o("aa-cost-per-task-index", "a@high", 4), o("aa-cost-per-task-index", "b@xhigh", 7), o("aa-cost-per-task-index", "c@default", 5),
    // a: Anthropic workload (fresh input billed as cache writes), priced from the source's own list price.
    o(SUBSCRIPTION_BENCHMARK, "a@max", 0.00419, plan("Claude Max", { mix: { cache: 0.97, input: 0, cacheWrite: 0.025, output: 0.005 }, listPrice: { cached: 0.2, input: 4, output: 20 } })),
    // b: no list price from the source, so Artificial Analysis prices; its cache price is unpublished.
    o(SUBSCRIPTION_BENCHMARK, "b@xhigh", 0.0294, plan("ChatGPT Plus")),
  ];
  return { version: 1, date: "2026-09-05", generatedAt: "", labs: LABS, models, variants, benchmarks, observations, series: [], sources: [] };
}

const base: IndexConfig = { id: "t", name: "t", weights: { swe: 100 }, required: [], cutoff: 5, estimateMissing: true, variants: "all", effortMatching: "strict", releasedAfter: "" };
const costs = (config: IndexConfig) => Object.fromEntries(computeIndex(snap(), config).ranked.map((r) => [r.variant.id, r.costUsd]));

describe("subscription cost basis", () => {
  it("blends API prices at the plan's workload, with the source's defaults for unpublished cache prices", () => {
    expect(blendedApiPrice({ input: 4, output: 20, cached: 0.2 }, standard)).toBeCloseTo(0.394, 6);
    expect(blendedApiPrice({ input: 4, output: 20, cached: 0.2 }, { cache: 0.97, input: 0, cacheWrite: 0.025, output: 0.005 })).toBeCloseTo(0.419, 6);
    expect(blendedApiPrice({ input: 2, output: 10 }, standard)).toBeCloseTo(0.294, 6);
  });
  it("derives each model's share of API price from its plan's token price", () => {
    const prices = subscriptionPrices(snap());
    expect(prices.get("a")).toMatchObject({ plan: "Claude Max", confidence: "high" });
    expect(prices.get("a")!.ratio).toBeCloseTo(0.01, 6);
    expect(prices.get("b")!.ratio).toBeCloseTo(0.1, 6);
    expect(prices.has("c")).toBe(false);
  });
  it("prices GPT-6.1 Terra at GPT-6.1 Sol's share until it has plan data of its own, then defers to it", () => {
    const sn = snap();
    const withSol = { ...sn, variants: [...sn.variants, { id: "gpt-6.1-sol@max", modelId: "gpt-6.1-sol", effort: "max" }] as Snapshot["variants"],
      observations: [...sn.observations, { benchmarkId: SUBSCRIPTION_BENCHMARK, variantId: "gpt-6.1-sol@max", value: 0.03, observedAt: "", sourceUrl: "", details: plan("ChatGPT Plus", { ratio: 0.02 }) }] };
    expect(subscriptionPrices(withSol).get("gpt-6.1-terra")).toMatchObject({ ratio: 0.02, plan: "ChatGPT Plus", confidence: "assumed: same share of API price as gpt-6.1-sol" });
    const own = { ...withSol, variants: [...withSol.variants, { id: "gpt-6.1-terra@max", modelId: "gpt-6.1-terra", effort: "max" }] as Snapshot["variants"],
      observations: [...withSol.observations, { benchmarkId: SUBSCRIPTION_BENCHMARK, variantId: "gpt-6.1-terra@max", value: 0.01, observedAt: "", sourceUrl: "", details: plan("ChatGPT Plus", { ratio: 0.01 }) }] };
    expect(subscriptionPrices(own).get("gpt-6.1-terra")).toMatchObject({ ratio: 0.01, confidence: "high" });
    expect(subscriptionPrices(sn).has("gpt-6.1-terra")).toBe(false);
  });
  it("leaves costs untouched when the index asks for the API basis", () => {
    expect(costs({ ...base, costBasis: "api" })).toEqual({ "a@max": 12, "a@high": 4, "b@xhigh": 7, "c@default": 5 });
    expect(computeIndex(snap(), { ...base, costBasis: "api" }).ranked.every((r) => r.costPlan === undefined)).toBe(true);
  });
  it("prices by subscription unless the index asks for API", () => {
    expect(costs(base)).toEqual(costs({ ...base, costBasis: "subscription" }));
  });
  it("scales every effort of a subscribed model and keeps API cost for models without a plan", () => {
    const ranked = computeIndex(snap(), { ...base, costBasis: "subscription" }).ranked;
    const by = Object.fromEntries(ranked.map((r) => [r.variant.id, r]));
    expect(by["a@max"].costUsd).toBeCloseTo(0.12, 6);
    expect(by["a@high"].costUsd).toBeCloseTo(0.04, 6);
    expect(by["b@xhigh"].costUsd).toBeCloseTo(0.7, 6);
    expect(by["c@default"].costUsd).toBe(5);
    expect(by["a@high"].costPlan?.plan).toBe("Claude Max");
    expect(by["a@high"].costSource).toContain("Claude Max, 1% of API price at full use");
    expect(by["c@default"].costPlan).toBeUndefined();
    // The frontier follows the adjusted costs: the cheapest subscribed effort now undercuts the unsubscribed model.
    expect(ranked.filter((r) => r.onFrontier).map((r) => r.variant.id).sort()).toEqual(["a@high", "a@max"]);
  });
  it("takes a curated ratio as is, without a token mix or list price", () => {
    const snapshot = snap();
    snapshot.observations.push({ ...snapshot.observations.find((o) => o.benchmarkId === SUBSCRIPTION_BENCHMARK)!, variantId: "c@default", value: 0.5, details: { plan: "Curated", ratio: 1 / 6, confidence: "medium", plans: [] } });
    expect(subscriptionPrices(snapshot).get("c")).toMatchObject({ ratio: 1 / 6, plan: "Curated" });
  });
  it("prices a free tier (ratio 0) at $0 and says where it is free", () => {
    const snapshot = snap();
    snapshot.observations.push({ ...snapshot.observations.find((o) => o.benchmarkId === SUBSCRIPTION_BENCHMARK)!, variantId: "c@default", value: 0, details: { plan: "OpenCode Zen free tier", ratio: 0, confidence: "high", plans: [] } });
    expect(subscriptionPrices(snapshot).get("c")).toMatchObject({ ratio: 0 });
    const c = computeIndex(snapshot, { ...base, variants: "all" }).ranked.find((r) => r.variant.id === "c@default")!;
    expect(c.costUsd).toBe(0);
    expect(c.costSource).toContain("free on OpenCode Zen free tier");
  });
  it("survives the client snapshot, which drops other scraper details", () => {
    expect(subscriptionPrices(clientSnapshot(snap())).get("a")!.ratio).toBeCloseTo(0.01, 6);
  });
  it("round-trips through share links, omitting the default", () => {
    expect(encodeIndex(base)).not.toContain("costbasis");
    expect(encodeIndex({ ...base, costBasis: "subscription" })).not.toContain("costbasis");
    const encoded = encodeIndex({ ...base, costBasis: "api" });
    expect(encoded).toContain("costbasis=api");
    expect(decodeIndex(encoded, "t")!.costBasis).toBe("api");
    expect(decodeIndex(encoded.replace("api", "nope"), "t")!.costBasis).toBeUndefined();
  });
});
