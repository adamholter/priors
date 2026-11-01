import { describe, expect, it } from "vitest";
import { metricChartOf } from "./benchmark-chart";
import type { BenchMetric } from "./benchmark-metrics";

const metric = (kind: BenchMetric["kind"], low: number, high: number) => ({ label: "Measure", kind, better: "lower", values: new Map([["a", low], ["b", high]]) }) as unknown as BenchMetric;

describe("metricChartOf", () => {
  it("starts durations linear, with the Log switch when the range suits it", () => {
    expect(metricChartOf(metric("seconds", 1, 100), "B")).toMatchObject({ scale: "linear", logOk: true, xName: "Measure" });
    expect(metricChartOf(metric("seconds", 1, 2), "B").logOk).toBeUndefined();
  });
  it("keeps other wide-ranging measures on log", () => {
    expect(metricChartOf(metric("usd", 1, 100), "B")).toMatchObject({ scale: "log", xName: "Measure (log)" });
  });
});
