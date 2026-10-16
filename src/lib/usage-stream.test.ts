import { describe, expect, it } from "vitest";
import { usageData, usageStack } from "./usage-stream";
import type { Snapshot } from "@/data/types";

const obs = (variantId: string, daily: number[], dayTotals: number[]) => ({ benchmarkId: "t3-usage-share", variantId, value: 1, observedAt: "", sourceUrl: "", details: { start: "2026-09-01", daily, dayTotals, window: "2026-09-01 to 2026-09-04" } });
const snapshot = {
  models: [{ id: "a", name: "Alpha", labId: "x" }, { id: "b", name: "Beta", labId: "y" }, { id: "c", name: "Gamma", labId: "x" }],
  variants: [{ id: "a@max", modelId: "a" }, { id: "b@high", modelId: "b" }, { id: "c@low", modelId: "c" }],
  observations: [obs("a@max", [10, 20, 30, 40], [100, 100, 100, 100]), obs("b@high", [60, 50, 40, 30], [100, 100, 100, 100]), obs("c@low", [5, 5, 5, 5], [100, 100, 100, 100]), { benchmarkId: "other", variantId: "a@max", value: 1, observedAt: "", sourceUrl: "" }],
} as unknown as Snapshot;

describe("usage over time", () => {
  const data = usageData(snapshot)!;
  it("reads each model's days and orders models by turns", () => {
    expect(data.days).toEqual(["2026-09-01", "2026-09-02", "2026-09-03", "2026-09-04"]);
    expect(data.models.map((m) => m.name)).toEqual(["Beta", "Alpha", "Gamma"]);
    expect(data.models[0].total).toBe(180);
  });
  it("is null without a daily series", () => {
    expect(usageData({ ...snapshot, observations: [] } as Snapshot)).toBeNull();
  });
  it("stacks shares of every day's turns, with everything else as Other", () => {
    const { series, rows } = usageStack(data, 2);
    expect(series.map((s) => s.name)).toEqual(["Beta", "Alpha", "Other"]);
    expect(series[2].share).toEqual([30, 30, 30, 30]);
    for (let i = 0; i < 4; i++) expect(series.reduce((s, x) => s + x.share[i], 0)).toBeCloseTo(100);
    expect(rows[0]).toMatchObject({ name: "Beta", perDay: 45, share: 45 });
    expect(rows[1].change).toBeGreaterThan(0);
    expect(rows[0].change).toBeLessThan(0);
  });
});
