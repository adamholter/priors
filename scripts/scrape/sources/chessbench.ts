/**
 * ChessBench (chessbench.org). LLMs play rated chess games against each other; each model setup
 * (model × reasoning effort) gets a Glicko-2 rating. The site publishes `/data/leaderboard.json`
 * with `models[].setups[]`; only setups the site marks `qualified` are kept. Ratings compare models
 * within this benchmark only. Cost per game stays in `details`.
 */
import type { Source, ScrapeResult, RawRow } from "../../../src/data/types";

const SITE = "https://chessbench.org";
const DATA = `${SITE}/data/leaderboard.json`;

type Setup = {
  name?: string; model?: string; effort?: string; rating?: number; deviation?: number; provisional?: boolean; qualified?: boolean;
  games?: number; wins?: number; draws?: number; losses?: number; illegalRate?: number; avgCost?: number; avgOutputTokens?: number; status?: string; rank?: number;
};
export type ChessBenchData = { updatedAt?: string; models?: { slug?: string; name?: string; url?: string; setups?: Setup[] }[] };

export function parseChessBench(data: ChessBenchData): { rows: RawRow[]; lastUpdated?: string } {
  const rows: RawRow[] = [];
  for (const m of data.models ?? []) {
    for (const s of m.setups ?? []) {
      if (!s.qualified || s.provisional || typeof s.rating !== "number" || !Number.isFinite(s.rating)) continue;
      const label = s.name || m.name || s.model;
      if (!label) continue;
      const d = s.deviation;
      rows.push({
        benchmarkId: "chessbench", modelLabel: label, effort: s.effort || undefined, value: s.rating, rank: s.rank,
        sourceUrl: m.url || (m.slug ? `${SITE}/models/${m.slug}` : SITE), sourceModelId: s.model,
        ci: typeof d === "number" ? [s.rating - 1.96 * d, s.rating + 1.96 * d] : undefined,
        details: { ratingDeviation: d, games: s.games, wins: s.wins, draws: s.draws, losses: s.losses, illegalRatePct: s.illegalRate, avgCostPerGameUsd: s.avgCost, avgOutputTokensPerGame: s.avgOutputTokens },
      });
    }
  }
  return { rows, lastUpdated: data.updatedAt?.slice(0, 10) };
}

const source: Source = {
  id: "chessbench",
  name: "ChessBench",
  url: SITE,
  async scrape(ctx): Promise<ScrapeResult> {
    const data = await ctx.fetchJson<ChessBenchData>(DATA);
    const { rows, lastUpdated } = parseChessBench(data);
    if (!rows.length) throw new Error("ChessBench: no qualified setups");
    return {
      benchmarks: [{
        id: "chessbench", name: "ChessBench", sourceId: this.id, url: SITE, lastUpdated,
        description: "LLMs play rated chess games against each other, one rating per model and reasoning effort; the value is a Glicko-2 rating within this benchmark's pool, qualified setups only.",
        unit: "elo" as const, higherIsBetter: true, category: "reasoning" as const, eligibleForDefault: false, defaultWeight: 0,
      }],
      rows,
      raw: { "leaderboard.json": JSON.stringify(data) },
      notes: [`${rows.length} qualified setups`],
    };
  },
};
export default source;
