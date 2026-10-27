/**
 * DuelLab GameBench 2 (benchmarks.duellab.org). Models write game-playing programs from a rules
 * description; DuelLab compiles them and runs head-to-head tournaments on hidden abstract strategy
 * games. Headline 0-100 score = average performance across games, penalised for programs that fail to
 * run. The public export has one row per model and reasoning setting in the "Reasoning Variants"
 * track (row_kind=track); per-game rows are ignored.
 */
import { parse } from "csv-parse/sync";
import type { RawRow, ScrapeResult, Source } from "../../../src/data/types";

const SITE = "https://benchmarks.duellab.org/";
const CSV = `${SITE}leaderboard.csv`;
const EFFORT = /^(none|minimal|low|medium|high|xhigh|max)$/i;

type Rec = Record<string, string>;

export function parseDuelLab(csv: string): ScrapeResult {
  const recs = parse(csv, { columns: true, bom: true, skip_empty_lines: true, relax_column_count: true }) as Rec[];
  const rows: RawRow[] = [];
  let release = "";
  for (const r of recs) {
    if (r.row_kind !== "track" || r.track_id !== "full_freedom/mixed") continue;
    if (r.eligibility_flag !== "true" || r.ranking_status !== "ranked") continue;
    const value = Number(r.score);
    if (!r.model_display_name || !Number.isFinite(value)) continue;
    release = r.results_cut_id || release;
    const lo = Number(r.min_score), hi = Number(r.max_score);
    const effort = EFFORT.test(r.reasoning_level) ? r.reasoning_level.toLowerCase() : undefined;
    rows.push({
      benchmarkId: "duellab-gamebench2", modelLabel: r.model_display_name, effort, value,
      ci: Number.isFinite(lo) && Number.isFinite(hi) ? [lo, hi] : undefined,
      rank: Number(r.rank) || undefined, sourceUrl: SITE, labHint: r.provider || undefined,
      note: `${r.reasoning_level || "default"} · Elo ${Math.round(Number(r.raw_elo))} · ${r.wins}W ${r.losses}L ${r.draws}D`,
      details: { rawElo: Number(r.raw_elo), pluginSuccessRate: Number(r.plugin_success_rate), wins: Number(r.wins), losses: Number(r.losses), draws: Number(r.draws) },
    });
  }
  if (!rows.length) throw new Error("DuelLab GameBench 2: no ranked rows");
  return {
    benchmarks: [{
      id: "duellab-gamebench2", name: "DuelLab GameBench 2", shortName: "GameBench 2", sourceId: "duellab", url: SITE, lastUpdated: release.replace(/^gb2-/, "").slice(0, 8) || undefined,
      description: "Models write game-playing programs from a rules description; the programs are compiled and play head-to-head tournaments on hidden abstract strategy games. 0-100 score, penalised for programs that fail to run.",
      normalization: { kind: "linear", min: 0, max: 100 },
      unit: "score", higherIsBetter: true, category: "coding", eligibleForDefault: false, defaultWeight: 0,
    }],
    rows, raw: { "leaderboard.csv": csv }, notes: [`${rows.length} rows`],
  };
}

const source: Source = {
  id: "duellab", name: "DuelLab", url: SITE,
  async scrape(ctx): Promise<ScrapeResult> { return parseDuelLab(await ctx.fetchText(CSV)); },
};
export default source;
