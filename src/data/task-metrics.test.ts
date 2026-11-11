import { describe, expect, it } from "vitest";
import { scatterSpec } from "@/lib/og-chart";
import type { Observation, Snapshot } from "./types";
import { aaTimeDescription, costDescription, MIX_COST_CAPTION, MIX_COST_DESCRIPTION, MIX_TIME_DESCRIPTION, taskMetricData, timeDescription } from "./task-metrics";
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

describe("task metric data", () => {
  it.each(["deepswe-1.1", "frontierswe-v2"] as const)("reads only %s's own measurements", (source) => {
    const s = { ...snapshot, observations: [...snapshot.observations,
      obs(source, "a@high", 80, { costUsd: 6, durationSec: 900 }),
      obs("deepswe-1", "b@high", 70, { costUsd: 100, durationSec: 500 }),
    ] };
    expect(taskMetricData(s, source, "time").get("a@low")).toBeUndefined();
    expect(taskMetricData(s, source, "time").get("a@high")?.value).toBe(900);
    expect(taskMetricData(s, source, "cost").modelCount).toBe(1);
    // A benchmark id is a data source for a benchmark page, never a stored choice: it has no link key.
    expect(decodeIndex(encodeIndex(config), "test")).not.toHaveProperty("timeSource");
  });
  it("counts unique models separately by metric, ignoring invalid data", () => {
    const s = { ...snapshot, observations: [...snapshot.observations, obs("terminalbench-4", "b@high", 60, { costUsd: NaN, durationSec: -1 })] };
    expect(taskMetricData(s, "terminalbench-4", "cost").modelCount).toBe(1);
    expect(taskMetricData(s, "terminalbench-4", "time").modelCount).toBe(1);
    expect(taskMetricData(s, "terminalbench-4", "time").get("a@low")).toBeUndefined();
  });
  it("reads Terminal-Bench 4.1's trials once the snapshot has them, and 4.0's before", () => {
    const tb41 = { ...snapshot.benchmarks[0], id: "terminalbench-4.1" };
    const s = { ...snapshot, benchmarks: [...snapshot.benchmarks, tb41], observations: [...snapshot.observations, obs("terminalbench-4.1", "b@high", 61, { costUsd: 5, durationSec: 700 })] };
    expect(taskMetricData(s, "terminalbench-4", "cost").get("b@high")?.value).toBe(5);
    expect(taskMetricData(s, "terminalbench-4", "cost").get("a@high")).toBeUndefined();
    expect(taskMetricData(snapshot, "terminalbench-4", "cost").get("a@high")?.value).toBe(8);
    // The blend reads the same board for a duration.
    expect(taskMetricData(s, "terminalbench-4", "time").get("b@high")?.value).toBe(700);
  });
  it("preserves the selected harness and exact effort without source fallback", () => {
    const data = taskMetricData(snapshot, "terminalbench-4", "cost");
    expect(data.get("a@high")?.value).toBe(8);
    expect(data.get("a@high~aa-config")).toBeUndefined();
    expect(data.get("a@max")).toBeUndefined();
    expect(data.get("b@high")).toBeUndefined();
  });
  it("accepts recorded legacy aliases while keeping actual configurations independent", () => {
    const s: Snapshot = { ...snapshot, variants: [
      { ...snapshot.variants[0], aliases: ["a@high~old-source-id"] },
      ...snapshot.variants.slice(1),
      { id: "a@high~no-fallback", modelId: "a", effort: "high", configuration: "no-fallback" },
    ], observations: [...snapshot.observations, obs("terminalbench-4", "a@high~no-fallback", 65, { costUsd: 3 })] };
    const data = taskMetricData(s, "terminalbench-4", "cost");
    expect(data.get("a@high~old-source-id")?.value).toBe(8);
    expect(data.get("a@high~no-fallback")?.value).toBe(3);
    expect(data.get("a@high~unmeasured-harness")).toBeUndefined();
  });
});

describe("cost per task", () => {
  it("prices a task from the mix's own benchmarks, never from a benchmark outside it", () => {
    // The mix is AA's index, whose components publish no cost here, so AA's index cost per task is the fallback.
    expect(computeIndex(snapshot, config).ranked.find((r) => r.variant.id === "a@high")?.costUsd).toBe(0.1);
    // Rank on Terminal-Bench instead and its own measured cost prices the task.
    const tb = computeIndex(snapshot, { ...config, weights: { "terminalbench-4": 100 } });
    expect(tb.ranked.find((r) => r.variant.id === "a@high")?.costUsd).toBe(8);
    // b has no Terminal-Bench run, so it has no cost rather than borrowing AA's.
    expect(tb.ranked.find((r) => r.variant.id === "b@high")?.costUsd).toBeUndefined();
  });
  it("falls back to AA's index cost per task when the mix publishes none", () => {
    const s = { ...snapshot, observations: snapshot.observations.map((o) => o.benchmarkId === "aa-intelligence-index-v4" ? { ...o, sourceModelId: "aa-model", costUsd: 3 } : o) };
    expect(computeIndex(s, config).ranked[0].costUsd).toBe(3);
    // A mix of a benchmark with no cost keeps the fallback.
    expect(computeIndex(s, { ...config, weights: { "aa-intelligence-index-v4": 100 } }).ranked[0].costUsd).toBe(3);
  });
  it("names the blend in a row's caption, and AA's index figure when it stands in", () => {
    const s = { ...snapshot, observations: snapshot.observations.map((o) => o.benchmarkId === "aa-intelligence-index-v4" ? { ...o, costUsd: 3 } : o) };
    const blended = computeIndex(s, { ...config, weights: { "aa-intelligence-index-v4": 100 } }).ranked.find((r) => r.variant.id === "a@high")!;
    expect(blended.costUsd).toBe(3);
    expect(blended.costSource).toBe(MIX_COST_CAPTION);
    expect(costDescription("api")).toBe(MIX_COST_DESCRIPTION);
    expect(costDescription("subscription")).toContain("priced by subscription");
    // A benchmark page prices its own benchmark instead of the blend.
    expect(costDescription("api", { name: "FrontierCode 2.0-AA" })).toBe("FrontierCode 2.0-AA · measured cost per task");
  });
});

describe("time per task", () => {
  it("blends the mix's own measured run durations, weighted by share", () => {
    const s: Snapshot = { ...snapshot, observations: [...snapshot.observations,
      obs("aa-frontiercode-2-0", "a@high", 48, { durationSec: 600 }),
      obs("aa-briefcase", "a@high", 1800, { durationSec: 1200 }),
    ], benchmarks: [...snapshot.benchmarks,
      { id: "aa-frontiercode-2-0", name: "FrontierCode 2.0-AA", sourceId: "aa", url: "", description: "", unit: "percent", higherIsBetter: true, category: "coding" },
      { id: "aa-briefcase", name: "AA-Briefcase v1.1", sourceId: "aa", url: "", description: "", unit: "elo", higherIsBetter: true, category: "agentic" },
    ] };
    const time = (weights: Record<string, number>) => computeIndex(s, { ...config, weights }).ranked.find((r) => r.variant.id === "a@high")!;
    expect(time({ "aa-frontiercode-2-0": 100 }).timeSec).toBe(600);
    expect(time({ "aa-frontiercode-2-0": 50, "aa-briefcase": 50 }).timeSec).toBeCloseTo(900, 6);
    // No duration: left out and the rest renormalized, not dragged back to AA's.
    expect(time({ "aa-frontiercode-2-0": 50, "aa-intelligence-index-v4": 50 }).timeSec).toBe(600);
    expect(time({ "aa-frontiercode-2-0": 50, "terminalbench-4": 50 }).timeSec).toBeCloseTo((600 + 1200) / 2, 6);
    expect(time({ "aa-frontiercode-2-0": 100 }).timeSource).toMatch(/^Weighted by this mix, from each benchmark's own measured run duration/);
    expect(time({ "aa-frontiercode-2-0": 100 }).timeComputed).toBe(false);
    expect(computeIndex(s, { ...config, weights: { "terminalbench-4": 100 } }, { timeBenchmark: "terminalbench-4" }).ranked.find((r) => r.variant.id === "a@high")!.timeSec).toBe(1200);
  });
  it("falls back to AA's computed time per task when the mix publishes no duration", () => {
    const ranked = computeIndex(snapshot, config).ranked;
    expect(ranked.find((r) => r.variant.id === "a@high")?.timeSec).toBe(25);
    expect(ranked.find((r) => r.variant.id === "a@high")?.timeComputed).toBe(true);
    expect(ranked.find((r) => r.variant.id === "a@high")?.timeSource).toMatch(/estimated decode time per Intelligence Index task/);
    // No duration and no AA figure: no time, rather than borrowing another benchmark's.
    expect(computeIndex(snapshot, { ...config, weights: { "terminalbench-4": 100 } }).ranked.find((r) => r.variant.id === "b@high")?.timeSec).toBeUndefined();
  });
  it("draws the blend on the time per task chart, and the fallback when the mix has none", () => {
    const blended: Snapshot = { ...snapshot, observations: snapshot.observations.map((o) => o.benchmarkId === "terminalbench-4" ? { ...o, durationSec: 1200 } : o) };
    const tb = computeIndex(blended, { ...config, weights: { "terminalbench-4": 100 } });
    expect(metricPanels(blended, tb.ranked)[0].chart?.points(tb.ranked).map((p) => p.x)).toEqual([1200, 1200]);
    expect(metricPanels(blended, tb.ranked)[0].desc).toMatch(/^Each benchmark in the mix at its own measured run duration/);
    const aa = computeIndex(snapshot, config);
    expect(metricPanels(snapshot, aa.ranked)[0].chart?.points(aa.ranked).map((p) => p.x)).toEqual([25, 30]);
    // This fixture predates the Nov 4 method change, so the caption keeps that snapshot's wording.
    expect(metricPanels(snapshot, aa.ranked)[0].desc).toMatch(/estimated decode time per Intelligence Index task/);
    expect(metricPanels(snapshot, []).length).toBeGreaterThan(0);
  });
  it("starts time per task on a linear axis with the Log switch available; a linked card can ask for log", () => {
    const ranked = computeIndex(snapshot, config).ranked, chart = metricPanels(snapshot, ranked)[0].chart!;
    expect(chart).toMatchObject({ scale: "linear", logOk: true });
    expect(scatterSpec(snapshot, ranked, config, "time-per-task")?.chart.scale).toBe("linear");
    expect(scatterSpec(snapshot, ranked, config, "time-per-task", "all", "log")?.chart.scale).toBe("log");
    expect(scatterSpec(snapshot, ranked, config, "cost")?.chart.scale).toBe("log");
  });
  it("says which measurement it drew: the blend, AA's computed decode time, or both", () => {
    expect(timeDescription("2026-11-05")).toBe(aaTimeDescription("2026-11-05"));
    expect(timeDescription("2026-11-05", true)).toBe(MIX_TIME_DESCRIPTION);
    // Mixed: the blend, and the fallback it used for the models without a duration.
    expect(timeDescription("2026-11-05", true, true)).toContain("no measured duration");
    expect(timeDescription("2026-11-05", true, true)).not.toBe(MIX_TIME_DESCRIPTION);
    expect(aaTimeDescription("2026-11-03")).toContain("excluding first-token wait");
  });
  it("captions a mixed chart honestly: some rows measured, some AA's computed figure", () => {
    // FrontierCode publishes a duration for a@high only, AA's index a computed figure for both: one chart, two measurements.
    const s: Snapshot = { ...snapshot, observations: [...snapshot.observations,
      obs("aa-frontiercode-2-0", "a@high", 48, { durationSec: 600 }),
    ], benchmarks: [...snapshot.benchmarks,
      { id: "aa-frontiercode-2-0", name: "FrontierCode 2.0-AA", sourceId: "aa", url: "", description: "", unit: "percent", higherIsBetter: true, category: "coding" },
    ] };
    const r = computeIndex(s, { ...config, weights: { "aa-frontiercode-2-0": 50, "aa-intelligence-index-v4": 50 } });
    const measured = r.ranked.filter((x) => x.timeSec != null && !x.timeComputed), computed = r.ranked.filter((x) => x.timeComputed);
    expect(measured.length).toBeGreaterThan(0);
    expect(computed.length).toBeGreaterThan(0);
    expect(metricPanels(s, r.ranked)[0].desc).toContain("no measured duration");
  });
});

describe("retired source keys", () => {
  it("still decodes a link that carries one, and ignores it", () => {
    // `costsrc` and `timesrc` are retired: cost and time are the mix's own blend. Old links still decode.
    const legacy = decodeIndex(encodeIndex(config) + "|costsrc=terminalbench-4|timesrc=deepswe-1.1", "test")!;
    expect(legacy).not.toHaveProperty("costSource");
    expect(legacy).not.toHaveProperty("timeSource");
    expect(encodeIndex(legacy)).not.toContain("costsrc");
    expect(encodeIndex(legacy)).not.toContain("timesrc");
    const now = computeIndex(snapshot, legacy).ranked.find((r) => r.variant.id === "a@high")!;
    const plain = computeIndex(snapshot, config).ranked.find((r) => r.variant.id === "a@high")!;
    expect(now.costUsd).toBe(plain.costUsd);
    expect(now.timeSec).toBe(plain.timeSec);
  });
});

/** AA's index cost per task, plus two of its evaluations publishing their own: the shape the per-evaluation blend reads. */
const withAaEvals: Snapshot = {
  ...snapshot,
  benchmarks: [
    ...snapshot.benchmarks,
    { id: "aa-intelligence-index-v5.0", name: "AA Intelligence Index v5.0", sourceId: "aa", url: "", description: "", unit: "score", higherIsBetter: true, category: "composite", components: { "aa-frontiercode-2-0": 15, "aa-briefcase": 15 } },
    { id: "aa-frontiercode-2-0", name: "FrontierCode 2.0-AA", sourceId: "aa", url: "", description: "", unit: "percent", higherIsBetter: true, category: "coding" },
    { id: "aa-briefcase", name: "AA-Briefcase v1.1", sourceId: "aa", url: "", description: "", unit: "elo", higherIsBetter: true, category: "agentic" },
    { id: "aa-price-blended", name: "Blended Price", sourceId: "aa", url: "", description: "", unit: "usd", higherIsBetter: false, category: "cost", proxy: true },
    { id: "aa-cost-per-task-index", name: "AA Intelligence Index Cost per Task", sourceId: "aa", url: "", description: "", unit: "usd", higherIsBetter: false, category: "cost" },
  ],
  observations: [
    ...snapshot.observations,
    obs("aa-frontiercode-2-0", "a@high", 48, { costUsd: 43.4, harness: "Stirrup" }),
    obs("aa-briefcase", "a@high", 1800, { costUsd: 59.4 }),
    obs("aa-price-blended", "a@high", 12),
  ],
};

describe("Artificial Analysis' evaluations as a mix", () => {
  it("blends whatever the mix publishes, from any publisher and without a source model id", () => {
    // ARC Prize, FrontierCode, WeirdML, Zapier and Roboflow publish a cost without a `sourceModelId`.
    const cost = (weights: Record<string, number>) => computeIndex(withAaEvals, { ...config, weights }).ranked.find((r) => r.variant.id === "a@high")!;
    expect(cost({ "aa-frontiercode-2-0": 100 }).costUsd).toBe(43.4);
    expect(cost({ "aa-frontiercode-2-0": 50, "aa-briefcase": 50 }).costUsd).toBeCloseTo((43.4 + 59.4) / 2, 6);
    expect(cost({ "aa-frontiercode-2-0": 50, "terminalbench-4": 50 }).costUsd).toBeCloseTo((43.4 + 8) / 2, 6);
    // No cost: left out and the rest renormalized (AA's index publishes none in this fixture).
    expect(cost({ "aa-frontiercode-2-0": 50, "aa-intelligence-index-v4": 50 }).costUsd).toBe(43.4);
  });
  it("falls back to AA's published cost per task when nothing in the mix publishes one", () => {
    // AA's index carries scores but no cost here, so its own cost per task stands in unchanged.
    const row = computeIndex(withAaEvals, { ...config, weights: { "aa-intelligence-index-v4": 100 } }).ranked.find((r) => r.variant.id === "a@high")!;
    expect(row.costUsd).toBe(0.1);
    expect(row.costSource).toBe(MIX_COST_DESCRIPTION);
  });
});
