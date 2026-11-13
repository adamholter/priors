import { describe, expect, it } from "vitest";
import type { Snapshot } from "../../src/data/types";
import { applyT3Costs, turnCost } from "./t3-costs";

describe("T3 Code cost per turn", () => {
  it("prices each kind of token at its list price, with tenth-of-input cache reads when unlisted", () => {
    expect(turnCost({ fresh: 1e6, cached: 1e6, written: 0, output: 1e6 }, { input: 2, output: 10 })).toBeCloseTo(2 + 0.2 + 10, 9);
    expect(turnCost({ fresh: 0, cached: 1e6, written: 1e6, output: 0 }, { input: 4, output: 20, cached: 0.2, cacheWrite: 5 })).toBeCloseTo(5.2, 9);
  });
  it("prices the usage row at today's list price, replacing Slopalytics' estimate and adding missing models", () => {
    const meta = (input: number, output: number) => ({ price1mInputTokens: input, price1mOutputTokens: output });
    const snap = {
      models: [], labs: [], series: [], sources: [],
      benchmarks: [{ id: "t3-usage-share" }, { id: "t3-cost-per-turn" }],
      variants: [{ id: "a@max", modelId: "a", effort: "max", sourceModel: { metadata: meta(1, 5) } }, { id: "b@max", modelId: "b", effort: "max", sourceModel: { metadata: meta(2, 10) } }, { id: "c@max", modelId: "c", effort: "max" }],
      observations: [
        { benchmarkId: "t3-usage-share", variantId: "a@max", value: 10, details: { perTurn: { fresh: 1e5, cached: 0, written: 0, output: 1e4 } } },
        { benchmarkId: "t3-usage-share", variantId: "b@max", value: 5, details: { perTurn: { fresh: 1e5, cached: 0, written: 0, output: 1e4 } } },
        { benchmarkId: "t3-usage-share", variantId: "c@max", value: 1, details: { perTurn: { fresh: 1e5, cached: 0, written: 0, output: 1e4 } } },
        { benchmarkId: "t3-cost-per-turn", variantId: "a@max", value: 9, note: "API-equivalent cost at Slopalytics' price table; 3,000 turns" },
      ],
    } as unknown as Snapshot;
    expect(applyT3Costs(snap).priced.sort()).toEqual(["a", "b"]);
    const cost = (v: string) => snap.observations.find((o) => o.benchmarkId === "t3-cost-per-turn" && o.variantId === v)?.value;
    expect(cost("a@max")).toBeCloseTo(0.15, 9);
    expect(cost("b@max")).toBeCloseTo(0.3, 9);
    expect(cost("c@max")).toBeUndefined();
    expect(snap.observations.find((o) => o.benchmarkId === "t3-usage-share" && o.variantId === "b@max")?.costUsd).toBeCloseTo(0.3, 9);
    expect(snap.observations.find((o) => o.benchmarkId === "t3-cost-per-turn" && o.variantId === "a@max")?.note).toMatch(/3,000 turns$/);
  });
});
