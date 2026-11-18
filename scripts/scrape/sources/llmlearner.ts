/**
 * LLMLearner's per-benchmark rankings, for boards with no official live leaderboard. Every row there is a vendor
 * or paper report (the page names the source, or says it has none), so these benchmarks are self-reported.
 */
import type { RawRow, Source } from "../../../src/data/types";
import { effortOf, text } from "./_board";

const BASE = "https://llmlearner.com/rankings";
export const NL2REPO_ID = "nl2repo-bench";

/** A field of a row's details panel: "Provider", "Best setting", "Result source". */
const rawField = (row: string, name: string) => row.match(new RegExp(`<dt[^>]*>${name}</dt><dd[^>]*>([\\s\\S]*?)</dd>`))?.[1] ?? "";
const field = (row: string, name: string) => text(rawField(row, name));
/** Settings read "Max", "Extra-High", "Thinking High", "Thinking" or "Effort not stated". */
const effortIn = (setting: string) => effortOf(setting.replace(/\(.*?\)/g, " ").replace(/\b(thinking|reasoning|mode|effort not stated)\b/gi, " ").replace(/\s+/g, " ").trim());

export function parseRanking(html: string, benchmarkId: string, page: string): RawRow[] {
  const rows: RawRow[] = [];
  for (const li of html.split(/<li\b[^>]*>/).slice(1)) {
    if (!li.includes('id="leaderboard-heading-settings-')) continue;
    const name = li.match(/<a\b[^>]*href="\/models\/[^"]*"[^>]*>([^<]+)<\/a>/)?.[1];
    const value = Number(li.match(/<span class="font-num text-lg[^"]*"[^>]*>(?:<span class="sr-only">[^<]*<\/span>)?([\d.]+)%?<\/span>/)?.[1]);
    if (!name || !Number.isFinite(value)) continue;
    const lab = text(rawField(li, "Provider").match(/^[^<]*/)?.[0] ?? "") || undefined, setting = field(li, "Best setting"), origin = field(li, "Result source");
    rows.push({ benchmarkId, modelLabel: text(name), effort: effortIn(setting), value, labHint: lab, sourceUrl: page, note: `Reported result (${origin || "source not given"}): ${[lab, setting].filter(Boolean).join(" · ")}` });
  }
  return rows;
}

const source: Source = {
  id: "llmlearner", name: "LLMLearner", url: `${BASE}/nl2repo-bench`,
  async scrape(ctx) {
    const page = `${BASE}/nl2repo-bench`, html = await ctx.fetchText(page);
    const rows = parseRanking(html, NL2REPO_ID, page);
    if (!rows.length) throw new Error("LLMLearner NL2Repo ranking had no rows");
    return {
      benchmarks: [{
        id: NL2REPO_ID, name: "NL2Repo-Bench", sourceId: this.id, url: page, unit: "percent" as const, higherIsBetter: true, category: "coding" as const,
        normalization: { kind: "linear" as const, min: 0, max: 100 }, eligibleForDefault: true, defaultWeight: 0,
        description: "Build a complete, installable Python repository from a natural-language spec and an empty workspace (104 tasks, graded by the upstream pytest suites). Average test pass rate; scores are vendor and paper reports, gathered by LLMLearner.",
      }],
      rows, raw: { "nl2repo.html": html }, notes: [`${rows.length} reported results`],
    };
  },
};
export default source;
