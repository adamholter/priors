import { describe, expect, it } from "vitest";
import type { Snapshot } from "../data/types";
import { computeIndex } from "../engine";
import { fitPriors, PREFERRED, selectedPairAgreement } from "./optimizer";

function snapshot(): Snapshot {
  const models = ["a", "b", "c", "d"].map((id) => ({ id, name: id.toUpperCase(), labId: "lab", kind: "llm" as const, reasoning: false, aliases: [] }));
  const variants = models.map((m) => ({ id: `${m.id}@default`, modelId: m.id, effort: "default" as const }));
  const benchmarks = [
    { id: "deepswe-1.1", name: "DeepSWE", category: "coding" as const },
    { id: "reverse", name: "Reverse", category: "reasoning" as const },
    { id: "sparse", name: "Sparse", category: "knowledge" as const },
    { id: "aa-cost-per-task-index", name: "Cost", category: "cost" as const },
  ].map((b) => ({ ...b, sourceId: "test", url: "", description: "", unit: "percent" as const, higherIsBetter: true }));
  const row = (benchmarkId: string, modelId: string, value: number) => ({ benchmarkId, variantId: `${modelId}@default`, value, observedAt: "", sourceUrl: "" });
  const observations = [
    row("deepswe-1.1", "a", 90), row("deepswe-1.1", "b", 70), row("deepswe-1.1", "c", 50), row("deepswe-1.1", "d", 20),
    row("reverse", "a", 10), row("reverse", "b", 30), row("reverse", "c", 60), row("reverse", "d", 90),
    row("sparse", "a", 80),
    row("aa-cost-per-task-index", "a", 1), row("aa-cost-per-task-index", "b", 2), row("aa-cost-per-task-index", "c", 3), row("aa-cost-per-task-index", "d", 4),
  ];
  return { version: 1, date: "2026-09-08", generatedAt: "", labs: [{ id: "lab", name: "Lab", color: "#000" }], models, variants, benchmarks, observations, series: [], sources: [] };
}

describe("fitPriors", () => {
  it("finds and exact-verifies a sparse pairwise fit", async () => {
    const updates: Awaited<ReturnType<typeof fitPriors>>[] = [];
    const result = await fitPriors(snapshot(), ["a", "b", "c", "d"], (u) => updates.push(u), { "deepswe-1.1": 88, reverse: 10 });
    expect(result.phase).toBe("complete");
    expect(result.matchedPairs).toBe(6);
    expect(result.totalPairs).toBe(6);
    expect(result.agreement).toBe(100);
    expect(result.benchmarkCount).toBeLessThanOrEqual(12);
    expect(result.weights).not.toHaveProperty("aa-cost-per-task-index");
    expect(result.quality).toBe(88);
    expect(result.estimatedShare).toBe(0);
    expect(result.config.excludeModels ?? []).toEqual([]);
    expect(result.config.optional).toEqual([]);
    expect(computeIndex(snapshot(), result.config).ranked.map((r) => r.model.id)).toEqual(result.ranking.map((r) => r.modelId));
    expect(updates.some((u) => u.phase === "searching")).toBe(true);
  });

  it("rejects an unknown target instead of reporting a perfect fit after dropping it", async () => {
    await expect(fitPriors(snapshot(), ["a", "missing"], () => {})).rejects.toThrow(/known LLM/);
  });

  it("does not count tied scores as a matched pair", async () => {
    const s = snapshot();
    for (const o of s.observations) if (o.benchmarkId === "deepswe-1.1" || o.benchmarkId === "reverse") o.value = 50;
    const result = await fitPriors(s, ["a", "b"], () => {});
    expect(result.agreement).toBe(0);
    expect(result.mismatches).toEqual([{ above: "a", below: "b" }]);
  });

  it("counts only selected pairs, regardless of unselected scores", () => {
    const scores = new Map([["a", 10], ["b", 20], ["c", 30], ["d", 1000]]);
    expect(selectedPairAgreement(["a", "b", "c"], scores)).toMatchObject({ total: 3, matched: 0 });
    scores.set("d", -1000);
    expect(selectedPairAgreement(["a", "b", "c"], scores)).toMatchObject({ total: 3, matched: 0 });
  });

  it("ignores outsiders inserted above or between selected models", () => {
    const target = ["a", "b", "c"];
    const selected = new Map([["a", 90], ["b", 70], ["c", 50]]);
    const expected = selectedPairAgreement(target, selected, { baseline: ["b", "a", "c"] });
    selected.set("outside-top", 100);
    selected.set("outside-middle", 80);
    selected.set("outside-bottom", 55);
    expect(selectedPairAgreement(target, selected, { baseline: ["b", "a", "c"] })).toEqual(expected);
    expect(expected).toMatchObject({ matchedPositions: 3, matched: 3, weightedErrors: 0 });
  });

  it("updates the objective when a model is added to the lineup", async () => {
    const small = await fitPriors(snapshot(), ["a", "b"], () => {});
    expect(small.totalPairs).toBe(1);
    expect(small.ranking.map(r => r.modelId)).toEqual(["a", "b"]);
    expect(small.config.excludeModels ?? []).toEqual([]);
    const updates: number[] = [];
    const added = await fitPriors(snapshot(), ["a", "b", "c"], u => { updates.push(u.agreement); });
    expect(added.totalPairs).toBe(3);
    expect(added.ranking.map(r => r.modelId)).toEqual(["a", "b", "c"]);
    expect(updates.every((value, i) => i === 0 || value >= updates[i - 1])).toBe(true);
  });

  it("identifies a changed top ordering and every relation for an added model", () => {
    const target = ["b", "a", "new", "c"];
    const scores = new Map([["a", 100], ["b", 90], ["new", 110], ["c", 10], ["outside", 999]]);
    const result = selectedPairAgreement(target, scores, { baseline: ["a", "b", "c"] });
    expect(result.priorityTotal).toBe(4);
    expect(result.priorityMatched).toBe(1);
    expect(result.priorityErrors).toEqual([2, 1, 0, 0]);
    expect(result.total).toBe(6);
    expect(result.matchedPositions).toBe(2);
  });

  it("penalizes mistakes near the top more than the same mistake near the bottom", () => {
    const target = ["a", "b", "c", "d"];
    const top = selectedPairAgreement(target, new Map([["a", 3], ["b", 4], ["c", 2], ["d", 1]]));
    const bottom = selectedPairAgreement(target, new Map([["a", 4], ["b", 3], ["c", 1], ["d", 2]]));
    expect(top.matched).toBe(bottom.matched);
    expect(top.weightedErrors).toBeGreaterThan(bottom.weightedErrors);
  });

  it("reports an impossible requested order as an incomplete fit", async () => {
    const s = snapshot();
    s.benchmarks = s.benchmarks.filter(b => b.id === "deepswe-1.1");
    s.observations = s.observations.filter(o => o.benchmarkId === "deepswe-1.1");
    const result = await fitPriors(s, ["b", "a", "c"], () => {}, {}, 0, { baseline: ["a", "b", "c"] });
    expect(result.exactMatch).toBe(false);
    expect(result.priorityTotal).toBe(1);
    expect(result.priorityMatched).toBe(0);
    expect(result.log).toMatch(/No matching configuration found/);
  });

  it("exports the preferred benchmark order", () => {
    expect(PREFERRED[0]).toBe("deepswe-1.1");
    expect(PREFERRED).toHaveLength(8);
  });
});
