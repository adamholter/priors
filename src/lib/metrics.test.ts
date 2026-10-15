import { describe, expect, it } from "vitest";
import type { RankedVariant } from "@/engine";
import type { Snapshot } from "@/data/types";
import { costChart, formatComputed, formulaChart, formulaInputs, metricPanels, pickPoints, type MetricChart } from "./metrics";
import { selectBars } from "../components/chart/bars-option";

const rv = (model: string, variant: string, score: number, metric?: number) =>
  ({ model: { id: model, name: model, labId: "lab" }, variant: { id: variant, effort: variant.split("@")[1] ?? "default" }, score, metric }) as unknown as RankedVariant;

const metricChart: MetricChart = {
  better: "lower",
  points: (rows) => rows.flatMap((r) => ((r as unknown as { metric?: number }).metric != null ? [{ x: (r as unknown as { metric: number }).metric, r }] : [])),
  xLabel: "s",
  xName: "Time per task (s)",
  formatX: (v) => `${v}s`,
  aria: "",
};

it("uses release chronology with the frontier off for gallery and preview definitions", () => {
  const ranked = [rv("older", "older@high", 65), rv("middle", "middle@high", 60), rv("newer", "newer@high", 70)].map((r, i) => ({ ...r, model: { ...r.model, releaseDate: `2026-0${i + 1}-01` } }));
  const snapshot: Snapshot = { version: 1, date: "2026-10-03", generatedAt: "2026-10-03T00:00:00Z", models: ranked.map(r => r.model), variants: ranked.map(r => r.variant), labs: [], benchmarks: [], observations: [], estimates: [], series: [], sources: [] };
  const chart = metricPanels(snapshot, ranked).find(p => p.id === "date")?.chart;
  expect(chart).toMatchObject({ better: "lower", scale: "time", defaultFrontier: false });
  expect(chart?.points(ranked).map(p => p.x)).toEqual([Date.UTC(2026, 0, 1), Date.UTC(2026, 1, 1), Date.UTC(2026, 2, 1)]);
});

describe("pickPoints", () => {
  const ranked = [
    rv("opus", "opus@max", 90),        // top effort lacks the metric
    rv("opus", "opus@high", 85, 40),   // best measured effort
    rv("opus", "opus@low", 70, 30),
    rv("sol", "sol@max", 80, 50),
  ];
  it("all mode returns every measured effort", () => {
    const pts = pickPoints(metricChart, ranked, "all");
    expect(pts.map((p) => p.r.variant.id).sort()).toEqual(["opus@high", "opus@low", "sol@max"]);
  });
  it("best mode keeps the model via its best effort that has the metric", () => {
    const pts = pickPoints(metricChart, ranked, "best");
    expect(pts.map((p) => p.r.variant.id).sort()).toEqual(["opus@high", "sol@max"]);
    expect(pts.find((p) => p.r.model.id === "opus")!.x).toBe(40);
  });
});

describe("selectBars", () => {
  it("does not collapse efforts of one model — all mode yields multiple bars per model", () => {
    const pts = [
      { x: 40, r: rv("opus", "opus@high", 85) },
      { x: 30, r: rv("opus", "opus@low", 70) },
      { x: 50, r: rv("sol", "sol@max", 80) },
    ];
    const bars = selectBars(pts, "lower", 24);
    expect(bars).toHaveLength(3);
    expect(bars.map((b) => b.x)).toEqual([30, 40, 50]); // sorted by metric value
  });
  it("caps by index score, then sorts by metric", () => {
    const pts = [
      { x: 1, r: rv("a", "a@x", 50) },
      { x: 2, r: rv("b", "b@x", 99) },
      { x: 3, r: rv("c", "c@x", 60) },
    ];
    const bars = selectBars(pts, "lower", 2);
    expect(bars.map((b) => b.r.model.id)).toEqual(["b", "c"]); // top-2 by score, drawn in metric order
  });
});

describe("custom formulas", () => {
  const variant = (id: string, score: number, costUsd?: number, speed?: number, releaseDate?: string) =>
    ({ model: { id: id.split("@")[0], name: id.split("@")[0], labId: "lab", releaseDate }, variant: { id, effort: id.split("@")[1] ?? "default" }, score, costUsd, speed }) as unknown as RankedVariant;
  const rows = [variant("a@high", 80, 4, 50, "2026-09-01"), variant("a@low", 60, 1, 100, "2026-09-01"), variant("b", 50, 0.5), variant("c", 40, undefined, 200)];
  const snapshot = { date: "2026-10-01", benchmarks: [], observations: [], variants: [] } as unknown as Snapshot;
  const base: MetricChart = { better: "lower", points: (r) => r.flatMap((x) => (x.costUsd ? [{ x: x.costUsd * 100, r: x }] : [])), xLabel: "", xName: "Cents", formatX: String, aria: "" };
  const build = (source: string) => { const c = formulaChart(base, source, "higher", formulaInputs(snapshot, rows), rows); if ("error" in c) throw new Error(c.error); return c; };

  it("offers only the variables this ranking has, and leaves off models missing an input", () => {
    expect(formulaInputs(snapshot, rows).get().variables.map((v) => v.name)).toEqual(["score", "cost", "speed", "age"]);
    const chart = build("score / cost");
    expect(chart.points(rows).map((p) => [p.r.variant.id, p.x])).toEqual([["a@high", 20], ["a@low", 60], ["b", 100]]);
    expect([chart.count, chart.total]).toEqual([2, 3]);
    expect(build("score * speed / age").points(rows).map((p) => p.r.variant.id)).toEqual(["a@high", "a@low"]);
  });
  it("reads the chart's own metric as `value`", () => {
    expect(build("value / 100 - cost").points(rows).map((p) => p.x)).toEqual([0, 0, 0]);
  });
  it("uses a log axis only for positive values with a wide spread", () => {
    expect(build("score / cost")).toMatchObject({ scale: "linear", logOk: true });
    expect(build("10 ^ (score / 20)")).toMatchObject({ scale: "log", logOk: true });
    expect(build("cost - 1")).toMatchObject({ scale: "linear", logOk: false });
  });
  it("reports formula errors and empty results", () => {
    expect(formulaChart(base, "score / nope", "higher", formulaInputs(snapshot, rows), rows)).toMatchObject({ error: expect.stringContaining("Unknown variable") });
    expect(build("score / (cost - cost)").count).toBe(0);
  });
  it("formats computed values of any size", () => {
    expect([0, 0.00001234, 0.0123, 1.5, 12.345, 403.2, 1234, 5_600_000, -42.5, 2e16].map(formatComputed)).toEqual(["0", "1.2e-5", "0.0123", "1.5", "12.3", "403", "1.23k", "5.6M", "-42.5", "2e16"]);
  });
});

it("puts free models on a floor left of the cheapest paid cost, since a log axis has no 0", () => {
  const rows = [rv("paid", "paid@high", 70), rv("cheap", "cheap@high", 60), rv("free", "free@max", 55), rv("unpriced", "unpriced@max", 50)];
  Object.assign(rows[0], { costUsd: 2 }); Object.assign(rows[1], { costUsd: 0.2 }); Object.assign(rows[2], { costUsd: 0 });
  const pts = costChart.points(rows);
  expect(pts.map((p) => p.r.model.id)).toEqual(["paid", "cheap", "free"]);
  expect(pts[2]).toMatchObject({ x: 0.05, raw: 0, free: true });
  expect(costChart.formatValue!(0)).toBe("free");
});
