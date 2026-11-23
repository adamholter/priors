/**
 * Human Intelligence Index (HII) from Intelligence, the makers of DesignArena (https://www.designarena.ai/), launched 2026-11-23. Blind
 * head-to-head votes from DesignArena users across its leaderboards (websites, apps, games, slides, images, video, audio and more), each
 * leaderboard weighted by the time Americans spend on what it makes (American Time Use Survey, Sensor Tower). The score is how many times in
 * 100 users would pick a model's work over Claude Opus 5.5's, so Opus 5.5 is 50; the interval is the Bradley-Terry standard error.
 *
 * The leaderboard page streams its board as React Server Component data (`self.__next_f.push`), which carries the board's rows by model id.
 * Anonymous models in testing (codenames such as "grogu") match no model and are left out by the build.
 */
import type { Benchmark, RawRow, ScrapeResult, Source } from "../../../src/data/types";

const PAGE = "https://www.designarena.ai/leaderboard?section=overall&board=human-intelligence-index";
export const HII_ID = "designarena-hii";
const CATEGORY = "human-intelligence-index";

export const HII_BENCHMARK: Benchmark = {
  id: HII_ID, name: "Human Intelligence Index", shortName: "HII", sourceId: "designarena-hii", url: PAGE,
  description: "Blind head-to-head votes from DesignArena users across its leaderboards (websites, apps, games, slides, images, video and more), each weighted by the time Americans spend on what it makes. How many times in 100 people would pick the model's work over Claude Opus 5.5's (Opus 5.5 is 50).",
  unit: "score", higherIsBetter: true, category: "preference", categories: ["preference", "creative", "composite"], versionPolicy: { kind: "fresh" }, defaultWeight: 0,
};

interface Row { modelId: string; elo: number; btStdErr?: number | null; battles?: number; wins?: number; losses?: number; winRate?: number }
export interface HiiBoard { category: string; metadata?: { lastUpdateTime?: string; totalVotes?: number }; data: Row[] }

/** The text the page streams, joined: each `self.__next_f.push([1, "..."])` holds a JSON string. */
export function streamedText(html: string): string {
  let out = "";
  for (const m of html.matchAll(/self\.__next_f\.push\(\[1,("(?:[^"\\]|\\.)*")\]\)/g)) out += JSON.parse(m[1]) as string;
  return out;
}

/** The HII board object in the streamed data: the `{"arenaType": ...}` object whose category is the index. */
export function findBoard(text: string): HiiBoard {
  const at = text.indexOf(`"category":"${CATEGORY}"`);
  if (at < 0) throw new Error("Human Intelligence Index: board not found in the page data");
  const start = text.lastIndexOf('{"arenaType"', at);
  if (start < 0) throw new Error("Human Intelligence Index: board start not found");
  let depth = 0, inString = false;
  for (let i = start; i < text.length; i++) {
    const c = text[i];
    if (inString) { if (c === "\\") i++; else if (c === '"') inString = false; continue; }
    if (c === '"') inString = true;
    else if (c === "{") depth++;
    else if (c === "}" && --depth === 0) return JSON.parse(text.slice(start, i + 1)) as HiiBoard;
  }
  throw new Error("Human Intelligence Index: board data is cut off");
}

export function parseHii(html: string): { rows: RawRow[]; board: HiiBoard } {
  const board = findBoard(streamedText(html));
  if (!Array.isArray(board.data) || !board.data.length) throw new Error("Human Intelligence Index: no rows");
  const rows = board.data.filter((r) => r.modelId && Number.isFinite(r.elo)).map((r): RawRow => {
    const se = typeof r.btStdErr === "number" && r.btStdErr > 0 ? r.btStdErr : undefined;
    return {
      benchmarkId: HII_ID, modelLabel: r.modelId, value: r.elo, sourceUrl: PAGE, ...(se ? { ci: [r.elo - se, r.elo + se] as [number, number] } : {}),
      note: `${r.battles != null ? `${r.battles.toLocaleString("en-US")} votes` : ""}${r.winRate != null ? `, ${r.winRate}% won` : ""}${se ? `, ±${se} standard error` : ""}`.replace(/^, /, "") || undefined,
    };
  });
  return { rows, board };
}

const source: Source = {
  id: "designarena-hii", name: "Human Intelligence Index · designarena.ai", url: PAGE,
  async scrape(ctx): Promise<ScrapeResult> {
    const { rows, board } = parseHii(await ctx.fetchText(PAGE));
    return { benchmarks: [{ ...HII_BENCHMARK, ...(board.metadata?.lastUpdateTime ? { lastUpdated: board.metadata.lastUpdateTime } : {}) }], rows, notes: [`${rows.length} models`], raw: { "board.json": JSON.stringify(board) } };
  },
};
export default source;
