import type { Benchmark, BenchmarkCategory } from "../types";

/** `c`: every category the benchmark sits in, main one first. `d`: its description; absent keeps the source's own. */
export interface Entry { c: BenchmarkCategory[]; d?: string }
/** A family of benchmarks whose ids share a pattern (category slices, dated editions). First match wins, after exact ids. */
export interface Rule { match: RegExp; c: BenchmarkCategory[] | ((b: Benchmark) => BenchmarkCategory[]); d?: (b: Benchmark) => string }
