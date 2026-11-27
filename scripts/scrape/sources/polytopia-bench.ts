/**
 * Polytopia Bench (Kevin Zhang, thekevinz.com/blog/polytopia-bench, published 2026-11-25): each model gets one continuous 40-minute
 * session to write and practice a Rust bot for a Polytopia-style strategy game (rule book, starter code, nine practice maps, a CLI
 * to compile and play). The frozen bot then plays six opponents (two frozen model-written bots, two hybrids of an RL champion, a
 * scripted siege and the full RL champion) on three map families × ten layouts × both seats: 360 games. A win is 1 point, a draw ½,
 * scaled to 100. Five attempts per model, all at high reasoning effort (the harness requires it); the score is their mean.
 *
 * Data: the public archive github.com/kevinz917/superhuman-polytopia-bot. `benchmark/INDEX.md` lists every model and links its
 * archive; the October 31 campaign's models are in its `article-data.json`, and each later follow-up (Claude Fable 5.2, November 10)
 * keeps its own `article-model.json` in the extension folder the index links to. A model in a follow-up replaces the campaign's.
 */
import type { Benchmark, RawRow, ScrapeResult, Source } from "../../../src/data/types";

export const POLYTOPIA_ID = "polytopia-bench";
export const POLYTOPIA_URL = "https://thekevinz.com/blog/polytopia-bench";
export const POLYTOPIA_REPO = "https://github.com/kevinz917/superhuman-polytopia-bot";
const RAW = "https://raw.githubusercontent.com/kevinz917/superhuman-polytopia-bot/main/benchmark/";
const CAMPAIGN = "runner/docs/skirmish/results/continuous-full-20261031/";

interface Cell { opponent: string; map?: string; wins: number; draws: number; losses: number }
export interface PolytopiaModel { id: string; label: string; mean: number; sd: number; trials: { id: string; score: number; cells: Cell[] }[] }
export interface PolytopiaFiles { index: string; campaign: { date: string; models: PolytopiaModel[] }; extensions: Record<string, PolytopiaModel> }

const fail = (what: string): never => { throw new Error(`Polytopia Bench: ${what}; the archive changed?`); };
const round = (x: number, d = 2) => Math.round(x * 10 ** d) / 10 ** d;

/** Follow-up folders the index links to (`extensions/<dir>/README.md`), each with the date its row was evaluated. */
export function indexExtensions(index: string): { dir: string; label: string; date: string }[] {
  const rows = [...index.matchAll(/^\|\s*\[([^\]]+)\]\(extensions\/([^/)]+)\/README\.md\)\s*\|[^|]*\|[^|]*\|\s*(\d{4}-\d{2}-\d{2})\s*\|/gm)];
  return rows.map((m) => ({ label: m[1], dir: m[2], date: m[3] }));
}

/** Index rows: label → evaluated date, for every model the index lists. */
function indexDates(index: string): Map<string, string> {
  const out = new Map<string, string>();
  for (const m of index.matchAll(/^\|\s*\[([^\]]+)\]\([^)]+\)\s*\|\s*([\d.]+)\s*±\s*[\d.]+\s*\|[^|]*\|\s*(\d{4}-\d{2}-\d{2})\s*\|/gm)) out.set(m[1], m[3]);
  return out;
}

export function parsePolytopia(files: PolytopiaFiles): { rows: RawRow[]; benchmark: Benchmark } {
  const dates = indexDates(files.index);
  if (dates.size < 5) fail(`only ${dates.size} rows in INDEX.md`);
  const byId = new Map<string, { m: PolytopiaModel; date: string }>();
  for (const m of files.campaign.models) byId.set(m.id, { m, date: files.campaign.date });
  for (const e of indexExtensions(files.index)) { const m = files.extensions[e.dir] ?? fail(`no article-model.json for ${e.dir}`); byId.set(m.id, { m, date: e.date }); }
  const models = [...byId.values()].sort((a, b) => b.m.mean - a.m.mean);
  // The index is the authors' own table: every model it lists must come out, at the same mean.
  for (const [label] of dates) if (!models.some(({ m }) => m.label === label)) fail(`${label} is in INDEX.md but in no data file`);
  const rows: RawRow[] = models.map(({ m, date }, i) => {
    if (!(m.trials.length >= 3) || !Number.isFinite(m.mean) || !Number.isFinite(m.sd)) fail(`unreadable model ${m.label}`);
    const se = m.sd / Math.sqrt(m.trials.length);
    const champion = m.trials.flatMap((t) => t.cells).filter((c) => c.opponent === "hero-1v1");
    return {
      benchmarkId: POLYTOPIA_ID, modelLabel: m.label, effort: "high", value: round(m.mean), rank: i + 1, sourceUrl: POLYTOPIA_URL,
      ci: [round(m.mean - se), round(m.mean + se)],
      note: `Mean panel points out of 100 (win 1, draw ½) over ${m.trials.length} attempts of 360 games each, evaluated ${date}; the interval is ±1 standard error (sample SD ${round(m.sd)})`,
      details: {
        attempts: m.trials.length, sd: round(m.sd), standardError: round(se), evaluated: date,
        attemptScores: m.trials.map((t) => round(t.score)),
        championWins: champion.reduce((s, c) => s + c.wins, 0), championGames: champion.reduce((s, c) => s + c.wins + c.draws + c.losses, 0),
      },
    };
  });
  const benchmark: Benchmark = {
    id: POLYTOPIA_ID, sourceId: "polytopia-bench", name: "Polytopia Bench", shortName: "Polytopia", url: POLYTOPIA_URL, unit: "score", higherIsBetter: true,
    category: "games", categories: ["games", "coding", "agentic"], normalization: { kind: "linear", min: 0, max: 100 }, eligibleForDefault: false, defaultWeight: 0,
    description: "Each model gets one 40-minute session to write and practice a Rust bot for a Polytopia-style strategy game, then the frozen bot plays 360 games against six fixed opponents, from weak model-written bots to an RL champion. Points out of 100 (win 1, draw ½), averaged over five attempts at high effort.",
  };
  return { rows, benchmark };
}

const source: Source = {
  id: "polytopia-bench", name: "Polytopia Bench", url: POLYTOPIA_URL,
  async scrape(ctx): Promise<ScrapeResult> {
    const index = await ctx.fetchText(RAW + "INDEX.md");
    const campaignText = await ctx.fetchText(RAW + CAMPAIGN + "article-data.json");
    const exts = indexExtensions(index);
    const extTexts = await Promise.all(exts.map((e) => ctx.fetchText(`${RAW}extensions/${e.dir}/article-model.json`)));
    const files: PolytopiaFiles = { index, campaign: JSON.parse(campaignText), extensions: Object.fromEntries(exts.map((e, i) => [e.dir, JSON.parse(extTexts[i]) as PolytopiaModel])) };
    const { rows, benchmark } = parsePolytopia(files);
    if (rows.length < 5) throw new Error(`Polytopia Bench: ${rows.length} models`);
    return {
      benchmarks: [benchmark], rows,
      raw: { "INDEX.md": index, "article-data.json": campaignText, ...Object.fromEntries(exts.map((e, i) => [`${e.dir}-article-model.json`, extTexts[i]])) },
      notes: [`${rows.length} models, #1 ${rows[0].modelLabel} ${rows[0].value}`],
    };
  },
};
export default source;
