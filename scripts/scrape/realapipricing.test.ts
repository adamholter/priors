import { describe, expect, it } from "vitest";
import source, { parseSubscriptions, type Channels, type Conventions, type Points } from "./sources/realapipricing";
import { blendedApiPrice, SUBSCRIPTION_BENCHMARK } from "../../src/data/subscription";
import { BUDGET_PLANS } from "./sources/subscription-overrides";

const conventions: Conventions = {
  usdPerCny: 8, standardTokenMix: { cache: 0.97, input: 0.025, output: 0.005 }, lowCacheTokenMix: { cache: 0.85, input: 0.145, output: 0.005 },
  anthropicTokenMix: { cache: 0.97, cacheWrite: 0.025, output: 0.005 },
};
const channels: Channels = { channels: [["chatgpt", "OpenAI"], ["claude", "Anthropic"], ["cursor", "Cursor"], ["glm", "Zhipu"], ["devin", "Devin"], ["google_ai", "Google"]] };
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
  point("google_ai_pro_us::gemini-4-argon", "Google AI Pro", "Google", 0.303, { model_display: "Gemini 4 Argon", confidence: "low", workload: "lowCache", price_usd: 19.99 }),
  point("opencode_go::gemini-4-argon-contributor", "OpenCode Go", "Google", 0.131, { model_display: "Gemini 4 Argon Contributor", price_usd: 10 }),
] };

describe("list prices", () => {
  const argon = (now: string) => parseSubscriptions(payload, conventions, channels, new Date(now)).find((r) => r.modelLabel === "Gemini 4 Argon")!.details;
  it("uses Google's price through November 30, and leaves it to Artificial Analysis after", () => {
    expect(argon("2026-11-05T00:00:00Z")).toMatchObject({ listPrice: { input: 2, cached: 0.1, output: 10 }, listUntil: "2026-12-01T00:00:00Z" });
    const after = argon("2026-12-01T00:00:00Z") as unknown as { listPrice?: unknown; listUntil?: unknown };
    expect(after.listPrice).toBeUndefined();
    expect(after.listUntil).toBeUndefined();
  });
  it("leaves that price with Argon when Carbon borrows its subsidy", () => {
    const carbon = parseSubscriptions(payload, conventions, channels, new Date("2026-11-05T00:00:00Z")).find((r) => r.modelLabel === "Gemini 4 Carbon (max)")!.details as unknown as { sameAs: string; listPrice?: unknown; listUntil?: unknown };
    expect(carbon.sameAs).toBe("gemini-4");
    expect(carbon.listPrice).toBeUndefined();
    expect(carbon.listUntil).toBeUndefined();
  });
  it("takes a budget plan's rates as the list price on the seller's own model, so its share is fee over budget", () => {
    const rows = parseSubscriptions({ ...payload, points: [] }, conventions, channels);
    const large = rows.find((r) => r.modelLabel === "Mistral Large 4")!, d = large.details as unknown as { listPrice: { input: number; cached: number; output: number }; mix: { cache: number; input: number; output: number } };
    expect(d.listPrice).toEqual({ input: 0.7, cached: 0.07, output: 2.1 });
    expect(large.value / blendedApiPrice(d.listPrice, d.mix)).toBeCloseTo(14.99 / 315, 6);
  });
});

describe("Kimi's legacy plans", () => {
  const kimi = (id: string, plan: string, real: number, price = 19) => point(`${id}::kimi-k3`, plan, "Moonshot", real, { model_display: "Kimi K3", price_usd: price });
  const rows = parseSubscriptions({ ...payload, points: [kimi("kimi_moderato_cn", "Kimi Moderato", 0.0488), kimi("kimi_allegro_cn", "Kimi Allegro", 0.017, 99), kimi("kimi_allegretto_cn", "Kimi Allegretto", 0.02, 39), kimi("kimi_plus_cn", "Kimi Plus", 0.0974), kimi("kimi_pro_cn", "Kimi Pro", 0.0401, 39), kimi("kimi_max_cn", "Kimi Max", 0.0339, 99)] }, conventions, { channels: [...channels.channels, ["kimi", "Moonshot"]] });
  const d = rows.find((r) => r.modelLabel === "Kimi K3")!;
  it("names them legacy and keeps them to pick", () => {
    const names = (d.details as unknown as { plans: { plan: string }[] }).plans.map((p) => p.plan);
    expect(names).toEqual(expect.arrayContaining(["Kimi Moderato, legacy", "Kimi Allegro, legacy", "Kimi Allegretto, legacy", "Kimi Plus"]));
  });
  it("prices the model on a plan you can still buy", () => {
    expect(d).toMatchObject({ value: 0.0401, details: { plan: "Kimi Pro" } });
  });
});

describe("ChatGPT Pro 500", () => {
  const rows = parseSubscriptions(payload, conventions, channels);
  const sol = rows.find((r) => r.modelLabel === "GPT 5.6 Sol")!;
  const details = sol.details as unknown as { plan: string; plans: { plan: string; usdPerMtok: number; feeUsd: number }[] };
  it("is listed at 50 times Plus, the only plan with Ultrafast", () => {
    const plan = details.plans.find((p) => p.plan === "ChatGPT Pro 500");
    expect(plan?.feeUsd).toBe(500);
    expect(plan?.usdPerMtok).toBeCloseTo(0.0325 * 25 / 50, 6);
  });
  it("does not move the median a model is priced at by default", () => {
    // Pro 500 falls just above the middle here, so counting it would land the median on it.
    const measured = parseSubscriptions({ ...payload, points: [
      point("chatgpt_plus::gpt-6.1-sol", "ChatGPT Plus", "OpenAI", 0.0325, { model_display: "GPT 6.1 Sol", confidence: "high" }),
      point("chatgpt_pro_5x::gpt-6.1-sol", "ChatGPT Pro 10x", "OpenAI", 0.015, { model_display: "GPT 6.1 Sol", price_usd: 100, data_date: "2026-10-30" }),
      point("chatgpt_pro_20x::gpt-6.1-sol", "ChatGPT Pro 20x", "OpenAI", 0.0155, { model_display: "GPT 6.1 Sol", price_usd: 200 }),
    ] }, conventions, channels)[0];
    expect((measured.details as unknown as { plans: { plan: string }[] }).plans.map((p) => p.plan)).toContain("ChatGPT Pro 500");
    expect(measured).toMatchObject({ value: 0.0155, details: { plan: "ChatGPT Pro 20x" } });
  });
});

describe("Real API Pricing subscriptions", () => {
  const rows = parseSubscriptions(payload, conventions, channels);
  const row = (label: string) => rows.find((r) => r.modelLabel === label)!;
  const VIBE = "https://mistral.ai/pricing";
  it("labels Max 20x as Ultra, the name it sells under now, at the price Real API Pricing measured", () => {
    expect(row("Claude Fable 5").details).toMatchObject({ plans: expect.arrayContaining([expect.objectContaining({ plan: "Claude Ultra", usdPerMtok: 0.16 })]) });
    expect(JSON.stringify(row("Claude Fable 5").details)).not.toContain("Max 20x");
  });
  const computed = rows.filter((r) => !(r.details as { source?: string; sameAs?: string }).source && !(r.details as { sameAs?: string }).sameAs && r.sourceUrl !== VIBE);
  it("keeps one row per model on its lab's own plans: no resellers, metered APIs or unmetered promos", () => {
    expect(computed.map((r) => r.modelLabel)).toEqual(["GPT 5.6 Sol", "Claude Opus 5.5", "Claude Fable 5", "GLM 5.3", "GLM 5.3 FlashX", "Gemini 4 Argon", "Hy4", "Hy4 preview", "Qwen3.8 Max"]);
    expect(row("GPT 5.6 Sol").details).toMatchObject({ plans: [{ plan: "ChatGPT Pro 20x" }, { plan: "ChatGPT Pro 500" }, { plan: "ChatGPT Pro 10x" }, { plan: "ChatGPT Plus" }] });
  });
  it("marks Cursor's old plans as legacy on its own model, and never prices another lab's model on them", () => {
    const pts = { generatedAt: "x", points: [
      point("cursor_ultra::composer-2.5", "Cursor Ultra", "Cursor", 0.01, { model: "composer-2.5", model_display: "Composer 2.5" }),
      point("cursor_ultra::claude-opus-5.5", "Cursor Ultra", "Anthropic", 0.001, { model: "claude-opus-5.5", model_display: "Claude Opus 5.5" }),
      point("claude_max_20x::claude-opus-5.5", "Claude Max 20x", "Anthropic", 0.0063, { model: "claude-opus-5.5", model_display: "Claude Opus 5.5" }),
    ] };
    const found = parseSubscriptions(pts as never, conventions, channels);
    const named = (label: string) => found.find((r) => r.modelLabel === label)!.details as { plan: string; plans: { plan: string }[] };
    expect(named("Composer 2.5").plan).toBe("Cursor Ultra, legacy");
    expect(named("Claude Opus 5.5").plan).toBe("Claude Ultra");
    expect(named("Claude Opus 5.5").plans.map((p) => p.plan)).toEqual(["Claude Ultra"]);
  });
  it("prices plans measured before an allowance change at the allowance they sell with now: Pro 100 doubled to 10× Plus, Pro 200 keeps 20×", () => {
    const sol = (row("GPT 5.6 Sol").details as { plans: { plan: string; feeUsd: number; usdPerMtok: number }[] }).plans;
    expect(sol.find((p) => p.plan === "ChatGPT Pro 10x")).toMatchObject({ feeUsd: 100, usdPerMtok: 0.0163 });
    expect(sol.find((p) => p.plan === "ChatGPT Pro 20x")).toMatchObject({ feeUsd: 200, usdPerMtok: 0.0155 });
    expect(row("GPT 5.6 Sol")).toMatchObject({ value: 0.0163, details: { plan: "ChatGPT Pro 10x" } });
    // Measured on or after the change: already the new allowance.
    const fresh = parseSubscriptions({ ...payload, points: payload.points.map((p) => p.id === "chatgpt_pro_5x::gpt-5.6-sol" ? { ...p, data_date: "2026-10-30" } : p) }, conventions, channels);
    expect((fresh.find((r) => r.modelLabel === "GPT 5.6 Sol")!.details as { plans: { plan: string; usdPerMtok: number }[] }).plans.find((p) => p.plan === "ChatGPT Pro 5x")!.usdPerMtok).toBe(0.0326);
  });
  it("derives the Pro tiers for an OpenAI model measured only on Plus, one grade less sure, so it lands on the same plan as the others", () => {
    const only = parseSubscriptions({ ...payload, points: [point("chatgpt_plus::gpt-6.1-sol", "ChatGPT Plus", "OpenAI", 0.023, { model_display: "GPT 6.1 Sol", confidence: "high", data_date: "2026-09-30" }), point("chatgpt_pro_5x::gpt-6-astra", "ChatGPT Pro 5x", "OpenAI", 0.11, { model_display: "GPT 6 Astra", price_usd: 100, confidence: "low" }), point("chatgpt_plus::gpt-6-astra", "ChatGPT Plus", "OpenAI", 0.126, { model_display: "GPT 6 Astra", confidence: "high" })] }, conventions, channels);
    const plans = (label: string) => (only.find((r) => r.modelLabel === label)!.details as { plans: { plan: string; feeUsd: number; usdPerMtok: number; confidence: string }[] }).plans;
    expect(plans("GPT 6.1 Sol")).toEqual([
      { plan: "ChatGPT Pro 500", feeUsd: 500, usdPerMtok: 0.0115, confidence: "medium" },
      { plan: "ChatGPT Pro 20x", feeUsd: 200, usdPerMtok: 0.0115, confidence: "medium" },
      { plan: "ChatGPT Pro 10x", feeUsd: 100, usdPerMtok: 0.0115, confidence: "medium" },
      { plan: "ChatGPT Plus", feeUsd: 20, usdPerMtok: 0.023, confidence: "high" },
    ]);
    expect(only.find((r) => r.modelLabel === "GPT 6.1 Sol")).toMatchObject({ value: 0.0115, details: { plan: "ChatGPT Pro 10x", dataDate: "2026-09-30" } });
    // A low-confidence Pro row gives way to the one derived from a high-confidence Plus measurement.
    expect(plans("GPT 6 Astra").find((p) => p.plan === "ChatGPT Pro 10x")).toMatchObject({ usdPerMtok: 0.063, confidence: "medium" });
  });
  it("falls back to the best medium-confidence reseller plan when a model has no first-party plan", () => {
    expect(row("Qwen3.8 Max")).toMatchObject({ value: 0.04, details: { plan: "Droid Max", confidence: "medium" } });
    expect(row("Qwen3.8 Max").note).toContain("best of 2 reseller plans");
  });
  it("finds a model whose Priors id differs from the source's slug: Gemini 4 Argon is gemini-4, priced on Google's own plan", () => {
    expect(rows.filter((r) => r.modelLabel.startsWith("Gemini 4 Argon"))).toHaveLength(1);
    expect(row("Gemini 4 Argon")).toMatchObject({ value: 0.303, details: { plan: "Google AI Pro", confidence: "low", mix: { cache: 0.85, input: 0.145, output: 0.005 } } });
  });
  it("gives Gemini 4 Carbon, which no plan sells yet, Argon's Google AI Pro row, labelled as an assumption", () => {
    expect(row("Gemini 4 Carbon (max)")).toMatchObject({ value: 0.303, details: { plan: "Google AI Pro (assumed same as Argon)", sameAs: "gemini-4", confidence: "assumed", mix: { cache: 0.85, input: 0.145, output: 0.005 } } });
    expect(row("Gemini 4 Carbon (max)").note).toContain("No plan sells Carbon yet");
  });
  it("drops the assumption once a plan's measurement for the model exists", () => {
    const measured = parseSubscriptions({ ...payload, points: [...payload.points, point("google_ai_pro_us::gemini-4-carbon", "Google AI Pro", "Google", 0.5, { model_display: "Gemini 4 Carbon", price_usd: 19.99 })] }, conventions, channels);
    const carbon = measured.filter((r) => r.modelLabel.startsWith("Gemini 4 Carbon"));
    expect(carbon).toHaveLength(1);
    expect(carbon[0]).toMatchObject({ value: 0.5, details: { plan: "Google AI Pro", confidence: "medium" } });
  });
  it("lets a curated published allowance replace a computed row, as a direct share of API price", () => {
    expect(row("Muse Wonder (Max)")).toMatchObject({ identity: { modelId: "aa-muse-wonder" }, details: { ratio: 100 / 150 } });
  });
  it("takes the median plan rather than the cheapest, and low-confidence rows only as a last resort", () => {
    expect(row("GPT 5.6 Sol")).toMatchObject({ value: 0.0163, details: { plan: "ChatGPT Pro 10x", feeUsd: 100, confidence: "medium" } });
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
  it("prices Mistral Vibe Pro's dollar budget at Mistral's API rates: first-party on Mistral's models, a pickable plan beside Z.ai's own for GLM 5.3", () => {
    const vibe = BUDGET_PLANS.find((b) => b.planId === "mistral_vibe_pro")!;
    const at = (model: string) => { const m = vibe.models.find((m) => m.model === model)!; return 14.99 * blendedApiPrice(m, conventions.standardTokenMix) / 315; };
    expect(row("Mistral Medium 3.5")).toMatchObject({ value: at("mistral-medium-3.5"), sourceUrl: VIBE, details: { plan: "Mistral Vibe Pro", feeUsd: 14.99, confidence: "medium", mix: conventions.standardTokenMix } });
    expect(row("Mistral Medium 3.5").note).toContain("median of 1 first-party plan");
    // At Mistral's own list price, the share of API price a subscriber pays is fee ÷ budget.
    expect(row("Mistral Medium 3.5").value / blendedApiPrice({ input: 1.5, output: 7.5 }, conventions.standardTokenMix)).toBeCloseTo(14.99 / 315, 10);
    expect(row("GLM 5.3")).toMatchObject({ value: 0.03, details: { plan: "GLM Coding Pro" } });
    expect((row("GLM 5.3").details as { plans: { plan: string; usdPerMtok: number }[] }).plans).toContainEqual({ plan: "Mistral Vibe Pro", feeUsd: 14.99, usdPerMtok: at("glm-5.3"), confidence: "medium" });
  });
  it("prices Tencent's Token Plan in credits against Hy4's USD list price, at the promotional rate until it ends, and keeps Hy4 preview apart", () => {
    const hy = (at: string, label: string) => parseSubscriptions(payload, conventions, channels, new Date(at)).find((r) => r.modelLabel === label)!;
    const share = (r: ReturnType<typeof hy>) => { const d = r.details as unknown as { plans: { plan: string; usdPerMtok: number }[]; listPrice: { input: number; cached: number; output: number } }; return d.plans.find((p) => p.plan === "Tencent Token Plan Max")!.usdPerMtok / blendedApiPrice(d.listPrice, conventions.standardTokenMix); };
    expect(hy("2026-11-10T00:00:00Z", "Hy4").details).toMatchObject({ listPrice: { input: 0.834, cached: 0.042, output: 2.501 }, plans: expect.arrayContaining([expect.objectContaining({ plan: "Tencent Token Plan Lite", feeUsd: 7 }), expect.objectContaining({ plan: "Tencent Token Plan Max", feeUsd: 103 })]) });
    expect(1 / share(hy("2026-11-10T00:00:00Z", "Hy4"))).toBeCloseTo(3.5, 0);
    // Noon in Beijing is 04:00 UTC.
    expect(share(hy("2026-11-17T03:59:00Z", "Hy4"))).toBeLessThan(0.3);
    expect(share(hy("2026-11-17T04:00:00Z", "Hy4"))).toBeCloseTo(1, 1);
    expect(share(hy("2026-11-20T00:00:00Z", "Hy4 preview"))).toBeLessThan(0.8);
    expect(share(hy("2026-11-30T04:00:00Z", "Hy4 preview"))).toBeCloseTo(1, 1);
  });
  it("makes Vibe Pro the reseller fallback only when it beats the others, and gives way to a Real API Pricing measurement of it", () => {
    const glm52 = (extra: Points["points"]) => parseSubscriptions({ ...payload, points: [...payload.points, ...extra] }, conventions, channels).find((r) => r.modelLabel === "GLM 5.2")!;
    expect(glm52([point("droid_max::glm-5.2", "Droid Max", "Zhipu", 0.0277, { model_display: "GLM 5.2", price_usd: 200 })])).toMatchObject({ details: { plan: "Mistral Vibe Pro", plans: [{ plan: "Mistral Vibe Pro" }, { plan: "Droid Max" }] } });
    expect(glm52([point("droid_max::glm-5.2", "Droid Max", "Zhipu", 0.001, { model_display: "GLM 5.2", price_usd: 200 })])).toMatchObject({ value: 0.001, details: { plan: "Droid Max" } });
    expect(glm52([point("mistral_vibe_pro::glm-5.2", "Mistral Vibe Pro", "Zhipu", 0.02, { model_display: "GLM 5.2", price_usd: 14.99 })])).toMatchObject({ value: 0.02, details: { plans: [{ plan: "Mistral Vibe Pro", usdPerMtok: 0.02 }] } });
  });
  it("scrapes the three published files into one proxy benchmark", async () => {
    const files: Record<string, unknown> = { "points.json": payload, "conventions.json": conventions, "channel-colors.json": channels };
    const ctx = { fetchText: async (url: string) => JSON.stringify(files[url.split("/").pop()!]) } as unknown as Parameters<typeof source.scrape>[0];
    const r = await source.scrape(ctx);
    expect(r.benchmarks[0]).toMatchObject({ id: SUBSCRIPTION_BENCHMARK, unit: "usd", proxy: true, defaultWeight: 0, eligibleForDefault: false, lastUpdated: "2026-10-08" });
    expect(r.rows).toHaveLength(9 + 7 + 2); // + Mistral Vibe Pro's rows (four Mistral models, GLM 5.2, GLM 5.3 Flash, DeepSeek V4.1 Flash 1017) and Tencent Token Plan's Hy4 and Hy4 preview
    expect(Object.keys(r.raw)).toEqual(["points.json", "conventions.json", "channel-colors.json"]);
  });
});
