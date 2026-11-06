import { describe, expect, it } from "vitest";
import type { Model, Variant } from "../../src/data/types";
import { firstCarry, remapMovedRows, retainCatalog, splitHy4Preview } from "./retain-catalog";

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

describe("labels that moved to another model", () => {
  const lab = { labId: "thinking-machines", kind: "llm", reasoning: true } as const;
  const inkling: Model = { id: "inkling", name: "Inkling", ...lab, aliases: ["inkling", "inkling 2 small"] };
  const inkling2: Model = { id: "inkling-2-small", name: "Inkling 2 Small", ...lab, aliases: ["inkling 2 small"] };
  const stale: Variant = { id: "inkling@default~aa-inkling-2-small", modelId: "inkling", effort: "default", configuration: "aa-inkling-2-small", sourceModel: { id: "e2ed", slug: "inkling-2-small", name: "Inkling 2 Small", url: "" } };
  const orphan: Model = { id: "vals-model-21b3", name: "Wonder Full", labId: "meta", kind: "llm", reasoning: true, aliases: ["wonder full"] };
  const orphanVariant: Variant = { id: "vals-model-21b3@max~vals-21b3", modelId: orphan.id, effort: "max", configuration: "VALS model key: meta/muse-wonder-full" };
  const wonderFull: Model = { id: "aa-muse-wonder-full", name: "Muse Wonder Full", labId: "meta", kind: "llm", reasoning: true, aliases: ["muse wonder full"] };
  it("drops the old model's empty configuration and the orphan twin once their labels resolve elsewhere", () => {
    const r = retainCatalog({ models: [inkling, orphan], variants: [stale, orphanVariant, { id: "inkling@max", modelId: "inkling", effort: "max" }] }, {
      models: [{ ...inkling, aliases: ["inkling"] }, inkling2, wonderFull], variants: [{ id: "inkling-2-small@default", modelId: "inkling-2-small", effort: "default" }],
      observations: [{ variantId: "inkling@max" }, { variantId: "inkling-2-small@default" }],
    });
    expect(r.models.map((m) => m.id)).toEqual(["inkling", "inkling-2-small", "aa-muse-wonder-full"]);
    expect(r.models[0].aliases).toEqual(["inkling"]);
    expect(r.variants.map((v) => v.id)).toEqual(["inkling@max", "inkling-2-small@default"]);
  });
  it("keeps a retained model that still has rows, or whose labels are still its own", () => {
    const old: Model = { id: "claude-opus-4.1", name: "Opus 4.1", labId: "anthropic", kind: "llm", reasoning: true, aliases: ["claude opus 4.1"] };
    const r = retainCatalog({ models: [old, orphan], variants: [orphanVariant] }, { models: [wonderFull], variants: [], observations: [{ variantId: orphanVariant.id }] });
    expect(r.models.map((m) => m.id).sort()).toEqual(["aa-muse-wonder-full", "claude-opus-4.1", "vals-model-21b3"]);
  });
});

describe("rows and dates a moved label leaves behind", () => {
  const o1: Model = { id: "o1", name: "o1", labId: "openai", kind: "llm", reasoning: true, releaseDate: "2024-09-12", aliases: ["o1", "o1-preview"] };
  const preview: Model = { id: "o1-preview", name: "o1-preview", labId: "openai", kind: "llm", reasoning: true, releaseDate: "2024-09-12", aliases: ["o1-preview"] };
  const src = { id: "078f", slug: "o1-preview", name: "o1-preview", url: "" };
  const oldVariant: Variant = { id: "o1@default~aa-o1-preview", modelId: "o1", effort: "default", configuration: "aa-o1-preview", sourceModel: src };
  const newVariant: Variant = { id: "o1-preview@default", modelId: "o1-preview", effort: "default", sourceModel: src };
  it("moves a carried row to the variant its source record now belongs to", () => {
    const rows = remapMovedRows([oldVariant], [newVariant], [{ variantId: oldVariant.id, value: 11 }, { variantId: "o1@high", value: 50 }]);
    expect(rows.map((r) => r.variantId)).toEqual(["o1-preview@default", "o1@high"]);
  });
  it("does not keep the old date when one of the model's labels moved away", () => {
    // o1-preview's rows once sat on o1 and gave it Sept 2024; o1 then kept that date through every later run.
    const r = retainCatalog({ models: [o1], variants: [oldVariant] }, { models: [{ ...o1, releaseDate: undefined, aliases: ["o1"] }, preview], variants: [newVariant], observations: [{ variantId: newVariant.id }] });
    expect(r.models.find((m) => m.id === "o1")!.releaseDate).toBeUndefined();
    expect(r.variants.map((v) => v.id)).toEqual(["o1-preview@default"]);
  });
  it("keeps one carry date, the first", () => {
    expect(firstCarry("deprecated on AA; carried from 2026-10-27; carried from 2026-10-27; carried from 2026-11-04")).toBe("deprecated on AA; carried from 2026-10-27");
    expect(firstCarry("no carry")).toBe("no carry");
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

describe("a merge that has been undone", () => {
  const swe2: Model = { id: "swe-2", name: "SWE 2", labId: "cognition", kind: "llm", reasoning: true, aliases: ["swe-2", "swe-2 flash"] };
  const flash: Model = { id: "swe-2-flash", name: "SWE 2 Flash", labId: "cognition", kind: "llm", reasoning: true, aliases: ["swe-2 flash"] };
  const bare = (id: string, modelId: string): Variant => ({ id, modelId, effort: id.split("@")[1] as Variant["effort"] });
  const result = retainCatalog({ models: [swe2], variants: [bare("swe-2@low", "swe-2"), bare("swe-2@max", "swe-2")] }, {
    models: [{ ...swe2, aliases: ["swe-2"] }, flash], variants: [bare("swe-2-flash@low", "swe-2-flash")], observations: [{ variantId: "swe-2@max" }, { variantId: "swe-2-flash@low" }],
  });
  it("does not bring the alias back through the catalog", () => {
    expect(result.models.find((m) => m.id === "swe-2")!.aliases).toEqual(["swe-2"]);
    expect(result.models.find((m) => m.id === "swe-2-flash")!.aliases).toEqual(["swe-2 flash"]);
  });
  it("drops a bare variant whose only row moved, and keeps one that still has rows or a source", () => {
    expect(result.variants.map((v) => v.id).sort()).toEqual(["swe-2-flash@low", "swe-2@max"]);
  });
  it("keeps an alias whose new model is not in this scrape", () => {
    const partial = retainCatalog({ models: [swe2], variants: [] }, { models: [{ ...swe2, aliases: [] }], variants: [] });
    expect(partial.models[0].aliases).toContain("swe-2 flash");
  });
});

