import type { Benchmark, BenchmarkCategory, RawRow, ScrapeResult, Source } from "../../../src/data/types";

/**
 * Benchmark Heaven (https://benchmarkheaven.com) republishes the leaderboards of dozens of independent
 * benchmark maintainers under one schema, with each benchmark's maintainer, primary URL and score
 * convention. This source reads that registry and dataset for the benchmarks Priors has no scraper
 * for (creative writing, MathArena, UGI, SWE-bench variants, agent and game benchmarks, ...). Each
 * benchmark links to its maintainer, not to Benchmark Heaven. Benchmarks Priors already reads at the
 * source (Artificial Analysis, Vals, Epoch, ARC Prize, Terminal-Bench, ...) are skipped; so is cost.
 * Their API is public and CORS-open (API.md in github.com/fstandhartinger/model-market-comparison).
 * The code is MIT; the data belongs to each maintainer, which is why the primary URL stays on every row.
 */
const ORIGIN = "https://benchmarkheaven.com";

/** Registry ids Priors reads directly from the publisher, or that are not a model-quality score. */
export const SKIP = /^(aa-|vals-|openrouter-|arc-agi|frontiermath|frontier-math|furniture|epoch-|chess-puzzles|mystery-game|ebr-bench|mirrorcode|simple-bench|deepswe|frontierswe|frontiercode|osworld|posttrainbench|lmarena|terminal-bench|bullshitbench|swe-atlas-qna|scale-hss|zapier|automationbench|cyber|exploitbench|programbench|clutter|minebench|hearingbench|weirdml|roboflow|andon|vending|blueprint|butter|drone|agi-pilled|bsbench|simpleqa|voxel|threejs|slopalytics|gdpval|critpt|humanitys|hle|gpqa|openai-|scicode)/;
const SKIP_MAINTAINER = /^(Vals AI|Artificial Analysis|OpenRouter|Epoch AI|ARC Prize|Terminal-Bench|Stanford \/ Harbor|Benchmark Heaven)/i;
const MIN_MODELS = 5;
/** A vendor's own claim counts only on a leaderboard with enough models to compare. */
const MIN_MODELS_SELF_REPORTED = 8;

const CATEGORY: Record<string, BenchmarkCategory> = {
  Coding: "coding", Agentic: "agentic", "Tool-use": "agentic", Math: "math", Reasoning: "reasoning", Knowledge: "knowledge", Science: "reasoning",
  Vision: "reasoning", "Long-context": "long-context", Instruction: "instruction", Writing: "creative", Roleplay: "creative",
  "Safety/Alignment": "safety", Uncensored: "safety", Other: "other",
};
const EFFORTS = new Set(["none", "minimal", "low", "medium", "high", "xhigh", "max"]);

interface RegistryEntry {
  id: string; name: string; version_status: string; category: string; one_sentence_description?: string; maintainer: string; primary_url?: string;
  scoring: { metric?: string; unit?: string; range?: [number | null, number | null]; higher_better?: boolean };
}
interface Obs { benchmark_id: string; value: number; unit: string; basis: string; subject: { name: string; model_id?: string; variant?: string | null; harness?: string | null }; source?: { url?: string }; protocol?: string }
interface Dataset { benchmark_results: { observations: Obs[] }; models?: { family_name: string; org?: string; open_weights?: boolean | null; release_date?: string | null }[] }

/**
 * A stable Priors id. Benchmark Heaven versions undated leaderboards as `family::snapshot-<date>`; the date
 * changes whenever it re-collects, so it stays out of the id (the newest snapshot of a family is the one read).
 */
const SNAPSHOT = /::snapshot-(\d{4}-\d{2}-\d{2})$/;
const slug = (id: string) => `bh-${id.replace(SNAPSHOT, "").replace(/::/g, "-").replace(/[^a-z0-9.]+/gi, "-").replace(/^-|-$/g, "").toLowerCase()}`;

/** The score scale Priors stores a registry benchmark in, or null when it is not a score (cost, rates of use, ...). */
function scale(b: RegistryEntry): { unit: Benchmark["unit"]; normalization?: Benchmark["normalization"]; factor: (obs: Obs) => number } | null {
  const u = (b.scoring.unit ?? "").toLowerCase(), [lo, hi] = b.scoring.range ?? [null, null];
  if (u === "usd" || u === "usd/task" || u === "percent of roofline") return null;
  if (u === "elo") return { unit: "elo", factor: () => 1 };
  const unit01 = u === "fraction" || (lo === 0 && hi === 1), unit100 = u === "percent" || u === "%" || (lo === 0 && hi === 100);
  if (unit01 || unit100) return { unit: "percent", factor: (o) => ((o.unit ?? "").toLowerCase() === "fraction" || (unit01 && !["percent", "%"].includes((o.unit ?? "").toLowerCase())) ? 100 : 1) };
  if (typeof lo === "number" && typeof hi === "number" && hi > lo) return { unit: "score", normalization: { kind: "linear", min: lo, max: hi }, factor: () => 1 };
  return { unit: "score", factor: () => 1 };
}

export function buildBenchmarkHeaven(registry: RegistryEntry[], data: Dataset): Pick<ScrapeResult, "benchmarks" | "rows" | "modelFlags" | "notes"> {
  const byId = new Map(registry.map((b) => [b.id, b]));
  const groups = new Map<string, Obs[]>();
  for (const o of data.benchmark_results.observations) (groups.get(o.benchmark_id) ?? groups.set(o.benchmark_id, []).get(o.benchmark_id)!).push(o);
  const found: { snapshot: string; bench: Benchmark; rows: RawRow[] }[] = [];
  for (const [id, all] of groups) {
    const b = byId.get(id);
    if (!b || b.version_status === "retained" || SKIP.test(id) || SKIP_MAINTAINER.test(b.maintainer) || b.category === "Efficiency") continue;
    const sc = scale(b), category = CATEGORY[b.category];
    if (!sc || !category) continue;
    const models = new Set(all.map((o) => o.subject.model_id ?? o.subject.name));
    const independent = all.filter((o) => o.basis !== "self_reported");
    const use = models.size >= MIN_MODELS_SELF_REPORTED ? all : independent;
    const kept = use.filter((o) => Number.isFinite(o.value));
    if (new Set(kept.map((o) => o.subject.model_id ?? o.subject.name)).size < MIN_MODELS) continue;
    const url = b.primary_url || `${ORIGIN}/benchmarks`;
    const bench: Benchmark = {
      id: slug(id), name: b.name, shortName: b.name.replace(/\s*\([^)]*\)\s*$/, ""), sourceId: "benchmarkheaven", url,
      description: `${b.one_sentence_description?.replace(/\s+/g, " ").trim() ?? b.name} Maintained by ${b.maintainer.replace(/\s*\(.*$/, "")}.${b.scoring.metric ? ` Score: ${b.scoring.metric}.` : ""}`.slice(0, 520),
      unit: sc.unit, higherIsBetter: b.scoring.higher_better !== false, category, versionPolicy: { kind: "fresh" }, defaultWeight: 0,
      ...(sc.normalization ? { normalization: sc.normalization } : {}),
    };
    const mine: RawRow[] = [];
    found.push({ snapshot: id.match(SNAPSHOT)?.[1] ?? "", bench, rows: mine });
    for (const o of kept) {
      const variant = o.subject.variant?.toLowerCase().trim();
      mine.push({
        benchmarkId: bench.id, modelLabel: o.subject.name, effort: variant && EFFORTS.has(variant) ? variant : undefined, value: o.value * sc.factor(o),
        sourceUrl: o.source?.url && !/benchmarkheaven|mintapis/.test(o.source.url) ? o.source.url : url, harness: o.subject.harness ?? undefined,
        note: o.basis === "self_reported" ? "self-reported by the model's vendor" : undefined,
      });
    }
  }
  // Two snapshots of one leaderboard are one benchmark: keep the newest.
  const newest = new Map<string, (typeof found)[number]>();
  for (const f of found) { const prev = newest.get(f.bench.id); if (!prev || f.snapshot > prev.snapshot) newest.set(f.bench.id, f); }
  const benchmarks = [...newest.values()].map((f) => f.bench), rows = [...newest.values()].flatMap((f) => f.rows);
  const modelFlags = (data.models ?? []).filter((m) => typeof m.open_weights === "boolean").map((m) => ({ modelLabel: m.family_name, labHint: m.org, openWeights: m.open_weights as boolean }));
  return { benchmarks, rows, modelFlags, notes: [`${benchmarks.length} benchmarks, ${rows.length} rows, ${modelFlags.length} model weight flags`] };
}

const source: Source = {
  id: "benchmarkheaven", name: "Independent leaderboards · via Benchmark Heaven", url: ORIGIN,
  async scrape(ctx): Promise<ScrapeResult> {
    const [registry, data] = await Promise.all([
      ctx.fetchText(`${ORIGIN}/api/benchmarks`), ctx.fetchText(`${ORIGIN}/api/dataset`),
    ]);
    const reg = (JSON.parse(registry) as { benchmarks?: RegistryEntry[] }).benchmarks;
    if (!Array.isArray(reg) || !reg.length) throw new Error("Benchmark Heaven registry is empty");
    const dataset = JSON.parse(data) as Dataset;
    if (!Array.isArray(dataset.benchmark_results?.observations)) throw new Error("Benchmark Heaven dataset has no observations");
    const result = buildBenchmarkHeaven(reg, dataset);
    if (!result.rows.length) throw new Error("Benchmark Heaven had no benchmarks to read");
    // The raw dataset is 36 MB; keep the part this source used.
    return { ...result, raw: { "benchmarks.json": registry, "read.json": JSON.stringify({ benchmarks: result.benchmarks.map((b) => b.id), rows: result.rows.length }) } };
  },
};
export default source;
