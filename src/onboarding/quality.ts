import type { Benchmark, Snapshot } from "../data/types";
import { factsOf, type TestSet } from "../data/benchmark-facts";
import { FAST_DAYS, SLOW_DAYS } from "../data/new-models";
import { focusMultiplier, type Focus } from "./focus";
import { defaultLineup } from "./defaults";

// AA's Terminal-Bench 4 run is preferred over tbench.ai's board: AA runs every new model on it, so fitted mixes that use it rank more models.
// HLE-Diamond replaces Humanity's Last Exam, as it did in AA's index v5.
export const PREFERRED = ["deepswe-1.1", "aa-terminalbench-v4-0", "arc-agi-3", "simplebench", "bsbench-v2", "aa-hle-diamond", "aa-omniscience", "frontiermath-tier-4-v2", "vals-programbench-v1"] as const;

export const FRONTIER_RELEASE_DATE = "2026-09-22";
/** The score's recipe: shares of each 0-100 part, then points added or taken away. The methodology page and every breakdown read these. */
export const QUALITY_WEIGHTS = { saturation: 0.25, testSet: 0.2, recency: 0.15, objectivity: 0.15, frontier: 0.15, breadth: 0.1 } as const;
export const QUALITY_ADJUST = { preferred: 15, superseded: -25, staleFrontier: -20 } as const;
/** What a test set's openness scores: a public set can be trained on, a private one cannot. Unknown is neutral. */
export const TEST_SET_SCORE = { private: 100, partial: 70, public: 30, unknown: 50 } as const;
/** A set that keeps replacing its questions resists training on the old ones, whatever is public. */
export const REFRESHED_SCORE = { private: 100, partial: 85, public: 65, unknown: 65 } as const;
/** Grading by method, where no hand-assigned objectivity exists. Self-reported scores lose `SELF_REPORTED`. */
export const GRADING_SCORE = { automatic: 85, mixed: 70, "llm-judge": 60, "human-judge": 55, "human-votes": 40 } as const;
export const SELF_REPORTED = -10;
export type QualityFactorId = keyof typeof QUALITY_WEIGHTS;
/** Display order and names: the same in the directory, a benchmark's page and the methodology page. */
export const QUALITY_FACTORS: { id: QualityFactorId; name: string; how: string }[] = [
  { id: "saturation", name: "Headroom", how: "Room left at the top and spread between models. A benchmark near its ceiling, or where every model scores the same, tells little." },
  { id: "testSet", name: "Test set", how: `Whether the scored tasks are public. Private scores ${TEST_SET_SCORE.private}, partly private ${TEST_SET_SCORE.partial}, public ${TEST_SET_SCORE.public}, unknown ${TEST_SET_SCORE.unknown}. A set whose questions are replaced on a schedule scores higher (public ${REFRESHED_SCORE.public}, partly private ${REFRESHED_SCORE.partial}).` },
  { id: "recency", name: "Recency", how: "How recently the benchmark was released. Full credit for 90 days, then falling to zero by about two years. Unknown dates score 50." },
  { id: "objectivity", name: "Grading", how: `How objective the grading is: exact answers and tests score high (${GRADING_SCORE.automatic}), model judges ${GRADING_SCORE["llm-judge"]}, human judges ${GRADING_SCORE["human-judge"]}, votes ${GRADING_SCORE["human-votes"]}. Scores the labs report themselves lose ${-SELF_REPORTED}. A few are set by hand.` },
  { id: "frontier", name: "New models", how: `How quickly it scores new models, measured from Priors' daily history: full credit for a model scored within ${FAST_DAYS} days of release, none after ${SLOW_DAYS} or never, with widely tested models counting most. Where too few new models have come out to tell, the share of today's 10 default lineup models it has measured.` },
  { id: "breadth", name: "Breadth", how: "How many models it has measured in all, with full credit at 40." },
];
export const BREADTH_FULL_AT = 40;

/** Joke benchmarks: kept on the site for anyone who looks, but scored 0 so nothing recommends or auto-picks them. */
export const NOT_SERIOUS = new Set(["khalilbench"]);
export const SUPERSEDED = new Set(["aa-terminalbench-v2-1", "terminalbench-4", "arc-agi-1", "arc-agi-2", "deepswe-1", "aa-math-500", "aa-humanitys-last-exam"]);

/** One weighted part of the score, as shown: its 0-100 score, its share, the points it adds, and what it rests on for this benchmark. */
export interface QualityFactor { id: QualityFactorId; name: string; score: number; weight: number; points: number; detail: string }
export interface QualityAdjustment { id: keyof typeof QUALITY_ADJUST; label: string; points: number }

export interface BenchmarkQuality {
  id: string;
  name: string;
  score: number;
  recency: number;
  saturation: number;
  objectivity: number;
  /** Whether the scored test set is public, and its 0-100 score. */
  testSet: TestSet | "unknown";
  testSetScore: number;
  /** The weighted parts in display order, then the points added or taken away. Their sum, kept within 0 to 100, is `score`. */
  factors: QualityFactor[];
  adjustments: QualityAdjustment[];
  preferred: boolean;
  releaseDate?: string;
  /** "verified": checked by hand against the publisher. "researched": found by the facts research. */
  dateConfidence: "verified" | "researched" | "unknown";
  reason: string;
  sourceUrl: string;
  coverage: number;
  frontierCoverage: number;
  frontierMeasured: number;
  frontierTotal: number;
  lastUpdated?: string;
  staleFrontier: boolean;
}

/** Dates here are benchmark releases verified from the linked publisher, not scrape/update dates. */
const RELEASES: Record<string, { date: string; url: string }> = {
  "arc-agi-1": { date: "2019-11-05", url: "https://arxiv.org/abs/1911.01547" },
  "arc-agi-2": { date: "2025-03-24", url: "https://arxiv.org/abs/2505.11831" },
  "arc-agi-3": { date: "2026-03-25", url: "https://arcprize.org/blog/arc-agi-3-launch" },
  "bsbench-v2": { date: "2026-03-02", url: "https://github.com/petergpt/bullshit-benchmark" },
  "deepswe-1": { date: "2026-05-26", url: "https://deepswe.datacurve.ai/blog/deepswe" },
  "deepswe-1.1": { date: "2026-06-14", url: "https://deepswe.datacurve.ai/blog/deepswe-v1-1" },
  "exploitbench-v0.1": { date: "2026-05-15", url: "https://exploitbench.ai/exploitbench.pdf" },
  "frontiermath-erdos": { date: "2026-09-01", url: "https://epoch.ai/latest/announcing-frontiermath-erdos" },
  "frontiermath-tier-4-v2": { date: "2026-06-12", url: "https://epoch.ai/benchmarks/frontiermath-tier-4-v2" },
  "frontiermath-tiers-1-3-v2": { date: "2026-06-12", url: "https://epoch.ai/benchmarks/frontiermath-tiers-1-3-v2" },
  "frontierswe-v1": { date: "2026-04-01", url: "https://www.proximal.ai/blog/frontierswe/" },
  "frontierswe-v2": { date: "2026-08-01", url: "https://www.frontierswe.com/blog/v2" },
  "frontiercode-2.0-main": { date: "2026-10-27", url: "https://cognition.com/blog/frontier-code-2.0" },
  "frontiercode-1.1-main": { date: "2026-07-07", url: "https://cognition.com/blog/frontier-code-1.1" },
  "posttrainbench-v1.1": { date: "2026-07-28", url: "https://posttrainbench.com/" },
  "vals-programbench-v1": { date: "2026-05-05", url: "https://arxiv.org/abs/2605.03546" },
  "simplebench": { date: "2024-11-25", url: "https://simple-bench.com/" },
  "simpleqa-verified": { date: "2025-09-09", url: "https://arxiv.org/abs/2509.07968" },
  "terminalbench-2": { date: "2025-11-07", url: "https://github.com/laude-institute/terminal-bench-2" },
  "terminalbench-2.1": { date: "2026-01-26", url: "https://github.com/harbor-framework/terminal-bench-2-1" },
  "terminalbench-4": { date: "2026-08-01", url: "https://www.tbench.ai/" },
  "terminalbench-4.1": { date: "2026-11-09", url: "https://x.com/ryan_marten/status/2119845012032876605" },
  "weirdml-v2": { date: "2025-05-01", url: "https://htihle.github.io/weirdml_v2.html" },
  "vendingbench-2": { date: "2025-11-18", url: "https://andonlabs.com/evals/vending-bench-2" },
  "vendingbench-arena": { date: "2025-11-18", url: "https://andonlabs.com/evals/vending-bench-arena" },
  "blueprintbench-2": { date: "2026-07-01", url: "https://andonlabs.com/evals/blueprint-bench-2" },
  "butterbench-v1": { date: "2025-10-24", url: "https://arxiv.org/abs/2510.21860" },
  "dronebench-v1": { date: "2026-07-24", url: "https://andonlabs.com/evals/drone-bench" },
  "aa-aime-2025": { date: "2025-02-06", url: "https://artificialanalysis.ai/evaluations/aime-2025" },
  "aa-apex-agents-aa": { date: "2026-01-15", url: "https://arxiv.org/abs/2601.14242" },
  "aa-automationbench-aa": { date: "2026-04-01", url: "https://arxiv.org/abs/2604.18934" },
  "aa-critpt": { date: "2025-09-30", url: "https://arxiv.org/abs/2509.26574" },
  "aa-gdpval-aa": { date: "2025-10-06", url: "https://arxiv.org/abs/2510.04374" },
  "aa-global-mmlu-lite": { date: "2025-04-15", url: "https://artificialanalysis.ai/evaluations/global-mmlu-lite" },
  "aa-gpqa-diamond": { date: "2023-11-20", url: "https://arxiv.org/abs/2311.12022" },
  "aa-ifbench": { date: "2025-07-03", url: "https://arxiv.org/abs/2507.02833" },
  "aa-itbench-aa": { date: "2025-02-07", url: "https://arxiv.org/abs/2502.05352" },
  "aa-livecodebench": { date: "2024-03-12", url: "https://arxiv.org/abs/2403.07974" },
  "aa-math-500": { date: "2024-09-12", url: "https://artificialanalysis.ai/evaluations/math-500" },
  "aa-mmlu-pro": { date: "2024-06-03", url: "https://arxiv.org/abs/2406.01574" },
  "aa-mmmu-pro": { date: "2024-09-05", url: "https://arxiv.org/abs/2409.02813" },
  "aa-omniscience": { date: "2025-11-16", url: "https://artificialanalysis.ai/articles/aa-omniscience-knowledge-hallucination-benchmark" },
  "aa-omniscience-accuracy": { date: "2025-11-16", url: "https://artificialanalysis.ai/articles/aa-omniscience-knowledge-hallucination-benchmark" },
  "aa-omniscience-non-hallucination": { date: "2025-11-16", url: "https://artificialanalysis.ai/articles/aa-omniscience-knowledge-hallucination-benchmark" },
  "aa-scicode": { date: "2024-07-19", url: "https://arxiv.org/abs/2407.13168" },
  "aa-tau2-bench": { date: "2025-06-10", url: "https://arxiv.org/abs/2506.07982" },
  "aa-tau3-banking": { date: "2026-03-05", url: "https://arxiv.org/abs/2603.04370" },
  "aa-terminalbench-v2-1": { date: "2026-01-26", url: "https://artificialanalysis.ai/evaluations/terminalbench-2-1" },
  "aa-terminalbench-v4-0": { date: "2026-08-01", url: "https://artificialanalysis.ai/evaluations/terminalbench-4-0" },
  "aa-humanitys-last-exam": { date: "2025-01-23", url: "https://arxiv.org/abs/2501.14249" },
  "aa-frontiercode-2-0": { date: "2026-10-27", url: "https://cognition.com/blog/frontier-code-2.0" },
  "aa-3d": { date: "2026-10-12", url: "https://artificialanalysis.ai/articles/aa-3d" },
  "aa-frontiercode": { date: "2026-07-07", url: "https://cognition.com/blog/frontier-code-1.1" },
  "aa-harvey-lab-aa": { date: "2026-10-08", url: "https://artificialanalysis.ai/articles/harvey-lab-aa-v1-1" },
  "aa-robotics": { date: "2026-10-14", url: "https://artificialanalysis.ai/articles/aa-robotics" },
};

const SOURCE_URLS: Record<string, string> = {
  "deepswe-1.1": "https://deepswe.datacurve.ai/",
  "terminalbench-4": "https://www.tbench.ai/",
  "terminalbench-4.1": "https://www.tbench.ai/",
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
  "terminalbench-4.1": 93,
  "arc-agi-3": 90,
  simplebench: 86,
  "bsbench-v2": 65,
  "aa-humanitys-last-exam": 88,
  "aa-terminalbench-v4-0": 92,
  "aa-hle-diamond": 90,
  "aa-omniscience": 85,
  "frontiermath-tier-4-v2": 96,
  "vals-programbench-v1": 98,
  "vendingbench-2": 82,
  "vendingbench-arena": 72,
  "blueprintbench-2": 78,
  "butterbench-v1": 80,
  "dronebench-v1": 80,
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

type QualityRow = { modelId: string; value: number };

function saturationScore(benchmark: Benchmark, rows: QualityRow[]): number {
  // Multiple effort/config rows for one model must not make the benchmark look more saturated.
  const byModel = new Map<string, number>();
  for (const row of rows) {
    const value = normalizedValue(benchmark, row.value);
    if (value == null) continue;
    byModel.set(row.modelId, Math.max(value, byModel.get(row.modelId) ?? -Infinity));
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
  const facts = factsOf(benchmark);
  if (facts.grading) return clamp(GRADING_SCORE[facts.grading] + (facts.selfReported ? SELF_REPORTED : 0));
  if (/arena|pairwise|human judge|llm judge/i.test(`${benchmark.name} ${benchmark.description}`)) return 40;
  if (benchmark.unit === "elo") return 45;
  return benchmark.unit === "percent" ? 80 : 65;
}

const GRADING_WORDS = { automatic: "Graded automatically (exact answers, tests or a programmatic check)", mixed: "Graded partly automatically and partly by judges", "llm-judge": "Graded by a model judge", "human-judge": "Graded by human judges", "human-votes": "Ranked by people's votes" } as const;
const TEST_SET_WORDS = { private: "Private test set", partial: "Partly private test set", public: "Public test set", unknown: "Not known whether the test set is public" } as const;
/** A researched date may be a month: the 15th stands in for the day. */
const fullDate = (d?: string) => !d ? undefined : /^\d{4}-\d{2}$/.test(d) ? `${d}-15` : /^\d{4}-\d{2}-\d{2}$/.test(d) ? d : undefined;

function modelsMeasured(rows: QualityRow[], llms: Set<string>): number {
  const covered = new Set<string>();
  for (const row of rows) {
    if (llms.has(row.modelId)) covered.add(row.modelId);
  }
  return covered.size;
}

function frontierCoverage(rows: QualityRow[], cohort: string[], llms: Set<string>): { measured: number; total: number; score: number } {
  cohort = cohort.filter((id) => llms.has(id));
  const selected = new Set(cohort);
  const measured = new Set<string>();
  for (const row of rows) {
    if (selected.has(row.modelId)) measured.add(row.modelId);
  }
  return { measured: measured.size, total: cohort.length, score: cohort.length ? rounded(100 * measured.size / cohort.length) : 0 };
}

/** How strongly a benchmark fits the chosen focus: quality scaled by the category multiplier. */
export function affinity(q: BenchmarkQuality, focus: Focus, benchmark: Benchmark): number {
  return Math.max(0, Math.min(1, (q.score / 100) * focusMultiplier(focus, benchmark.category)));
}

export function benchmarkQuality(snapshot: Snapshot, cohort: string[] = defaultLineup(snapshot, 10)): BenchmarkQuality[] {
  const variantModels = new Map(snapshot.variants.map((variant) => [variant.id, variant.modelId]));
  const rowsByBenchmark = new Map<string, QualityRow[]>();
  for (const observation of snapshot.observations) {
    const rows = rowsByBenchmark.get(observation.benchmarkId) ?? [];
    rows.push({ modelId: variantModels.get(observation.variantId) ?? observation.variantId.split("@")[0], value: observation.value });
    rowsByBenchmark.set(observation.benchmarkId, rows);
  }
  const llms = new Set(snapshot.models.filter((model) => model.kind === "llm").map((model) => model.id));
  return snapshot.benchmarks.map((benchmark) => {
    const rows = rowsByBenchmark.get(benchmark.id) ?? [];
    const facts = factsOf(benchmark), verified = RELEASES[benchmark.id], researched = verified ? undefined : fullDate(facts.released);
    const releaseDate = verified?.date ?? researched;
    const recency = recencyScore(snapshot.date, releaseDate);
    const saturation = saturationScore(benchmark, rows);
    const objectivity = objectivityScore(benchmark);
    const testSet = facts.test ?? "unknown", testSetScore = (facts.refreshed ? REFRESHED_SCORE : TEST_SET_SCORE)[testSet];
    const measured = modelsMeasured(rows, llms);
    const coverage = rounded(100 * Math.min(1, measured / BREADTH_FULL_AT));
    const frontier = frontierCoverage(rows, cohort, llms);
    // Measured speed at adding new models when the snapshot has it (src/data/new-models.ts), else coverage of today's top lineup.
    const added = benchmark.newModels;
    const frontierScore = added ? added.score : frontier.total ? frontier.score : coverage;
    const preferred = (PREFERRED as readonly string[]).includes(benchmark.id);
    const superseded = SUPERSEDED.has(benchmark.id) || !!benchmark.stoppedPublishing;
    const staleFrontier = snapshot.date >= FRONTIER_RELEASE_DATE && !!benchmark.lastUpdated && benchmark.lastUpdated < FRONTIER_RELEASE_DATE;
    const serious = !NOT_SERIOUS.has(benchmark.id);
    const dateConfidence = verified ? "verified" as const : researched ? "researched" as const : "unknown" as const;
    const details: Record<QualityFactorId, [score: number, detail: string]> = {
      saturation: [saturation, "From the spread of published scores and the room left above the top quarter of models, one score per model."],
      testSet: [testSetScore, `${TEST_SET_WORDS[testSet]}${facts.refreshed ? ", with questions replaced on a schedule" : ""}.${facts.testNote ? ` ${facts.testNote}` : ""}`],
      recency: [recency, releaseDate ? `Released ${facts.released && !verified && /^\d{4}-\d{2}$/.test(facts.released) ? facts.released : releaseDate}${dateConfidence === "researched" ? " (from the publisher's pages, not yet checked by hand)" : ""}.` : "Release date not known, so recency is held at 50."],
      objectivity: [objectivity, OBJECTIVITY[benchmark.id] != null ? "Set by hand from how answers are graded." : facts.grading ? `${GRADING_WORDS[facts.grading]}${facts.selfReported ? "; labs report their own scores" : ""}.` : "Judged from its unit and description; the grading method has not been researched."],
      frontier: [frontierScore, added ? `Scored ${added.added} of the ${added.of} notable models released since Priors began watching it${added.medianDays != null ? `, typically ${added.medianDays === 0 ? "on release day" : `${added.medianDays} day${added.medianDays === 1 ? "" : "s"} after release`}` : ""}.` : frontier.total ? `Has measured ${frontier.measured} of today's ${frontier.total} default lineup models. Too few new models to time how quickly it adds them.` : `${measured} models measured.`],
      breadth: [coverage, `${measured} model${measured === 1 ? "" : "s"} measured.`],
    };
    const factors: QualityFactor[] = QUALITY_FACTORS.map(({ id, name }) => ({ id, name, score: details[id][0], weight: QUALITY_WEIGHTS[id], points: Math.round(details[id][0] * QUALITY_WEIGHTS[id] * 10) / 10, detail: details[id][1] }));
    const adjustments: QualityAdjustment[] = [
      ...(preferred ? [{ id: "preferred" as const, label: "A benchmark Priors prefers", points: QUALITY_ADJUST.preferred }] : []),
      ...(superseded ? [{ id: "superseded" as const, label: "An older version with a replacement", points: QUALITY_ADJUST.superseded }] : []),
      ...(staleFrontier ? [{ id: "staleFrontier" as const, label: `Results last updated before ${FRONTIER_RELEASE_DATE}, when the current frontier models began to ship`, points: QUALITY_ADJUST.staleFrontier }] : []),
    ];
    const score = !serious ? 0 : rounded(factors.reduce((sum, f) => sum + f.score * f.weight, 0) + adjustments.reduce((sum, a) => sum + a.points, 0));
    const reason = !serious ? "Not a serious benchmark (one person's reactions to a few posts per model), so it has no quality score and is never recommended or picked automatically."
      : `${factors.map((f) => `${f.name} ${f.score}/100 (${Math.round(f.weight * 100)}% of the score): ${f.detail}`).join(" ")}${adjustments.length ? ` Then ${adjustments.map((a) => `${a.points > 0 ? "+" : ""}${a.points} (${a.label.toLowerCase()})`).join(", ")}.` : ""} ${benchmark.lastUpdated ? `Publisher results updated ${benchmark.lastUpdated}. ` : ""}Quality does not prove validity or freedom from training contamination.`;
    return {
      id: benchmark.id,
      name: benchmark.name,
      score,
      recency,
      saturation,
      objectivity,
      testSet,
      testSetScore,
      factors,
      adjustments,
      preferred,
      ...(releaseDate ? { releaseDate } : {}),
      dateConfidence,
      reason,
      sourceUrl: verified?.url ?? SOURCE_URLS[benchmark.id] ?? benchmark.url,
      coverage,
      frontierCoverage: frontierScore,
      frontierMeasured: frontier.measured,
      frontierTotal: frontier.total,
      ...(benchmark.lastUpdated ? { lastUpdated: benchmark.lastUpdated } : {}),
      staleFrontier,
    };
  });
}
