import type { Benchmark, BenchmarkCategory, RawRow, ScrapeResult, Source } from "../../../src/data/types";

/**
 * Jake Boggs' benchmark dashboard (https://boggs.tech/posts/benchmarks/) publishes the ~100 leaderboards
 * behind his capabilities index as one JSON file. This source reads the ones Priors has neither a
 * direct scraper nor a Benchmark Heaven entry for: Surge AI's boards (DAYJOB, Riemann, GDP.xlsx, ...),
 * ClockBench, PPBench, ALE-Bench, Mercor APEX, game and puzzle boards, and the older general-knowledge sets
 * (MMLU, HellaSwag, GSM8K, ...). Each benchmark links to its own site.
 */
const URL_DATA = "https://boggs.tech/data/benchmark-dashboard.json";
const PAGE = "https://boggs.tech/posts/benchmarks/";
const MIN_MODELS = 5;

/** Dashboard ids Priors already has from the publisher or from Benchmark Heaven. */
export const COVERED = new Set([
  "weirdml", "weirdml-v3", "frontiermath-erdos", "furniture-assembly", "posttrainbench", "eqbench-4", "arc-agi-2", "osworld-verified", "osworld-v2", "frontierswe-v2", "frontierswe-v1",
  "gdpval-aa", "aa-analyst-agent", "humanitys-last-exam", "critpt", "terminalbench-hard", "terminalbench-v2-1", "swe-bench-verified", "mystery-game-puzzles", "omniscience", "mmlu-pro",
  "mmmu-pro", "gpqa-diamond", "math-500", "tau2-bench", "otis-mock-aime-2024-2025", "aa-briefcase", "vending-bench-2", "ebr-bench", "blueprint-bench-2", "scale-hss", "programbench",
  "code-migration", "vibe-code-bench-1-100", "cua-bench", "mysterymechanism", "vals-rsi", "deepswe", "proofbench", "vibe-code-bench", "frontier-code", "agents-last-exam", "gdp-pdf",
  "terminal-bench-4", "terminal-bench-science", "lisanbench", "contextarena", "gso-bench", "apprentice-bench", "real-swe", "rsi-exam", "bullshitbench", "zapier-benchmarks", "chartography",
  "livebench", "longbench-v2", "mmlu", "sudo-l7",
]);

const CATEGORY: Record<string, BenchmarkCategory> = {
  agentic: "agentic", coding: "coding", context: "long-context", hallucination: "safety", math: "math", reasoning: "reasoning", science: "reasoning", vision: "reasoning",
};

interface DashBenchmark { id: string; name: string; category?: string; url?: string; notes?: string }
interface DashResult { benchmark_id: string; model: string; model_id?: string; lab?: string; raw_score: number; reported_score?: number; score_direction?: string; metric?: string; source_url?: string; release_date?: string; open_weights?: boolean | null; source_rank?: number }
interface Dashboard { benchmarks: DashBenchmark[]; results: DashResult[] }

export function buildBoggs(data: Dashboard): Pick<ScrapeResult, "benchmarks" | "rows" | "modelFlags" | "notes"> {
  const meta = new Map(data.benchmarks.map((b) => [b.id, b]));
  const groups = new Map<string, DashResult[]>();
  for (const r of data.results) (groups.get(r.benchmark_id) ?? groups.set(r.benchmark_id, []).get(r.benchmark_id)!).push(r);
  const benchmarks: Benchmark[] = [], rows: RawRow[] = [];
  for (const [id, rs] of groups) {
    const b = meta.get(id);
    if (!b || COVERED.has(id) || /^(aa-|vals-)/.test(id)) continue;
    const used = rs.filter((r) => Number.isFinite(r.raw_score) && r.model);
    if (new Set(used.map((r) => r.model_id ?? r.model)).size < MIN_MODELS) continue;
    const category = CATEGORY[b.category ?? ""] ?? "other";
    // A published score of 0 to 1 is a share; anything else (Elo, ratings, raw points) stays in its own scale.
    const share = used.every((r) => typeof r.reported_score === "number" && r.reported_score >= 0 && r.reported_score <= 1);
    const metric = used[0].metric ?? "";
    const elo = !share && /elo|rating|bradley/i.test(metric);
    const lower = used[0].score_direction === "lower";
    const url = b.url || PAGE;
    const bench: Benchmark = {
      id: `bg-${id}`, name: b.name, shortName: b.name.replace(/\s*\([^)]*\)\s*$/, ""), sourceId: "boggs", url,
      description: `${(b.notes ?? "").replace(/\s+/g, " ").trim()}${metric ? ` Score: ${metric}.` : ""} Collected by Jake Boggs' benchmark dashboard.`.trim().slice(0, 520),
      unit: share ? "percent" : elo ? "elo" : "score", higherIsBetter: !lower, category, versionPolicy: { kind: "fresh" }, defaultWeight: 0,
    };
    benchmarks.push(bench);
    for (const r of used) rows.push({
      benchmarkId: bench.id, modelLabel: r.model, value: share ? r.reported_score! * 100 : r.raw_score, rank: r.source_rank, sourceUrl: r.source_url || url,
      labHint: r.lab, releaseDateHint: r.release_date,
    });
  }
  const seen = new Set<string>();
  const modelFlags = data.results.filter((r) => typeof r.open_weights === "boolean" && r.model && !seen.has(r.model) && seen.add(r.model)).map((r) => ({ modelLabel: r.model, labHint: r.lab, openWeights: r.open_weights as boolean }));
  return { benchmarks, rows, modelFlags, notes: [`${benchmarks.length} benchmarks, ${rows.length} rows`] };
}

const source: Source = {
  id: "boggs", name: "Capabilities index leaderboards · boggs.tech", url: PAGE,
  async scrape(ctx): Promise<ScrapeResult> {
    const text = await ctx.fetchText(URL_DATA);
    const data = JSON.parse(text) as Dashboard;
    if (!Array.isArray(data.benchmarks) || !Array.isArray(data.results)) throw new Error("boggs.tech dashboard has an unexpected shape");
    const result = buildBoggs(data);
    if (!result.rows.length) throw new Error("boggs.tech dashboard had no benchmarks to read");
    return { ...result, raw: { "read.json": JSON.stringify({ benchmarks: result.benchmarks.map((b) => b.id), rows: result.rows.length }) } };
  },
};
export default source;
