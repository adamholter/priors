/**
 * Mercor's APEX page (mercor.com/apex): the leaderboards Mercor runs itself, shipped in the page's `__NEXT_DATA__`
 * as `props.pageProps.benchmarks[]`, one per `leaderboardKey`, each with `globalLeaderboard[]` rows of
 * `{ model: { modelName, effort, provider }, passScores: [{ pass, score, error }] }`.
 * Read here: OpenWorldEngineer (OWE-Bench), launched November 12, 2026. Its headline is Mean@8 with a 95% interval
 * across tasks (`error` is the half-width).
 */
import type { Benchmark, RawRow, Source } from "../../../src/data/types";

const PAGE = "https://www.mercor.com/apex/";

interface ApexRow { model?: { modelName?: string; modelId?: string; effort?: string | null; provider?: { name?: string } }; passScores?: { pass?: string; score?: number | null; error?: number | null }[] }
interface ApexBoard { leaderboardKey?: string; pageTitle?: string; taskCount?: number; websiteLink?: string; globalLeaderboard?: ApexRow[] }

interface Board { key: string; pass: string; benchmark: Omit<Benchmark, "sourceId">; minRows: number }
const BOARDS: Board[] = [{
  key: "open-world-engineer-leaderboard", pass: "mean-8", minRows: 8,
  benchmark: {
    id: "owe-bench", name: "OpenWorldEngineer (OWE-Bench)", shortName: "OWE-Bench", url: PAGE,
    description: "26 long-horizon engineering projects built by domain experts, from GPU kernels to aircraft design. Each attempt is scored by how far it moves the project from its baseline (0%) toward the task's ceiling (100%) on held-out cases. Mean of 8 attempts per task.",
    unit: "percent", higherIsBetter: true, category: "agentic", categories: ["agentic", "coding", "science"],
    normalization: { kind: "linear", min: 0, max: 100 }, eligibleForDefault: false, defaultWeight: 0,
  },
}];

/** Mercor writes some names without the family ("Fable 5.2", "Beam"). */
function label(row: ApexRow): string {
  const name = (row.model?.modelName ?? "").trim(), provider = row.model?.provider?.name ?? "";
  if (provider === "Anthropic" && !/^claude\b/i.test(name)) return `Claude ${name}`;
  if (provider === "Reflection" && /^beam$/i.test(name)) return "Beam 1.0";
  return name;
}

export function parseMercorApex(html: string): { benchmarks: Benchmark[]; rows: RawRow[]; notes: string[] } {
  const json = html.match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/)?.[1];
  if (!json) throw new Error("Mercor APEX: __NEXT_DATA__ missing");
  const boards = (JSON.parse(json)?.props?.pageProps?.benchmarks ?? []) as ApexBoard[];
  const benchmarks: Benchmark[] = [], rows: RawRow[] = [], notes: string[] = [];
  for (const b of BOARDS) {
    const board = boards.find((x) => x.leaderboardKey === b.key);
    if (!board?.globalLeaderboard?.length) throw new Error(`Mercor APEX: ${b.key} missing`);
    const before = rows.length;
    for (const row of board.globalLeaderboard) {
      const s = row.passScores?.find((p) => p.pass === b.pass);
      const modelLabel = label(row);
      if (!modelLabel || typeof s?.score !== "number" || !Number.isFinite(s.score)) continue;
      const half = typeof s.error === "number" && Number.isFinite(s.error) ? s.error : undefined;
      rows.push({
        benchmarkId: b.benchmark.id, modelLabel, value: s.score, sourceUrl: PAGE,
        ...(row.model?.effort ? { effort: row.model.effort } : {}),
        ...(half !== undefined ? { ci: [s.score - half, s.score + half] as [number, number] } : {}),
        details: { mercorModelId: row.model?.modelId, ...Object.fromEntries((row.passScores ?? []).filter((p) => p.pass !== b.pass && typeof p.score === "number").map((p) => [p.pass, p.score])) },
      });
    }
    const n = rows.length - before;
    if (n < b.minRows) throw new Error(`Mercor APEX: ${b.key} parsed only ${n} rows`);
    benchmarks.push({ ...b.benchmark, sourceId: "mercor-apex", ...(board.websiteLink ? { url: board.websiteLink } : {}) });
    notes.push(`${b.benchmark.shortName}: ${n} models, ${board.taskCount ?? "?"} tasks`);
  }
  return { benchmarks, rows, notes };
}

const source: Source = {
  id: "mercor-apex", name: "Mercor APEX", url: PAGE,
  async scrape(ctx) {
    const html = await ctx.fetchText(PAGE);
    const { benchmarks, rows, notes } = parseMercorApex(html);
    return { benchmarks, rows, notes, raw: { "apex.html": html } };
  },
};
export default source;
