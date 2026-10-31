/**
 * Dubesor's AI Chess Leaderboard (dubesor.de/chess). LLMs play rated games against each other, and
 * separately solve Lichess puzzles. The site publishes a plain-text snapshot with markdown tables per
 * pool; we read two of them: game Elo in the Mixed-modes pool (reasoning and continuation games
 * together, 5+ games) and the Lichess puzzle Elo (100+ puzzles). Baselines (random-mover, Maia) are
 * dropped, "˟" (deprecated) and the "±NN" interval are split off. Elo is relative to this pool only.
 * The average cost per game or puzzle is kept in `details`.
 */
import type { Source, ScrapeResult, RawRow } from "../../../src/data/types";

const PAGE = "https://dubesor.de/chess/chess-leaderboard";
const DATA = "https://dubesor.de/chess/chess-leaderboard-llm.txt";
/** Fewer games than this leaves the Elo too uncertain to rank (the site lists from 5). */
const MIN_GAMES = 10;
const BASELINE = /^(random-mover|maia)/i;

type Table = { heading: string; header: string[]; rows: string[][] };

/** Every `## heading` followed by a markdown table. */
export function markdownTables(text: string): Table[] {
  const out: Table[] = [];
  let heading = "", cur: Table | undefined;
  for (const line of text.split(/\r?\n/)) {
    if (line.startsWith("## ")) { heading = line.slice(3).trim(); cur = undefined; continue; }
    if (!line.startsWith("|")) { cur = undefined; continue; }
    const cells = line.replace(/^\||\|\s*$/g, "").split("|").map((c) => c.trim());
    if (cells.every((c) => /^-+$/.test(c))) continue;
    if (!cur) { cur = { heading, header: cells, rows: [] }; out.push(cur); } else cur.rows.push(cells);
  }
  return out;
}

const eloCell = (s: string) => { const m = /^(-?\d+(?:\.\d+)?)(?:\s*±\s*(\d+(?:\.\d+)?))?/.exec(s.trim()); return m ? { elo: Number(m[1]), pm: m[2] ? Number(m[2]) : undefined } : undefined; };
const money = (s: string | undefined) => { const m = /\$?\s*([\d.]+)\s*(¢)?/.exec((s ?? "").replace("~", "")); return m ? Number(m[1]) / (m[2] ? 100 : 1) : undefined; };
const intOf = (s: string | undefined) => { const m = /^(\d+)/.exec((s ?? "").trim()); return m ? Number(m[1]) : undefined; };

export function parseDubesorChess(text: string): { rows: RawRow[]; lastUpdated?: string } {
  const lastUpdated = /Last updated:\s*(\d{4}-\d{2}-\d{2})/.exec(text)?.[1];
  const tables = markdownTables(text);
  const rows: RawRow[] = [];
  const read = (t: Table | undefined, benchmarkId: string, eloCol: string, count: (cells: Record<string, string>) => number | undefined, min: number, extra: (c: Record<string, string>) => Record<string, unknown>) => {
    if (!t) return;
    for (const cells of t.rows) {
      const c = Object.fromEntries(t.header.map((h, i) => [h, cells[i] ?? ""]));
      const deprecated = c.Model?.includes("˟");
      const label = (c.Model ?? "").replace(/˟/g, "").trim();
      const e = eloCell(c[eloCol] ?? "");
      const n = count(c);
      if (!label || BASELINE.test(label) || !e || n === undefined || n < min) continue;
      rows.push({
        benchmarkId, modelLabel: label, value: e.elo, rank: intOf(c["#"]), sourceUrl: PAGE,
        ci: e.pm !== undefined ? [e.elo - e.pm, e.elo + e.pm] : undefined,
        details: { eloInterval: e.pm, deprecated: deprecated || undefined, ...extra(c) },
      });
    }
  };
  read(tables.find((t) => /^Detailed Player Statistics.*Mixed Modes/i.test(t.heading)), "dubesor-chess", "Elo", (c) => intOf(c.Games), MIN_GAMES,
    (c) => ({ games: intOf(c.Games), winDrawLoss: c["W-D-L"], accuracy: c.Acc, winRate: c.WR, costPerGameUsd: money(c.Cost), costReconstructed: c.Cost?.startsWith("~") || undefined }));
  read(tables.find((t) => /^Puzzle Rating/i.test(t.heading)), "dubesor-chess-puzzles", "Puzzle Elo", (c) => intOf(c.Puzzles), 100,
    (c) => ({ puzzles: intOf(c.Puzzles), firstTry: c["1st Try"], recover: c.Recover, partial: c.Partial, costPerPuzzleUsd: money(c.Cost) }));
  return { rows, lastUpdated };
}

const source: Source = {
  id: "dubesor-chess",
  name: "AI Chess Leaderboard · dubesor.de",
  url: PAGE,
  async scrape(ctx): Promise<ScrapeResult> {
    const text = await ctx.fetchText(DATA);
    const { rows, lastUpdated } = parseDubesorChess(text);
    const games = rows.filter((r) => r.benchmarkId === "dubesor-chess").length, puzzles = rows.length - games;
    if (!games || !puzzles) throw new Error(`dubesor chess: ${games} game rows, ${puzzles} puzzle rows`);
    return {
      benchmarks: [
        {
          id: "dubesor-chess", name: "AI Chess Leaderboard (Dubesor)", shortName: "Dubesor Chess", sourceId: this.id, url: PAGE, lastUpdated,
          description: "LLMs play full chess games against each other from the move list, in reasoning and continuation modes combined; Elo within this LLM-only pool, models with 10+ games.",
          unit: "elo" as const, higherIsBetter: true, category: "reasoning" as const, eligibleForDefault: false, defaultWeight: 0,
        },
        {
          id: "dubesor-chess-puzzles", name: "Lichess Puzzle Elo (Dubesor)", shortName: "Dubesor Chess Puzzles", sourceId: this.id, url: PAGE, lastUpdated,
          description: "LLMs solve rated Lichess puzzles (100+ of a 500-puzzle set); the value is a maximum-likelihood performance rating against the puzzles' Lichess ratings, first-try solves only.",
          unit: "elo" as const, higherIsBetter: true, category: "reasoning" as const, eligibleForDefault: false, defaultWeight: 0,
        },
      ],
      rows,
      raw: { "chess-leaderboard-llm.txt": text },
      notes: [`${games} game rows, ${puzzles} puzzle rows`],
    };
  },
};
export default source;
