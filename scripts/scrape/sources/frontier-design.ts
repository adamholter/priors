/**
 * Frontier Design Benchmark (Contra Labs × BenchFlow, contralabs.com/frontierdesign): models build real websites from client briefs, and
 * professional designers vote blind between pairs of results. `data/fdb.js` holds the Elo standings and `js/rubric.js` the scorecard behind the
 * site's two other tabs: Design critique (the desktop rubric score) and Slop Detector (`clanker`, how AI-made a design looks, lower is better).
 * The human reference and the unnamed stealth entry are left out. The panel's GPT-6 Astra is its ultra-effort run, which the scorecard calls
 * "GPT 6 Astra Ultra". `costUsd` is the mean cost of one output, left out when the site marks it as only a lower bound. GLM-5.3 Prime is the
 * high-speed, higher-priced serving of GLM-5.3: its scores count for GLM-5.3, but its cost is not GLM-5.3's.
 */
import type { Benchmark, RawRow, ScrapeResult, Source } from "../../../src/data/types";
import { findJsObject } from "../js-literal";

export const FRONTIER_DESIGN_ID = "frontier-design";
const ORIGIN = "https://www.contralabs.com/frontierdesign", SITE = "https://contralabs.com/frontierdesign/leaderboard";
const STEALTH = new Set(["gestalt"]), PREMIUM_SERVING = /\bprime\b/i;
type Standing = { name: string; org?: string; golden?: boolean; ranked?: boolean; games?: number; wins?: number; rate?: number; elo?: number; eloLo?: number; eloHi?: number; cost?: number | null; costLowerBound?: boolean | null };
export type DesignBoard = { designers?: string; board: { overall: { votes?: number; reviewers?: number; standings: Standing[] } } };
type Scored = { id: string; name: string; reference?: boolean; rubric?: number | null; clanker?: number | null; rollouts?: number; landing_pages?: number };
export type DesignRubric = { meta: { source?: string; n_tasks?: number }; models: Scored[] };

/** `window.FDB_OURS = {...};`, written as a minified object literal (it was plain JSON until November 2026). */
export function readDesignBoard(js: string): DesignBoard {
  if (!/window\.FDB_OURS\s*=/.test(js)) throw new Error("Frontier Design: data file changed");
  const data = findJsObject(js, ["board"]) as DesignBoard | undefined;
  if (!data?.board?.overall?.standings?.length) throw new Error("Frontier Design: no standings");
  return data;
}

/** The scorecard is an object literal inside the script, found by its `meta` and `models` keys (once `const DATA = {...};`). */
export function readDesignRubric(js: string): DesignRubric {
  const data = findJsObject(js, ["meta", "models"]) as DesignRubric | undefined;
  if (!data) throw new Error("Frontier Design: rubric file changed");
  if (!data.models?.length) throw new Error("Frontier Design: no rubric scores");
  return data;
}

const keyOf = (name: string) => name.toLowerCase().replace(/[^a-z0-9.]+/g, "-").replace(/^-+|-+$/g, "");
const scorecardKey = (name: string) => (keyOf(name) === "gpt-6-astra" ? "gpt-6-astra-ultra" : keyOf(name));

export function parseFrontierDesign(board: DesignBoard, rubric: DesignRubric): { rows: RawRow[]; benchmarks: Benchmark[]; skipped: string[] } {
  const { votes, reviewers, standings } = board.board.overall, tasks = rubric.meta.n_tasks, date = rubric.meta.source?.match(/\d{4}-\d{2}-\d{2}/)?.[0];
  const base = { sourceId: "frontier-design", url: SITE, higherIsBetter: true, category: "creative", categories: ["creative", "preference"], eligibleForDefault: false, defaultWeight: 0, ...(date ? { lastUpdated: date } : {}) } satisfies Partial<Benchmark>;
  const scale = { unit: "score", normalization: { kind: "linear", min: 0, max: 100 } } satisfies Partial<Benchmark>;
  const benchmarks: Benchmark[] = [
    { ...base, id: FRONTIER_DESIGN_ID, name: "Frontier Design Benchmark", shortName: "Frontier Design", unit: "elo", description: `Models build websites from real client briefs, and ${reviewers ?? "professional"} designers vote blind between pairs of results. An Elo rating from ${votes ?? "those"} votes.` },
    { ...base, ...scale, id: `${FRONTIER_DESIGN_ID}-critique`, name: "Frontier Design: Design critique", shortName: "Design critique", description: "Share of the design rubric's aspects a site gets right on desktop, a minor issue counting half, averaged over the model's sites.", variantOf: FRONTIER_DESIGN_ID, variantLabel: "Design critique" },
    { ...base, ...scale, id: `${FRONTIER_DESIGN_ID}-slop`, name: "Frontier Design: Slop Detector", shortName: "Slop Detector", higherIsBetter: false, description: "How AI-made the model's landing pages look, from 0 to 100. Lower is better.", variantOf: FRONTIER_DESIGN_ID, variantLabel: "Slop Detector" },
  ];
  const scores = new Map(rubric.models.filter((m) => !m.reference).map((m) => [keyOf(m.name), m])), rows: RawRow[] = [], skipped: string[] = [];
  for (const s of standings) {
    if (s.golden) continue;
    if (STEALTH.has(keyOf(s.name)) || s.ranked === false || typeof s.elo !== "number") { skipped.push(s.name); continue; }
    const key = scorecardKey(s.name), scored = scores.get(key), common = { modelLabel: s.name, labHint: s.org, sourceUrl: SITE, ...(key !== keyOf(s.name) ? { effort: "ultra" } : {}) };
    const costUsd = typeof s.cost === "number" && s.cost > 0 && !s.costLowerBound && !PREMIUM_SERVING.test(s.name) ? s.cost : undefined;
    rows.push({ ...common, benchmarkId: FRONTIER_DESIGN_ID, value: s.elo, ...(typeof s.eloLo === "number" && typeof s.eloHi === "number" ? { ci: [s.eloLo, s.eloHi] as [number, number] } : {}), ...(costUsd ? { costUsd } : {}), note: `${s.games ?? "?"} votes, ${s.rate != null ? Math.round(s.rate * 100) : "?"}% won`, details: { votes: s.games, wins: s.wins, winRate: s.rate, ...(s.costLowerBound ? { costAtLeastUsd: s.cost } : {}) } });
    if (typeof scored?.rubric === "number") rows.push({ ...common, benchmarkId: `${FRONTIER_DESIGN_ID}-critique`, value: scored.rubric, note: `${scored.rollouts ?? "?"} of ${tasks ?? "?"} sites` });
    if (typeof scored?.clanker === "number") rows.push({ ...common, benchmarkId: `${FRONTIER_DESIGN_ID}-slop`, value: scored.clanker, note: `${scored.landing_pages ?? "?"} landing pages` });
  }
  return { rows, benchmarks, skipped };
}

const source: Source = {
  id: "frontier-design", name: "Frontier Design Benchmark", url: SITE,
  async scrape(ctx): Promise<ScrapeResult> {
    const [boardJs, rubricJs] = [await ctx.fetchText(`${ORIGIN}/data/fdb.js`), await ctx.fetchText(`${ORIGIN}/js/rubric.js`)];
    const { rows, benchmarks, skipped } = parseFrontierDesign(readDesignBoard(boardJs), readDesignRubric(rubricJs)), count = (id: string) => rows.filter((r) => r.benchmarkId === id).length;
    if (count(FRONTIER_DESIGN_ID) < 5) throw new Error("Frontier Design: fewer than 5 ranked models");
    return { benchmarks, rows, raw: { "fdb.js": boardJs, "rubric.js": rubricJs }, notes: [`${benchmarks.map((b) => `${b.id}: ${count(b.id)}`).join(", ")}${skipped.length ? `; left out: ${skipped.join(", ")}` : ""}`] };
  },
};
export default source;
