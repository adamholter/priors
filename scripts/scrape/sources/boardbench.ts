/**
 * BoardBench (boardbench.dev). Models answer 30 newly generated puzzles across ten board games
 * (Xiangqi, chess, Go, backgammon, shogi, Scrabble, Kalah, Gomoku, Othello, Connect Four). An engine
 * scores each legal move 0 to 1, an illegal move 0, and Quality is the mean score × 100. The site is a
 * Next.js app: the "Quality vs cost" chart carries `points` (slug, model name, effort, quality, cost)
 * in its RSC payload. Cost is the list price of one answer; it is kept in `details`, not `costUsd`,
 * because it is not a cost per task in our sense.
 */
import type { Source, ScrapeResult, RawRow } from "../../../src/data/types";
import { extractKeyed, rscText } from "./_rsc";

const SITE = "https://boardbench.dev";

export type BoardBenchPoint = { slug: string; className: string; effort?: string; lab?: string; label?: string; costUsd?: number; qualityPct: number };

/** The chart points from the home page's RSC payload; the array whose items carry `qualityPct`. */
export function parseBoardBench(html: string): RawRow[] {
  const lists = extractKeyed<BoardBenchPoint[]>(rscText(html), "points").filter((l) => Array.isArray(l) && l.some((p) => typeof p?.qualityPct === "number"));
  const points = lists[0] ?? [];
  const rows: RawRow[] = [];
  for (const p of points) {
    if (typeof p.qualityPct !== "number" || !Number.isFinite(p.qualityPct) || !p.className) continue;
    rows.push({
      benchmarkId: "boardbench", modelLabel: p.className, effort: p.effort || undefined, value: p.qualityPct, sourceUrl: `${SITE}/models/${p.slug}`,
      note: `slug ${p.slug}`, labHint: p.lab,
      details: { costPerAnswerUsd: p.costUsd, label: p.label },
    });
  }
  return rows;
}

const source: Source = {
  id: "boardbench",
  name: "BoardBench",
  url: SITE,
  async scrape(ctx): Promise<ScrapeResult> {
    const html = await ctx.fetchText(SITE);
    const rows = parseBoardBench(html);
    if (!rows.length) throw new Error("BoardBench: no models found in the page payload");
    return {
      benchmarks: [{
        id: "boardbench", name: "BoardBench", sourceId: this.id, url: SITE,
        description: "Models play 30 unseen puzzles across ten board games (Xiangqi, chess, Go, backgammon, shogi, Scrabble, Kalah, Gomoku, Othello, Connect Four). An engine scores each legal move from 0 to 1 and any illegal move 0; the value is the mean score × 100.",
        unit: "percent" as const, higherIsBetter: true, category: "reasoning" as const, eligibleForDefault: false, defaultWeight: 0,
      }],
      rows,
      raw: { "home.html": html },
      notes: [`${rows.length} models`],
    };
  },
};
export default source;
