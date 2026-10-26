/**
 * DeepSWE (DataCurve) — long-horizon SWE benchmark. Two leaderboards: v1.1 and v1.
 * Data: the site fetches `/artifacts/<version>/leaderboard-live.json` (discovered from the HTML);
 * we read the same files. Labels are rendered the way the site does (`gpt-5-6-sol` -> `gpt-5.6-sol`),
 * with the effort tag kept separate.
 */
import type { Source, ScrapeResult, RawRow } from "../../../src/data/types";

const SITE = "https://deepswe.datacurve.ai";

interface LiveRow {
  model: string; harness?: string; provider?: string; reasoning_effort?: string | null; config?: string;
  pass_at_1?: number; pass_rate?: number; ci_lo?: number; ci_hi?: number; n_tasks_attempted?: number; n_runs?: number;
  mean_cost_usd?: number; mean_output_tokens?: number; mean_agent_steps?: number; mean_duration_seconds?: number;
}
interface Live { generated_at?: string; n_tasks_in_set?: number; rows: LiveRow[] }

/** Mirrors the site's display function: strip provider prefix, join digit-digit hyphens with dots, drop -preview. */
export function displayModel(id: string): string {
  return id
    .replace(/^[a-z0-9-]+\//, "")
    .replace(/(\d)-(\d)(?=-|$)/g, "$1.$2")
    .replace(/(\d)\.(\d)\.(\d)(?=-|$)/g, "$1.$2.$3")
    .replace(/-preview$/, "");
}

const source: Source = {
  id: "deepswe",
  name: "DeepSWE",
  url: `${SITE}/`,
  async scrape(ctx): Promise<ScrapeResult> {
    const html = await ctx.fetchText(this.url);
    const raw: Record<string, string> = { "page.html": html };
    // Discover artifact paths from the page; fall back to the known layout.
    const found = new Set<string>();
    for (const m of html.matchAll(/artifacts\/(v[\d.]+)\/leaderboard-live\.json/g)) found.add(m[1]);
    const versions = ["v1.1", "v1"];
    for (const v of versions) if (!found.has(v)) ctx.log(`artifact for ${v} not referenced in HTML; trying anyway`);

    const rows: RawRow[] = [];
    const notes: string[] = [];
    for (const v of versions) {
      const url = `${SITE}/artifacts/${v}/leaderboard-live.json`;
      const live = await ctx.fetchJson<Live>(url);
      raw[`leaderboard-live-${v}.json`] = JSON.stringify(live, null, 2);
      const benchId = v === "v1.1" ? "deepswe-1.1" : "deepswe-1";
      const sorted = [...live.rows].sort((a, b) => (b.pass_at_1 ?? b.pass_rate ?? 0) - (a.pass_at_1 ?? a.pass_rate ?? 0));
      let n = 0;
      for (const r of sorted) {
        const p = r.pass_at_1 ?? r.pass_rate;
        if (p == null || !Number.isFinite(p)) continue;
        const effort = r.reasoning_effort ?? undefined;
        rows.push({
          benchmarkId: benchId,
          modelLabel: displayModel(r.model),
          effort: effort ?? undefined,
          value: p * 100,
          ci: r.ci_lo != null && r.ci_hi != null ? [r.ci_lo * 100, r.ci_hi * 100] : undefined,
          costUsd: r.mean_cost_usd ?? undefined,
          outputTokens: r.mean_output_tokens != null ? Math.round(r.mean_output_tokens) : undefined,
          steps: r.mean_agent_steps != null ? Math.round(r.mean_agent_steps) : undefined,
          durationSec: r.mean_duration_seconds ?? undefined,
          harness: r.harness,
          sourceUrl: this.url,
          labHint: r.provider,
          note: `${r.n_tasks_attempted ?? "?"} tasks x ${r.n_runs ?? "?"} runs; config ${r.config ?? ""}`.trim(),
        });
        n++;
      }
      notes.push(`${v}: ${n} configs, generated ${live.generated_at ?? "?"}`);
    }

    const common = {
      sourceId: this.id, unit: "percent" as const, higherIsBetter: true, category: "coding" as const,
    };
    return {
      benchmarks: [
        {
          ...common, id: "deepswe-1.1", name: "DeepSWE v1.1", shortName: "DeepSWE 1.1", url: this.url,
          description: "Pass@1 on 113 original long-horizon software engineering tasks across 91 repos and 5 languages, run with mini-swe-agent in isolated environments (v1.1 fixes dependency drift and flaky tasks).",
          versionPolicy: { kind: "fallback", fallbackTo: "deepswe-1" }, eligibleForDefault: true, defaultWeight: 10,
        },
        {
          ...common, id: "deepswe-1", name: "DeepSWE v1", shortName: "DeepSWE 1", url: this.url,
          description: "Original DeepSWE leaderboard: pass@1 on 113 long-horizon SWE tasks with mini-swe-agent. Used as fallback for models not yet run on v1.1.",
          eligibleForDefault: false, defaultWeight: 0,
        },
      ],
      rows, raw, notes,
    };
  },
};
export default source;
