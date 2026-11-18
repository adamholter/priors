import { describe, expect, it } from "vitest";
import type { Snapshot } from "../../src/data/types";
import { applyT3Costs, SETTLED_TURNS, turnCost } from "./t3-costs";

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
  it("prices T3's ClickHouse rows per effort and rebuilds cost per turn from them, with the users behind each", () => {
    const meta = (input: number, output: number) => ({ price1mInputTokens: input, price1mOutputTokens: output });
    const perTurn = { fresh: 1e5, cached: 1e6, written: 0, output: 1e4 };
    const snap = {
      models: [], labs: [], series: [], sources: [],
      benchmarks: [{ id: "t3-usage-share" }, { id: "t3-cost-per-turn", description: "Slopalytics" }, { id: "t3-turn-time", sourceId: "t3-telemetry", url: "https://t3.codes", lastUpdated: "2026-11-16" }],
      variants: [
        { id: "a@max", modelId: "a", effort: "max", sourceModel: { metadata: meta(1, 5) } }, { id: "a@low", modelId: "a", effort: "low" },
        { id: "n@high", modelId: "n", effort: "high", sourceModel: { metadata: meta(2, 10) } }, { id: "x@high", modelId: "x", effort: "high" },
      ],
      observations: [
        { benchmarkId: "t3-usage-share", variantId: "a@max", value: 10, details: { perTurn } },
        { benchmarkId: "t3-cost-per-turn", variantId: "a@max", value: 9, note: "Slopalytics" },
        { benchmarkId: "t3-turn-time", variantId: "a@max", value: 5, durationSec: 300, details: { users: 900, turns: 5000, tokenTurns: 4800, perTurn, window: "2026-10-17 to 2026-11-15" } },
        { benchmarkId: "t3-turn-time", variantId: "a@low", value: 2, durationSec: 120, details: { users: 40, turns: 300, tokenTurns: 290, perTurn: { ...perTurn, output: 2e3 } } },
        // A model Slopalytics never had (under 2,000 turns): ClickHouse has it.
        { benchmarkId: "t3-turn-time", variantId: "n@high", value: 3, durationSec: 180, details: { users: 7, turns: 60, tokenTurns: 60, perTurn } },
        // No list price: no cost.
        { benchmarkId: "t3-turn-time", variantId: "x@high", value: 3, durationSec: 180, details: { users: 7, turns: 60, perTurn } },
        // Turns without token counts: time only.
        { benchmarkId: "t3-turn-time", variantId: "n@high~old", value: 3, details: { users: 7, turns: 60 } },
      ],
    } as unknown as Snapshot;
    expect(applyT3Costs(snap)).toEqual({ priced: ["a", "n"], perEffort: 3, held: [] });
    const costs = snap.observations.filter((o) => o.benchmarkId === "t3-cost-per-turn");
    expect(costs.map((o) => o.variantId).sort()).toEqual(["a@low", "a@max", "n@high"]);
    // a@max: 0.1M fresh at $1, 1M cached at $0.10, 0.01M out at $5.
    expect(costs.find((o) => o.variantId === "a@max")).toMatchObject({ value: expect.closeTo(0.25, 9), costUsd: expect.closeTo(0.25, 9), details: { users: 900, turns: 4800 } });
    expect(costs.find((o) => o.variantId === "a@max")?.note).toMatch(/4,800 turns with token counts from 900 T3 Code users, 2026-10-17 to 2026-11-15$/);
    expect(costs.find((o) => o.variantId === "a@low")?.value).toBeCloseTo(0.21, 9);
    expect(snap.observations.find((o) => o.benchmarkId === "t3-turn-time" && o.variantId === "n@high")?.costUsd).toBeCloseTo(0.5, 9);
    expect(snap.benchmarks.find((b) => b.id === "t3-cost-per-turn")).toMatchObject({ sourceId: "t3-telemetry", unit: "usd", higherIsBetter: false, lastUpdated: "2026-11-16" });
  });
  describe("holding back thin data whose cost does not rise with effort", () => {
    const tokens = (output: number) => ({ fresh: 0, cached: 0, written: 0, output });
    const build = (model: string, turns: number, outputs: Record<string, number>) => ({
      models: [], labs: [], series: [], sources: [], benchmarks: [{ id: "t3-usage-share" }, { id: "t3-turn-time" }],
      variants: Object.keys(outputs).map((effort, i) => ({ id: `${model}@${effort}`, modelId: model, effort, ...(i ? {} : { sourceModel: { metadata: { price1mInputTokens: 1, price1mOutputTokens: 10 } } }) })),
      observations: [
        ...Object.entries(outputs).map(([effort, output]) => ({ benchmarkId: "t3-turn-time", variantId: `${model}@${effort}`, value: 1, durationSec: 60, details: { users: 9, turns, tokenTurns: turns, tokenUsers: 9, perTurn: tokens(output) } })),
        { benchmarkId: "t3-usage-share", variantId: `${model}@default`, value: 1, costUsd: 1, durationSec: 60 },
      ],
    }) as unknown as Snapshot;
    const timeRows = (s: Snapshot) => s.observations.filter((o) => o.benchmarkId === "t3-turn-time").length;
    it("holds a model with little data, keeping its usage share but not the time or cost on it", () => {
      const s = build("new", 500, { low: 1000, high: 3000, max: 2000 });
      expect(applyT3Costs(s).held).toEqual(["new"]);
      expect(timeRows(s)).toBe(0);
      expect(s.observations.filter((o) => o.benchmarkId === "t3-cost-per-turn")).toEqual([]);
      const usage = s.observations.find((o) => o.benchmarkId === "t3-usage-share");
      expect(usage).toMatchObject({ value: 1 });
      expect(usage?.costUsd).toBeUndefined();
      expect(usage?.durationSec).toBeUndefined();
    });
    it("publishes thin data once cost rises with every effort", () => {
      const s = build("new", 500, { low: 1000, high: 2000, max: 3000 });
      expect(applyT3Costs(s).held).toEqual([]);
      expect(timeRows(s)).toBe(3);
    });
    it("publishes a model past the data line even when its efforts do not line up", () => {
      const s = build("big", SETTLED_TURNS / 3 + 1, { low: 1000, high: 3000, max: 2000 });
      expect(applyT3Costs(s).held).toEqual([]);
      expect(timeRows(s)).toBe(3);
    });
    it("compares efforts within one configuration, not across them", () => {
      const s = build("new", 500, { low: 1000, high: 2000 });
      s.variants.push({ id: "new@low~pro", modelId: "new", effort: "low", configuration: "pro" } as never, { id: "new@high~pro", modelId: "new", effort: "high", configuration: "pro" } as never);
      s.observations.push(...[["low", 5000], ["high", 6000]].map(([e, output]) => ({ benchmarkId: "t3-turn-time", variantId: `new@${e}~pro`, value: 1, details: { users: 9, turns: 500, perTurn: tokens(output as number) } }) as never));
      expect(applyT3Costs(s).held).toEqual([]);
    });
    it("never holds Gemini", () => {
      const s = build("gemini-9", 500, { low: 3000, high: 1000 });
      expect(applyT3Costs(s).held).toEqual([]);
      expect(timeRows(s)).toBe(2);
    });
  });
});
