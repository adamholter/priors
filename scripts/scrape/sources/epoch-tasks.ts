import { parse } from "csv-parse/sync";
import type { Benchmark, BenchmarkCategory, RawRow, ScrapeResult, Source } from "../../../src/data/types";

/**
 * The other tasks in Epoch AI's Benchmarking Hub export (the CSV FrontierMath and Furniture Assembly
 * already read): their own runs of public benchmarks plus Epoch's puzzle and game tasks. Latest
 * successful run per model and effort. Data: Epoch AI, CC BY 4.0.
 */
const ORIGIN = "https://epoch.ai";
const DATA = `${ORIGIN}/data/benchmarks.csv`;

interface Task { task: string; id: string; name: string; page: string; category: BenchmarkCategory; description: string }
export const TASKS: Task[] = [
  { task: "Chess Puzzles", id: "epoch-chess-puzzles", name: "Chess Puzzles (Epoch AI)", page: "chess-puzzles", category: "reasoning", description: "Epoch AI's chess puzzles: the model finds the best move in positions with a single correct line. Score is the share of puzzles solved." },
  { task: "Mystery Game Puzzles", id: "epoch-mystery-game-puzzles", name: "Mystery Game Puzzles (Epoch AI)", page: "mystery-game-puzzles", category: "reasoning", description: "Epoch AI's deduction puzzles: work out the hidden rules of a mystery game from its observations. Score is the share solved." },
  { task: "OTIS Mock AIME 2024-2025", id: "epoch-otis-mock-aime", name: "OTIS Mock AIME 2024-2025", page: "otis-mock-aime", category: "math", description: "The OTIS Mock AIME problems (2024 and 2025), run by Epoch AI. Accuracy over repeated samples." },
  { task: "MATH level 5", id: "epoch-math-level-5", name: "MATH Level 5 (Epoch AI)", page: "math-level-5", category: "math", description: "The hardest tier (level 5) of the MATH competition set, run by Epoch AI. Accuracy." },
  { task: "SWE-Bench verified", id: "epoch-swe-bench-verified", name: "SWE-bench Verified (Epoch AI)", page: "swe-bench-verified", category: "coding", description: "The human-verified SWE-bench subset: resolve real GitHub issues in a repository. Run by Epoch AI with its own scaffold; resolve rate." },
  { task: "EBR-bench", id: "epoch-ebr-bench", name: "EBR-bench (Earthborne Rangers, Epoch AI)", page: "ebr-bench", category: "agentic", description: "Epoch AI's agentic game benchmark built on the Earthborne Rangers card game: long-horizon planning across a campaign. Score is the share of the scenario completed." },
  { task: "MirrorCode", id: "epoch-mirrorcode", name: "MirrorCode (Epoch AI, with METR)", page: "mirrorcode", category: "coding", description: "Reimplement a large existing program from its behavior alone. Built by Epoch AI with METR; score is the share of tests passed." },
  { task: "GPQA diamond", id: "epoch-gpqa-diamond", name: "GPQA Diamond (Epoch AI run)", page: "gpqa-diamond", category: "reasoning", description: "Graduate-level science multiple choice (the diamond subset), run by Epoch AI. Accuracy." },
  { task: "SimpleQA Verified", id: "epoch-simpleqa-verified", name: "SimpleQA Verified (Epoch AI run)", page: "simpleqa-verified", category: "knowledge", description: "Google DeepMind's cleaned-up SimpleQA short-answer factuality set, run by Epoch AI. Share answered correctly." },
  { task: "SpireClimb", id: "epoch-spireclimb", name: "SpireClimb (Epoch AI)", page: "spireclimb", category: "agentic", description: "Epoch AI's Slay the Spire agent benchmark: climb the spire by playing cards and choosing routes. Score is progress up the spire." },
  { task: "OEIS Open", id: "epoch-oeis-open", name: "OEIS Open (Epoch AI)", page: "oeis-open", category: "math", description: "Find the rule behind open integer sequences from the OEIS and extend them. Share solved." },
  { task: "OEIS Open Lite", id: "epoch-oeis-open-lite", name: "OEIS Open Lite (Epoch AI)", page: "oeis-open", category: "math", description: "The smaller Lite split of Epoch's OEIS Open sequence benchmark. Share solved." },
];

type RecordRow = Record<string, string>;
const benchmark = (t: Task): Benchmark => ({
  id: t.id, name: t.name, shortName: t.name.replace(/ \(.*\)$/, ""), sourceId: "epoch-tasks", url: `${ORIGIN}/benchmarks/${t.page}`,
  description: `${t.description} Data: Epoch AI, CC BY.`,
  unit: "percent", higherIsBetter: true, category: t.category, versionPolicy: { kind: "fresh" }, defaultWeight: 0,
});

export function parseEpochTasks(csv: string): Pick<ScrapeResult, "benchmarks" | "rows" | "notes"> {
  const records = parse(csv, { columns: true, bom: true, skip_empty_lines: true, relax_column_count: true }) as RecordRow[];
  if (!records.length || !("task" in records[0]) || !("model" in records[0]) || !("Best score (across scorers)" in records[0])) throw new Error("Epoch export is missing required benchmark columns");
  const rows: RawRow[] = [], benchmarks: Benchmark[] = [], notes: string[] = [];
  for (const t of TASKS) {
    const latest = new Map<string, RecordRow>();
    for (const r of records) {
      if (r.task !== t.task || r.Status !== "Success" || !r.model?.trim()) continue;
      const v = Number(r["Best score (across scorers)"]);
      if (!r["Best score (across scorers)"]?.trim() || !Number.isFinite(v) || v < 0 || v > 1) continue;
      const prev = latest.get(r.model);
      if (!prev || (r.started_at ?? "") > (prev.started_at ?? "")) latest.set(r.model, r);
    }
    if (!latest.size) continue;
    const b = benchmark(t);
    benchmarks.push(b);
    for (const r of latest.values()) {
      const effort = r.model.match(/_(none|minimal|low|medium|high|xhigh|max)$/i)?.[1]?.toLowerCase();
      const stderr = r.stderr?.trim() ? Number(r.stderr) : undefined;
      rows.push({
        benchmarkId: b.id, modelLabel: (r["Display name"] || r["Unique display name"] || r.Model || r.model).trim(), effort,
        value: Number(r["Best score (across scorers)"]) * 100, sourceUrl: b.url, harness: "Epoch AI",
        labHint: r.Organization || undefined, releaseDateHint: r["Version release date"] || undefined,
        note: [`Epoch AI (CC BY); run ${r.id_runs}; evaluated ${r.started_at || "date unspecified"}`, stderr != null && Number.isFinite(stderr) && `standard error ${+(stderr * 100).toFixed(2)} percentage points`, r.comments].filter(Boolean).join("; "),
      });
    }
    notes.push(`${t.name}: ${latest.size}`);
  }
  if (!rows.length) throw new Error("Epoch export contains no usable task results");
  return { benchmarks, rows, notes };
}

const source: Source = {
  id: "epoch-tasks", name: "Benchmarking Hub tasks · Epoch AI", url: `${ORIGIN}/benchmarks`,
  async scrape(ctx): Promise<ScrapeResult> {
    const csv = await ctx.fetchText(DATA);
    const result = parseEpochTasks(csv);
    // A task Epoch added that is neither mapped here nor read by the FrontierMath / Furniture sources.
    const known = new Set([...TASKS.map((t) => t.task), "Furniture Assembly"]);
    const seen = new Set((parse(csv, { columns: true, bom: true, skip_empty_lines: true, relax_column_count: true }) as RecordRow[]).filter((r: RecordRow) => r.Status === "Success").map((r: RecordRow) => r.task));
    const discoveries = [...seen].filter((t) => t && !known.has(t) && !/^FrontierMath/i.test(t)).map((t) => `Epoch AI benchmark task: ${t}`);
    return { ...result, discoveries, raw: { "benchmarks.csv": csv } };
  },
};
export default source;
