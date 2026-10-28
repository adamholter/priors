import { describe, expect, it } from "vitest";
import type { Snapshot } from "./types";
import { LABS } from "./normalize";
import { computeIndex, type IndexConfig } from "../engine";
import { decodeIndex, encodeIndex } from "../lib/url";
import { clientSnapshot } from "./client-snapshot";
import { countedResets, extraWeeks, planResetBoosts, planResetNote } from "./plan-resets";
import { blendedApiPrice, CODEX_LIMITS_BENCHMARK, subscriptionPrices, SUBSCRIPTION_BENCHMARK, type SubscriptionDetails } from "./subscription";

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
  it("prices a new OpenAI model from Codex's message limits against measured models, until it has plan data of its own", () => {
    const sn = snap();
    const aa = (input: number, output: number) => ({ id: "t", slug: "t", name: "t", url: "", metadata: { price1mInputTokens: input, price1mOutputTokens: output } });
    const codex = (variantId: string, value: number) => ({ benchmarkId: CODEX_LIMITS_BENCHMARK, variantId, value, observedAt: "", sourceUrl: "" });
    // b pays 10% of API price and gets 50 messages; Terra costs twice b per token and gets 100: twice the messages at twice
    // the price is four times the API value from the same allowance, so a quarter of b's share.
    const withTerra = { ...sn, variants: [...sn.variants, { id: "gpt-6.1-terra@default", modelId: "gpt-6.1-terra", effort: "default", sourceModel: aa(4, 20) }] as Snapshot["variants"],
      observations: [...sn.observations, codex("b@xhigh", 50), codex("gpt-6.1-terra@default", 100)] };
    const terra = subscriptionPrices(withTerra).get("gpt-6.1-terra")!;
    expect(terra.ratio).toBeCloseTo(0.025, 6);
    expect(terra).toMatchObject({ plan: "ChatGPT Plus", confidence: "estimated from Codex Plus message limits against b" });
    // Its own plan row wins.
    const own = { ...withTerra, observations: [...withTerra.observations, { benchmarkId: SUBSCRIPTION_BENCHMARK, variantId: "gpt-6.1-terra@default", value: 0.01, observedAt: "", sourceUrl: "", details: plan("ChatGPT Plus", { ratio: 0.01 }) }] };
    expect(subscriptionPrices(own).get("gpt-6.1-terra")).toMatchObject({ ratio: 0.01, confidence: "high" });
    // No limits published, no guess.
    expect(subscriptionPrices({ ...withTerra, observations: sn.observations }).has("gpt-6.1-terra")).toBe(false);
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

describe("plan limit resets", () => {
  const ev = (at: string, kind: "reset" | "banked" | "both" = "reset", scope = "all") => ({ at, kind, scope });
  /** The snapshot as of 2026-09-05T12:00Z with OpenAI having reset three times in the last 30 days (plus a banked one, an older one and a partial one). */
  const withResets = (): Snapshot => ({
    ...snap(), generatedAt: "2026-09-05T12:00:00Z",
    planResets: [
      { labId: "openai", plan: "Codex", source: "t", url: "", events: [ev("2026-07-01T00:00:00Z"), ev("2026-08-07T00:00:00Z"), ev("2026-08-10T00:00:00Z"), ev("2026-08-20T00:00:00Z", "both"), ev("2026-08-25T00:00:00Z", "banked"), ev("2026-08-28T00:00:00Z", "reset", "affected users"), ev("2026-09-06T00:00:00Z")] },
      { labId: "anthropic", plan: "Claude", source: "t", url: "", events: [ev("2026-06-01T00:00:00Z"), ev("2026-08-30T00:00:00Z")] },
    ],
  });
  const cost = (sn: Snapshot, config: IndexConfig, id: string) => computeIndex(sn, config).ranked.find((r) => r.variant.id === id)!;

  it("counts regular resets in the last 30 days: not banked ones, partial ones, older ones or future ones", () => {
    const boosts = planResetBoosts(withResets());
    expect(boosts.get("openai")).toMatchObject({ resets: 3, clock: "restart" });
    expect(boosts.get("anthropic")).toMatchObject({ resets: 1, clock: "fixed" });
    expect(countedResets([ev("2026-09-04T00:00:00Z", "banked")], Date.parse("2026-09-05T00:00:00Z"))).toEqual([]);
  });

  it("a Claude reset is a whole extra allowance, because its weekly clock does not move", () => {
    const b = planResetBoosts(withResets()).get("anthropic")!;
    expect(b.weeks).toBe(1);
    expect(b.boost).toBeCloseTo(1 + 1 / (30 / 7), 9);
  });

  it("an OpenAI reset restarts the week, so it adds only the part of the week it skips", () => {
    // Aug 7 lands 37 days after the Jul 1 reset (2 days into a 7-day clock), Aug 10 lands 3 days after it, Aug 20 lands 10 days after it (3 days into the next week).
    const b = planResetBoosts(withResets()).get("openai")!;
    expect(b.weeks).toBeCloseTo((1 - 2 / 7) + (1 - 3 / 7) + (1 - 3 / 7), 9);
    expect(b.boost).toBeCloseTo(1 + 13 / 30, 9);
    // Resets that come every day or two replace the whole weekly schedule: the extra weeks approach resets minus the weeks they replace.
    const daily = Array.from({ length: 12 }, (_, i) => ev(new Date(Date.parse("2026-08-10T00:00:00Z") + i * 2 * 86_400_000).toISOString()));
    // The first has no earlier reset on record (counted as landing mid-week); each later one lands 2 days into the week it restarted.
    expect(extraWeeks(daily, Date.parse("2026-09-05T00:00:00Z"), "restart")).toBeCloseTo(0.5 + 11 * (1 - 2 / 7), 9);
    expect(extraWeeks(daily, Date.parse("2026-09-05T00:00:00Z"), "fixed")).toBe(12);
    // A reset a whole number of weeks after the last lands as a week begins anyway: it replaces nothing, so it adds a whole allowance.
    expect(extraWeeks([ev("2026-07-20T00:00:00Z"), ev("2026-08-10T00:00:00Z")], Date.parse("2026-09-05T00:00:00Z"), "restart")).toBeCloseTo(1, 9);
  });

  it("makes the lab's plan cheaper by that factor, and leaves other labs, API pricing and the off switch alone", () => {
    const sn = withResets(), on = { ...base, costBasis: "subscription" as const }, boost = planResetBoosts(sn).get("openai")!.boost;
    const plain = cost(snap(), on, "b@xhigh"), counted = cost(sn, on, "b@xhigh");
    expect(counted.costUsd).toBeCloseTo(plain.costUsd! / boost, 9);
    expect(counted.costPlan!.ratio).toBeCloseTo(0.1 / boost, 9);
    expect(counted.costSource).toContain("with 3 limit resets in 30 days");
    expect(cost(sn, { ...on, planResets: false }, "b@xhigh").costUsd).toBeCloseTo(plain.costUsd!, 9);
    expect(cost(sn, { ...base, costBasis: "api" }, "b@xhigh").costUsd).toBe(7);
    // Anthropic's one reset is worth a whole week against the 4.29 in the window.
    expect(cost(sn, on, "a@max").costUsd).toBeCloseTo(cost(snap(), on, "a@max").costUsd! / (1 + 7 / 30), 9);
  });

  it("does nothing for snapshots without reset data, and the off switch survives a link", () => {
    expect(planResetBoosts(snap()).size).toBe(0);
    expect(planResetNote(snap())).toBeUndefined();
    expect(planResetNote(withResets())).toMatch(/OpenAI: 3 resets in 30 days.*Banked resets are not counted.*restarts the week/);
    const encoded = encodeIndex({ ...base, planResets: false });
    expect(encoded).toContain("resets=off");
    expect(decodeIndex(encoded, "t")!.planResets).toBe(false);
    expect(decodeIndex(encodeIndex(base), "t")!.planResets).toBeUndefined();
  });
});
