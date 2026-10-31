/**
 * Chess LLM Benchmark (chessbenchllm.onrender.com). LLMs play rated games in a pool anchored by
 * chess engines and Maia bots; the site publishes a Glicko rating with a deviation and a FIDE-scale
 * estimate at `/api/leaderboard`. Anchors, engines and retired players are dropped, as are players
 * with fewer than MIN_GAMES games or a deviation above MAX_RD. Labels carry effort in parentheses
 * ("gemini-4-argon (high)"). The host sleeps when idle, so the first request can be slow.
 */
import type { Source, ScrapeResult, RawRow } from "../../../src/data/types";

const SITE = "https://chessbenchllm.onrender.com";
const API = `${SITE}/api/leaderboard`;
const MIN_GAMES = 10;
const MAX_RD = 150;

export type ChessLlmPlayer = {
  player_id: string; rating?: number; rating_deviation?: number; confidence_low?: number; confidence_high?: number; fide_estimate?: number;
  games_played?: number; wins?: number; draws?: number; losses?: number; legal_move_rate?: number; avg_cost_per_game?: number;
  is_anchor?: boolean; is_engine?: boolean; retired?: boolean; rank?: number;
};

export function parseChessLlmBenchmark(list: ChessLlmPlayer[]): RawRow[] {
  const rows: RawRow[] = [];
  for (const p of list) {
    if (!p.player_id || p.is_anchor || p.is_engine || p.retired) continue;
    if (typeof p.rating !== "number" || !Number.isFinite(p.rating) || (p.games_played ?? 0) < MIN_GAMES) continue;
    if (typeof p.rating_deviation === "number" && p.rating_deviation > MAX_RD) continue;
    rows.push({
      benchmarkId: "chess-llm-benchmark", modelLabel: p.player_id, value: p.rating, sourceUrl: SITE,
      ci: typeof p.confidence_low === "number" && typeof p.confidence_high === "number" ? [p.confidence_low, p.confidence_high] : undefined,
      details: {
        ratingDeviation: p.rating_deviation, fideEstimate: p.fide_estimate, games: p.games_played, wins: p.wins, draws: p.draws, losses: p.losses,
        legalMoveRate: p.legal_move_rate, avgCostPerGameUsd: p.avg_cost_per_game, siteRank: p.rank,
      },
    });
  }
  return rows;
}

const source: Source = {
  id: "chess-llm-benchmark",
  name: "Chess LLM Benchmark",
  url: SITE,
  async scrape(ctx): Promise<ScrapeResult> {
    const list = await ctx.fetchJson<ChessLlmPlayer[]>(API);
    if (!Array.isArray(list)) throw new Error("Chess LLM Benchmark: leaderboard is not an array");
    const rows = parseChessLlmBenchmark(list);
    if (!rows.length) throw new Error("Chess LLM Benchmark: no rated LLM players");
    return {
      benchmarks: [{
        id: "chess-llm-benchmark", name: "Chess LLM Benchmark", sourceId: this.id, url: SITE,
        description: "LLMs play rated chess games in a pool anchored by chess engines and Maia bots; the value is the Glicko rating, with a FIDE-scale estimate in details, for models with 10+ games.",
        unit: "elo" as const, higherIsBetter: true, category: "reasoning" as const, eligibleForDefault: false, defaultWeight: 0,
      }],
      rows,
      raw: { "leaderboard.json": JSON.stringify(list) },
      notes: [`${rows.length} of ${list.length} players`],
    };
  },
};
export default source;
