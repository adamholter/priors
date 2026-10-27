import { describe, expect, it } from "vitest";
import type { Benchmark, Observation, Snapshot } from "@/data/types";
import { benchmarkMetrics, benchmarkRelatives, benchmarkSeries, formatMetric } from "./benchmark-metrics";

const bench = (id: string, extra: Partial<Benchmark> = {}) => ({ id, name: id, sourceId: "s", url: "", description: "", unit: "percent", higherIsBetter: true, category: "coding", ...extra }) as unknown as Benchmark;
const obs = (benchmarkId: string, variantId: string, value: number, extra: Partial<Observation> = {}) => ({ benchmarkId, variantId, value, sourceUrl: "", observedAt: "", ...extra }) as Observation;
const snap = (observations: Observation[], benchmarks: Benchmark[], series: Snapshot["series"] = []) => ({ observations, benchmarks, series, variants: [], models: [], labs: [] }) as unknown as Snapshot;

describe("benchmarkMetrics", () => {
  it("finds the standard per-task measurements a source publishes (DeepSWE steps, time, tokens)", () => {
    const s = snap([1, 2, 3].map((i) => obs("deepswe", `m${i}@high`, 50 + i, { steps: 20 + i, durationSec: 600 * i, outputTokens: 1e4 * i })), [bench("deepswe")]);
    const m = benchmarkMetrics(s, s.benchmarks[0]);
    expect(m.standard.map((x) => x.id)).toEqual(["steps", "durationSec", "outputTokens"]);
    expect(m.standard[0].values.get("m2@high")).toBe(22);
    expect(m.standard.every((x) => x.better === "lower")).toBe(true);
  });

  it("flattens details into metrics and groups siblings into breakdowns, skipping settings and repeats of the score", () => {
    const rows = [
      { v: 1, d: { tiers: { Everyday: 15, Notes: 8 }, correct: 44, wrong: 55, temperature: 1, elo: 1 } },
      { v: 2, d: { tiers: { Everyday: 10, Notes: 9 }, correct: 40, wrong: 60, temperature: 1, elo: 2 } },
      { v: 3, d: { tiers: { Everyday: 12, Notes: 3 }, correct: 30, wrong: 70, temperature: 1, elo: 3 } },
    ];
    const s = snap(rows.map((r, i) => obs("hearing", `m${i}@default`, r.v, { details: r.d })), [bench("hearing")]);
    const m = benchmarkMetrics(s, s.benchmarks[0]);
    const ids = m.details.map((x) => x.id);
    expect(ids).toContain("d:tiers.Everyday");
    expect(ids).not.toContain("d:temperature");
    expect(ids).not.toContain("d:elo");
    expect(m.details.find((x) => x.id === "d:wrong")?.better).toBe("lower");
    expect(m.groups.map((g) => g.label)).toEqual(expect.arrayContaining(["Tiers", "Breakdown"]));
  });

  it("names top-level subsets from the benchmark's advanced list (Vals categories)", () => {
    const s = snap([1, 2, 3].map((i) => obs("vals-mgsm", `m${i}@default`, 80 + i, { details: { mgsm_en: 90 + i, mgsm_ja: 70 + 2 * i } })), [bench("vals-mgsm", { advanced: [{ id: "mgsm_en", name: "English" }, { id: "mgsm_ja", name: "Japanese" }] })]);
    const m = benchmarkMetrics(s, s.benchmarks[0]);
    expect(m.groups[0]).toMatchObject({ label: "Subsets" });
    expect(m.groups[0].metrics.map((x) => x.label)).toEqual(["English", "Japanese"]);
  });
});

describe("benchmarkSeries", () => {
  it("reads scraped series and per-model day lists, ignoring lists shared by every model", () => {
    const s = snap([
      obs("t3", "a@default", 1, { details: { daily: [1, 2, 3, 4, 5], dayTotals: [9, 9, 9, 9, 9] } }),
      obs("t3", "b@default", 2, { details: { daily: [2, 2, 2, 2, 2], dayTotals: [9, 9, 9, 9, 9] } }),
    ], [bench("t3")], [{ benchmarkId: "vb", variantId: "a@default", x: [1, 2], y: [500, 510], xLabel: "Day", yLabel: "Money balance ($)", sourceUrl: "" }]);
    expect(benchmarkSeries(s, "t3").map((x) => x.id)).toEqual(["d:daily"]);
    expect(benchmarkSeries(s, "vb")[0]).toMatchObject({ xLabel: "Day", rows: [{ variantId: "a@default", y: [500, 510] }] });
  });
});

describe("benchmarkRelatives", () => {
  it("lists a board's category splits and its versions", () => {
    const s = snap([obs("arena-text", "a@d", 1), obs("arena-text-coding", "a@d", 1), obs("fc-2", "a@d", 1), obs("fc-1", "a@d", 1)], [
      bench("arena-text"), bench("arena-text-coding", { variantOf: "arena-text", variantLabel: "Coding" }), bench("arena-text-math", { variantOf: "arena-text", variantLabel: "Math" }),
      bench("fc-2", { versionPolicy: { kind: "fresh", supersedes: "fc-1" } }), bench("fc-1"),
    ]);
    expect(benchmarkRelatives(s, s.benchmarks[1]).family).toEqual([{ id: "arena-text", label: "Overall" }, { id: "arena-text-coding", label: "Coding" }]);
    expect(benchmarkRelatives(s, s.benchmarks[4]).versions.map((v) => v.id)).toEqual(["fc-2", "fc-1"]);
    const d = snap([obs("deepswe-1.1", "a@d", 1), obs("deepswe-1", "a@d", 1)], [bench("deepswe-1.1", { versionPolicy: { kind: "fallback", fallbackTo: "deepswe-1" } }), bench("deepswe-1")]);
    expect(benchmarkRelatives(d, d.benchmarks[0]).versions.map((v) => v.id)).toEqual(["deepswe-1.1", "deepswe-1"]);
  });
});

describe("formatMetric", () => {
  it("formats by kind", () => {
    expect(formatMetric("seconds", 1132)).toBe("19 min");
    expect(formatMetric("tokens", 29557)).toBe("30k");
    expect(formatMetric("fraction", 0.612)).toBe("61%");
    expect(formatMetric("usd", 810.41)).toBe("$810");
  });
});
