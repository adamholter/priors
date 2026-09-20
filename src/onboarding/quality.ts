import type { Benchmark, Snapshot } from "../data/types";

export interface BenchmarkQuality {
  id: string;
  name: string;
  score: number;
  recency: number;
  saturation: number;
  objectivity: number;
  preferred: boolean;
  releaseDate?: string;
  dateConfidence: "verified" | "unknown";
  reason: string;
  sourceUrl: string;
  coverage: number;
}

const PREFERRED = new Set([
  "deepswe-1.1",
  "terminalbench-4",
  "arc-agi-3",
  "simplebench",
  "bsbench-v2",
  "aa-humanitys-last-exam",
  "aa-omniscience",
  "frontiermath-tier-4-v2",
]);

/** Dates here are benchmark releases verified from the linked publisher, not scrape/update dates. */
const RELEASES: Record<string, { date: string; url: string }> = {
  "arc-agi-3": { date: "2026-03-25", url: "https://arcprize.org/blog/arc-agi-3-launch" },
  "frontiermath-tier-4-v2": { date: "2026-06-12", url: "https://epoch.ai/benchmarks/frontiermath-tier-4-v2" },
  "aa-omniscience": { date: "2025-11-16", url: "https://artificialanalysis.ai/articles/aa-omniscience-knowledge-hallucination-benchmark" },
  "aa-humanitys-last-exam": { date: "2025-01-23", url: "https://arxiv.org/abs/2501.14249" },
};

const SOURCE_URLS: Record<string, string> = {
  "deepswe-1.1": "https://deepswe.datacurve.ai/",
  "terminalbench-4": "https://www.tbench.ai/",
  "arc-agi-3": "https://arcprize.org/blog/arc-agi-3-launch",
  simplebench: "https://simple-bench.com/",
  "bsbench-v2": "https://petergpt.github.io/bullshit-benchmark/viewer/index.v2.html",
  "aa-humanitys-last-exam": "https://arxiv.org/abs/2501.14249",
  "aa-omniscience": "https://artificialanalysis.ai/articles/aa-omniscience-knowledge-hallucination-benchmark",
  "frontiermath-tier-4-v2": "https://epoch.ai/benchmarks/frontiermath-tier-4-v2",
};

const OBJECTIVITY: Record<string, number> = {
  "deepswe-1.1": 96,
  "terminalbench-4": 92,
  "arc-agi-3": 90,
  simplebench: 86,
  "bsbench-v2": 65,
  "aa-humanitys-last-exam": 88,
  "aa-omniscience": 85,
  "frontiermath-tier-4-v2": 96,
};

const clamp = (n: number) => Math.max(0, Math.min(100, n));
const rounded = (n: number) => Math.round(clamp(n));

function recencyScore(snapshotDate: string, releaseDate?: string): number {
  if (!releaseDate) return 50;
  const ageDays = (Date.parse(snapshotDate) - Date.parse(releaseDate)) / 86_400_000;
  if (!Number.isFinite(ageDays)) return 50;
  // Full credit for the first 90 days, then linear decay to zero after two years.
  return rounded(100 - (Math.max(0, ageDays - 90) / 640) * 100);
}

function normalizedValue(benchmark: Benchmark, value: number): number | undefined {
  if (!Number.isFinite(value)) return undefined;
  if (benchmark.normalization?.kind === "linear") {
    const { min, max } = benchmark.normalization;
    if (max <= min) return undefined;
    const n = ((value - min) / (max - min)) * 100;
    return clamp(benchmark.higherIsBetter ? n : 100 - n);
  }
  if (benchmark.unit === "percent") return clamp(benchmark.higherIsBetter ? value : 100 - value);
  // AA-Omniscience has a documented -100..100 index. Do not infer ranges for arbitrary scores or Elo.
  if (benchmark.id === "aa-omniscience") return clamp((value + 100) / 2);
  return undefined;
}

function saturationScore(snapshot: Snapshot, benchmark: Benchmark): number {
  // Multiple effort/config rows for one model must not make the benchmark look more saturated.
  const byModel = new Map<string, number>();
  for (const observation of snapshot.observations) {
    if (observation.benchmarkId !== benchmark.id) continue;
    const modelId = snapshot.variants.find((v) => v.id === observation.variantId)?.modelId ?? observation.variantId.split("@")[0];
    const value = normalizedValue(benchmark, observation.value);
    if (value == null) continue;
    byModel.set(modelId, Math.max(value, byModel.get(modelId) ?? -Infinity));
  }
  const scores = [...byModel.values()].sort((a, b) => a - b);
  if (!scores.length) return 50;
  // Saturation concerns the frontier cluster. Scores at or below 50 retain full discrimination credit.
  const frontier = scores.slice(Math.floor(scores.length * 0.75));
  const frontierMean = frontier.reduce((sum, value) => sum + value, 0) / frontier.length;
  const headroom = 100 - frontierMean;
  const spread = scores.length > 1 ? scores.at(-1)! - scores[0] : 0;
  // Mostly reward remaining headroom, but reserve credit for observed separation. A flat floor is
  // difficult rather than discriminative, while a flat ceiling is both saturated and flat.
  const combined = headroom * 0.75 + spread * 0.25;
  return rounded(spread < 5 ? Math.min(combined, 35) : combined);
}

function objectivityScore(benchmark: Benchmark): number {
  const assigned = OBJECTIVITY[benchmark.id];
  if (assigned != null) return assigned;
  if (/arena|pairwise|human judge|llm judge/i.test(`${benchmark.name} ${benchmark.description}`)) return 40;
  if (benchmark.unit === "elo") return 45;
  return benchmark.unit === "percent" ? 80 : 65;
}

function coverageScore(snapshot: Snapshot, benchmarkId: string): number {
  const llms = new Set(snapshot.models.filter((m) => m.kind === "llm").map((m) => m.id));
  if (!llms.size) return 0;
  const covered = new Set<string>();
  for (const observation of snapshot.observations) {
    if (observation.benchmarkId !== benchmarkId) continue;
    const modelId = snapshot.variants.find((v) => v.id === observation.variantId)?.modelId ?? observation.variantId.split("@")[0];
    if (llms.has(modelId)) covered.add(modelId);
  }
  return rounded((covered.size / llms.size) * 100);
}

export function benchmarkQuality(snapshot: Snapshot): BenchmarkQuality[] {
  return snapshot.benchmarks.map((benchmark) => {
    const release = RELEASES[benchmark.id];
    const recency = recencyScore(snapshot.date, release?.date);
    const saturation = saturationScore(snapshot, benchmark);
    const objectivity = objectivityScore(benchmark);
    const score = rounded(recency * 0.3 + saturation * 0.4 + objectivity * 0.3);
    const dateConfidence = release ? "verified" as const : "unknown" as const;
    const reason = `${dateConfidence === "verified" ? `Released ${release.date}` : "Release date unverified; recency held neutral"}. Headroom and score-spread quality ${saturation}/100 after collapsing effort/config variants by model. Objectivity ${objectivity}/100 is an assigned judgment score based on grading method. Quality is a 30% recency, 40% headroom-and-spread, 30% objectivity heuristic, not proof of validity or freedom from training contamination.`;
    return {
      id: benchmark.id,
      name: benchmark.name,
      score,
      recency,
      saturation,
      objectivity,
      preferred: PREFERRED.has(benchmark.id),
      ...(release ? { releaseDate: release.date } : {}),
      dateConfidence,
      reason,
      sourceUrl: release?.url ?? SOURCE_URLS[benchmark.id] ?? benchmark.url,
      coverage: coverageScore(snapshot, benchmark.id),
    };
  });
}
