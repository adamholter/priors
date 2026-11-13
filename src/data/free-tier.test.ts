import { describe, expect, it } from "vitest";
import { applyFreeTiers, carriedFreeTiers, freeTierChoice, freeTierValue, modelsForFree, parseGoogleFree, parseOpenRouterFree, parseZenFree, type OpenRouterListing } from "./free-tier";
import { SUBSCRIPTION_BENCHMARK, subscriptionPrices } from "./subscription";
import type { Model, Snapshot } from "./types";

const model = (id: string, name: string, kind: Model["kind"] = "llm"): Model => ({ id, name, labId: "x", kind, reasoning: false, aliases: [] });
const snap = (models: Model[], extra: Partial<Snapshot> = {}): Snapshot => ({
  version: 1, date: "2026-10-16", generatedAt: "", labs: [], models, benchmarks: [], series: [], sources: [],
  variants: models.flatMap((m) => [{ id: `${m.id}@low`, modelId: m.id, effort: "low" as const }, { id: `${m.id}@high`, modelId: m.id, effort: "high" as const }]),
  observations: [], ...extra,
});
const or = (id: string, pricing: Record<string, unknown>, out = ["text"], inp = ["text"]): OpenRouterListing => ({ id, pricing, architecture: { input_modalities: inp, output_modalities: out } });
const zero = { prompt: "0", completion: "0" };

describe("parseZenFree", () => {
  it("keeps only -free ids and flags the contributor tier", () => {
    const e = parseZenFree(["claude-opus-5-5", "deepseek-v4.1-flash-free", "muse-spark-1.3-contributor-free", "big-pickle", "test"]);
    expect(e.map((x) => x.name)).toEqual(["deepseek-v4.1-flash", "muse-spark-1.3"]);
    expect(e[1].note).toContain("shares your prompts");
  });
});

describe("parseOpenRouterFree", () => {
  const entries = parseOpenRouterFree([
    or("google/gemma-4-31b-it:free", zero),
    or("google/gemma-4-31b-it", { prompt: "0.0000001", completion: "0.0000004" }),
    or("google/lyria-3-pro-preview", zero, ["text", "audio"]),
    or("google/lyria-3-clip-preview:free", zero, ["text", "audio"]),
    or("openrouter/free", zero, ["text"]),
    or("vendor/image-maker:free", zero, ["image"]),
    or("nvidia/nemotron-3.5-content-safety:free", zero),
    or("vendor/odd-priced:free", { prompt: "0", completion: "0", image: "0.04" }),
    or("vendor/text-in-text-out:free", { prompt: "0", completion: "0" }, ["text"], ["image"]),
  ]);
  it("keeps only free, text-output chat models", () => {
    expect(entries.map((e) => e.slug)).toEqual(["google/gemma-4-31b-it:free"]);
  });
});

describe("applyFreeTiers", () => {
  const models = [model("gemma-4-31b-it", "Gemma 4 31B IT"), model("aa-north-mini-code", "North Mini Code"), model("gemma-4-31b", "Gemma 4 31B"), model("flux-pro", "Flux Pro", "image")];
  const entries = [...parseOpenRouterFree([or("google/gemma-4-31b-it:free", zero), or("cohere/north-mini-code:free", zero), or("vendor/flux-pro:free", zero)])];
  it("matches by exact name, never to a different model or a non-LLM", () => {
    expect(modelsForFree(entries[0], models).map((m) => m.id)).toEqual(["gemma-4-31b-it"]);
    expect(modelsForFree(entries[1], models).map((m) => m.id)).toEqual(["aa-north-mini-code"]);
    expect(modelsForFree(entries[2], models)).toEqual([]);
  });
  it("gives an undated provider id to the newest dated revision (deepseek-v4.1-flash-free serves V4.1 Flash 1017)", () => {
    const ms = [model("deepseek-v4.1-flash", "DeepSeek V4.1 Flash"), model("deepseek-v4.1-flash-1017", "DeepSeek V4.1 Flash 1017"), model("deepseek-v4.1-flash-0920", "DeepSeek V4.1 Flash 0920")];
    expect(modelsForFree(parseZenFree(["deepseek-v4.1-flash-free"])[0], ms).map((m) => m.id)).toEqual(["deepseek-v4.1-flash-1017"]);
  });
  it("prices a free model at ratio 0, replacing a computed row", () => {
    const s = snap(models, { observations: [{ benchmarkId: SUBSCRIPTION_BENCHMARK, variantId: "gemma-4-31b-it@high", value: 0.2, observedAt: "", sourceUrl: "" }] });
    expect(applyFreeTiers(s, entries, "2026-10-16").sort()).toEqual(["aa-north-mini-code", "gemma-4-31b-it"]);
    // OpenRouter's :free variants are rate-limited: free only when a visitor counts rate-limited tiers.
    expect(subscriptionPrices(s).has("aa-north-mini-code")).toBe(false);
    const prices = subscriptionPrices(s, {}, { free: "limited" });
    expect(prices.get("gemma-4-31b-it")).toMatchObject({ ratio: 0, plan: "OpenRouter free tier" });
    expect(prices.get("aa-north-mini-code")?.ratio).toBe(0);
    expect(prices.has("gemma-4-31b")).toBe(false);
    expect(s.observations.filter((o) => o.benchmarkId === SUBSCRIPTION_BENCHMARK && o.variantId.startsWith("gemma-4-31b-it@"))).toHaveLength(1);
  });
  it("prefers the OpenCode plan name and notes the other provider", () => {
    const s = snap([model("glm-5.3-flash", "GLM 5.3 Flash")]);
    applyFreeTiers(s, [...parseOpenRouterFree([or("z-ai/glm-5.3-flash:free", zero)]), ...parseZenFree(["glm-5.3-flash-free"])], "2026-10-16");
    const o = s.observations[0];
    expect(o.details).toMatchObject({ plan: "OpenCode Zen free tier", ratio: 0, free: true });
    expect(o.note).toContain("also free on OpenRouter free tier");
  });
  it("carries earlier free rows forward for models still in the index", () => {
    const prev = snap(models);
    applyFreeTiers(prev, entries, "2026-10-15");
    const next = snap([models[0]]);
    const carried = carriedFreeTiers(prev, next);
    expect(carried.map((o) => o.variantId)).toEqual(["gemma-4-31b-it@high"]);
    expect(carried[0].note).toContain("carried from 2026-10-16");
  });
});

describe("the paid row behind a free one", () => {
  it("keeps it on the free row", () => {
    const snap = { models: [{ id: "deepseek-v4.1-flash-1017", name: "DeepSeek V4.1 Flash 1017", labId: "deepseek", kind: "llm" }], variants: [{ id: "deepseek-v4.1-flash-1017@max", modelId: "deepseek-v4.1-flash-1017", effort: "max" }], observations: [{ benchmarkId: SUBSCRIPTION_BENCHMARK, variantId: "deepseek-v4.1-flash-1017@max", value: 0.002, details: { plan: "OpenCode Go", plans: [{ plan: "OpenCode Go" }] } }] } as unknown as Snapshot;
    applyFreeTiers(snap, [{ provider: "opencode", slug: "deepseek-v4.1-flash-1017-free", name: "deepseek-v4.1-flash-1017", plan: "OpenCode Zen free tier", source: "x" }], "2026-11-05");
    expect(snap.observations).toHaveLength(1);
    expect(snap.observations[0].details).toMatchObject({ ratio: 0, free: true, paid: { plan: "OpenCode Go", value: 0.002 } });
  });
});


describe("rate-limited free tiers", () => {
  const section = (name: string, id: string, input: string, output: string) => `\n## ${name} {% id=&quot;${id}&quot; %}\n{% tabs %}\n {% tab title=&quot;Standard&quot; %}\n {% table %}\n * Feature\n * Free Tier\n * Paid Tier\n ---\n * Input price\n * ${input}\n * $1.50\n ---\n * Output price (including thinking tokens)\n * ${output}\n * $7.50\n {% /table %}\n {% /tab %}\n {% tab title=&quot;Batch&quot; %}\n * Input price\n * Free of charge\n {% /tab %}`;
  it("reads models whose Gemini API free tier is free for input and output, and marks them rate-limited", () => {
    const page = "# Pricing" + section("Gemini 4 Hydrogen", "gemini-4-hydrogen", "Free of charge", "Free of charge") + section("Gemini 4 Argon", "gemini-4-argon", "Not available", "Not available")
      + section("Gemini 3.8 Live", "gemini-3.8-live", "Free of charge", "Free of charge");
    const got = parseGoogleFree(page);
    expect(got.map((e) => e.name)).toEqual(["Gemini 4 Hydrogen"]);
    expect(got[0]).toMatchObject({ provider: "google", limited: true, plan: "Gemini API free tier" });
  });
  it("marks OpenRouter's :free variants rate-limited", () => {
    expect(parseOpenRouterFree([{ id: "z-ai/glm-5.3-flash:free", pricing: { prompt: "0", completion: "0" }, architecture: { input_modalities: ["text"], output_modalities: ["text"] } }])[0].limited).toBe(true);
  });
  it("maps the settings choice to the stored value and back", () => {
    for (const c of ["generous", "limited", "off"] as const) expect(freeTierChoice(freeTierValue(c))).toBe(c);
    expect(freeTierValue("generous")).toBeUndefined();
  });
});
