/**
 * GDPx (SemiAnalysis): 206 agentic tasks across 11 high-value domains. The site ships every model's per-partner
 * results as a JSON module in a hashed client chunk, and computes the headline in the browser: the mean over domains
 * of the mean over each domain's partners. The server-rendered leaderboard only lists the top 13 of 20 models, so it
 * checks the computed scores rather than supplying them.
 */
import type { Benchmark, BenchmarkCategory, Source, ScrapeResult, RawRow } from "../../../src/data/types";

export const GDPX_ID = "gdpx";
const SITE = "https://gdpx.semianalysis.com";

/** `specialist`: the model was run on that one domain only (a cybersecurity specialist), so it has no headline score, only that domain's. */
interface Model { id: string; name: string; lab: string; openWeights: boolean; harness: string; reasoning: string; specialist?: string }
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

/** The 11 domains, as the site names them, and the second category each adds to "agentic". */
export const GDPX_DOMAINS: Record<string, { label: string; category: BenchmarkCategory }> = {
  "chip-design": { label: "Chip design", category: "professional" },
  "hardware-design": { label: "Hardware design", category: "professional" },
  cybersecurity: { label: "Cybersecurity", category: "coding" },
  "software-engineering": { label: "Software engineering", category: "coding" },
  biology: { label: "Biology", category: "science" },
  "materials-science": { label: "Materials science", category: "science" },
  rsi: { label: "Recursive self-improvement", category: "science" },
  alignment: { label: "Alignment", category: "science" },
  finance: { label: "Finance", category: "professional" },
  "quant-trading": { label: "Quant trading", category: "professional" },
  legal: { label: "Legal", category: "professional" },
};
export const GDPX_PARTIAL_ID = `${GDPX_ID}-partial`;
export const gdpxDomainId = (domain: string) => `${GDPX_ID}-${domain}`;

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
  // The name span's classes vary between releases ("text-[15px] font-medium", then "min-w-0 text-[15px] font-medium leading-snug"), so only those two are required.
  return new Map([...html.matchAll(/class="[^"]*\btext-\[15px\][^"]*\bfont-medium\b[^"]*">([^<]+)<\/span>[\s\S]*?>(\d+(?:\.\d+)?)<!-- -->%/g)].map((m) => [m[1], Number(m[2])]));
}

export function parseGdpx(chunk: string, html: string): { rows: RawRow[]; updated: string; tasks: number } {
  const data = readData(chunk);
  if (!data?.models?.length || !data.results?.length) throw new Error("GDPx: data module not found");
  const partners = readPartners(chunk);
  if (partners.size < 14) throw new Error(`GDPx: read ${partners.size} partners, expected at least 14`);
  for (const d of new Set(partners.values())) if (!GDPX_DOMAINS[d]) throw new Error(`GDPx: domain ${d} is new; name it in GDPX_DOMAINS`);
  const board = readBoard(html);
  if (board.size < 10) throw new Error(`GDPx: read ${board.size} leaderboard rows from the page`);
  // A specialist ran one domain, so its mean "over domains" is that domain's score: it would rank on the headline as if it had done them all.
  // An "Abliterated" model is another model's weights with its refusals removed: not the provider's model, and its name would file it under that model.
  const models = data.models.filter((m) => !/abliterat/i.test(m.name));
  const generalists = models.filter((m) => !m.specialist), specialists = models.filter((m) => m.specialist);
  const scored = generalists.map((m) => ({ m, ...scoreModel(m.id, data.results, partners) })).sort((a, b) => b.score - a.score);
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
  for (const name of board.keys()) if (!generalists.some((m) => m.name === name)) throw new Error(`GDPx: ${name} is on the page but not in the data`);
  // The views the benchmark's settings offer: partial credit, and each domain on its own. Same model, harness and effort as the headline row.
  const views: RawRow[] = rows.flatMap((r) => {
    const { partial, domains } = r.details as { partial: number; domains: Record<string, number> };
    const base = { modelLabel: r.modelLabel, harness: r.harness, labHint: r.labHint, sourceUrl: SITE, ...(r.effort ? { effort: r.effort } : {}) };
    return [
      ...(Number.isFinite(partial) ? [{ ...base, benchmarkId: GDPX_PARTIAL_ID, value: partial }] : []),
      ...Object.entries(domains).filter(([, v]) => Number.isFinite(v)).map(([d, v]) => ({ ...base, benchmarkId: gdpxDomainId(d), value: Math.round(v * 100) / 100 })),
    ];
  });
  const tasks = data.results.filter((r) => r.modelId === generalists[0].id).reduce((sum, r) => sum + r.tasks, 0);
  // Specialists join only the view of the domain they ran.
  const special: RawRow[] = specialists.flatMap((m) => {
    const { domains } = scoreModel(m.id, data.results, partners), v = domains[m.specialist!];
    if (!Number.isFinite(v)) return [];
    return [{ benchmarkId: gdpxDomainId(m.specialist!), modelLabel: m.name, value: Math.round(v * 100) / 100, harness: m.harness, labHint: m.lab, sourceUrl: SITE,
      ...(m.reasoning === "Highest" || m.reasoning === "Default" ? {} : { effort: m.reasoning }), note: `${m.lab}'s ${GDPX_DOMAINS[m.specialist!]?.label.toLowerCase() ?? m.specialist} specialist, run on that domain only, in ${m.harness}.` }];
  });
  return { rows: [...rows, ...views, ...special], updated: data.updatedAt, tasks };
}

/** The headline board and the views its settings offer: partial credit, then each domain. */
export function gdpxBenchmarks(sourceId: string, updated: string, tasks: number): Benchmark[] {
  const main: Benchmark = {
    id: GDPX_ID, name: "GDPx", shortName: "GDPx", sourceId, url: SITE, lastUpdated: updated,
    description: `SemiAnalysis's benchmark of agents doing frontier work in ${tasks} long tasks across 11 domains: chip design, cybersecurity, biology, finance, legal, quant trading, recursive self-improvement, hardware design, materials science, alignment and software engineering. Each model runs in its own harness where it has one, up to 8 hours a task. The score averages 3 attempts per task, with every domain weighted equally and each graded the way its tasks intend, pass or fail or partial. Most tasks are private. SemiAnalysis says safety classifiers lower some models' scores in cybersecurity, biology and alignment.`,
    normalization: { kind: "linear", min: 0, max: 100 },
    unit: "percent", higherIsBetter: true, category: "agentic", eligibleForDefault: true, defaultWeight: 0,
  };
  const view = { sourceId, url: SITE, lastUpdated: updated, normalization: main.normalization, unit: main.unit, higherIsBetter: true, eligibleForDefault: false, defaultWeight: 0, variantOf: GDPX_ID } satisfies Partial<Benchmark>;
  return [
    main,
    { ...view, id: GDPX_PARTIAL_ID, name: "GDPx: partial credit", shortName: "GDPx partial", variantLabel: "Partial credit", category: "agentic",
      description: "GDPx on the site's partial-credit score, which gives credit for tasks a model only partly completes. Same tasks and attempts, every domain weighted equally." },
    ...Object.entries(GDPX_DOMAINS).map(([d, { label, category }]): Benchmark => ({
      ...view, id: gdpxDomainId(d), name: `GDPx: ${label}`, shortName: `GDPx ${label}`, variantLabel: label, category: "agentic", categories: ["agentic", category],
      description: `GDPx's ${label.toLowerCase()} tasks alone: the mean over this domain's partners of each partner's score, as the headline averages them. Most tasks are private.`,
    })),
  ];
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
      benchmarks: gdpxBenchmarks(this.id, updated, tasks),
      rows, raw: { "page.html": html, "data-chunk.js": chunk },
      notes: [`${rows.length} rows, updated ${updated}`],
    };
  },
};
export default source;
