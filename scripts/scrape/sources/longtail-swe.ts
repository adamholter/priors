/**
 * LongTail-SWE (Nebius, longtail-swe.com): can a coding agent fix real GitHub issues in languages standard benchmarks skip? 202 tasks in 13
 * languages, three attempts each, every model in the same SWE-agent-like scaffold. The page is server-rendered: the leaderboard rows carry exact
 * scores in `data-*` attributes, and the main score is Pass@1, the mean over all attempts. Each language is a variant. A model the authors also
 * used to select tasks by difficulty keeps its published score, with a note saying so.
 */
import type { Benchmark, RawRow, ScrapeResult, Source } from "../../../src/data/types";
import { EFFORT_WORDS } from "../../../src/data/normalize";

export const LONGTAIL_SWE_ID = "longtail-swe";
const SITE = "https://longtail-swe.com/";
const text = (html: string) => html.replace(/<[^>]+>/g, " ").replace(/&amp;/g, "&").replace(/&#x27;|&#39;/g, "'").replace(/\s+/g, " ").trim();
const section = (html: string, id: string) => { const at = html.indexOf(`id="${id}"`), end = html.indexOf("</table>", at); if (at < 0 || end < 0) throw new Error(`LongTail-SWE: no ${id} table`); return html.slice(at, end); };
const cellsOf = (row: string) => [...row.matchAll(/<t[dh]\b[^>]*>([\s\S]*?)<\/t[dh]>/g)].map((m) => m[1]);
const modelOf = (cell: string) => { const m = cell.match(/^([\s\S]*?)<small>([\s\S]*?)<\/small>/); return m ? { name: text(m[1]), setting: text(m[2]) } : { name: text(cell), setting: "" }; };
const attr = (tag: string, name: string) => { const v = Number(tag.match(new RegExp(`data-${name}="([\\d.]+)"`))?.[1]); return Number.isFinite(v) ? v : undefined; };

export function parseLongTail(html: string): { rows: RawRow[]; benchmarks: Benchmark[]; version?: string } {
  const version = html.match(/release\s+(v[\d.]+)/i)?.[1], plain = text(html);
  const base = { sourceId: "longtail-swe", url: SITE, unit: "percent", higherIsBetter: true, category: "coding", categories: ["coding", "agentic"], normalization: { kind: "linear", min: 0, max: 100 }, eligibleForDefault: false, defaultWeight: 0 } satisfies Partial<Benchmark>;
  const board = section(html, "leaderboard"), rows: RawRow[] = [], common = new Map<string, Pick<RawRow, "modelLabel" | "effort" | "harness" | "sourceUrl">>(), overall = new Map<string, number>();
  for (const m of board.matchAll(/<tr\b([^>]*data-p1=[^>]*)>([\s\S]*?)<\/tr>/g)) {
    const cells = cellsOf(m[2]), { name, setting } = modelOf(cells[1] ?? ""), value = attr(m[1], "p1");
    if (!name || value == null) throw new Error("LongTail-SWE: leaderboard row changed");
    const shared = { modelLabel: name, ...(EFFORT_WORDS[setting] ? { effort: setting } : {}), harness: "SWE-agent-like scaffold", sourceUrl: SITE }, context = text(cells[2] ?? ""), tokens = attr(m[1], "tok"), steps = attr(m[1], "st"), picked = plain.includes(`${name} was also used for difficulty selection`);
    common.set(name, shared); overall.set(name, value);
    rows.push({ ...shared, benchmarkId: LONGTAIL_SWE_ID, value, ...(steps != null ? { steps } : {}), note: `Pass@1 over three attempts per task, ${context} context${EFFORT_WORDS[setting] ? "" : setting ? `, ${setting}` : ""}${picked ? ". Also used to select tasks by difficulty" : ""}`, details: { passAt3: attr(m[1], "p3"), allThree: attr(m[1], "a3"), sem: Number(cells[3]?.match(/±\s*([\d.]+)/)?.[1]) || undefined, context, tokensPerAttempt: tokens != null ? Math.round(tokens * 1e6) : undefined, usedForTaskSelection: picked || undefined, release: version } });
  }
  const table = section(html, "languages"), [head, ...body] = [...table.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/g)].map((m) => cellsOf(m[1])), models = head.slice(2).map((c) => modelOf(c).name), benchmarks: Benchmark[] = [];
  const main = body.find((r) => text(r[0]) === "Overall"), tasks = main ? Number(text(main[1])) : undefined, languages = body.filter((r) => r !== main);
  models.forEach((name, i) => { const shown = Number(text(main?.[i + 2] ?? "")), exact = overall.get(name); if (exact == null || Math.abs(exact - shown) > 0.051) throw new Error(`LongTail-SWE: language table does not line up at ${name}`); });
  benchmarks.push({ ...base, id: LONGTAIL_SWE_ID, name: "LongTail-SWE", shortName: "LongTail-SWE", description: `${tasks ?? "Real"} tasks from GitHub issues in ${languages.length} languages standard benchmarks skip, three attempts each. Share of attempts that pass the tests.` });
  for (const r of languages) {
    const label = text(r[0]), id = `${LONGTAIL_SWE_ID}-${label.toLowerCase().replace("#", "sharp").replace(/[^a-z0-9]+/g, "-")}`;
    benchmarks.push({ ...base, id, name: `LongTail-SWE: ${label}`, shortName: `LongTail ${label}`, description: `The ${text(r[1])} ${label} tasks. Share of attempts that pass the tests.`, variantOf: LONGTAIL_SWE_ID, variantLabel: label });
    models.forEach((name, i) => { const value = Number(text(r[i + 2] ?? "")); if (r[i + 2] != null && Number.isFinite(value)) rows.push({ ...common.get(name)!, benchmarkId: id, value, note: `Pass@1 over ${text(r[1])} ${label} tasks` }); });
  }
  return { rows, benchmarks, version };
}

const source: Source = {
  id: "longtail-swe", name: "LongTail-SWE", url: SITE,
  async scrape(ctx): Promise<ScrapeResult> {
    const html = await ctx.fetchText(SITE), { rows, benchmarks, version } = parseLongTail(html), count = rows.filter((r) => r.benchmarkId === LONGTAIL_SWE_ID).length;
    if (count < 5) throw new Error("LongTail-SWE: fewer than 5 models");
    return { benchmarks, rows, raw: { "index.html": html }, notes: [`${count} models, ${benchmarks.length - 1} languages${version ? `, release ${version}` : ""}`] };
  },
};
export default source;
