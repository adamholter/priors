import type { RankedVariant } from "@/engine";
import type { MetricChart } from "./metrics";
import { formatMetric, type BenchMetric } from "./benchmark-metrics";

/** Look a metric up for a ranked row: exact variant, then the variant without its configuration suffix. */
export const valueFor = (m: BenchMetric, r: RankedVariant) => m.values.get(r.variant.id) ?? m.values.get(r.variant.id.split("~")[0]);

/** Score vs one of the benchmark's own measurements, in the shape the gallery charts take. */
export function metricChartOf(m: BenchMetric, benchmarkName: string): MetricChart {
  const all = [...m.values.values()];
  const positive = all.every((v) => v > 0);
  const log = positive && Math.max(...all) / Math.min(...all) >= 20;
  return {
    better: m.better,
    points: (rows) => rows.flatMap((r) => { const x = valueFor(m, r); return x != null && Number.isFinite(x) && (!log || x > 0) ? [{ x, r }] : []; }),
    xLabel: "",
    xName: `${m.label}${log ? " (log)" : ""}`,
    scale: log ? "log" : "linear",
    secs: m.kind === "seconds",
    formatX: (v) => formatMetric(m.kind, v),
    aria: `${benchmarkName} score versus ${m.label.toLowerCase()}`,
  };
}

