/**
 * The GameFeel Benchmark (github.com/kodasdream/gamefeel-benchmark), read from the publisher. Its GitHub Pages site
 * draws every chart from `data/gamefeelbench.csv`, one row per model and effort, so the scraper reads that same file.
 * Models add content and balance changes of their own choosing to 12 unpublished games and are scored in seven
 * subcategories. Value is the board's own headline, the Overall column (`avg`, the mean of the seven subcategories, which
 * is what the site ranks by); the seven subcategory scores go in details. A row with no overall is the publisher's
 * "not run" and is skipped. A subcategory 0 is a published score (the board's own average counts it) and is kept.
 * Since v1.5 the reverse-evaluation section (RE: judging game proposals) is harder and split into blind and assisted runs;
 * its combined score is the board's headline chart and a benchmark of its own (`gamefeel-re`), since some models (Gemini 4
 * Hydrogen) have only that. Both benchmarks carry the board's standard as `version`: the build files a new standard as a new
 * benchmark and freezes the old one (scripts/scrape/version-splits.ts; v1.4 is frozen in sources/frozen/versions).
 */
import { parse } from "csv-parse/sync";
import type { RawRow, ScrapeResult, Source } from "../../../src/data/types";

export const GAMEFEEL_ID = "gamefeel";
export const GAMEFEEL_PAGE = "https://kodasdream.github.io/gamefeel-benchmark/";
const CSV = `${GAMEFEEL_PAGE}data/gamefeelbench.csv`;
const META = `${GAMEFEEL_PAGE}data/meta.json`;
/** The seven subcategories, as the CSV names them. */
const OTHERS = ["create", "bugfix", "gamefeel", "ideas", "visuals", "audio", "re"] as const;
export const GAMEFEEL_RE_ID = "gamefeel-re";
const DATED_BUILD = /\([^)]*\b(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\s+\d{1,2}\)/i;

type Rec = Record<string, string>;
/** A cell as a number. Blank is undefined, never 0: the board uses blank for "no score" and 0 for a score of zero. */
const cell = (v: string | undefined): number | undefined => (v === undefined || v.trim() === "" ? undefined : Number(v));

export function parseGameFeel(csv: string, metaJson?: string): Pick<ScrapeResult, "benchmarks" | "rows" | "notes"> {
  const recs = parse(csv, { columns: true, bom: true, skip_empty_lines: true, relax_column_count: true }) as Rec[];
  const missing = ["model", "effort", "avg", "gamefeel"].filter((c) => !recs.length || !(c in recs[0]));
  if (missing.length) throw new Error(`GameFeel CSV columns changed: no ${missing.join(", ")}`);
  const rows: RawRow[] = [];
  let unscored = 0;
  const reRows: RawRow[] = [];
  for (const r of recs) {
    const label = r.model.trim(), value = cell(r.avg);
    if (!label) continue;
    const re = cell(r.re_combined), blind = cell(r.re_blind), assisted = cell(r.re_assisted);
    // "Qwen-4-Max-Preview (Qwen App Nov 11)": an unreleased build caught in one app on one day, several per model. Not the model.
    const dated = DATED_BUILD.test(label);
    if (!dated && re !== undefined && Number.isFinite(re) && re >= 0 && re <= 100) reRows.push({
      benchmarkId: GAMEFEEL_RE_ID, modelLabel: label, effort: r.effort.trim() || undefined, value: re, labHint: r.lab?.trim() || undefined, sourceUrl: GAMEFEEL_PAGE,
      details: { ...(Number.isFinite(blind) ? { blind } : {}), ...(Number.isFinite(assisted) ? { assisted } : {}) },
      note: [Number.isFinite(blind) ? `blind ${blind}` : "", Number.isFinite(assisted) ? `assisted ${assisted}` : "", r.re_test?.trim() ?? ""].filter(Boolean).join(" · ") || undefined,
    });
    if (value === undefined) { unscored++; continue; } // listed for a side test only, no overall
    if (!Number.isFinite(value) || value < 0 || value > 100) throw new Error(`GameFeel score out of range for ${label}: ${r.avg}`);
    const scores = Object.fromEntries(OTHERS.map((k) => [k, cell(k === "re" ? r.re_combined ?? r.re : r[k])]).filter(([, v]) => Number.isFinite(v))) as Partial<Record<(typeof OTHERS)[number], number>>;
    const price = cell(r.price_per_task_usd), minutes = cell(r.minutes_per_task);
    rows.push({
      benchmarkId: GAMEFEEL_ID, modelLabel: label, effort: r.effort.trim() || undefined, value, labHint: r.lab?.trim() || undefined, sourceUrl: GAMEFEEL_PAGE,
      // The board's price per task mixes subscription, API and free billing and covers all seven subcategories, so it is not a measured run cost.
      details: { ...scores, ...(Number.isFinite(price) ? { pricePerTaskUsd: price, billing: r.billing?.trim() || undefined } : {}), ...(Number.isFinite(minutes) ? { minutesPerTask: minutes } : {}) },
      note: OTHERS.filter((k) => k in scores).map((k) => `${k === "re" ? "RE" : k} ${scores[k]}`).join(" · ") || undefined,
    });
  }
  if (rows.length < 5) throw new Error(`GameFeel CSV schema changed: ${rows.length} scored rows of ${recs.length}`);
  let meta: { updated?: string; standard?: string } = {};
  try { meta = metaJson ? JSON.parse(metaJson) : {}; } catch { /* the date is optional */ }
  const updated = typeof meta.updated === "string" ? meta.updated.match(/^\d{4}-\d{2}-\d{2}/)?.[0] : undefined;
  const version = typeof meta.standard === "string" && /^v?\d+(\.\d+)*$/.test(meta.standard.trim()) ? meta.standard.trim().replace(/^v/, "") : undefined;
  const v = version ? ` v${version}` : "";
  const common = { sourceId: "gamefeel", url: GAMEFEEL_PAGE, unit: "score" as const, higherIsBetter: true, category: "creative" as const, normalization: { kind: "linear" as const, min: 0, max: 100 },
    eligibleForDefault: false, defaultWeight: 0, ...(updated ? { lastUpdated: updated } : {}), ...(version ? { version } : {}) };
  return {
    benchmarks: [...(reRows.length >= 5 ? [{
      ...common, id: GAMEFEEL_RE_ID, name: `GameFeel Reverse Evaluation${v}`, shortName: `GameFeel RE${v}`,
      description: "GameFeel's reverse evaluation (RE), made much harder in v1.5: how well the model gives feedback on game proposals, especially on balance. Score: the board's RE (combined), about two thirds blind runs and one third assisted runs, where the model first sees 39 worked examples; out of 100. Blind and assisted scores are kept in each row's details.",
    }] : []), {
      ...common, id: GAMEFEEL_ID, name: `GameFeel Benchmark${v}`, shortName: `GameFeel${v}`, sourceId: "gamefeel", url: GAMEFEEL_PAGE,
      description: "The GameFeel Benchmark: each model adds 30 to 100 items, mechanics and balance changes of its own choosing to 12 unpublished game projects. Score: the board's Overall, the mean of its seven subcategories (creating, bug fixing, gamefeel, ideas, visuals, audio and reverse evaluation), out of 100. Gamefeel itself, how well the additions keep each game balanced, is rated 1 to 10 per task by human evaluators. All seven subcategory scores are kept in each row's details.",
    }],
    rows: [...rows, ...(reRows.length >= 5 ? reRows : [])],
    notes: [`${rows.length} rows, ${unscored} without an overall score skipped${updated ? `, updated ${updated}` : ""}${meta.standard ? `, standard ${meta.standard}` : ""}`],
  };
}

const source: Source = {
  id: "gamefeel", name: "GameFeel Benchmark", url: GAMEFEEL_PAGE,
  async scrape(ctx): Promise<ScrapeResult> {
    const csv = await ctx.fetchText(CSV);
    const meta = await ctx.fetchText(META).catch((e) => { ctx.log(`meta.json unavailable: ${e instanceof Error ? e.message : e}`); return undefined; });
    return { ...parseGameFeel(csv, meta), raw: { "gamefeelbench.csv": csv, ...(meta ? { "meta.json": meta } : {}) } };
  },
};
export default source;
