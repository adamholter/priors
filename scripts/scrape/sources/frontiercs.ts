/**
 * FrontierCS 2 (frontier-cs.org), read from the publisher. The home page loads its leaderboard from a hashed
 * `/assets/js/fcs2-data.js`, found live from the page's script tag. That file is minified code, so the model list,
 * pass rates, FCI and update date are matched as literals, never evaluated. Priors used to read this board second
 * hand from Jake Boggs' dashboard, which lagged it; the id stays `bg-frontier-cs-2` so saved mixes keep working.
 */
import type { RawRow, Source } from "../../../src/data/types";

export const FRONTIER_CS_ID = "bg-frontier-cs-2";
export const FRONTIER_CS_PAGE = "https://frontier-cs.org/";

const MONTHS = ["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december"];

/** "November 6, 2026" as YYYY-MM-DD. */
function isoDate(text: string): string | undefined {
  const m = text.trim().toLowerCase().match(/^([a-z]+)\s+(\d{1,2}),\s*(\d{4})$/);
  const month = m ? MONTHS.indexOf(m[1]) + 1 : 0;
  return m && month ? `${m[3]}-${String(month).padStart(2, "0")}-${m[2].padStart(2, "0")}` : undefined;
}

/** `{a:[1,2,3],"b-c":[4,5,6]}` after `NAME=`, as id -> numbers. */
function numberTable(js: string, name: string): Map<string, number[]> {
  const body = js.match(new RegExp(`\\b${name}=\\{([^{}]*)\\}`))?.[1];
  const out = new Map<string, number[]>();
  if (!body) return out;
  for (const m of body.matchAll(/"?([\w-]+)"?:\[([-\d.,\s]+)\]/g)) out.set(m[1], m[2].split(",").map(Number));
  return out;
}

export function parseFrontierCs(js: string): { rows: RawRow[]; updated?: string } {
  const models = [...js.matchAll(/\{id:"([^"]+)",name:"([^"]+)",short:"[^"]*",h:"([^"]*)",lab:"([^"]*)"\}/g)].map((m) => ({ id: m[1], name: m[2], harness: m[3], lab: m[4] }));
  const pass = numberTable(js, "PASS"), fci = numberTable(js, "ECI");
  const updated = isoDate(js.match(/\bUPDATED="([^"]+)"/)?.[1] ?? "");
  if (models.length < 5 || pass.size < 5) throw new Error(`FrontierCS data schema changed: ${models.length} models, ${pass.size} pass rates`);
  const rows: RawRow[] = [];
  for (const m of models) {
    const p = pass.get(m.id);
    if (!p) continue; // listed but not yet scored
    const [rate, passed, tasks] = p, f = fci.get(m.id);
    if (!Number.isFinite(rate) || rate < 0 || rate > 100 || !(tasks > 0)) throw new Error(`FrontierCS pass rate out of range for ${m.name}`);
    rows.push({
      benchmarkId: FRONTIER_CS_ID, modelLabel: m.name, value: rate, labHint: m.lab, sourceUrl: FRONTIER_CS_PAGE,
      ...(m.harness ? { harness: m.harness } : {}),
      details: { passed, tasks, ...(f ? { fci: f[0], fciInterval: [f[1], f[2]] } : {}) },
      note: `${passed} of ${tasks} tasks beat the human reference${m.harness ? `; harness ${m.harness}` : ""}${f ? `; FCI ${f[0]}` : ""}`,
    });
  }
  return { rows, updated };
}

const source: Source = {
  id: "frontiercs", name: "FrontierCS", url: FRONTIER_CS_PAGE,
  async scrape(ctx) {
    const html = await ctx.fetchText(FRONTIER_CS_PAGE);
    const src = html.match(/<script[^>]*\bsrc="([^"]*fcs2-data\.js[^"]*)"/)?.[1];
    if (!src) throw new Error("FrontierCS page no longer loads fcs2-data.js");
    const js = await ctx.fetchText(new URL(src, FRONTIER_CS_PAGE).toString());
    const { rows, updated } = parseFrontierCs(js);
    return {
      benchmarks: [{
        id: FRONTIER_CS_ID, name: "FrontierCS 2", shortName: "FrontierCS 2", sourceId: this.id, url: FRONTIER_CS_PAGE,
        description: "FrontierCS 2: 48 open-ended research-grade computer science tasks, each run once in the model's own agent harness. Score: share of tasks whose final submission beats the human reference on every metric and hidden workload. The board's FCI index is kept in each row's details.",
        unit: "percent" as const, higherIsBetter: true, category: "reasoning" as const, versionPolicy: { kind: "fresh" as const },
        normalization: { kind: "linear" as const, min: 0, max: 100 }, eligibleForDefault: false, defaultWeight: 0,
        ...(updated ? { lastUpdated: updated } : {}),
      }],
      rows, raw: { "frontier-cs.html": html, "fcs2-data.js": js }, notes: [`${rows.length} models${updated ? `, updated ${updated}` : ""}`],
    };
  },
};
export default source;
