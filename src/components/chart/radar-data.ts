import type { Benchmark, BenchmarkCategory } from "@/data/types";
import type { IndexResult, RankedVariant } from "@/engine";

type IndexBenchmarks = IndexResult["benchmarks"];

/** Radar needs at least three spokes to enclose an area. */
export const RADAR_MIN_AXES = 3;

/**
 * How a benchmark value maps to radius.
 * - field: min-max over every ranked model on that benchmark (worst in the field sits near the center).
 * - score: the engine's 0-100 value as-is (percent benchmarks are raw).
 * - rank: percentile among ranked models on that benchmark.
 */
export type RadarNorm = "field" | "score" | "rank";
const FLOOR = 0.1;

export interface RadarAxis { id: string; label: string; name: string; description: string; share: number; category: BenchmarkCategory; unit: Benchmark["unit"]; min: number; max: number; median: number }
export interface RadarPoint { r: number | null; value?: number; raw?: number; estimated: boolean }
export interface RadarModel { id: string; name: string; labId: string; score: number; rank: number; points: RadarPoint[] }

const CATEGORY_ORDER: BenchmarkCategory[] = ["coding", "agentic", "reasoning", "math", "long-context", "knowledge", "instruction", "economics", "creative", "safety", "composite", "reliability", "speed", "cost", "other"];

/** Spokes in category order so related benchmarks sit next to each other. */
export function radarAxes(benchmarks: IndexBenchmarks, rows: RankedVariant[]): RadarAxis[] {
  return benchmarks
    .map(({ benchmark, share }) => {
      const values = rows.map((r) => r.values.find((v) => v.benchmarkId === benchmark.id)?.value).filter((v): v is number => v != null).sort((a, b) => a - b);
      return {
        id: benchmark.id, name: benchmark.name, description: benchmark.description, label: benchmark.shortName ?? benchmark.name, share, category: benchmark.category, unit: benchmark.unit,
        min: values[0] ?? 0, max: values.at(-1) ?? 100, median: values.length ? values[Math.floor(values.length / 2)] : 50,
      };
    })
    .sort((a, b) => CATEGORY_ORDER.indexOf(a.category) - CATEGORY_ORDER.indexOf(b.category) || b.share - a.share);
}

export function normalize(value: number, axis: RadarAxis, norm: RadarNorm, pool: number[]): number {
  if (norm === "score") return Math.max(0, Math.min(1, value / 100));
  if (norm === "field") return axis.max === axis.min ? 1 : FLOOR + (1 - FLOOR) * (value - axis.min) / (axis.max - axis.min);
  const below = pool.filter((v) => v < value).length, ties = pool.filter((v) => v === value).length;
  return FLOOR + (1 - FLOOR) * (pool.length > 1 ? (below + (ties - 1) / 2) / (pool.length - 1) : 1);
}

export function radarModels(rows: RankedVariant[], axes: RadarAxis[], norm: RadarNorm): RadarModel[] {
  const pools = new Map(axes.map((a) => [a.id, rows.map((r) => r.values.find((v) => v.benchmarkId === a.id)?.value).filter((v): v is number => v != null)]));
  return rows.map((r) => ({
    id: r.model.id, name: r.model.name, labId: r.model.labId, score: r.score, rank: r.rank,
    points: axes.map((a) => {
      const v = r.values.find((x) => x.benchmarkId === a.id);
      if (!v) return { r: null, estimated: false };
      return { r: normalize(v.value, a, norm, pools.get(a.id)!), value: v.value, raw: v.raw, estimated: v.estimated };
    }),
  }));
}

export function medianPoints(rows: RankedVariant[], axes: RadarAxis[], norm: RadarNorm): RadarPoint[] {
  return axes.map((a) => {
    const pool = rows.map((r) => r.values.find((v) => v.benchmarkId === a.id)?.value).filter((v): v is number => v != null);
    return { r: normalize(a.median, a, norm, pool), value: a.median, estimated: false };
  });
}

/** Ring captions, outermost last. */
export function ringLabels(norm: RadarNorm): string[] {
  return norm === "score" ? ["25", "50", "75", "100"] : norm === "rank" ? ["p25", "p50", "p75", "top"] : ["", "", "", "best"];
}

export function formatValue(p: RadarPoint, axis: RadarAxis): string {
  if (p.value == null) return "no data";
  const raw = p.raw ?? p.value;
  if (axis.unit === "percent") return `${raw.toFixed(1)}%`;
  if (axis.unit === "usd") return `$${raw.toFixed(2)}`;
  if (axis.unit === "seconds") return `${raw.toFixed(0)}s`;
  return Math.abs(raw) >= 100 ? raw.toFixed(0) : raw.toFixed(1);
}
