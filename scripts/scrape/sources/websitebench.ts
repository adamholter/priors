/**
 * WebsiteBench (website-bench.com, TIGER-AI-Lab): an agent explores a production-level website only through a browser (no HTML,
 * JS, CSS or server source) and must rebuild it full-stack to match its look and behaviour. 70 expert-built sites, ~47k hidden
 * tests in three groups: Request (HTTP responses), Browser (interface responses, state changes, workflows) and System (build,
 * security, persistence). The page embeds its leaderboard as `#leaderboard-data` JSON. Value: Overall, the site's default ranking,
 * test-pooled (100 x passed / total hidden tests). Cost is the site's mean API cost per task.
 */
import type { RawRow, ScrapeResult, Source } from "../../../src/data/types";

export const WEBSITEBENCH_ID = "websitebench";
const SITE = "https://website-bench.com/";

type Model = { id: string; name: string; org?: string; group?: string; overall?: number; request?: number; browser?: number; system?: number;
  cost?: number; tokens?: number; turns?: number; score_counts?: Record<string, { passed: number; total: number }> };
type Board = { cohort_id?: string; total_tasks?: number; models?: Model[] };

export function parseWebsiteBench(html: string): Pick<ScrapeResult, "benchmarks" | "rows" | "notes"> {
  const m = html.match(/id="leaderboard-data"[^>]*>([\s\S]*?)<\/script>/);
  if (!m) throw new Error("WebsiteBench: no #leaderboard-data on the page");
  const board = JSON.parse(m[1]) as Board;
  const tasks = board.total_tasks ?? 70;
  const rows: RawRow[] = [];
  for (const x of board.models ?? []) {
    if (!x.name || typeof x.overall !== "number" || !Number.isFinite(x.overall)) continue;
    const cost = typeof x.cost === "number" && x.cost > 0 ? x.cost : undefined;
    const n = x.score_counts?.overall;
    rows.push({
      benchmarkId: WEBSITEBENCH_ID, modelLabel: x.name, labHint: x.org, sourceUrl: SITE, value: Math.round(x.overall * 10) / 10, effortUnstated: true,
      ...(cost ? { costUsd: cost } : {}),
      note: `${n ? `${n.passed.toLocaleString("en-US")} of ${n.total.toLocaleString("en-US")} hidden tests` : "hidden tests"}; request ${x.request?.toFixed(1)}, browser ${x.browser?.toFixed(1)}, system ${x.system?.toFixed(1)}`,
      details: { request: x.request, browser: x.browser, system: x.system, tokensM: x.tokens, turns: x.turns, passed: n?.passed, total: n?.total },
    });
  }
  if (rows.length < 5) throw new Error(`WebsiteBench: ${rows.length} rows; page changed?`);
  return {
    benchmarks: [{
      id: WEBSITEBENCH_ID, name: "WebsiteBench", shortName: "WebsiteBench", sourceId: WEBSITEBENCH_ID, url: SITE,
      description: `Rebuilding a production website from browser exploration alone: the agent sees screenshots and can click, type and navigate, but never the site's HTML, JavaScript, CSS or server code, and must write a full-stack copy that looks and behaves the same. ${tasks} expert-built sites checked by hidden request, browser and system tests; share of tests passed, pooled over all tasks, with mean API cost per task. From TIGER-AI-Lab.`,
      unit: "percent", higherIsBetter: true, category: "coding",
      eligibleForDefault: false, defaultWeight: 0,
    }],
    rows,
    notes: [`${rows.length} models, cohort ${board.cohort_id ?? "?"}`],
  };
}

const source: Source = {
  id: WEBSITEBENCH_ID, name: "WebsiteBench", url: SITE,
  async scrape(ctx): Promise<ScrapeResult> {
    const html = await ctx.fetchText(SITE);
    return { ...parseWebsiteBench(html), raw: { "index.html": html } };
  },
};
export default source;
