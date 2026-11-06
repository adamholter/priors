/**
 * LLM Chess (maxim-saplin/llm_chess). LLMs play chess through a text tool interface against a
 * random-move player and the Komodo Dragon engine at set skill levels; an Elo is estimated from those
 * results. The leaderboard page embeds its data as CSV in `docs/data.js` (`const data = \`...\``).
 * Rows without an Elo, multi-model "non-" combos and alternate-prompt (`@PGN`) runs are skipped, as are
 * Elos whose 95% margin exceeds MAX_MOE. The source has no update stamp, so `lastUpdated` is the
 * newest model's first game date.
 */
import { parse } from "csv-parse/sync";
import type { Source, ScrapeResult, RawRow } from "../../../src/data/types";
import { normalizeLabel } from "../../../src/data/normalize";

const PAGE = "https://maxim-saplin.github.io/llm_chess/";
const DATA = "https://raw.githubusercontent.com/maxim-saplin/llm_chess/main/docs/data.js";
const MAX_MOE = 250;

type Rec = Record<string, string>;
const n = (s: string | undefined) => (s === undefined || s.trim() === "" ? undefined : Number(s));

const BUDGET = /^(.*?)[_-]thinking[_-](\d+)$/i;

/**
 * Sonnet 3.7 plays at four thinking budgets ("claude-3-7-sonnet_thinking_1024" to "_10000"). Each budget is its own named
 * configuration, as ARC does, so they neither collide on one variant nor read as a version. The same model's row with
 * no budget is thinking off on Claude, where thinking only runs when a budget is set.
 */
export function chessIdentity(label: string, budgeted: Set<string>): Pick<RawRow, "effort" | "identity"> {
  const b = BUDGET.exec(label), n = normalizeLabel(b ? b[1] : label);
  if (!n.ok || !budgeted.has(n.modelId)) return {};
  if (!b) return n.effort || n.labId !== "anthropic" ? {} : { effort: "none" };
  const configuration = `llm-chess-thinking-${b[2]}`;
  return { identity: { modelId: n.modelId, modelName: n.modelName, labId: n.labId, effort: "default", variantId: `${n.modelId}@default~${configuration}`, configuration, sourceModelId: label, sourceSlug: label } };
}

export function parseLlmChess(js: string): { rows: RawRow[]; lastUpdated?: string } {
  const start = js.indexOf("`"), end = js.lastIndexOf("`");
  if (start < 0 || end <= start) return { rows: [] };
  const recs = parse(js.slice(start + 1, end).trim(), { columns: true, skip_empty_lines: true, relax_column_count: true }) as Rec[];
  const rows: RawRow[] = [];
  const budgeted = new Set(recs.map((r) => BUDGET.exec(r.Player?.trim() ?? "")).flatMap((b) => { const n = b && normalizeLabel(b[1]); return n && n.ok ? [n.modelId] : []; }));
  let lastUpdated: string | undefined;
  for (const r of recs) {
    const label = r.Player?.trim(), elo = n(r.elo), moe = n(r.elo_moe_95);
    if (!label || elo === undefined || !Number.isFinite(elo) || /^non-/i.test(label) || /@pgn$/i.test(label)) continue;
    if (moe !== undefined && moe > MAX_MOE) continue;
    if (r.min_game_date && (!lastUpdated || r.min_game_date > lastUpdated)) lastUpdated = r.min_game_date;
    rows.push({
      benchmarkId: "llm-chess", modelLabel: label, value: elo, sourceUrl: PAGE,
      ...chessIdentity(label, budgeted),
      ci: moe !== undefined ? [elo - moe, elo + moe] : undefined,
      details: {
        eloMoe95: moe, games: n(r.total_games), wins: n(r.player_wins), losses: n(r.opponent_wins), draws: n(r.draws),
        gamesVsRandom: n(r.games_vs_random), gamesVsDragon: n(r.games_vs_dragon), firstGameDate: r.min_game_date || undefined, avgGameCostUsd: n(r.average_game_cost),
      },
    });
  }
  return { rows, lastUpdated };
}

const source: Source = {
  id: "llm-chess",
  name: "LLM Chess",
  url: PAGE,
  async scrape(ctx): Promise<ScrapeResult> {
    const js = await ctx.fetchText(DATA);
    const { rows, lastUpdated } = parseLlmChess(js);
    if (!rows.length) throw new Error("LLM Chess: no rated players in data.js");
    return {
      benchmarks: [{
        id: "llm-chess", name: "LLM Chess", sourceId: this.id, url: PAGE, lastUpdated,
        description: "LLMs play chess through a text tool interface against a random-move player and the Komodo Dragon engine at set skill levels; the value is the Elo estimated from those games.",
        unit: "elo" as const, higherIsBetter: true, category: "reasoning" as const, eligibleForDefault: false, defaultWeight: 0,
      }],
      rows,
      raw: { "data.js": js },
      notes: [`${rows.length} rated players`],
    };
  },
};
export default source;
