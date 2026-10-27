import type { Benchmark } from "@/data/types";

/** A benchmark's published value, the way its page and share card print it. Client-safe: no server imports. */
export function formatBenchValue(b: Pick<Benchmark, "unit">, v: number) {
  if (b.unit === "percent") return `${v.toFixed(1)}%`;
  if (b.unit === "usd") return `$${v >= 100 ? Math.round(v).toLocaleString("en-US") : v.toFixed(2)}`;
  if (b.unit === "seconds") return `${v.toFixed(v >= 10 ? 0 : 1)}s`;
  return v.toFixed(b.unit === "elo" ? 0 : 1);
}
