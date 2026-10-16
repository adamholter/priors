import { describe, expect, it } from "vitest";
import { applyFreeTiers, carriedFreeTiers, modelsForFree, parseOpenRouterFree, parseZenFree, type OpenRouterListing } from "./free-tier";
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
  it("prices a free model at ratio 0, replacing a computed row", () => {
    const s = snap(models, { observations: [{ benchmarkId: SUBSCRIPTION_BENCHMARK, variantId: "gemma-4-31b-it@high", value: 0.2, observedAt: "", sourceUrl: "" }] });
    expect(applyFreeTiers(s, entries, "2026-10-16").sort()).toEqual(["aa-north-mini-code", "gemma-4-31b-it"]);
    const prices = subscriptionPrices(s);
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
