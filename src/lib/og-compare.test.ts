import { describe, expect, it } from "vitest";
import type { Snapshot } from "../data/types";
import { LABS } from "../data/normalize";
import { choiceFromIndex } from "../components/compare/choice";
import type { IndexConfig } from "../engine";
import { compareLead, renderCompareCard } from "./og-compare";

const ids = ["a", "b", "c", "d", "e", "f"];
function snapshot(): Snapshot {
  const bench = (id: string) => ({ id, name: id.toUpperCase(), sourceId: "s", url: "", description: "", unit: "percent", higherIsBetter: true, category: "coding" });
  const observations: Snapshot["observations"] = [];
  ids.forEach((id, i) => { observations.push({ benchmarkId: "x", variantId: `${id}@default`, value: 90 - i * 10, observedAt: "", sourceUrl: "" }, { benchmarkId: "y", variantId: `${id}@default`, value: 40 + i * 10, observedAt: "", sourceUrl: "" }); });
  return {
    version: 1, date: "2026-09-05", generatedAt: "", labs: LABS, series: [], sources: [], observations,
    models: ids.map((id) => ({ id, name: id.toUpperCase(), labId: "openai", kind: "llm", reasoning: false, aliases: [] })) as Snapshot["models"],
    variants: ids.map((id) => ({ id: `${id}@default`, modelId: id, effort: "default" })) as Snapshot["variants"],
    benchmarks: [bench("x"), bench("y")] as Snapshot["benchmarks"],
  };
}
const index = (id: string, weights: Record<string, number>): IndexConfig => ({ id, name: id, weights, required: [], cutoff: 5, estimateMissing: false, variants: "all", releasedAfter: "" });

describe("compare card", () => {
  it("opposite mixes disagree: the lead counts the shared top models and the correlation is negative", () => {
    const a = choiceFromIndex(index("Up", { x: 100 })), b = choiceFromIndex(index("Down", { y: 100 }));
    const r = compareLead(snapshot(), a, b);
    expect(r.sa.placed.map((p) => p.modelId)).toEqual(ids);
    expect(r.sb.placed.map((p) => p.modelId)).toEqual([...ids].reverse());
    expect(r.rho).toBeCloseTo(-1);
    expect(r.gap).toMatchObject({ shift: expect.any(Number) });
  });
  it("draws a PNG", () => {
    const png = renderCompareCard(snapshot(), choiceFromIndex(index("Up", { x: 100 })), choiceFromIndex(index("Down", { y: 100 })));
    expect([...png.subarray(0, 4)]).toEqual([0x89, 0x50, 0x4e, 0x47]);
  });
});
