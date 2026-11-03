/**
 * GDPx (SemiAnalysis): 206 agentic tasks across 11 high-value domains. The site ships every model's per-partner
 * results as a JSON module in a hashed client chunk, and computes the headline in the browser: the mean over domains
 * of the mean over each domain's partners. The server-rendered leaderboard only lists the top 13 of 20 models, so it
 * checks the computed scores rather than supplying them.
 */
import type { Source, ScrapeResult, RawRow } from "../../../src/data/types";

export const GDPX_ID = "gdpx";
const SITE = "https://gdpx.semianalysis.com";

interface Model { id: string; name: string; lab: string; openWeights: boolean; harness: string; reasoning: string }
interface Result { modelId: string; partnerId: string; tasks: number; tasksScored: number; score: number; tasksWithPartial: number; partialScore: number }
interface Data { updatedAt: string; models: Model[]; overall: Record<string, { costPerTask: number | null; tokensPerTask: number | null }>; results: Result[] }

/** The module holds a JS string literal: `JSON.parse('{...}')`. */
export function readData(chunk: string): Data | undefined {
  const literal = chunk.match(/JSON\.parse\('(\{"updatedAt"[\s\S]*?\})'\)/)?.[1];
  return literal ? JSON.parse(literal.replace(/\\([\\'])/g, "$1")) as Data : undefined;
}

/** Partner id to domain, from the calls that define the partners: `a("aria","Aria","chip-design","/partners/aria.png")`. */
export function readPartners(chunk: string): Map<string, string> {
  return new Map([...chunk.matchAll(/\b\w+\("([a-z-]+)","[^"]+","([a-z-]+)","\/partners\//g)].map((m) => [m[1], m[2]]));
}

const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;

/** Each model's score per domain and the headline, weighted as the site weights them. */
export function scoreModel(modelId: string, results: Result[], partners: Map<string, string>) {
  const byDomain = new Map<string, { score: number[]; partial: number[] }>();
  for (const r of results) {
    if (r.modelId !== modelId) continue;
    const domain = partners.get(r.partnerId);
    if (!domain) throw new Error(`GDPx: partner ${r.partnerId} has no domain`);
    const d = byDomain.get(domain) ?? byDomain.set(domain, { score: [], partial: [] }).get(domain)!;
    if (r.tasksScored) d.score.push(r.score);
    if (r.tasksWithPartial) d.partial.push(r.partialScore);
  }
  const domains = Object.fromEntries([...byDomain].map(([k, v]) => [k, mean(v.score)]));
  return { score: mean(Object.values(domains)), partial: mean([...byDomain.values()].map((v) => mean(v.partial))), domains };
}

/** The leaderboard the page renders, for checking: `Claude Opus 5.5` to 12. */
export function readBoard(html: string): Map<string, number> {
  return new Map([...html.matchAll(/text-\[15px\] font-medium">([^<]+)<\/span>[\s\S]*?>(\d+(?:\.\d+)?)<!-- -->%/g)].map((m) => [m[1], Number(m[2])]));
}

export function parseGdpx(chunk: string, html: string): { rows: RawRow[]; updated: string; tasks: number } {
  const data = readData(chunk);
  if (!data?.models?.length || !data.results?.length) throw new Error("GDPx: data module not found");
  const partners = readPartners(chunk);
  if (partners.size < 14) throw new Error(`GDPx: read ${partners.size} partners, expected at least 14`);
  const board = readBoard(html);
  if (board.size < 10) throw new Error(`GDPx: read ${board.size} leaderboard rows from the page`);
  const scored = data.models.map((m) => ({ m, ...scoreModel(m.id, data.results, partners) })).sort((a, b) => b.score - a.score);
  const rows: RawRow[] = scored.map(({ m, score, partial, domains }, i) => {
    const shown = board.get(m.name);
    if (shown != null && Math.abs(shown - score) > 0.051) throw new Error(`GDPx: computed ${score.toFixed(2)} for ${m.name}, the page shows ${shown}`);
    const overall = data.overall[m.id];
    return {
      benchmarkId: GDPX_ID, modelLabel: m.name, value: Math.round(score * 100) / 100, rank: i + 1, harness: m.harness, labHint: m.lab, sourceUrl: SITE,
      // "Highest" is each model's top setting, whatever its name: left open, so it lands on the top effort known for the model.
      ...(m.reasoning === "Highest" ? {} : { effort: m.reasoning }),
      ...(overall?.costPerTask != null ? { costUsd: overall.costPerTask } : {}),
      ...(overall?.tokensPerTask != null ? { outputTokens: overall.tokensPerTask } : {}),
      note: `Reasoning ${m.reasoning} in ${m.harness}. Partial-credit score ${partial.toFixed(1)}%.`,
      details: { partial: Math.round(partial * 100) / 100, reasoning: m.reasoning, openWeights: m.openWeights, domains },
    };
  });
  for (const name of board.keys()) if (!data.models.some((m) => m.name === name)) throw new Error(`GDPx: ${name} is on the page but not in the data`);
  const tasks = data.results.filter((r) => r.modelId === data.models[0].id).reduce((sum, r) => sum + r.tasks, 0);
  return { rows, updated: data.updatedAt, tasks };
}

const source: Source = {
  id: "gdpx",
  name: "GDPx",
  url: SITE,
  async scrape(ctx): Promise<ScrapeResult> {
    const html = await ctx.fetchText(this.url);
    const paths = [...new Set(html.match(/\/_next\/static\/immutable\/chunks\/[\w.-]+\.js/g) ?? [])];
    let chunk: string | undefined;
    for (const p of paths) {
      const text = await ctx.fetchText(SITE + p);
      if (readData(text)) { chunk = text; break; }
    }
    if (!chunk) throw new Error(`GDPx: no data module in ${paths.length} chunks`);
    const { rows, updated, tasks } = parseGdpx(chunk, html);
    return {
      benchmarks: [{
        id: GDPX_ID, name: "GDPx", shortName: "GDPx", sourceId: this.id, url: SITE, lastUpdated: updated,
        description: `SemiAnalysis's benchmark of agents doing frontier work in ${tasks} long tasks across 11 domains: chip design, cybersecurity, biology, finance, legal, quant trading, recursive self-improvement, hardware design, materials science, alignment and software engineering. Each model runs in its own harness where it has one, up to 8 hours a task. The score averages 3 attempts per task, with every domain weighted equally and each graded the way its tasks intend, pass or fail or partial. Most tasks are private. SemiAnalysis says safety classifiers lower some models' scores in cybersecurity, biology and alignment.`,
        normalization: { kind: "linear", min: 0, max: 100 },
        unit: "percent", higherIsBetter: true, category: "agentic", eligibleForDefault: true, defaultWeight: 0,
      }],
      rows, raw: { "page.html": html, "data-chunk.js": chunk },
      notes: [`${rows.length} rows, updated ${updated}`],
    };
  },
};
export default source;
