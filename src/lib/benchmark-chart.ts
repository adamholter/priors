import type { RankedVariant } from "@/engine";
import type { MetricChart } from "./metrics";
import { formatMetric, type BenchMetric } from "./benchmark-metrics";

/** Look a metric up for a ranked row: exact variant, then the variant without its configuration suffix. */
export const valueFor = (m: BenchMetric, r: RankedVariant) => m.values.get(r.variant.id) ?? m.values.get(r.variant.id.split("~")[0]);

/** Score vs one of the benchmark's own measurements, in the shape the gallery charts take. */
export function metricChartOf(m: BenchMetric, benchmarkName: string): MetricChart {
  const all = [...m.values.values()];
  const positive = all.every((v) => v > 0);
  // Waiting happens in linear time, so durations start linear even when the range would suit a log axis.
  const logOk = positive && Math.max(...all) / Math.min(...all) >= 20, log = logOk && m.kind !== "seconds";
  return {
    better: m.better,
    points: (rows) => rows.flatMap((r) => { const x = valueFor(m, r); return x != null && Number.isFinite(x) && (!logOk || x > 0) ? [{ x, r }] : []; }),
    xLabel: "",
    xName: `${m.label}${log ? " (log)" : ""}`,
    scale: log ? "log" : "linear", ...(logOk && !log ? { logOk } : {}),
    secs: m.kind === "seconds",
    formatX: (v) => formatMetric(m.kind, v),
    aria: `${benchmarkName} score versus ${m.label.toLowerCase()}`,
  };
}

