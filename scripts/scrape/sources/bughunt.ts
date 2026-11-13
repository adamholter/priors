/**
 * Bug Hunt Bench (bughunt.productcompass.pm, Pawel Huryn). 105 real bugs replanted in two production repos (a TypeScript VS Code
 * extension, 45; a React/Supabase LMS, 60). Each model gets one round per repo in its own agentic CLI and a blind judge checks
 * its fixes against a withheld answer key. The site publishes `data/benchmark.json`; `runs` holds every configuration, means of
 * repeated runs included. Read here: the current rows (`superseded` empty), score = planted bugs fixed as a share of 105.
 * Several harnesses for one model and effort (DeepSeek's) collapse to the site's featured row, else the one with the most runs.
 * Quantized local builds ("8-bit") are not the model and are left out. Cost is the whole run (both repos) where the site priced
 * it at list rates or from the bill; floor estimates stay in details.
 */
import type { RawRow, ScrapeResult, Source } from "../../../src/data/types";

export const BUGHUNT_ID = "bughunt";
const SITE = "https://bughunt.productcompass.pm/";
const EFFORTS = new Set(["none", "minimal", "low", "medium", "high", "xhigh", "max"]);

type Run = { id: string; model: string; vendor?: string; harness?: string; effort?: string; effort_status?: string; n_runs?: number; fixed: number; repo1_fixed?: number; repo2_fixed?: number;
  partial?: number; claimed_only?: number; extras?: number; false_positive_fixes?: number; wall_min?: number | null; cost_usd?: number | null; cost_kind?: string; superseded?: unknown; featured?: boolean; local?: boolean; date?: string };
type Data = { meta?: { planted_total?: number; updated?: string }; runs?: Run[] };

export function parseBugHunt(json: Data): Pick<ScrapeResult, "benchmarks" | "rows" | "notes"> {
  const total = json.meta?.planted_total ?? 105;
  const current = (json.runs ?? []).filter((r) => !r.superseded && r.model && Number.isFinite(r.fixed) && !/\b\d+-bit\b/i.test(r.model));
  if (current.length < 10) throw new Error(`Bug Hunt Bench: ${current.length} current rows; data changed?`);
  const best = new Map<string, Run>();
  const rank = (r: Run) => [r.featured ? 1 : 0, r.n_runs ?? 1, r.fixed];
  for (const r of current) {
    // On the mapped effort: "default" and "enabled" both mean no stated effort, so they are one row.
    const key = `${r.model.toLowerCase()}|${r.effort && EFFORTS.has(r.effort) ? r.effort : ""}`, had = best.get(key);
    if (!had) { best.set(key, r); continue; }
    const a = rank(r), b = rank(had);
    if (a[0] > b[0] || (a[0] === b[0] && (a[1] > b[1] || (a[1] === b[1] && a[2] > b[2])))) best.set(key, r);
  }
  const rows: RawRow[] = [...best.values()].map((r) => {
    const effort = r.effort && EFFORTS.has(r.effort) ? r.effort : undefined;
    const priced = r.cost_kind === "list" || r.cost_kind === "bill";
    return {
      benchmarkId: BUGHUNT_ID, modelLabel: r.model, labHint: r.vendor, sourceUrl: SITE, harness: r.harness,
      ...(effort ? { effort } : { effortUnstated: true }),
      value: Math.round((r.fixed / total) * 1000) / 10,
      ...(priced && typeof r.cost_usd === "number" && r.cost_usd > 0 ? { costUsd: r.cost_usd } : {}),
      ...(typeof r.wall_min === "number" && r.wall_min > 0 ? { durationSec: r.wall_min * 60 } : {}),
      note: `${r.fixed} of ${total} planted bugs fixed${(r.n_runs ?? 1) > 1 ? `, mean of ${r.n_runs} runs` : ", one run"}; ${r.harness ?? "?"}${r.cost_kind ? `; cost ${r.cost_kind}` : ""}`,
      details: { fixed: r.fixed, repo1Fixed: r.repo1_fixed, repo2Fixed: r.repo2_fixed, partial: r.partial, claimedOnly: r.claimed_only, extras: r.extras, falsePositiveFixes: r.false_positive_fixes,
        runs: r.n_runs, costUsd: r.cost_usd, costKind: r.cost_kind, effortStatus: r.effort_status, local: r.local, date: r.date, sourceRow: r.id },
    };
  });
  return {
    benchmarks: [{
      id: BUGHUNT_ID, name: "Bug Hunt Bench", shortName: "Bug Hunt", sourceId: BUGHUNT_ID, url: SITE,
      description: `105 real bugs replanted in two production repos (a TypeScript VS Code extension and a React/Supabase app) with their tests still passing. Each model gets one round per repo in its own coding CLI; a blind judge checks its fixes against a withheld answer key. Share of the ${total} bugs fixed; partial fixes and extra real fixes are kept in details but not scored. By Pawel Huryn.`,
      unit: "percent", higherIsBetter: true, category: "coding", normalization: { kind: "linear", min: 0, max: 100 },
      eligibleForDefault: false, defaultWeight: 0, ...(json.meta?.updated ? { lastUpdated: json.meta.updated } : {}),
    }],
    rows,
    notes: [`${rows.length} model and effort rows from ${current.length} current configurations`],
  };
}

const source: Source = {
  id: BUGHUNT_ID, name: "Bug Hunt Bench", url: SITE,
  async scrape(ctx): Promise<ScrapeResult> {
    const text = await ctx.fetchText(`${SITE}data/benchmark.json`);
    return { ...parseBugHunt(JSON.parse(text) as Data), raw: { "benchmark.json": text } };
  },
};
export default source;
