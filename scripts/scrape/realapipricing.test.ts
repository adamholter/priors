import { describe, expect, it } from "vitest";
import source, { budgetPoints, parseOpenCodeGo, parseSubscriptions, type Channels, type Conventions, type Points } from "./sources/realapipricing";
import { blendedApiPrice, SUBSCRIPTION_BENCHMARK, type SubscriptionDetails } from "../../src/data/subscription";
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
  point("opencode_go::qwen3.7-max", "OpenCode Go", "Alibaba", 0.2, { model_display: "Qwen3.7 Max", price_usd: 10 }),
  point("droid_max::qwen3.7-max", "Droid Max", "Alibaba", 0.04, { model_display: "Qwen3.7 Max", price_usd: 200 }),
  point("scam_plan::qwen3.7-max", "Cheap Plan", "Alibaba", 0.001, { model_display: "Qwen3.7 Max", confidence: "low" }),
  point("devin_pro::swe-2", "Devin Pro", "Cognition", 0, { model_display: "SWE-2", unmetered: true }),
  point("google_ai_pro_us::gemini-4-argon", "Google AI Pro", "Google", 0.303, { model_display: "Gemini 4 Argon", confidence: "low", workload: "lowCache", price_usd: 19.99 }),
  point("opencode_go::gemini-4-argon-contributor", "OpenCode Go", "Google", 0.131, { model_display: "Gemini 4 Argon Contributor", price_usd: 10 }),
] };

describe("OpenCode Go's limits", () => {
  const tr = (cells: string[]) => `<tr>${cells.map((c) => `<td>${c}</td>`).join("")}</tr>`;
  const page = `<table>${tr(["Go", "$10/month", "Lower-cost"])}${tr(["Go Plus", "$40/month", "Higher"])}${tr(["Go Teams", "$20/member/month", "Every member"])}</table>`;
  const model = (id: string, name: string, canonical: string, input: number, output: number, cache: number, usage: [number, number, number], extra: object = {}) => ({ id, name, canonical_id: canonical, cost: { text: { input: { price: input, cache: { read: cache } }, output: { price: output } } }, go: { monthly_usage: { go: usage[0], "go-plus": usage[1], "go-teams": usage[2] } }, ...extra });
  const flash = model("deepseek-v4.1-flash", "DeepSeek V4.1 Flash 1017", "deepseek/deepseek-v4.1-flash-1017", 0.15, 0.6, 0.003, [100, 200, 105]);
  flash.cost = { ...flash.cost, multipliers: [{ factor: 2 }] } as typeof flash.cost;
  const list = { data: [flash, model("glm-5.3", "GLM-5.3", "zhipuai/glm-5.3", 1.4, 4.4, 0.26, [500, 1000, 505]), model("muse-spark-1.3-contributor", "Muse Spark 1.3 Contributor", "meta/muse-spark-1.3", 0.1, 0.2, 0.002, [60, 120, 65], { go: { training: true, monthly_usage: { go: 60, "go-plus": 120, "go-teams": 65 } } }), { id: "beam-free", name: "Beam Free", canonical_id: "x/beam", cost: { text: { input: { price: 0 }, output: { price: 0 } } } }] };
  const mix = conventions.standardTokenMix, points = parseOpenCodeGo(page, list, mix, "2026-11-18");
  const share = (id: string) => { const p = points.find((x) => x.id === id)!; return p.real_usd_per_mtok / blendedApiPrice(p.list_price!, mix); };
  it("gives each plan's share of API price as fee over limit", () => {
    expect(1 / share("opencode_go::glm-5.3")).toBeCloseTo(50, 6);
    expect(1 / share("opencode_go_plus::glm-5.3")).toBeCloseTo(25, 6);
    expect(1 / share("opencode_go_teams::glm-5.3")).toBeCloseTo(25.25, 6);
    expect(1 / share("opencode_go::deepseek-v4.1-flash-1017")).toBeCloseTo(10, 6);
  });
  it("prices against the highest rate and covers a family's current revision", () => {
    expect(points.find((x) => x.id === "opencode_go::deepseek-v4.1-flash")!.list_price).toEqual({ cached: 0.006, input: 0.3, output: 1.2, currency: "USD" });
  });
  it("leaves out free models and tiers paid for with your prompts", () => {
    expect(points.some((p) => /muse|beam/.test(p.id))).toBe(false);
  });
  it("lists Go beside a lab's own plans and prices the model on it when it gives the bigger subsidy", () => {
    const own = point("glm_coding_pro::glm-5.3", "GLM Coding Pro", "Zhipu", 0.03, { model_display: "GLM 5.3 (v3)", price_usd: 80, list_price: { cached: 0.26, input: 1.4, output: 4.4, currency: "USD" } });
    const row = parseSubscriptions({ ...payload, points: [own] }, conventions, channels, new Date("2026-11-18T00:00:00Z"), points).find((r) => r.modelLabel === "GLM 5.3")!;
    const details = row.details as unknown as { plan: string; plans: { plan: string }[] };
    expect(details.plan).toBe("OpenCode Go");
    expect(details.plans.map((p) => p.plan)).toEqual(expect.arrayContaining(["GLM Coding Pro", "OpenCode Go", "OpenCode Go Plus", "OpenCode Go Teams"]));
  });
  it("drops Real API Pricing's Go rows, including models OpenCode no longer sells", () => {
    const stale = point("opencode_go::mimo-v2.5", "OpenCode Go", "Xiaomi", 0.0013, { model_display: "MiMo V2.5", price_usd: 10 });
    expect(parseSubscriptions({ ...payload, points: [stale] }, conventions, channels, new Date("2026-11-18T00:00:00Z"), points).some((r) => r.modelLabel === "MiMo V2.5")).toBe(false);
  });
  it("tags a promotional limit on every Go plan, until the limit drops back", () => {
    const kimi = (usage: [number, number, number]) => model("kimi-k3.1-pro", "Kimi K3.1 Pro", "moonshotai/kimi-k3.1-pro", 2, 10, 0.2, usage);
    const promo = parseOpenCodeGo(page, { data: [kimi([60, 120, 65])] }, mix, "2026-11-25");
    expect(promo.map((p) => p.preliminary?.label)).toEqual(["Promotion", "Promotion", "Promotion"]);
    expect(promo[0].preliminary?.short).toMatch(/Gimme Kimi Phase 1/);
    expect(parseOpenCodeGo(page, { data: [kimi([15, 60, 20])] }, mix, "2026-11-22").some((p) => p.preliminary)).toBe(false);
    expect(points.some((p) => p.preliminary)).toBe(false);
  });
  it("throws on a changed page or list, so the last rows stand", () => {
    expect(() => parseOpenCodeGo("<p>new page</p>", list, mix, "2026-11-18")).toThrow(/page changed/);
    expect(() => parseOpenCodeGo(page, { data: [] }, mix, "2026-11-18")).toThrow(/response changed/);
  });
});

describe("list prices", () => {
  const argon = (now: string) => parseSubscriptions(payload, conventions, channels, new Date(now)).find((r) => r.modelLabel === "Gemini 4 Argon")!.details;
  it("uses Google's price through November 30, and leaves it to Artificial Analysis after", () => {
    expect(argon("2026-11-05T00:00:00Z")).toMatchObject({ listPrice: { input: 2, cached: 0.1, output: 10 }, listUntil: "2026-12-01T00:00:00Z" });
    const after = argon("2026-12-01T00:00:00Z") as unknown as { listPrice?: unknown; listUntil?: unknown };
    expect(after.listPrice).toBeUndefined();
    expect(after.listUntil).toBeUndefined();
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
    expect(d).toMatchObject({ value: 0.0339, details: { plan: "Kimi Max" } });
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
  it("competes with the other plans for the default", () => {
    // Pro 10x gives the most here, ahead of Pro 500, Pro 20x and Plus.
    const measured = parseSubscriptions({ ...payload, points: [
      point("chatgpt_plus::gpt-6.1-sol", "ChatGPT Plus", "OpenAI", 0.0325, { model_display: "GPT 6.1 Sol", confidence: "high" }),
      point("chatgpt_pro_5x::gpt-6.1-sol", "ChatGPT Pro 10x", "OpenAI", 0.015, { model_display: "GPT 6.1 Sol", price_usd: 100, data_date: "2026-10-30" }),
      point("chatgpt_pro_20x::gpt-6.1-sol", "ChatGPT Pro 20x", "OpenAI", 0.0155, { model_display: "GPT 6.1 Sol", price_usd: 200 }),
    ] }, conventions, channels)[0];
    expect((measured.details as unknown as { plans: { plan: string }[] }).plans.map((p) => p.plan)).toContain("ChatGPT Pro 500");
    expect(measured).toMatchObject({ value: 0.015, details: { plan: "ChatGPT Pro 10x" } });
  });
});

describe("Real API Pricing subscriptions", () => {
  const rows = parseSubscriptions(payload, conventions, channels);
  const row = (label: string) => rows.find((r) => r.modelLabel === label)!;
  const VIBE = "https://mistral.ai/pricing";
  it("uses a lab's only low-confidence rows over a surer but smaller reseller subsidy", () => {
    const got = parseSubscriptions({ ...payload, points: [point("claude_max_5x::claude-sonnet-5.5", "Claude Max 5x", "Anthropic", 0.003, { model_display: "Claude Sonnet 5.5", confidence: "low", list_price: { cached: 0.1, input: 2, output: 10, currency: "USD" } }), point("droid_max::claude-sonnet-5.5", "Droid Max", "Anthropic", 0.04, { model_display: "Claude Sonnet 5.5", price_usd: 200 }), point("thin_plan::claude-sonnet-5.5", "Thin Plan", "Anthropic", 0.001, { model_display: "Claude Sonnet 5.5", confidence: "low" })] }, conventions, channels).find((r) => r.modelLabel === "Claude Sonnet 5.5")!;
    expect(got).toMatchObject({ value: 0.003, details: { plan: "Claude Max 5x" } });
  });
  it("labels Max 20x as Ultra, the name it sells under now, at the price Real API Pricing measured", () => {
    expect(row("Claude Fable 5").details).toMatchObject({ plans: expect.arrayContaining([expect.objectContaining({ plan: "Claude Ultra", usdPerMtok: 0.16 })]) });
    expect(JSON.stringify(row("Claude Fable 5").details)).not.toContain("Max 20x");
  });
  const computed = rows.filter((r) => !(r.details as { source?: string; sameAs?: string }).source && !(r.details as { sameAs?: string }).sameAs && r.sourceUrl !== VIBE);
  it("keeps one row per model, with no metered APIs or unmetered promos", () => {
    expect(computed.filter((r) => !(r.details as unknown as SubscriptionDetails).listOnly).map((r) => r.modelLabel)).toEqual(["GPT 5.6 Sol", "Claude Opus 5.5", "Claude Fable 5", "GLM 5.3 FlashX", "Gemini 4 Argon", "Hy4", "Hy4 preview", "Qwen3.7 Max"]);
    expect(row("GPT 5.6 Sol").details).toMatchObject({ plans: [{ plan: "Cursor Ultra, legacy" }, { plan: "ChatGPT Pro 20x" }, { plan: "ChatGPT Pro 500" }, { plan: "ChatGPT Pro 10x" }, { plan: "ChatGPT Plus" }] });
  });
  it("marks Cursor's old plans as legacy, lists them on other labs' models, and never prices those models on them", () => {
    const pts = { generatedAt: "x", points: [
      point("cursor_ultra::composer-2.5", "Cursor Ultra", "Cursor", 0.01, { model: "composer-2.5", model_display: "Composer 2.5" }),
      point("cursor_ultra::claude-opus-5.5", "Cursor Ultra", "Anthropic", 0.001, { model: "claude-opus-5.5", model_display: "Claude Opus 5.5" }),
      point("claude_max_20x::claude-opus-5.5", "Claude Max 20x", "Anthropic", 0.0063, { model: "claude-opus-5.5", model_display: "Claude Opus 5.5" }),
    ] };
    const found = parseSubscriptions(pts as never, conventions, channels);
    const named = (label: string) => found.find((r) => r.modelLabel === label)!.details as { plan: string; plans: { plan: string }[] };
    expect(named("Composer 2.5").plan).toBe("Cursor Ultra, legacy");
    expect(named("Claude Opus 5.5").plan).toBe("Claude Ultra");
    expect(named("Claude Opus 5.5").plans.map((p) => p.plan).sort()).toEqual(["Claude Ultra", "Cursor Ultra, legacy", "Devin Max"]);
  });
  it("prices plans measured before an allowance change at the allowance they sell with now: Pro 100 doubled to 10× Plus, Pro 200 keeps 20×", () => {
    const sol = (row("GPT 5.6 Sol").details as { plans: { plan: string; feeUsd: number; usdPerMtok: number }[] }).plans;
    expect(sol.find((p) => p.plan === "ChatGPT Pro 10x")).toMatchObject({ feeUsd: 100, usdPerMtok: 0.0163 });
    expect(sol.find((p) => p.plan === "ChatGPT Pro 20x")).toMatchObject({ feeUsd: 200, usdPerMtok: 0.0155 });
    expect(row("GPT 5.6 Sol")).toMatchObject({ value: 0.0155, details: { plan: "ChatGPT Pro 20x" } });
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
  it("lists Pro 10x once when Real API Pricing already publishes it under its new id at the doubled allowance (no second halving)", () => {
    const renamed = parseSubscriptions({ ...payload, points: [point("chatgpt_plus::gpt-6.1-sol", "ChatGPT Plus", "OpenAI", 0.02, { model_display: "GPT 6.1 Sol", confidence: "high", data_date: "2026-07-30" }), point("chatgpt_pro_10x::gpt-6.1-sol", "ChatGPT Pro 10x", "OpenAI", 0.01, { model_display: "GPT 6.1 Sol", price_usd: 100, confidence: "medium", data_date: "2026-07-30~2026-10-30" })] }, conventions, channels);
    const plans = (renamed.find((r) => r.modelLabel === "GPT 6.1 Sol")!.details as { plans: { plan: string; usdPerMtok: number }[] }).plans;
    expect(plans.filter((p) => p.plan === "ChatGPT Pro 10x")).toEqual([expect.objectContaining({ usdPerMtok: 0.01 })]);
  });
  it("lists no Google AI Plus: Antigravity, where every Google row is measured, gives Plus only the free tier", () => {
    const got = parseSubscriptions({ ...payload, points: [point("google_ai_pro_us::gemini-3.8-flash", "Google AI Pro", "Google", 0.008, { model_display: "Gemini 3.8 Flash", price_usd: 19.99, confidence: "high" })] }, conventions, channels);
    expect((got.find((r) => r.modelLabel === "Gemini 3.8 Flash")!.details as { plans: { plan: string }[] }).plans.some((p) => p.plan === "Google AI Plus")).toBe(false);
  });
  it("takes the biggest medium-confidence reseller subsidy when a model has no first-party plan", () => {
    expect(row("Qwen3.7 Max")).toMatchObject({ value: 0.04, details: { plan: "Droid Max", confidence: "medium" } });
    expect(row("Qwen3.7 Max").note).toContain("biggest subsidy of 2 reseller plans");
  });
  it("finds a model whose Priors id differs from the source's slug: Gemini 4 Argon is gemini-4, priced on Google's own plan", () => {
    expect(rows.filter((r) => r.modelLabel.startsWith("Gemini 4 Argon"))).toHaveLength(1);
    expect(row("Gemini 4 Argon")).toMatchObject({ value: 0.303, details: { plan: "Google AI Pro", confidence: "low", mix: { cache: 0.85, input: 0.145, output: 0.005 } } });
  });
  it("prices Gemini 4 Neon from preliminary user readings on Pro and Ultra 20x and extrapolates Ultra 5x, defaulting to Ultra 20x", () => {
    const neon = parseSubscriptions(payload, conventions, channels).find((r) => r.modelLabel === "Gemini 4 Neon (xhigh)")!;
    const d = neon.details as unknown as SubscriptionDetails;
    expect(d).toMatchObject({ plan: "Google AI Ultra 20x", feeUsd: 199.99, confidence: "preliminary", preliminary: { label: "Preliminary, 1 user", credit: "Pyrmi" } });
    expect(1 / (neon.value / blendedApiPrice(d.listPrice!, d.mix))).toBeCloseTo(48.0, 1);
    expect(d.plans.map((p) => p.plan)).toEqual(["Google AI Ultra 20x", "Google AI Ultra 5x", "Google AI Pro"]);
    expect(d.plans.find((p) => p.plan === "Google AI Ultra 5x")!.preliminary!.label).toBe("Extrapolated from 20x plan");
    expect(d.preliminary!.short).toMatch(/pending larger-scale data/i);
  });
  it("makes a user's plan usage the model's price, labeled preliminary with credit, and keeps its other plans", () => {
    const go = point("opencode_go::qwen4-max", "OpenCode Go", "Qwen", 0.09, { model_display: "Qwen4 Max", price_usd: 10, list_price: { cached: 0.075, input: 1.5, output: 4.5, currency: "USD" } });
    const row = parseSubscriptions({ ...payload, points: [...payload.points, go] }, conventions, channels).find((r) => r.sourceUrl?.includes("SSHCodes"))!, d = row.details as unknown as SubscriptionDetails;
    expect(row.value / blendedApiPrice(d.listPrice!, d.mix)).toBeCloseTo(18 / 87.76, 6);
    expect(d).toMatchObject({ plan: "Qwen Token Plan Standard", feeUsd: 18, confidence: "preliminary", preliminary: { label: "Preliminary, 1 user", credit: "@SSHCodes" } });
    expect(d.preliminary!.short).toBe("From one user's data (@SSHCodes), pending larger-scale data.");
    expect(d.plans[0].preliminary?.credit).toBe("@SSHCodes");
  });
  it("since November 23 gives Carbon and Argon Flash's share of the shared Gemini pool on every plan, Pro included, and drops Argon's old Pro-pool row", () => {
    const flash = (id: string, plan: string, v: number, fee: number) => point(`${id}::gemini-3.8-flash`, plan, "Google", v, { model_display: "Gemini 3.8 Flash", price_usd: fee, workload: "lowCache", confidence: id.includes("ultra") ? "low" : "high" });
    const points = [...payload.points, flash("google_ai_pro_us", "Google AI Pro", 0.0077, 19.99), flash("google_ai_ultra_5x_us", "Google AI Ultra 5x", 0.0077, 99.99), flash("google_ai_ultra_20x_us", "Google AI Ultra 20x", 0.0039, 199.99)];
    const found = parseSubscriptions({ ...payload, points }, conventions, channels);
    const flashRow = found.find((r) => r.modelLabel === "Gemini 3.8 Flash")!;
    for (const label of ["Gemini 4 Carbon (max)", "Gemini 4 Argon (max)", "Gemini 4 Hydrogen (xhigh)"]) {
      const r = found.find((x) => x.modelLabel === label)!;
      // The same token price as Flash's row, and `sameAs` so the engine gives it Flash's share of API price on whatever plan Flash is priced at.
      expect(r.value).toBe(flashRow.value);
      expect(r.details).toMatchObject({ sameAs: "gemini-3.8-flash", plans: [] });
      expect((r.details as { poolRate?: number }).poolRate).toBeUndefined();
    }
    // Real API Pricing's Argon row measured Pro's old Argon-only pool: it makes way.
    expect(found.filter((r) => /^Gemini 4 Argon/.test(r.modelLabel))).toHaveLength(1);
  });
  it("gives GPT-6.2 Astra GPT-6 Astra's ChatGPT plan tokens, priced against its own lower list price, until it is measured", () => {
    const astra = (id: string, plan: string, v: number, fee: number) => point(`${id}::gpt-6-astra`, plan, "OpenAI", v, { model_display: "GPT 6 Astra", price_usd: fee, confidence: "medium" });
    const points = [...payload.points, astra("chatgpt_pro_10x", "ChatGPT Pro 10x", 0.0629, 100), astra("chatgpt_plus", "ChatGPT Plus", 0.1258, 20)];
    const found = parseSubscriptions({ ...payload, points }, conventions, channels);
    const row62 = found.find((r) => r.modelLabel === "GPT-6.2 Astra (max)")!;
    // Same tokens per plan dollar as GPT-6 Astra...
    expect(row62.value).toBeCloseTo(0.0629, 9);
    expect(row62).toMatchObject({ details: { plan: "ChatGPT Pro 10x (assumed same as GPT-6 Astra)", sameAs: "gpt-6-astra", listPrice: { input: 8, cached: 0.4, output: 40 }, confidence: "assumed" } });
    // ...so a larger share of the cheaper list price: about 1.9 times GPT-6 Astra's at the standard mix ($10 / $1 / $50 before).
    const mix = conventions.standardTokenMix;
    expect(blendedApiPrice({ input: 10, cached: 1, output: 50 }, mix) / blendedApiPrice({ input: 8, cached: 0.4, output: 40 }, mix)).toBeCloseTo(1.865, 2);
    // A measured row replaces the assumption.
    const measured = parseSubscriptions({ ...payload, points: [...points, point("chatgpt_pro_10x::gpt-6.2-astra", "ChatGPT Pro 10x", "OpenAI", 0.05, { model_display: "GPT 6.2 Astra", price_usd: 100 })] }, conventions, channels);
    expect(measured.filter((r) => /^GPT[- ]6\.2 Astra/.test(r.modelLabel)).map((r) => r.value)).toEqual([0.05]);
  });
  it("prices Hydrogen from the shared Gemini pool, keeping Argon's separate Pro quota out of its estimate", () => {
    const flash = point("google_ai_pro_us::gemini-3.8-flash", "Google AI Pro", "Google", 0.0077450601, { model_display: "Gemini 3.8 Flash", price_usd: 19.99, workload: "lowCache", confidence: "high" });
    const points = [...payload.points, flash];
    const found = parseSubscriptions({ ...payload, points }, conventions, channels);
    expect(found.find((r) => r.modelLabel.startsWith("Gemini 4 Hydrogen"))).toMatchObject({ value: flash.real_usd_per_mtok, details: { sameAs: "gemini-3.8-flash", confidence: "medium", plan: "Google AI Pro (assumed same as Flash)" } });
    // Argon's own Pro pool is gone (2026-11-23): Argon follows Flash too.
    expect(found.find((r) => r.modelLabel.startsWith("Gemini 4 Argon"))!.value).toBe(flash.real_usd_per_mtok);
    // Without a shared-pool measurement, do not silently substitute Argon's unrelated allowance.
    expect(rows.some((r) => r.modelLabel.startsWith("Gemini 4 Hydrogen"))).toBe(false);
    const measured = parseSubscriptions({ ...payload, points: [...points, point("google_ai_pro_us::gemini-4-hydrogen", "Google AI Pro", "Google", 0.009, { model_display: "Gemini 4 Hydrogen", price_usd: 19.99 })] }, conventions, channels);
    expect(measured.filter((r) => r.modelLabel.startsWith("Gemini 4 Hydrogen"))).toMatchObject([{ value: 0.009, details: { plan: "Google AI Pro", confidence: "medium" } }]);
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
  it("prices Fable 5.2 at 2.4 times Opus 5.5's share on Claude Ultra (shared limit) with 4.85 times as the other reading, over a Real API Pricing row that leaves out the half-week cap", () => {
    expect(row("Claude Fable 5.2")).toMatchObject({ details: { plan: "Claude Ultra", feeUsd: 200, confidence: "medium", dataDate: "2026-11-11" } });
    expect(row("Claude Fable 5.2").value).toBeCloseTo(0.03673, 5);
    const uncapped = parseSubscriptions({ ...payload, points: [...payload.points, point("claude_pro::claude-fable-5.2", "Claude Pro", "Anthropic", 0.025575, { model_display: "Claude Fable 5.2", price_usd: 20, workload: "anthropic" })] }, conventions, channels);
    const fable = uncapped.filter((r) => r.modelLabel === "Claude Fable 5.2");
    expect(fable).toHaveLength(1);
    const details = fable[0].details as { ratio?: number; readings?: { id: string; ratio: number }[] };
    // Default: the shared-limit reading, 2.4267 times Opus 5.5's 1.5135%. The Fable-only reading (4.85 times) is the alternative.
    expect(details.ratio).toBeCloseTo(0.03673, 5);
    expect(details.readings?.map((r) => r.id)).toEqual(["shared", "own"]);
    expect(details.readings?.[1].ratio).toBeCloseTo(0.0734, 4);
  });
  it("takes the biggest subsidy, and low-confidence rows only when they are the lab's own and it has nothing surer", () => {
    expect(row("GPT 5.6 Sol")).toMatchObject({ value: 0.0155, details: { plan: "ChatGPT Pro 20x", feeUsd: 200, confidence: "medium" } });
    expect(row("Claude Opus 5.5")).toMatchObject({ value: 0.0055, details: { plan: "Claude Max 5x", confidence: "high" } });
    expect(row("Claude Fable 5")).toMatchObject({ value: 0.16, details: { confidence: "low" } });
  });
  it("records the workload mix and the source's list price in USD", () => {
    expect(row("Claude Opus 5.5").details).toMatchObject({ mix: { cache: 0.97, input: 0, cacheWrite: 0.025, output: 0.005 } });
    expect(row("GPT 5.6 Sol").details).toMatchObject({ mix: { cache: 0.97, input: 0.025, output: 0.005 }, listPrice: { cached: 0.4, input: 4, output: 20 } });
    expect(row("GLM 5.3").details).toMatchObject({ listPrice: { cached: 0.2, input: 1, output: 4 } });
  });
  it("never prices a model from a speed tier that normalizes onto it", () => {
    expect(row("GLM 5.3").value).not.toBe(0.01);
  });
  it("prices Mistral Vibe Pro's dollar budget at Mistral's API rates: first-party on Mistral's models, and GLM 5.3's price when it beats Z.ai's own plan", () => {
    const vibe = BUDGET_PLANS.find((b) => b.planId === "mistral_vibe_pro")!;
    const at = (model: string) => { const m = vibe.models.find((m) => m.model === model)!; return 14.99 * blendedApiPrice(m, conventions.standardTokenMix) / 315; };
    expect(row("Mistral Medium 3.5")).toMatchObject({ value: at("mistral-medium-3.5"), sourceUrl: VIBE, details: { plan: "Mistral Vibe Pro", feeUsd: 14.99, confidence: "medium", mix: conventions.standardTokenMix } });
    expect(row("Mistral Medium 3.5").note).toContain("biggest subsidy of 1 plan");
    // At Mistral's own list price, the share of API price a subscriber pays is fee ÷ budget.
    expect(row("Mistral Medium 3.5").value / blendedApiPrice({ input: 1.5, output: 7.5 }, conventions.standardTokenMix)).toBeCloseTo(14.99 / 315, 10);
    expect(row("GLM 5.3")).toMatchObject({ value: at("glm-5.3"), details: { plan: "Mistral Vibe Pro" } });
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
  it("prices DeepRelay's token allowances by whichever cap runs out first, and marks Vibe's DeepSeek figure preliminary", () => {
    const pts = budgetPoints(conventions), at = (id: string) => pts.find((p) => p.id === id)!;
    // 97% cache reads + 2.5% input spend the 500M input cap long before 0.5% output spends the 50M output cap.
    expect(at("deeprelay_base::deepseek-v4.1-flash-1017").real_usd_per_mtok).toBeCloseTo(0.99 * 0.995 / 500, 12);
    expect(at("deeprelay_plus::deepseek-v4.1-flash-1017").real_usd_per_mtok).toBeCloseTo(4.99 * 0.995 / 2500, 12);
    // Output-heavy work hits the output cap instead.
    const heavy = budgetPoints({ ...conventions, standardTokenMix: { cache: 0.5, input: 0.3, output: 0.2 } });
    expect(heavy.find((p) => p.id === "deeprelay_base::deepseek-v4.1-flash-1017")!.real_usd_per_mtok).toBeCloseTo(0.99 * 0.2 / 50, 12);
    const ds = parseSubscriptions(payload, conventions, channels).find((r) => r.modelLabel === "DeepSeek V4.1 Flash 1017")!, plans = (ds.details as unknown as SubscriptionDetails).plans;
    expect(plans.map((p) => p.plan)).toEqual(expect.arrayContaining(["Mistral Vibe Pro", "DeepRelay Base", "DeepRelay Plus"]));
    expect(plans.find((p) => p.plan === "Mistral Vibe Pro")!.preliminary?.label).toBe("Preliminary");
    expect(plans.find((p) => p.plan === "DeepRelay Base")!.preliminary).toBeUndefined();
    expect((row("Mistral Medium 3.5").details as unknown as SubscriptionDetails).preliminary).toBeUndefined();
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
    expect(r.rows.filter((x) => !(x.details as unknown as SubscriptionDetails | undefined)?.listOnly)).toHaveLength(8 + 7 + 2 + 1 + 3); // + Gemini 4 Neon and the Qwen plan usage rows, added even before a plan row exists. // Carbon is absent without a Flash Ultra measurement. + Mistral Vibe Pro's rows (four Mistral models, GLM 5.2, GLM 5.3 Flash, DeepSeek V4.1 Flash 1017), Tencent Token Plan's Hy4 and Hy4 preview, Fable 5.2's measured share. Hydrogen is absent without a Flash shared-pool measurement
    expect(Object.keys(r.raw)).toEqual(["points.json", "conventions.json", "channel-colors.json"]);
  });
});

describe("plans sold by time of day", () => {
  const glm = (id: string, plan: string, real: number, price = 79.37) => point(`${id}::glm-5.3`, plan, "Zhipu", real, { model_display: "GLM 5.3", price_usd: price, confidence: "high", list_price: { cached: 1.6, input: 8, output: 32, currency: "CNY" } });
  const mimo = (id: string, plan: string, real: number, price: number) => point(`${id}::mimo-v2.6-pro`, plan, "Xiaomi", real, { model_display: "MiMo V2.6 Pro", price_usd: price, list_price: { cached: 0.0036, input: 0.435, output: 0.87, currency: "USD" } });
  const ch: Channels = { channels: [...channels.channels, ["mimo", "Xiaomi"]] };
  it("names each rate as Priors shows it, and skips a price closed to new customers", () => {
    const rows = parseSubscriptions({ ...payload, points: [
      glm("glm_coding_pro_cn_new_offpeak", "GLM Coding Pro (新客 ¥538) 闲时", 0.0321), glm("glm_coding_pro_cn_new_mid", "GLM Coding Pro (新客 ¥538) 中间值", 0.0428), glm("glm_coding_pro_cn_new_peak", "GLM Coding Pro (新客 ¥538) 忙时", 0.0642),
      glm("glm_coding_pro_cn_old_offpeak", "GLM Coding Pro (老客 ¥149) 闲时", 0.0089, 21.98), glm("glm_coding_pro_cn_old_peak", "GLM Coding Pro (老客 ¥149) 忙时", 0.0178, 21.98),
    ] }, conventions, ch);
    const row = rows.find((r) => r.modelLabel === "GLM 5.3")!, d = row.details as { plan: string; plans: { plan: string }[] };
    expect(d.plan).not.toMatch(/existing subscribers/);
    expect(d.plans.map((p) => p.plan)).toEqual(expect.arrayContaining(["GLM Coding Pro ¥538 (peak)", "GLM Coding Pro ¥538 (mixed)", "GLM Coding Pro ¥149, existing subscribers (off-peak)"]));
  });
  it("picks the off-peak rate that gives the most", () => {
    const pick = (pts: Points["points"]) => parseSubscriptions({ ...payload, points: pts }, conventions, ch).find((r) => r.modelLabel === "MiMo V2.6 Pro")!;
    const four = pick([
      mimo("mimo_token_lite_day", "MiMo Token Plan Lite (Day)", 0.0189, 6), mimo("mimo_token_lite_night", "MiMo Token Plan Lite (Night 0.8x)", 0.0151, 6),
      mimo("mimo_token_max_day", "MiMo Token Plan Max (Day)", 0.01576, 100), mimo("mimo_token_max_night", "MiMo Token Plan Max (Night 0.8x)", 0.01261, 100),
    ]);
    expect((four.details as { plan: string }).plan).toBe("MiMo Token Plan Max (off-peak)");
    expect(four.value).toBe(0.01261);
    const lone = pick([
      mimo("mimo_token_lite_day", "MiMo Token Plan Lite (Day)", 0.0189, 6), mimo("mimo_token_lite_night", "MiMo Token Plan Lite (Night 0.8x)", 0.0151, 6),
      mimo("mimo_token_pro_day", "MiMo Token Plan Pro (Day)", 0.0170, 50),
    ]);
    expect((lone.details as { plan: string }).plan).toBe("MiMo Token Plan Lite (off-peak)");
  });
});

describe("Devin Max, measured for Priors", () => {
  const devin = BUDGET_PLANS.find((b) => b.planId === "devin_max")!;
  const opus = (points: Points) => parseSubscriptions(points, conventions, channels).find((r) => r.modelLabel === "Claude Opus 5.5")!;
  const share = (r: ReturnType<typeof opus>) => { const d = r.details as unknown as SubscriptionDetails; return d.plans.find((p) => p.plan === "Devin Max")!.usdPerMtok / blendedApiPrice(d.listPrice!, d.mix); };
  it("pays the fee for 100% a week over 4.35 weeks, at the dollars of list price one percent bought", () => {
    // Opus 5.5: one percent of the week bought $1.24 to $1.26 of Devin's listed price.
    expect(1 / share(opus(payload))).toBeCloseTo(435 * 1.25 / 200, 6);
    expect(devin.models.map((m) => m.model)).not.toContain("deepseek-v4.1-flash");
  });
  it("replaces Real API Pricing's older Devin Max point for the same model, and stays a pickable reseller plan, not the price", () => {
    const old = point("devin_max::claude-opus-5.5", "Devin Max", "Anthropic", 0.0299, { model_display: "Claude Opus 5.5", workload: "anthropic", price_usd: 200, list_price: { cached: 0.2, input: 4, output: 20, currency: "USD" } });
    const row = opus({ ...payload, points: [...payload.points, old] });
    expect((row.details as unknown as SubscriptionDetails).plans.filter((p) => p.plan === "Devin Max")).toHaveLength(1);
    expect(1 / share(row)).toBeCloseTo(435 * 1.25 / 200, 6);
    expect((row.details as unknown as SubscriptionDetails).plan).toBe("Claude Max 5x");
  });
  it("joins the plans of a model priced by assumption, at its own list price and mix, without changing its price", () => {
    const astra = (id: string, plan: string, v: number, fee: number) => point(`${id}::gpt-6-astra`, plan, "OpenAI", v, { model_display: "GPT 6 Astra", price_usd: fee, confidence: "medium" });
    const found = parseSubscriptions({ ...payload, points: [...payload.points, astra("chatgpt_pro_10x", "ChatGPT Pro 10x", 0.0629, 100), astra("chatgpt_plus", "ChatGPT Plus", 0.1258, 20)] }, conventions, channels);
    const row62 = found.find((r) => r.modelLabel === "GPT-6.2 Astra (max)")!, d = row62.details as unknown as SubscriptionDetails;
    expect(row62.value).toBeCloseTo(0.0629, 9);
    // GPT-6.2 Astra: one percent of the week bought $0.70 to $1.16.
    expect(blendedApiPrice(d.listPrice!, d.mix) / d.plans.find((p) => p.plan === "Devin Max")!.usdPerMtok).toBeCloseTo(435 * 0.93 / 200, 6);
    // A model with nothing else gets a row that counts only when Devin Max is picked (GPT-6.1 Terra: one percent bought $0.86 to $1.29).
    const terra = found.find((r) => r.modelLabel === "GPT-6.1 Terra")!, t = terra.details as unknown as SubscriptionDetails;
    expect(t).toMatchObject({ plan: "Devin Max", listOnly: true });
    expect(blendedApiPrice(t.listPrice!, t.mix) / t.plans[0].usdPerMtok).toBeCloseTo(435 * 1.075 / 200, 6);
    // Never a price of its own: no assumption or other plan, no Devin row that prices the model.
    expect(found.some((r) => /Wonder/.test(r.modelLabel) && (r.details as unknown as SubscriptionDetails).plan === "Devin Max" && !(r.details as unknown as SubscriptionDetails).listOnly)).toBe(false);
  });
});

describe("The X Subscription", () => {
  const grok = (id: string, plan: string, v: number, fee: number, confidence = "medium") => point(`${id}::grok-4.7`, plan, "SpaceXAI", v, { model_display: "Grok 4.7", price_usd: fee, confidence });
  const points = [...payload.points, grok("supergrok", "SuperGrok", 0.0524, 30), grok("supergrok_plus", "SuperGrok Plus", 0.0437, 100), grok("supergrok_heavy", "SuperGrok Heavy", 0.0524, 300)];
  const row = parseSubscriptions({ ...payload, points }, conventions, channels).find((r) => r.modelLabel === "Grok 4.7")!;
  const plans = (row.details as unknown as SubscriptionDetails).plans, at = (plan: string) => plans.find((p) => p.plan === plan)!;
  it("lists Plus, Premium, Super and Ultra at X's multiples of Plus, Premium taking SuperGrok's measured allowance", () => {
    // Premium is SuperGrok's $30 allowance; Plus a quarter of it for $8, Super 15/4 for $100, Ultra 50/4 for $200.
    expect(at("X Premium").usdPerMtok).toBeCloseTo(0.0524, 9);
    expect(at("X Plus").usdPerMtok).toBeCloseTo(0.0524 * (8 / 30) * 4, 9);
    expect(at("X Super").usdPerMtok).toBeCloseTo(0.0524 * (100 / 30) / 3.75, 9);
    expect(at("X Ultra").usdPerMtok).toBeCloseTo(0.0524 * (200 / 30) / 12.5, 9);
    expect(at("X Ultra").confidence).toBe("low");
  });
  it("marks the SuperGrok plans legacy and prices Grok on an X plan", () => {
    expect(plans.map((p) => p.plan)).toEqual(expect.arrayContaining(["SuperGrok, legacy", "SuperGrok Plus, legacy", "SuperGrok Heavy, legacy"]));
    expect((row.details as unknown as SubscriptionDetails).plan).toMatch(/^X /);
  });
});
