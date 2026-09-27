import { describe, expect, it } from "vitest";
import type { Observation, Snapshot } from "./types";
import { taskMetricData, taskMetricOptions } from "./task-metrics";
import { computeIndex, defaultConfig } from "../engine";
import { decodeIndex, encodeIndex } from "../lib/url";
import { metricPanels } from "../lib/metrics";

const obs = (benchmarkId: string, variantId: string, value: number, extra: Partial<Observation> = {}): Observation => ({ benchmarkId, variantId, value, observedAt: "2026-09-27", sourceUrl: "https://example.com", ...extra });
const snapshot: Snapshot = {
  version: 1, date: "2026-09-27", generatedAt: "2026-09-27", labs: [], series: [], sources: [],
  models: ["a", "b"].map((id) => ({ id, name: id, labId: "test", kind: "llm", reasoning: true, aliases: [] })),
  variants: [{ id: "a@high", modelId: "a", effort: "high" }, { id: "a@low", modelId: "a", effort: "low" }, { id: "b@high", modelId: "b", effort: "high" }],
  benchmarks: ["terminalbench-4", "aa-cost-per-task-index", "aa-intelligence-index-v4"].map((id) => ({ id, name: id, sourceId: "test", url: "", description: "", unit: "percent", higherIsBetter: true, category: "agentic" })),
  observations: [
    obs("terminalbench-4", "a@high", 90, { costUsd: 8, durationSec: 1200, harness: "Agent A" }),
    obs("terminalbench-4", "a@high", 80, { costUsd: 20, durationSec: 4000, harness: "Agent B" }),
    obs("terminalbench-4", "a@low", 70, { costUsd: 2 }),
    obs("aa-cost-per-task-index", "a@high", 0.1), obs("aa-cost-per-task-index", "b@high", 0.2),
    obs("aa-intelligence-index-v4", "a@high", 80, { details: { estimatedDecodeSecondsPerTask: 25 } }),
    obs("aa-intelligence-index-v4", "b@high", 70, { details: { estimatedDecodeSecondsPerTask: 30 } }),
  ],
};
const config = { ...defaultConfig(snapshot), weights: { "aa-intelligence-index-v4": 1 }, strictness: 0, variants: "all" as const, releasedAfter: "" };

describe("task metric sources", () => {
  it.each(["deepswe-1.1", "frontierswe-v2"] as const)("uses only %s measurements and preserves selections", (source) => {
    const s = { ...snapshot, observations: [...snapshot.observations,
      obs(source, "a@high", 80, { costUsd: 6, durationSec: 900 }),
      obs("deepswe-1", "b@high", 70, { costUsd: 100, durationSec: 500 }),
    ] };
    const selected = { ...config, costSource: source, timeSource: source };
    const ranked = computeIndex(s, selected).ranked;
    expect(ranked.find((r) => r.variant.id === "a@high")?.costUsd).toBe(6);
    expect(ranked.find((r) => r.variant.id === "b@high")?.costUsd).toBeUndefined();
    expect(taskMetricData(s, source, "time").get("a@low")).toBeUndefined();
    expect(taskMetricData(s, source, "cost").modelCount).toBe(1);
    expect(metricPanels(s, ranked, source)[0].chart?.points(ranked).map((p) => p.x)).toEqual([900]);
    const restored = decodeIndex(encodeIndex(selected), "test")!;
    expect(restored.costSource).toBe(source);
    expect(restored.timeSource).toBe(source);
    expect(taskMetricOptions(s, "cost").some((o) => o.id.startsWith("vals"))).toBe(false);
  });
  it("counts unique models separately by metric, ignoring invalid data", () => {
    const s = { ...snapshot, observations: [...snapshot.observations, obs("terminalbench-4", "b@high", 60, { costUsd: NaN, durationSec: -1 })] };
    expect(taskMetricOptions(s, "cost").map((x) => x.modelCount)).toEqual([2, 1, 0, 0]);
    expect(taskMetricData(s, "terminalbench-4", "time").modelCount).toBe(1);
    expect(taskMetricData(s, "terminalbench-4", "time").get("a@low")).toBeUndefined();
  });
  it("preserves the selected harness and exact effort without source fallback", () => {
    const data = taskMetricData(snapshot, "terminalbench-4", "cost");
    expect(data.get("a@high")?.value).toBe(8);
    expect(data.get("a@high~aa-config")?.value).toBe(8);
    expect(data.get("a@max")).toBeUndefined();
    expect(data.get("b@high")).toBeUndefined();
  });
  it("switches cost without changing rankings or borrowing AA costs for missing TB models", () => {
    const aa = computeIndex(snapshot, config);
    const tb = computeIndex(snapshot, { ...config, costSource: "terminalbench-4" });
    expect(aa.ranked.map((r) => [r.variant.id, r.score])).toEqual(tb.ranked.map((r) => [r.variant.id, r.score]));
    expect(aa.ranked.find((r) => r.variant.id === "a@high")?.costUsd).toBe(0.1);
    expect(tb.ranked.find((r) => r.variant.id === "a@high")?.costUsd).toBe(8);
    expect(tb.ranked.find((r) => r.variant.id === "b@high")?.costUsd).toBeUndefined();
  });
  it("preserves AA mix-weighted costs without applying them to Terminal-Bench", () => {
    const s = { ...snapshot, observations: snapshot.observations.map((o) => o.benchmarkId === "aa-intelligence-index-v4" ? { ...o, sourceModelId: "aa-model", costUsd: 3 } : o) };
    expect(computeIndex(s, config).ranked[0].costUsd).toBe(3);
    expect(computeIndex(s, { ...config, costSource: "terminalbench-4" }).ranked[0].costUsd).toBe(8);
  });
  it("uses trial duration for TB and keeps the selector available for empty charts", () => {
    const ranked = computeIndex(snapshot, config).ranked;
    expect(metricPanels(snapshot, ranked, "terminalbench-4")[0].chart?.points(ranked).map((p) => p.x)).toEqual([1200]);
    expect(metricPanels(snapshot, [], "terminalbench-4")[0].id).toBe("tpt");
    expect(metricPanels(snapshot, ranked)[0].chart?.points(ranked).map((p) => p.x)).toEqual([25, 30]);
  });
  it("round trips independent choices and ignores unknown source IDs", () => {
    const c = { ...config, costSource: "terminalbench-4" as const, timeSource: "aa" as const };
    const restored = decodeIndex(encodeIndex(c), c.id)!;
    expect(restored.costSource).toBe("terminalbench-4");
    expect(restored.timeSource ?? "aa").toBe("aa");
    expect(decodeIndex(encodeIndex(config) + "|costsrc=bad|timesrc=bad", "test")?.costSource).toBeUndefined();
    expect(decodeIndex(encodeIndex({ ...config, timeSource: "terminalbench-4" }), "test")?.timeSource).toBe("terminalbench-4");
  });
});
