/**
 * MathArena, read from the publisher: the overall leaderboard (expected share solved across its benchmarks, from the home page's
 * chart data), and the boards below with accuracy over repeated runs (± 95% CI).
 */
import type { Benchmark, RawRow, Source } from "../../../src/data/types";
import { splitLabel, text } from "./_board";

const SITE = "https://matharena.ai";
const COMPS = [
  { id: "matharena-apex", comp: "apex--apex_2025", name: "MathArena Apex", shortName: "Apex", description: "MathArena Apex: 12 final-answer competition problems that earlier frontier models (Grok 4, GPT-5, Gemini 2.5 Pro, GLM 4.5) failed, so it is biased against them. Accuracy over repeated attempts." },
  { id: "matharena-apex-shortlist", comp: "apex--shortlist_2025", name: "MathArena Apex Shortlist", shortName: "Apex Shortlist", description: "MathArena's Apex shortlist: the hardest final-answer problems from 2025 competitions that models still struggle with. Accuracy over repeated attempts." },
  { id: "matharena-arxivmath-2026-10", comp: "arxiv--october", name: "ArXivMath 10/2026 (MathArena)", shortName: "ArXivMath 10/2026", description: "Research-level math problems with a checkable final answer, from arXiv papers of October 2026." },
  { id: "matharena-brokenarxiv-2026-10", comp: "arxiv_false--october", name: "BrokenArXiv 10/2026 (MathArena)", shortName: "BrokenArXiv 10/2026", description: "Plausible but false statements from arXiv papers of October 2026. Models score by recognizing that the statement is false." },
  { id: "matharena-arxivlean-2026-09", comp: "arxivlean--september", name: "ArXivLean 09/2026 (MathArena)", shortName: "ArXivLean 09/2026", description: "Formalized Lean statements from arXiv papers of September 2026, to be proved by the model." },
];
/** Keeps the id this board had when it came through Jake Boggs' dashboard, so saved mixes and its history carry over. */
const OVERALL = { id: "bg-matharena", name: "MathArena", shortName: "MathArena", description: "MathArena's overall estimate of how a model would do across everything it runs. Expected share solved." };
const modelName = (raw: string) => raw.replace(/\s*⚠️\s*$/, "").replace(/\((Think|Thinking)\)/i, "").trim();

/** The overall leaderboard: every ranked model is in the data behind the home page's release-date chart. */
export function parseOverall(html: string, benchmarkId: string, page: string): RawRow[] {
  const json = html.match(/const releasePoints = (\[[\s\S]*?\]);/)?.[1];
  if (!json) throw new Error("MathArena overall data missing");
  return (JSON.parse(json) as { name: string; creator?: string; capability: number; expected_cost?: number | null; release_date?: string }[]).flatMap((p) => {
    if (!p.name || !Number.isFinite(p.capability)) return [];
    const { label, effort } = splitLabel(modelName(p.name));
    return [{ benchmarkId, modelLabel: label, effort, effortUnstated: !effort, value: +p.capability.toFixed(2), labHint: p.creator, releaseDateHint: p.release_date, costUsd: p.expected_cost ?? undefined, sourceUrl: page, note: p.name }];
  });
}

export function parseApexTable(json: string, benchmarkId: string, page: string): RawRow[] {
  const table = (JSON.parse(json) as { table?: string }).table;
  if (!table) throw new Error("MathArena table missing");
  const rows: RawRow[] = [];
  for (const tr of table.match(/<tr[\s\S]*?<\/tr>/g)?.slice(1) ?? []) {
    const cells = [...tr.matchAll(/<td[\s\S]*?<\/td>/g)].map((c) => text(c[0]));
    // Rank, model, provider, "81.25% ± 7.81%", cost, tokens. A ⚠️ marks possible contamination.
    const [, model, provider, acc, cost] = cells;
    const m = acc?.match(/^([\d.]+)%\s*±\s*([\d.]+)%/);
    if (!model || !m) continue;
    const value = Number(m[1]), ci = Number(m[2]), name = modelName(model);
    const { label, effort } = splitLabel(name);
    rows.push({ benchmarkId, modelLabel: label, effort, value, ci: [Math.max(0, +(value - ci).toFixed(2)), Math.min(100, +(value + ci).toFixed(2))], labHint: provider, costUsd: Number(cost?.replace("$", "")) || undefined, sourceUrl: page, note: model });
  }
  return rows;
}

const source: Source = {
  id: "matharena-apex", name: "MathArena", url: `${SITE}/`,
  async scrape(ctx) {
    const home = await ctx.fetchText(`${SITE}/`), overall = parseOverall(home, OVERALL.id, `${SITE}/`);
    if (overall.length < 20) throw new Error(`MathArena overall returned ${overall.length} rows`);
    const raw: Record<string, string> = { "home.html": home }, rows: RawRow[] = [...overall];
    const benchmarks: Benchmark[] = [{ ...OVERALL, sourceId: "matharena-apex", url: `${SITE}/`, unit: "percent", higherIsBetter: true, category: "math", normalization: { kind: "linear", min: 0, max: 100 }, versionPolicy: { kind: "fresh" }, defaultWeight: 0 }];
    for (const c of COMPS) {
      const page = `${SITE}/?comp=${c.comp}`, json = await ctx.fetchText(`${SITE}/competition_tables/${c.comp}`);
      raw[`${c.id}.json`] = json;
      const part = parseApexTable(json, c.id, page);
      if (!part.length) throw new Error(`${c.name} returned no rows`);
      rows.push(...part);
      benchmarks.push({ id: c.id, name: c.name, shortName: c.shortName, sourceId: "matharena-apex", url: page, description: c.description, unit: "percent" as const, higherIsBetter: true, category: "math" as const, normalization: { kind: "linear" as const, min: 0, max: 100 }, eligibleForDefault: true, defaultWeight: 0 });
    }
    return { benchmarks, rows, raw, notes: [`${rows.length} results across ${COMPS.length + 1} boards`] };
  },
};
export default source;
