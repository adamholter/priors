/**
 * DeepFinance (juliusresearch.ai/deep-finance), by Julius Research. Ultra long-horizon Private Equity and
 * Investment Banking workflows (21 tasks, about 27 hours of human work each, ~84 rubric criteria per task,
 * ~19 files per data room), 10 attempts per task. The page is a Next.js server render; its RSC payload carries
 * the leaderboard as a `results` array with score, 95% bootstrap CI, attempts, cost per task and tokens per task,
 * so that array is read rather than the DOM. The site shows each configuration's reasoning setting, which
 * becomes the row's effort. Cost is mean API cost per task; tokens are total tokens per task (kept in details,
 * since the site does not split output tokens).
 */
import type { Source, ScrapeResult, RawRow } from "../../../src/data/types";
import { rscText, balancedJson } from "./_rsc";

const SITE = "https://www.juliusresearch.ai/deep-finance";

type Result = {
  rank?: number; model?: string; lab?: string; reasoning?: string; score?: number; ciLow?: number; ciHigh?: number;
  ci?: number; attempts?: number; costPerTask?: number; tokensPerTask?: number;
};

const stat = (text: string, label: string) => {
  const m = new RegExp(`"children":"${label}"\\}\\],\\["\\$","dd",null,\\{[^}]*"children":"([^"]+)"`).exec(text);
  return m?.[1];
};

export function parseDeepFinance(html: string): ScrapeResult {
  const text = rscText(html);
  const at = text.indexOf('"results":[{');
  if (at < 0) throw new Error("DeepFinance: results array not found in RSC payload");
  const body = balancedJson(text, at + '"results":'.length);
  if (!body) throw new Error("DeepFinance: results array unterminated");
  const results = JSON.parse(body) as Result[];
  const caption = /DeepFinance \(",(\d+)," tasks, ",(\d+)," attempts per task\)/.exec(text);
  const tasks = caption?.[1] ?? stat(text, "tasks");
  const attempts = caption?.[2];
  const hours = stat(text, "average human time")?.match(/[\d.]+/)?.[0];
  const criteria = stat(text, "rubric criteria per task");
  const updated = /"Updated ",\["\$","time",null,\{"dateTime":"([\d-]+)"/.exec(text)?.[1];
  const rows: RawRow[] = [];
  for (const r of results) {
    if (!r.model || typeof r.score !== "number" || !Number.isFinite(r.score)) continue;
    rows.push({
      benchmarkId: "julius-deepfinance", modelLabel: r.model, effort: r.reasoning || undefined, value: r.score,
      ...(typeof r.ciLow === "number" && typeof r.ciHigh === "number" ? { ci: [r.ciLow, r.ciHigh] as [number, number] } : {}),
      costUsd: typeof r.costPerTask === "number" ? r.costPerTask : undefined,
      rank: r.rank, labHint: r.lab, sourceUrl: SITE,
      note: `${r.attempts ?? "?"} attempts${tasks ? ` over ${tasks} tasks` : ""}, 95% CI ${r.ciLow}–${r.ciHigh}`,
      details: { attempts: r.attempts, tokensPerTask: r.tokensPerTask, ciHalfWidth: r.ci },
    });
  }
  if (!rows.length) throw new Error("DeepFinance: no usable rows");
  return {
    benchmarks: [{
      id: "julius-deepfinance", name: "DeepFinance", sourceId: "julius-deepfinance", url: SITE, lastUpdated: updated,
      description: `Julius Research's ultra long-horizon benchmark of real Private Equity and Investment Banking workflows: ${tasks ?? 21} tasks that take a professional about ${hours ?? 27} hours each, scored against ${criteria ?? "about 84"} rubric criteria per task, ${attempts ?? 10} attempts per task. Value is the mean share of rubric criteria met. Cost is mean API cost per task.`,
      normalization: { kind: "linear", min: 0, max: 100 },
      unit: "percent", higherIsBetter: true, category: "agentic", eligibleForDefault: false, defaultWeight: 0,
    }],
    rows,
    raw: { "page.html": html },
    notes: [`${rows.length} configurations`],
  };
}

const source: Source = {
  id: "julius-deepfinance",
  name: "DeepFinance",
  url: SITE,
  async scrape(ctx): Promise<ScrapeResult> {
    return parseDeepFinance(await ctx.fetchText(SITE));
  },
};
export default source;
