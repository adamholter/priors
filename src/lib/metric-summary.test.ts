import { describe, expect, it } from "vitest";
import type { RankedVariant } from "@/engine";
import type { Snapshot } from "@/data/types";
import type { RadarModel } from "@/components/chart/radar-data";
import { axisOf, contendersOf, dateText, metricSummary, topRanked, type MetricSource, type Summary } from "./metric-summary";
import { frontier, nearestMark, placeMarks, radarPath } from "./metric-thumbs";
import type { MetricChart } from "./metrics";

const rv = (model: string, variant: string, score: number, metric?: number) =>
  ({ model: { id: model, name: model, labId: `lab-${model}` }, variant: { id: variant, effort: variant.split("@")[1] ?? "default" }, score, metric }) as unknown as RankedVariant;
const snapshot = { date: "2026-11-26" } as Snapshot;
const chart = (better: "lower" | "higher", extra: Partial<MetricChart> = {}): MetricChart => ({
  better, xLabel: "", xName: "", aria: "", formatX: (v) => `${v}s`,
  points: (rows) => rows.flatMap((r) => ((r as unknown as { metric?: number }).metric != null ? [{ x: (r as unknown as { metric: number }).metric, r }] : [])),
  ...extra,
});
const src = (id: string, c: MetricChart, rows: RankedVariant[]): MetricSource => ({ id, title: id, chart: c, rows });

describe("contendersOf", () => {
  it("keeps the n models with the highest best-effort score", () => {
    const rows = [rv("a", "a@low", 50), rv("a", "a@max", 70), rv("b", "b@max", 60), rv("c", "c@max", 55)];
    expect([...contendersOf(rows, 2)].sort()).toEqual(["a", "b"]);
  });
});

describe("dateText", () => {
  const ref = Date.UTC(2026, 10, 26);
  it("names month and day, adding the year past a year back", () => {
    expect(dateText(Date.UTC(2026, 10, 18), ref)).toBe("Nov 18");
    expect(dateText(Date.UTC(2025, 5, 1), ref)).toBe("Jun 1, 2025");
  });
});

describe("metricSummary", () => {
  const rows = [rv("tiny", "tiny@max", 20, 0.39), rv("top", "top@max", 70, 2.02), rv("mid", "mid@max", 60, 3), rv("slow", "slow@max", 40, 9)];
  const contenders = new Set(["top", "mid"]);
  it("answers with the best of the top models, not of all models", () => {
    const s = metricSummary(src("latency", chart("lower"), rows), "best", snapshot, contenders)!;
    expect(s.answer).toMatchObject({ modelId: "top", text: "2.02s", qual: "to first token" });
    expect(s.marks.map((m) => m.modelId)).toEqual(["tiny", "top", "mid", "slow"]);
    expect(s.n).toBe(4);
  });
  it("orders higher-is-better metrics best first and keeps the unit", () => {
    const s = metricSummary(src("speed", chart("higher"), rows), "best", snapshot, contenders)!;
    expect(s.marks.map((m) => m.modelId)).toEqual(["slow", "mid", "top", "tiny"]);
    expect(s.answer?.modelId).toBe("mid");
    expect(s.answer?.unit).toBe("tok/s");
  });
  it("lists the newest release first and formats it as a date", () => {
    const dated = [rv("old", "old@max", 50, Date.UTC(2026, 0, 5)), rv("new", "new@max", 55, Date.UTC(2026, 10, 18))];
    const s = metricSummary(src("date", chart("lower"), dated), "best", snapshot, new Set(["old", "new"]))!;
    expect(s.marks.map((m) => m.modelId)).toEqual(["new", "old"]);
    expect(s.answer?.text).toBe("Nov 18");
  });
  it("falls back to the first mark when no top model has data, and null without a chart", () => {
    expect(metricSummary(src("latency", chart("lower"), rows), "best", snapshot, new Set(["nobody"]))!.answer?.modelId).toBe("tiny");
    expect(metricSummary({ id: "strengths", title: "Strengths", rows }, "best", snapshot, contenders)).toBeNull();
  });
  it("all mode keeps every effort, best mode one mark per model", () => {
    const efforts = [rv("top", "top@high", 70, 2), rv("top", "top@low", 60, 1)];
    expect(metricSummary(src("latency", chart("lower"), efforts), "all", snapshot, contenders)!.marks).toHaveLength(2);
    const best = metricSummary(src("latency", chart("lower"), efforts), "best", snapshot, contenders)!;
    expect(best.marks).toHaveLength(1);
    expect(best.byModel.size).toBe(1);
  });
  it("handles a metric nobody has", () => {
    const s = metricSummary(src("latency", chart("lower"), []), "best", snapshot, contenders)!;
    expect(s).toMatchObject({ answer: null, n: 0, lo: 0, hi: 1 });
  });
});

describe("axisOf", () => {
  it("places values along linear and log axes, and centres a single value", () => {
    expect(axisOf({ scale: "linear", lo: 0, hi: 10 })(2.5)).toBeCloseTo(0.25);
    expect(axisOf({ scale: "log", lo: 1, hi: 100 })(10)).toBeCloseTo(0.5);
    expect(axisOf({ scale: "linear", lo: 3, hi: 3 })(3)).toBe(0.5);
  });
});

describe("topRanked", () => {
  it("is the three best ranked models, whatever order they come in", () => {
    const m = (id: string, rank: number) => ({ id, rank }) as RadarModel;
    expect(topRanked([m("d", 4), m("b", 2), m("a", 1), m("c", 3)]).map((x) => x.id)).toEqual(["a", "b", "c"]);
    expect(topRanked([m("a", 1)]).map((x) => x.id)).toEqual(["a"]);
  });
});

describe("thumbnail geometry", () => {
  const rows = [rv("top", "top@max", 70, 2), rv("mid", "mid@max", 60, 4), rv("low", "low@max", 40, 8)];
  const sum = (id: string, c: MetricChart): Summary => metricSummary(src(id, c, rows), "best", snapshot, new Set(["top", "mid"]))!;
  it("draws bars best first, inside the box, never shorter than the minimum", () => {
    const s = sum("latency", chart("lower", { scale: "log" })), placed = placeMarks(s, 200, 100);
    expect(placed.map((p) => p.m.modelId)).toEqual(["top", "mid", "low"]);
    for (const p of placed) { expect(p.x + (p.bw ?? 0) / 2).toBeLessThanOrEqual(200); expect(p.bh).toBeGreaterThanOrEqual(4); }
  });
  it("plots a scatter with the best score at the top", () => {
    const placed = placeMarks(sum("tpt", chart("lower")), 200, 100);
    expect(placed.find((p) => p.m.modelId === "top")!.y).toBeLessThan(placed.find((p) => p.m.modelId === "low")!.y);
  });
  it("snaps the pointer to the nearest bar and ignores far-off pointers", () => {
    const s = sum("latency", chart("lower", { scale: "log" })), placed = placeMarks(s, 200, 100);
    const target = placed[1];
    expect(nearestMark(placed, "bars", target.x, target.y + 10, 100)?.modelId).toBe("mid");
    expect(nearestMark(placed, "bars", target.x, 0, 100)).toBeNull();
    expect(nearestMark([], "scatter", 5, 5, 100)).toBeNull();
  });
  it("keeps the points no other point beats on both axes in the frontier", () => {
    const s = sum("tpt", chart("lower")), placed = placeMarks(s, 200, 100);
    expect(frontier(placed).map((p) => p.m.modelId)).toEqual(["top"]);
  });
  it("builds a radar polygon with a point per spoke and a floor for missing values", () => {
    const pts = radarPath([{ r: 1 }, { r: null }, { r: 0.5 }], 50, 50, 40).split(" ");
    expect(pts).toHaveLength(3);
    expect(pts[0]).toBe("50.0,10.0");
  });
});
