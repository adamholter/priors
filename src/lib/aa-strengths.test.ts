import { describe, expect, it } from "vitest";
import { LABS } from "@/data/normalize";
import type { Snapshot } from "@/data/types";
import { aaStrengths } from "./aa-strengths";

function snap(components: Record<string, number> | undefined = { "aa-x": 30, "aa-y": 50, "aa-z": 20 }): Snapshot {
  const bench = (id: string, extra: Record<string, unknown> = {}) => ({ id, name: id.toUpperCase(), sourceId: "aa", url: "", description: `What ${id} measures.`, unit: "percent", higherIsBetter: true, category: "coding", ...extra });
  const o = (benchmarkId: string, variantId: string, value: number, sourceUrl: string) => ({ benchmarkId, variantId, value, observedAt: "", sourceUrl });
  const model = (slug: string) => `https://artificialanalysis.ai/models/${slug}`, page = "https://artificialanalysis.ai/evaluations/x";
  return {
    version: 1, date: "2026-11-10", generatedAt: "2026-11-10T12:00:00.000Z", labs: LABS, series: [], sources: [],
    models: [{ id: "a", name: "A", labId: "anthropic", kind: "llm", reasoning: true, aliases: [] }, { id: "b", name: "B", labId: "openai", kind: "llm", reasoning: true, aliases: [] }],
    variants: [{ id: "a@max", modelId: "a", effort: "max" }, { id: "a@high", modelId: "a", effort: "high" }, { id: "b@default", modelId: "b", effort: "default" }],
    benchmarks: [bench("aa-intelligence-index-v5.0.1", { components, category: "composite" }), bench("aa-x", { shortName: "X" }), bench("aa-y", { unit: "elo" }), bench("aa-z"), bench("aa-not-in-index")],
    observations: [
      // The index rows link to the model's page: that is where a configuration's slug is read.
      o("aa-intelligence-index-v5.0.1", "a@max", 60, model("model-a")), o("aa-intelligence-index-v5.0.1", "a@high", 55, model("model-a-high")), o("aa-intelligence-index-v5.0.1", "b@default", 40, model("model-b")),
      o("aa-x", "a@max", 80, page), o("aa-y", "a@max", 1700, page), o("aa-z", "a@max", 30, page),
      o("aa-x", "a@high", 70, page), o("aa-y", "a@high", 1600, page),
      o("aa-x", "b@default", 20, page), o("aa-y", "b@default", 1200, page), o("aa-z", "b@default", 10, page),
      o("aa-not-in-index", "a@max", 99, page),
    ],
  } as unknown as Snapshot;
}

describe("AA strengths", () => {
  it("lists the index's evaluations from the snapshot, with their share and the field's range", () => {
    const out = aaStrengths(snap());
    expect(out.index).toBe("Artificial Analysis Index v5.0.1");
    expect(out.generatedAt).toBe("2026-11-10T12:00:00.000Z");
    expect(out.axes.map((a) => [a.id, a.label, a.share, a.unit])).toEqual([["aa-x", "X", 30, "percent"], ["aa-y", "AA-Y", 50, "elo"], ["aa-z", "AA-Z", 20, "percent"]]);
    expect(out.axes[0]).toMatchObject({ min: 20, max: 80, median: 70, description: "What aa-x measures." });
    expect(out.axes[2]).toMatchObject({ min: 10, max: 30, median: 20 });
  });

  it("keys every configuration's scores by its Artificial Analysis slug, null where it has none", () => {
    const out = aaStrengths(snap());
    expect(out.models).toEqual({ "model-a": [80, 1700, 30], "model-a-high": [70, 1600, null], "model-b": [20, 1200, 10] });
  });

  it("answers with no axes when the snapshot does not carry the index's parts", () => {
    expect(aaStrengths(snap({}))).toMatchObject({ axes: [], models: {} });
    // A part missing from the snapshot would make a partial copy of the index.
    expect(aaStrengths(snap({ "aa-x": 50, "aa-gone": 50 })).axes).toEqual([]);
  });
});
