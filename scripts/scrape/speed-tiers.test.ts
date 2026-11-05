import { describe, expect, it } from "vitest";
import { claudeFastOutsidePlan, mergeTierRates, parseAaTiers, parseOpenAiPlanRates, parseOpenRouterTiers, type AaEndpoint, type OrEndpoint } from "./speed-tiers";

const aa = (label: string, slug: string, host: string, out: number, speed: number | null, err = 0): AaEndpoint => ({ label, host: { slug: host }, model: { slug }, pricing: { price1mInputTokens: out / 5, price1mOutputTokens: out }, performance: { outputSpeed: speed, endpointErrorRate: err } });
const ids: Record<string, string> = { "gpt-6-1-sol": "gpt-6.1-sol", "claude-opus-5-5": "claude-opus-5.5" };

describe("Artificial Analysis tier endpoints", () => {
  const rows = parseAaTiers([
    aa("GPT-6.1 Sol (max)", "gpt-6-1-sol", "openai", 10, 53.2),
    aa("GPT-6.1 Sol (max) (Fast)", "gpt-6-1-sol", "openai", 20, 77.9),
    aa("GPT-6.1 Sol (max) (Ultrafast)", "gpt-6-1-sol", "openai", 60, 230.8),
    aa("GPT-6.1 Sol (max) (Flex)", "gpt-6-1-sol", "openai", 5, 58.3, 0.074),
    aa("GPT-6.1 Sol (max)", "gpt-6-1-sol", "azure", 10, 40),
    aa("Grok 4 Fast", "grok-4-fast", "xai", 2, 100),
    aa("Unknown (max) (Fast)", "not-a-model", "openai", 20, 80),
  ], (s) => ids[s]);
  it("reads each tier against the same model's standard endpoint", () => {
    expect(rows.map((r) => [r.tier, r.priceMultiple, r.speedMultiple])).toEqual([["fast", 2, 1.464], ["ultrafast", 6, 4.338], ["flex", 0.5, 1.096]]);
    expect(rows[0].speedSource).toBe("Artificial Analysis, max effort");
    expect(rows[2].errorRate).toBe(0.074);
  });
  it("keeps a tier it has no speed for, priced", () => {
    const [row] = parseAaTiers([aa("GPT-6.1 Sol (max)", "gpt-6-1-sol", "openai", 10, 53), aa("GPT-6.1 Sol (max) (Fast)", "gpt-6-1-sol", "openai", 20, null)], (s) => ids[s]);
    expect(row).toEqual({ modelId: "gpt-6.1-sol", tier: "fast", priceMultiple: 2 });
  });
  it("does not read a model named Fast, or another host, as a tier", () => expect(rows.every((r) => r.modelId === "gpt-6.1-sol")).toBe(true));
});

describe("OpenRouter tier endpoints", () => {
  const ep = (id: string, slug: string, completion: string, requests = 5000): OrEndpoint => ({ id, provider_slug: slug, pricing: { completion }, stats: { throughput_request_count: requests } });
  const hours = (y: Record<string, number>) => ({ data: Array.from({ length: 30 }, (_, i) => ({ x: String(i), y })) });
  it("takes a ratio of first-party medians, leaving other providers out", () => {
    expect(parseOpenRouterTiers("claude-opus-5.5", "anthropic", [ep("a", "anthropic", "0.00002"), ep("b", "anthropic/fast", "0.00004"), ep("c", "amazon-bedrock", "0.00002")], hours({ a: 79, b: 189, c: 500 })))
      .toEqual([{ modelId: "claude-opus-5.5", tier: "fast", priceMultiple: 2, speedMultiple: 2.392, speedSource: "OpenRouter, real traffic" }]);
  });
  it("leaves speed out on thin traffic, and when a Fast reads slower than standard", () => {
    const thin = parseOpenRouterTiers("m", "openai", [ep("a", "openai", "0.00001"), ep("b", "openai/fast", "0.00002", 40)], hours({ a: 50, b: 70 }));
    const slower = parseOpenRouterTiers("m", "openai", [ep("a", "openai", "0.00001"), ep("b", "openai/fast", "0.00002")], hours({ a: 50, b: 40 }));
    for (const rows of [thin, slower]) expect(rows).toEqual([{ modelId: "m", tier: "fast", priceMultiple: 2 }]);
  });
  it("keeps a slower Flex, which is what Flex is", () => {
    expect(parseOpenRouterTiers("m", "openai", [ep("a", "openai", "0.00001"), ep("b", "openai/flex", "0.000005")], hours({ a: 50, b: 40 }))[0].speedMultiple).toBe(0.8);
  });
});

describe("merging sources", () => {
  it("prefers Artificial Analysis, and fills a missing speed from OpenRouter", () => {
    const merged = mergeTierRates(
      [{ modelId: "a", tier: "fast", priceMultiple: 2, speedMultiple: 1.5, speedSource: "AA" }, { modelId: "b", tier: "fast", priceMultiple: 2 }],
      [{ modelId: "a", tier: "fast", priceMultiple: 2, speedMultiple: 9, speedSource: "OR" }, { modelId: "b", tier: "fast", priceMultiple: 2, speedMultiple: 3, speedSource: "OR" }, { modelId: "c", tier: "flex", priceMultiple: 0.5 }],
    );
    expect(merged.map((r) => [r.modelId, r.speedMultiple, r.speedSource])).toEqual([["a", 1.5, "AA"], ["b", 3, "OR"], ["c", undefined, undefined]]);
  });
});

describe("plan rates", () => {
  const doc = `For supported models, Fast mode uses included subscription limits at 2.5x the
Standard rate. Ultrafast is available in Codex and ChatGPT Work on Pro $500 and eligible
Enterprise and Edu plans. Ultrafast uses included subscription limits at 8x the Standard rate.`;
  it("reads OpenAI's allowance rates across line breaks", () => {
    expect(parseOpenAiPlanRates(doc).map((r) => [r.tier, r.usageMultiple, r.plan])).toEqual([["fast", 2.5, undefined], ["ultrafast", 8, "ChatGPT Pro 500"]]);
  });
  it("throws when the page stops saying them, so the last ones are kept", () => {
    expect(() => parseOpenAiPlanRates("Fast mode is great.")).toThrow(/page changed/);
    expect(() => parseOpenAiPlanRates(doc.replace("Pro $500", "Pro $200"))).toThrow(/Pro \$500/);
  });
  it("sees whether Anthropic still bills Fast outside the plan", () => {
    expect(claudeFastOutsidePlan("fast mode is available via usage credits only and not\nincluded in the subscription rate limits.")).toBe(true);
    expect(claudeFastOutsidePlan("fast mode is included in your plan.")).toBe(false);
  });
});
