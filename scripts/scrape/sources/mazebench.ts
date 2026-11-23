/**
 * MazeBench (https://mazebench.com/): an open world of 256 rooms of 3D block-pushing puzzles with 100 gems hidden across them, played by an
 * agent in its own harness (Codex, Claude Code, Antigravity) through an MCP server in one long run. One gem is one percent. Read from the
 * site's own leaderboard data (`/data/ai-leaderboards.json`, which lists the parts that hold the runs).
 *
 * Two boards with runs today, both ASCII. Without Python ("ASCII · No tools") is the main one: the author calls it "the universal option to
 * test visual spatial reasoning" because the agent cannot write a solver, and it is the board every new model is run on. With Python
 * ("ASCII · Tools") is a sub-board under the id it always had (`bg-maze-bench`, from Jake Boggs' dashboard, which reads only that board),
 * so saved mixes keep it. Runs on the earlier world (71 to 90 gems) count their gems the same way, as the site shows them.
 *
 * A run still going ("running", "continuing") is the score so far; its note says so.
 */
import type { Benchmark, RawRow, ScrapeResult, Source } from "../../../src/data/types";
import { EFFORT_WORDS } from "../../../src/data/normalize";

const PAGE = "https://mazebench.com/leaderboard/ai";
const INDEX = "https://mazebench.com/data/ai-leaderboards.json";
export const MAZEBENCH_ID = "mazebench";
export const MAZEBENCH_TOOLS_ID = "bg-maze-bench";

interface Entry {
  id: string; model: string; organization?: string; harness?: string; reasoning?: string | null; gems?: number; gem_total?: number;
  rooms?: number; room_total?: number; created_at?: string; source?: { status?: string; tools_enabled?: boolean; observation_mode?: string };
}
interface Board { mode: string; tools: boolean; title: string }
export interface MazeIndex { leaderboards: Board[]; parts?: string[] }
export interface MazePart { entries: { board: number; entry: Entry }[] }

const BOARDS: { id: string; mode: string; tools: boolean }[] = [{ id: MAZEBENCH_ID, mode: "ascii", tools: false }, { id: MAZEBENCH_TOOLS_ID, mode: "ascii", tools: true }];
const UNFINISHED = new Set(["running", "continuing"]);

export const MAZEBENCH_BENCHMARKS: Benchmark[] = [
  {
    id: MAZEBENCH_ID, name: "MazeBench", shortName: "MazeBench", sourceId: "mazebench", url: PAGE,
    description: "An agent explores an open world of 256 connected rooms, seen as ASCII text it can rotate in 3D, and solves block-pushing puzzles to collect 100 hidden gems in one long run, without Python, so it cannot write a solver. The share of gems collected.",
    unit: "percent", higherIsBetter: true, category: "games", categories: ["games", "agentic", "reasoning"], versionPolicy: { kind: "fresh" }, defaultWeight: 0,
  },
  {
    id: MAZEBENCH_TOOLS_ID, name: "MazeBench with Python", shortName: "MazeBench (Python)", sourceId: "mazebench", url: PAGE,
    description: "MazeBench with Python allowed: the agent may write programs that simulate the puzzles and search for solutions. The share of the 100 gems collected in one long run.",
    unit: "percent", higherIsBetter: true, category: "games", categories: ["games", "agentic", "reasoning"], versionPolicy: { kind: "fresh" }, defaultWeight: 0,
    variantOf: MAZEBENCH_ID, variantLabel: "With Python",
  },
];

const effortOf = (r: string | null | undefined) => { const w = r?.toLowerCase().trim(); return w && EFFORT_WORDS[w] ? w : undefined; };

/** One row per model and effort on each board: its latest run. */
export function parseMazeBench(index: MazeIndex, parts: MazePart[]): RawRow[] {
  const latest = new Map<string, { benchmarkId: string; e: Entry }>();
  for (const part of parts) for (const { board, entry: e } of part.entries ?? []) {
    const b = index.leaderboards[board], target = b && BOARDS.find((x) => x.mode === b.mode && x.tools === b.tools);
    if (!target || !e?.model || typeof e.gems !== "number" || !Number.isFinite(e.gems)) continue;
    const key = `${target.id}|${e.model}|${effortOf(e.reasoning) ?? ""}`, had = latest.get(key);
    if (!had || (e.created_at ?? "") > (had.e.created_at ?? "")) latest.set(key, { benchmarkId: target.id, e });
  }
  return [...latest.values()].map(({ benchmarkId, e }): RawRow => {
    const effort = effortOf(e.reasoning), going = UNFINISHED.has(e.source?.status ?? "");
    return {
      benchmarkId, modelLabel: e.model, effort, effortUnstated: !effort, value: e.gems!, sourceUrl: PAGE, labHint: e.organization, harness: e.harness,
      note: `${e.gems} of ${e.gem_total ?? 100} gems${e.rooms != null ? `, ${e.rooms} of ${e.room_total ?? 256} rooms` : ""}${e.harness ? `, in ${e.harness}` : ""}${going ? ". Run still going: the score so far" : ""}.`,
    };
  });
}

const source: Source = {
  id: "mazebench", name: "MazeBench · mazebench.com", url: PAGE,
  async scrape(ctx): Promise<ScrapeResult> {
    const index = JSON.parse(await ctx.fetchText(INDEX)) as MazeIndex;
    if (!Array.isArray(index.leaderboards) || !Array.isArray(index.parts) || !index.parts.length) throw new Error("MazeBench leaderboard index has an unexpected shape");
    const parts = await Promise.all(index.parts.map(async (p) => JSON.parse(await ctx.fetchText(new URL(p, INDEX).toString())) as MazePart));
    const rows = parseMazeBench(index, parts);
    if (!rows.some((r) => r.benchmarkId === MAZEBENCH_ID)) throw new Error("MazeBench: no runs on the ASCII board without Python");
    return { benchmarks: MAZEBENCH_BENCHMARKS, rows, notes: [`${rows.length} runs`], raw: { "read.json": JSON.stringify({ rows: rows.length }) } };
  },
};
export default source;
