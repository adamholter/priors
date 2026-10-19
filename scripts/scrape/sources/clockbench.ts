/** ClockBench: reading analog clocks, trivial for humans (90.7% average) and hard for models. Official leaderboard. */
import type { RawRow, Source } from "../../../src/data/types";
import { effortOf, splitLabel, text } from "./_board";

const PAGE = "https://clockbench.ai/";
export const CLOCKBENCH_ID = "clockbench";

export function parseClockBench(html: string): RawRow[] {
  const start = html.indexOf('id="leaderboard"');
  if (start < 0) throw new Error("ClockBench page has no leaderboard");
  const rows: RawRow[] = [];
  for (const tr of html.slice(start).split(/<tr[^>]*>/).slice(1)) {
    const cells = [...tr.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/g)].map((m) => text(m[1]));
    // Rank, model, accuracy, lab; the two human baselines have no rank.
    if (cells.length < 4 || !/^\d+$/.test(cells[0])) continue;
    const value = Number(cells[2].match(/^([\d.]+)%$/)?.[1]);
    if (!cells[1] || !Number.isFinite(value)) continue;
    // Effort is a trailing word ("Claude Opus 5.5 Max"), not a parenthetical.
    const words = cells[1].split(" "), effort = words.length > 1 ? effortOf(words[words.length - 1]) : undefined;
    const label = (effort ? words.slice(0, -1).join(" ") : splitLabel(cells[1]).label).replace(/^GTP-/, "GPT-"); // the page misspells GPT-5 Nano
    rows.push({ benchmarkId: CLOCKBENCH_ID, modelLabel: label, effort, value, labHint: cells[3] || undefined, sourceUrl: PAGE, note: cells[1] });
  }
  if (!rows.length) throw new Error("ClockBench leaderboard had no rows");
  return rows;
}

const source: Source = {
  id: "clockbench", name: "ClockBench", url: PAGE,
  async scrape(ctx) {
    const html = await ctx.fetchText(PAGE);
    const rows = parseClockBench(html);
    return {
      benchmarks: [{
        id: CLOCKBENCH_ID, name: "ClockBench", shortName: "ClockBench", sourceId: this.id, url: PAGE,
        description: "Reading analog clocks. Trivial for people (90.7% average, 95% best) and hard for frontier models. Accuracy on the official leaderboard.",
        unit: "percent" as const, higherIsBetter: true, category: "reasoning" as const,
        normalization: { kind: "linear" as const, min: 0, max: 100 }, eligibleForDefault: true, defaultWeight: 0,
      }],
      rows, raw: { "clockbench.html": html }, notes: [`${rows.length} models`],
    };
  },
};
export default source;
