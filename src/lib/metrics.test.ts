import { describe, expect, it } from "vitest";
import type { RankedVariant } from "@/engine";
import type { Snapshot } from "@/data/types";
import { metricPanels, pickPoints, type MetricChart } from "./metrics";
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
