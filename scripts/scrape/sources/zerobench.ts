/** ZeroBench (main set): 100 visual questions designed to be impossible for current multimodal models. Official leaderboard, pass@5. */
import type { RawRow, Source } from "../../../src/data/types";
import { splitLabel, text } from "./_board";

const PAGE = "https://zerobench.github.io/";
export const ZEROBENCH_ID = "zerobench-main";

export function parseZeroBench(html: string): RawRow[] {
  // The first table is the officially evaluated leaderboard; externally reported and release tables follow.
  const start = html.indexOf('id="sortableTable"');
  if (start < 0) throw new Error("ZeroBench page has no leaderboard table");
  const table = html.slice(start, html.indexOf("</table>", start));
  const rows: RawRow[] = [];
  for (const tr of table.split(/<tr[^>]*>/).slice(1)) {
    const cells = [...tr.matchAll(/<td([^>]*)>([\s\S]*?)<\/td>/g)];
    if (cells.length < 4) continue;
    const bar = (i: number) => Number(cells[i][2].match(/bar-value">(?:<b>)?([\d.]+)/)?.[1]);
    const { label, effort } = splitLabel(text(cells[0][2])), pass1 = bar(1), pass5 = bar(2), cost = Number(cells[4]?.[1].match(/data-sort="([\d.]+)"/)?.[1]);
    if (!label || !Number.isFinite(pass5)) continue;
    rows.push({ benchmarkId: ZEROBENCH_ID, modelLabel: label, effort, value: pass5, costUsd: Number.isFinite(cost) && cost > 0 ? cost : undefined, sourceUrl: PAGE, note: `${text(cells[0][2])}; pass@1 ${pass1}` });
  }
  if (!rows.length) throw new Error("ZeroBench leaderboard had no rows");
  return rows;
}

const source: Source = {
  id: "zerobench", name: "ZeroBench", url: PAGE,
  async scrape(ctx) {
    const html = await ctx.fetchText(PAGE);
    const rows = parseZeroBench(html);
    return {
      benchmarks: [{
        id: ZEROBENCH_ID, name: "ZeroBench (main)", shortName: "ZeroBench", sourceId: this.id, url: PAGE,
        description: "ZeroBench's 100 main questions: visual problems built to be impossible for contemporary multimodal models. Official leaderboard, pass@5 (solved in at least one of five tries).",
        unit: "percent" as const, higherIsBetter: true, category: "reasoning" as const,
        normalization: { kind: "linear" as const, min: 0, max: 100 }, eligibleForDefault: true, defaultWeight: 0,
      }],
      rows, raw: { "zerobench.html": html }, notes: [`${rows.length} officially evaluated models`],
    };
  },
};
export default source;
