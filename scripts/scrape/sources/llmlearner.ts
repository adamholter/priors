/**
 * LLMLearner's per-benchmark rankings, for boards with no official live leaderboard. Every row there is a vendor
 * or paper report (the page names the source), so these benchmarks are self-reported.
 */
import type { RawRow, Source } from "../../../src/data/types";
import { effortOf, text } from "./_board";

const BASE = "https://llmlearner.com/rankings";
export const NL2REPO_ID = "nl2repo-bench";

/** "Anthropic · Max (With Tools)" → lab Anthropic, effort max. Efforts there read "Max", "Extra-High", "Thinking High", "Unspecified Reasoning". */
function setting(line: string): { lab?: string; effort?: string } {
  const [lab, rest = ""] = line.split(" · ");
  const words = rest.replace(/\(.*?\)/g, " ").replace(/\b(thinking|reasoning|mode)\b/gi, " ").replace(/\s+/g, " ").trim();
  return { lab: lab?.trim() || undefined, effort: effortOf(words) };
}

export function parseRanking(html: string, benchmarkId: string, page: string): RawRow[] {
  const rows: RawRow[] = [];
  for (const li of html.split(/<li class="border-b border-ll-line[^>]*>/).slice(1)) {
    const name = li.match(/<a[^>]*href="\/models\/[^"]*"[^>]*>([^<]+)<\/a>/)?.[1];
    const line = text(li.match(/<p class="mt-0\.5[^"]*">([\s\S]*?)<\/p>/)?.[1] ?? ""), value = Number(li.match(/<span class="font-num text-lg[^"]*"[^>]*>([\d.]+)<\/span>/)?.[1]);
    if (!name || !Number.isFinite(value)) continue;
    const { lab, effort } = setting(line);
    rows.push({ benchmarkId, modelLabel: text(name), effort, value, labHint: lab, sourceUrl: page, note: `Self-reported: ${line}` });
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
