import { describe, expect, it } from "vitest";
import source, { parseSubscriptions, type Channels, type Conventions, type Points } from "./sources/realapipricing";
import { SUBSCRIPTION_BENCHMARK } from "../../src/data/subscription";

const conventions: Conventions = {
  usdPerCny: 8, standardTokenMix: { cache: 0.97, input: 0.025, output: 0.005 }, lowCacheTokenMix: { cache: 0.85, input: 0.145, output: 0.005 },
  anthropicTokenMix: { cache: 0.97, cacheWrite: 0.025, output: 0.005 },
};
const channels: Channels = { channels: [["chatgpt", "OpenAI"], ["claude", "Anthropic"], ["cursor", "Cursor"], ["glm", "Zhipu"], ["devin", "Devin"]] };
const point = (id: string, plan: string, vendor: string, real: number, extra: Partial<Points["points"][number]> = {}): Points["points"][number] => {
  const model = id.split("::")[1];
  return { id, plan, billing: "subscription", model, model_display: model, vendor, real_usd_per_mtok: real, confidence: "medium", workload: "standard", price_usd: 20, ...extra };
};
const payload: Points = { generatedAt: "2026-10-08", points: [
  point("chatgpt_pro_20x::gpt-5.6-sol", "ChatGPT Pro 20x", "OpenAI", 0.0155, { model_display: "GPT 5.6 Sol", price_usd: 200 }),
  point("chatgpt_plus::gpt-5.6-sol", "ChatGPT Plus", "OpenAI", 0.0325, { model_display: "GPT 5.6 Sol", list_price: { cached: 0.4, input: 4, output: 20, currency: "USD" } }),
  point("chatgpt_pro_5x::gpt-5.6-sol", "ChatGPT Pro 5x", "OpenAI", 0.0326, { model_display: "GPT 5.6 Sol", price_usd: 100 }),
  point("cursor_ultra::gpt-5.6-sol", "Cursor Ultra", "OpenAI", 0.001, { model_display: "GPT 5.6 Sol" }),
  point("openai_api::gpt-5.6-sol", "GPT-5.6 Sol API", "OpenAI", 0.588, { model_display: "GPT 5.6 Sol", billing: "metered" }),
  point("claude_max_5x::claude-opus-5.5", "Claude Max 5x", "Anthropic", 0.0055, { model_display: "Claude Opus 5.5", workload: "anthropic", confidence: "high" }),
  point("claude_team::claude-opus-5.5", "Claude Team Premium", "Anthropic", 0.001, { model_display: "Claude Opus 5.5", confidence: "low" }),
  point("claude_max_20x::claude-fable-5", "Claude Max 20x", "Anthropic", 0.16, { model_display: "Claude Fable 5", confidence: "low" }),
  point("glm_coding_pro::glm-5.3", "GLM Coding Pro", "Zhipu", 0.03, { model_display: "GLM 5.3 (v3)", list_price: { cached: 1.6, input: 8, output: 32, currency: "CNY" } }),
  point("glm_coding_pro::glm-5.3-flashx", "GLM Coding Pro", "Zhipu", 0.01, { model_display: "GLM 5.3 FlashX" }),
  point("opencode_go::qwen3.8-max", "OpenCode Go", "Alibaba", 0.2, { model_display: "Qwen3.8 Max", price_usd: 10 }),
  point("droid_max::qwen3.8-max", "Droid Max", "Alibaba", 0.04, { model_display: "Qwen3.8 Max", price_usd: 200 }),
  point("scam_plan::qwen3.8-max", "Cheap Plan", "Alibaba", 0.001, { model_display: "Qwen3.8 Max", confidence: "low" }),
  point("devin_pro::swe-2", "Devin Pro", "Cognition", 0, { model_display: "SWE-2", unmetered: true }),
] };

describe("Real API Pricing subscriptions", () => {
  const rows = parseSubscriptions(payload, conventions, channels);
  const row = (label: string) => rows.find((r) => r.modelLabel === label)!;
  const computed = rows.filter((r) => !(r.details as { source?: string }).source);
  it("keeps one row per model on its lab's own plans: no resellers, metered APIs or unmetered promos", () => {
    expect(computed.map((r) => r.modelLabel)).toEqual(["GPT 5.6 Sol", "Claude Opus 5.5", "Claude Fable 5", "GLM 5.3", "Qwen3.8 Max"]);
    expect(row("GPT 5.6 Sol").details).toMatchObject({ plans: [{ plan: "ChatGPT Pro 10x" }, { plan: "ChatGPT Plus" }, { plan: "ChatGPT Pro 5x" }] });
  });
  it("prices plans measured before an allowance cut at the allowance they sell with now", () => {
    const sol = (row("GPT 5.6 Sol").details as { plans: { plan: string; usdPerMtok: number }[] }).plans;
    expect(sol.find((p) => p.plan === "ChatGPT Pro 10x")!.usdPerMtok).toBeCloseTo(0.031);
    expect(sol.some((p) => p.plan === "ChatGPT Pro 20x")).toBe(false);
  });
  it("falls back to the best medium-confidence reseller plan when a model has no first-party plan", () => {
    expect(row("Qwen3.8 Max")).toMatchObject({ value: 0.04, details: { plan: "Droid Max", confidence: "medium" } });
    expect(row("Qwen3.8 Max").note).toContain("best of 2 reseller plans");
  });
  it("lets a curated published allowance replace a computed row, as a direct share of API price", () => {
    expect(rows.filter((r) => r.modelLabel === "Gemini 4 Argon")).toHaveLength(1);
    expect(row("Gemini 4 Argon")).toMatchObject({ details: { ratio: 10 / 60, plan: expect.stringContaining("OpenCode Go") } });
    expect(row("Muse Wonder (Max)")).toMatchObject({ identity: { modelId: "aa-muse-wonder" }, details: { ratio: 100 / 150 } });
  });
  it("takes the median plan rather than the cheapest, and low-confidence rows only as a last resort", () => {
    expect(row("GPT 5.6 Sol")).toMatchObject({ value: 0.0325, details: { plan: "ChatGPT Plus", feeUsd: 20, confidence: "medium" } });
    expect(row("Claude Opus 5.5")).toMatchObject({ value: 0.0055, details: { plan: "Claude Max 5x", confidence: "high" } });
    expect(row("Claude Fable 5")).toMatchObject({ value: 0.16, details: { confidence: "low" } });
  });
  it("records the workload mix and the source's list price in USD", () => {
    expect(row("Claude Opus 5.5").details).toMatchObject({ mix: { cache: 0.97, input: 0, cacheWrite: 0.025, output: 0.005 } });
    expect(row("GPT 5.6 Sol").details).toMatchObject({ mix: { cache: 0.97, input: 0.025, output: 0.005 }, listPrice: { cached: 0.4, input: 4, output: 20 } });
    expect(row("GLM 5.3").details).toMatchObject({ listPrice: { cached: 0.2, input: 1, output: 4 } });
  });
  it("never prices a model from a speed tier that normalizes onto it", () => {
    expect(row("GLM 5.3").value).toBe(0.03);
  });
  it("scrapes the three published files into one proxy benchmark", async () => {
    const files: Record<string, unknown> = { "points.json": payload, "conventions.json": conventions, "channel-colors.json": channels };
    const ctx = { fetchText: async (url: string) => JSON.stringify(files[url.split("/").pop()!]) } as unknown as Parameters<typeof source.scrape>[0];
    const r = await source.scrape(ctx);
    expect(r.benchmarks[0]).toMatchObject({ id: SUBSCRIPTION_BENCHMARK, unit: "usd", proxy: true, defaultWeight: 0, eligibleForDefault: false, lastUpdated: "2026-10-08" });
    expect(r.rows).toHaveLength(7);
    expect(Object.keys(r.raw)).toEqual(["points.json", "conventions.json", "channel-colors.json"]);
  });
});
