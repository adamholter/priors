/**
 * OpenTTD-Bench (openttd-bench.com, Dylan Fetch): each model runs a transport company in OpenTTD for three in-game years on one
 * fixed 128 x 128 map (seed 125001, 16 towns), through the open-source OpenTTD MCP tools inside its own agent harness, with the
 * game clock running while it thinks. A model needs at least five complete, independently re-verified games; the board ranks its
 * median game. The site publishes `data/leaderboard.json`; `arms` holds each model and effort with its medians. Value: median
 * final-year operating profit in pounds, the site's default ranking. The human baseline (the author's own games) is a reference,
 * not a row; retired arms (replaced by a newer run of the model) still count as measurements. Cost is the median API cost per game
 * where the site recorded or estimated it.
 */
import type { RawRow, ScrapeResult, Source } from "../../../src/data/types";

export const OPENTTD_ID = "openttd";
const SITE = "https://openttd-bench.com/";
const EFFORTS = new Set(["none", "minimal", "low", "medium", "high", "xhigh", "max"]);

type Arm = { key: string; model: string; company?: string; client?: string; effort?: string | null; status?: string; cost_basis?: string | null;
  medians?: Record<string, number | null>; games?: unknown[] };
type Data = { updated?: string; companies?: { key: string; name: string; reference?: boolean }[]; arms?: Arm[] };

const pounds = (n: number) => `£${Math.round(n).toLocaleString("en-GB")}`;

export function parseOpenTtd(json: Data): Pick<ScrapeResult, "benchmarks" | "rows" | "notes"> {
  const reference = new Set((json.companies ?? []).filter((c) => c.reference).map((c) => c.key));
  const lab = new Map((json.companies ?? []).map((c) => [c.key, c.name]));
  const arms = json.arms ?? [];
  const human = arms.find((a) => a.company && reference.has(a.company));
  const rows: RawRow[] = [];
  for (const a of arms) {
    if (!a.model || (a.company && reference.has(a.company))) continue;
    const m = a.medians ?? {}, profit = m.profit;
    if (typeof profit !== "number" || !Number.isFinite(profit)) continue;
    const effort = a.effort && EFFORTS.has(a.effort) ? a.effort : undefined;
    const cost = typeof m.cost_usd === "number" && m.cost_usd > 0 && a.cost_basis !== "unavailable" ? m.cost_usd : undefined;
    rows.push({
      benchmarkId: OPENTTD_ID, modelLabel: a.model, labHint: a.company ? lab.get(a.company) : undefined, harness: a.client, sourceUrl: SITE, value: Math.round(profit),
      ...(effort ? { effort } : { effortUnstated: true }), ...(cost ? { costUsd: cost } : {}),
      note: `median of ${a.games?.length ?? "?"} games; company value ${typeof m.value === "number" ? pounds(m.value) : "?"}, fleet ${m.fleet ?? "?"}; ${a.client ?? "?"}${a.status === "retired" ? "; retired arm" : ""}${cost && a.cost_basis === "estimated_standard_api_list_price" ? "; cost estimated at list price" : ""}`,
      details: { games: a.games?.length, companyValue: m.value, fleet: m.fleet, profitPerVehicle: m.ppv, cargoPerYear: m.fyc, marginPct: m.margin, toolCalls: m.calls, costBasis: a.cost_basis, status: a.status, arm: a.key },
    });
  }
  if (rows.length < 5) throw new Error(`OpenTTD-Bench: ${rows.length} rows; leaderboard.json changed?`);
  const humanNote = human?.medians?.profit != null ? ` The author's own human games, on the same map, median ${pounds(human.medians.profit)}.` : "";
  return {
    benchmarks: [{
      id: OPENTTD_ID, name: "OpenTTD-Bench", shortName: "OpenTTD", sourceId: OPENTTD_ID, url: SITE,
      description: `Running a transport company in OpenTTD (a Transport Tycoon remake) for three in-game years on one fixed map, through game tools in the model's own agent harness, with the clock running while it thinks. Score: median final-year operating profit in pounds over at least five verified games.${humanNote} By Dylan Fetch.`,
      unit: "score", higherIsBetter: true, category: "games",
      eligibleForDefault: false, defaultWeight: 0,
    }],
    rows,
    notes: [`${rows.length} model arms${human ? ", human baseline in the description" : ""}`],
  };
}

const source: Source = {
  id: OPENTTD_ID, name: "OpenTTD-Bench", url: SITE,
  async scrape(ctx): Promise<ScrapeResult> {
    const text = await ctx.fetchText(`${SITE}data/leaderboard.json`);
    return { ...parseOpenTtd(JSON.parse(text) as Data), raw: { "leaderboard.json": text } };
  },
};
export default source;
