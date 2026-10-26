/** Snorkel AI's Agents' Last Exam leaderboard (Overall tab): long-horizon professional workflows run in agent harnesses. */
import type { RawRow, Source } from "../../../src/data/types";
import { effortOf } from "./_board";

const PAGE = "https://snorkel.ai/leaderboard/agents-last-exam/";
export const ALE_ID = "agents-last-exam";
const unescape = (s: string) => s.replace(/&quot;/g, '"').replace(/&amp;/g, "&").replace(/&#039;|&#39;/g, "'");

/** Each row of the first (Overall) table carries every effort measured for its model and harness. The best harness per model and effort wins. */
export function parseAle(html: string): RawRow[] {
  const start = html.indexOf('class="tb-data-table"');
  if (start < 0) throw new Error("Agents' Last Exam page has no leaderboard table");
  const table = html.slice(start, html.indexOf("</table>", start));
  const best = new Map<string, RawRow>();
  for (const m of table.matchAll(/<tr\s+class="tb-table-row[^"]*"\s+data-efforts="([^"]*)"[\s\S]*?data-model="([^"]*)"[\s\S]*?data-harness="([^"]*)"/g)) {
    const efforts = JSON.parse(unescape(m[1])) as { effort: string; pass_rate_pct: number; score_pct: number }[];
    const model = unescape(m[2]).trim(), harness = unescape(m[3]).trim();
    for (const e of efforts) {
      if (!Number.isFinite(e.score_pct)) continue;
      const effort = effortOf(e.effort), key = `${model}|${effort ?? e.effort}`;
      const row: RawRow = { benchmarkId: ALE_ID, modelLabel: model, effort, value: e.score_pct, harness, sourceUrl: PAGE, note: `${harness}${effort ? `, ${effort}` : ""}; pass rate ${e.pass_rate_pct}%` };
      if (!best.has(key) || row.value > best.get(key)!.value) best.set(key, row);
    }
  }
  if (!best.size) throw new Error("Agents' Last Exam table had no rows");
  return [...best.values()];
}

const source: Source = {
  id: "snorkel-ale", name: "Snorkel Agents' Last Exam", url: PAGE,
  async scrape(ctx) {
    const html = await ctx.fetchText(PAGE);
    const rows = parseAle(html);
    return {
      benchmarks: [{
        id: ALE_ID, name: "Agents' Last Exam", shortName: "Agents' Last Exam", sourceId: this.id, url: PAGE,
        description: "Snorkel AI's benchmark of long-horizon, economically valuable professional workflows across 55 sub-industries, run in each model's agent harness with verifiable outcomes. Score is the share of rubric points earned (the pass rate, all checks met, is lower). Best harness per model and effort.",
        unit: "percent" as const, higherIsBetter: true, category: "agentic" as const,
        normalization: { kind: "linear" as const, min: 0, max: 100 }, eligibleForDefault: true, defaultWeight: 0,
      }],
      rows, raw: { "ale.html": html }, notes: [`${rows.length} model and effort results`],
    };
  },
};
export default source;
