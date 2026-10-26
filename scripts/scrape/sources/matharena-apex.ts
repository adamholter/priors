/** MathArena Apex: final-answer math problems chosen because earlier frontier models failed them. Accuracy over repeated runs (± 95% CI). */
import type { RawRow, Source } from "../../../src/data/types";
import { splitLabel, text } from "./_board";

const SITE = "https://matharena.ai";
const COMPS = [
  { id: "matharena-apex", comp: "apex--apex_2025", name: "MathArena Apex", shortName: "Apex", description: "MathArena Apex: 12 final-answer competition problems that earlier frontier models (Grok 4, GPT-5, Gemini 2.5 Pro, GLM 4.5) failed, so it is biased against them. Accuracy over repeated attempts." },
  { id: "matharena-apex-shortlist", comp: "apex--shortlist_2025", name: "MathArena Apex Shortlist", shortName: "Apex Shortlist", description: "MathArena's Apex shortlist: the hardest final-answer problems from 2025 competitions that models still struggle with. Accuracy over repeated attempts." },
];

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
    const value = Number(m[1]), ci = Number(m[2]), name = model.replace(/\s*⚠️\s*$/, "").replace(/\((Think|Thinking)\)/i, "").trim();
    const { label, effort } = splitLabel(name);
    rows.push({ benchmarkId, modelLabel: label, effort, value, ci: [Math.max(0, +(value - ci).toFixed(2)), Math.min(100, +(value + ci).toFixed(2))], labHint: provider, costUsd: Number(cost?.replace("$", "")) || undefined, sourceUrl: page, note: model });
  }
  return rows;
}

const source: Source = {
  id: "matharena-apex", name: "MathArena Apex", url: `${SITE}/?comp=${COMPS[0].comp}`,
  async scrape(ctx) {
    const benchmarks = [], rows: RawRow[] = [], raw: Record<string, string> = {};
    for (const c of COMPS) {
      const page = `${SITE}/?comp=${c.comp}`, json = await ctx.fetchText(`${SITE}/competition_tables/${c.comp}`);
      raw[`${c.id}.json`] = json;
      const part = parseApexTable(json, c.id, page);
      if (!part.length) throw new Error(`${c.name} returned no rows`);
      rows.push(...part);
      benchmarks.push({ id: c.id, name: c.name, shortName: c.shortName, sourceId: "matharena-apex", url: page, description: c.description, unit: "percent" as const, higherIsBetter: true, category: "math" as const, normalization: { kind: "linear" as const, min: 0, max: 100 }, eligibleForDefault: true, defaultWeight: 0 });
    }
    return { benchmarks, rows, raw, notes: [`${rows.length} results across ${COMPS.length} boards`] };
  },
};
export default source;
