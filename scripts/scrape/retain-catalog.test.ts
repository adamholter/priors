import { describe, expect, it } from "vitest";
import type { Model, Variant } from "../../src/data/types";
import { retainCatalog, splitHy4Preview } from "./retain-catalog";

const model: Model = {
  id: "gpt-6-astra", name: "GPT-6 Astra", labId: "openai", kind: "llm", reasoning: true,
  releaseDate: "2026-09-03", priceTier: "frontier", aliases: ["openai/gpt-6-astra"],
};
const sourceModel = { id: "source-astra", slug: "astra", name: "Astra", url: "https://example.com/astra" };
const variant: Variant = { id: "gpt-6-astra@low", modelId: model.id, effort: "low", sourceModel, sourceModels: [sourceModel], aliases: ["old-astra-low"] };

describe("partial scrape catalog retention", () => {
  it("preserves release dates, price tiers, aliases and provenance on overlapping identities", () => {
    const sparse: Model = { id: model.id, name: model.name, labId: model.labId, kind: "llm", reasoning: false, aliases: ["GPT-6 Astra (low)"] };
    const result = retainCatalog({ models: [model], variants: [variant] }, {
      models: [sparse], variants: [{ id: variant.id, modelId: model.id, effort: "low" }],
    });
    expect(result.models[0]).toMatchObject({ releaseDate: model.releaseDate, priceTier: "frontier", reasoning: true });
    expect(result.models[0].aliases).toEqual([...model.aliases, ...sparse.aliases]);
    expect(result.variants[0]).toEqual(variant);
    expect(model.aliases).toEqual(["openai/gpt-6-astra"]);
  });

  it("retains skipped identities while accepting new models and explicit metadata updates", () => {
    const newer = { ...model, releaseDate: "2026-09-04", aliases: ["new label"] };
    const extra = { ...model, id: "new-model", aliases: ["new model"] };
    const result = retainCatalog({ models: [model], variants: [variant] }, { models: [newer, extra], variants: [] });
    expect(result.models).toHaveLength(2);
    expect(result.models[0].releaseDate).toBe("2026-09-04");
    expect(result.variants).toEqual([variant]);
  });

  it("preserves both primary source records when a second publisher measures the same effort", () => {
    const second = { ...sourceModel, id: "second-astra", url: "https://example.com/second" };
    const old = { ...variant, sourceModels: undefined };
    const result = retainCatalog({ models: [model], variants: [old] }, {
      models: [], variants: [{ ...old, sourceModel: second }],
    });
    expect(result.variants[0].sourceModels).toEqual([sourceModel, second]);
  });
});

describe("splitHy4Preview", () => {
  const hy = (releaseDate?: string) => ({
    models: [{ id: "hy-4", name: "Hy4", labId: "tencent", kind: "llm", reasoning: true, aliases: ["hy4 preview", "tencent: hy4"], releaseDate, openWeights: true }, model] as Model[],
    variants: [{ id: "hy-4@high~vals-1", modelId: "hy-4", effort: "high" }, { id: "hy-40@high", modelId: "hy-40", effort: "high" }] as Variant[],
    observations: [{ variantId: "hy-4@high~vals-1", value: 53 }],
  });
  it("moves a snapshot from before the split onto the preview's id, and only Hy4's rows", () => {
    const s = splitHy4Preview(hy("2026-08-28"));
    expect(s.models[0]).toMatchObject({ id: "hy-4-preview", name: "Hy4 preview", releaseDate: "2026-08-28", openWeights: true, aliases: ["hy4 preview"] });
    expect(s.variants.map((v) => [v.id, v.modelId])).toEqual([["hy-4-preview@high~vals-1", "hy-4-preview"], ["hy-40@high", "hy-40"]]);
    expect(s.observations[0].variantId).toBe("hy-4-preview@high~vals-1");
    expect(s.models[1].id).toBe(model.id);
  });
  it("leaves a snapshot from after the split alone", () => {
    expect(splitHy4Preview(hy("2026-11-04")).models[0].id).toBe("hy-4");
    expect(splitHy4Preview({ models: [model] }).models).toEqual([model]);
  });
});
