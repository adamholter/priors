import { describe, expect, it } from "vitest";
import type { Model, Variant } from "../../src/data/types";
import { retainCatalog } from "./retain-catalog";

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
