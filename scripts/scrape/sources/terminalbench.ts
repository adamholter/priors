/**
 * Terminal-Bench (Laude Institute / Stanford). tbench.ai publishes only the current version (4.1 since
 * 2026-11-09); the page embeds a react-query dehydrated state (leaderboard + rows) in its RSC payload.
 * The benchmark id follows the leaderboard's title, so a new version gets its own id instead of
 * overwriting the last one. Older leaderboards (4.0, 2.1, 2.0) remain published on Harbor Hub,
 * rendered client-side, so we read their tables with Playwright (best effort; failures there do not
 * fail the source).
 */
import type { Source, ScrapeResult, RawRow, Benchmark } from "../../../src/data/types";
import { num, ci as parseCi } from "../harness";
import { rscText, extractKeyed } from "./_rsc";

const SITE = "https://www.tbench.ai/";
const HUB = "https://hub.harborframework.com";

interface TbRow {
  rank?: number;
  metadata: {
    date?: string; reasoning_effort?: string;
    agent_display?: { label: string; url?: string }; model_display?: { label: string; url?: string };
    agent_org?: { label: string }; model_org?: { label: string };
  };
  metrics: {
    accuracy: number; accuracy_ci95_half_width?: number; n_trials?: number; total_cost_usd?: number;
    output_tokens?: number; avg_trial_duration_sec?: number; display_accuracy?: string;
  };
  status?: string;
}
interface TbState { leaderboard: { name: string; title: string; description?: string }; rows: TbRow[] }

const TASKS_4 = "66 professional computer-work tasks in a terminal (5 trials per task, 8-hour timeout). Rows are harness+model pairs.";
/** Versions tbench.ai has shown as its main board: id, the version it supersedes, what it is. */
const MAIN: Record<string, { id: string; supersedes: string; desc: string }> = {
  "4.0": { id: "terminalbench-4", supersedes: "terminalbench-2.1", desc: `Resolution rate of agent+model systems on ${TASKS_4}` },
  "4.1": { id: "terminalbench-4.1", supersedes: "terminalbench-4", desc: `Resolution rate of agent+model systems on ${TASKS_4} 4.1 re-grades 4.0's trials with updated verifiers that resist reward hacking and cut false negatives (about 1% of rewards flipped).` },
};

const OLDER: { slug: string; hubPath: string; name: string; desc: string; supersedes?: string }[] = [
  { slug: "terminalbench-4", hubPath: "terminal-bench/terminal-bench/4.0.0", name: "Terminal-Bench 4.0", desc: `Terminal-Bench 4.0: resolution rate of agent+model systems on ${TASKS_4} Kept for time travel; 4.1 re-grades the same trials.`, supersedes: "terminalbench-2.1" },
  { slug: "terminalbench-2.1", hubPath: "terminal-bench/terminal-bench-2-1/latest", name: "Terminal-Bench 2.1", desc: "Terminal-Bench 2.1 (verified revision of 2.0): task resolution rate for agent+model pairs on terminal tasks. Kept for time travel." },
  { slug: "terminalbench-2", hubPath: "terminal-bench/terminal-bench-2/latest", name: "Terminal-Bench 2.0", desc: "Terminal-Bench 2.0: task resolution rate for agent+model pairs on 89 terminal tasks. Kept for time travel." },
];

const source: Source = {
  id: "terminalbench",
  name: "Terminal-Bench",
  url: SITE,
  async scrape(ctx): Promise<ScrapeResult> {
    const rows: RawRow[] = [];
    const raw: Record<string, string> = {};
    const notes: string[] = [];
    const benchmarks: Benchmark[] = [];

    // ---- current version from tbench.ai RSC payload
    const html = await ctx.fetchText(SITE);
    raw["tbench-main.html"] = html;
    const text = rscText(html);
    const state = extractKeyed<TbState>(text, "data").find((d) => d?.leaderboard?.name && Array.isArray(d.rows));
    if (!state) throw new Error("Terminal-Bench: no dehydrated leaderboard state found");
    raw["tbench-main-state.json"] = JSON.stringify(state, null, 2);
    const title = state.leaderboard.title; // "Terminal-Bench 4.1"
    const version = title.match(/(\d+\.\d+)/)?.[1] ?? "";
    // An unknown version must not land under the last one's id: fail the source (its previous rows are kept) until it is added to MAIN.
    const main = MAIN[version];
    if (!main) throw new Error(`Terminal-Bench: main leaderboard is "${title}"; add version ${version || "?"} to MAIN in terminalbench.ts`);
    const sorted = [...state.rows].filter((r) => (r.status ?? "display") === "display").sort((a, b) => b.metrics.accuracy - a.metrics.accuracy);
    for (const r of sorted) {
      const acc = r.metrics.accuracy, half = r.metrics.accuracy_ci95_half_width;
      const trials = r.metrics.n_trials;
      rows.push({
        benchmarkId: main.id,
        modelLabel: r.metadata.model_display?.label ?? "",
        effort: r.metadata.reasoning_effort || undefined,
        value: acc,
        ci: half != null ? [acc - half, acc + half] : undefined,
        costUsd: r.metrics.total_cost_usd != null && trials ? r.metrics.total_cost_usd / trials : undefined,
        outputTokens: r.metrics.output_tokens != null && trials ? Math.round(r.metrics.output_tokens / trials) : undefined,
        durationSec: r.metrics.avg_trial_duration_sec ?? undefined,
        harness: r.metadata.agent_display?.label,
        rank: r.rank,
        sourceUrl: SITE,
        labHint: r.metadata.model_org?.label,
        releaseDateHint: r.metadata.date,
        note: trials ? `${trials} trials; cost/tokens are per-trial averages of published totals` : undefined,
      });
    }
    notes.push(`${version}: ${sorted.length} rows`);
    benchmarks.push({
      id: main.id, name: `Terminal-Bench ${version}`, shortName: `TB ${version}`, sourceId: this.id, url: SITE,
      description: main.desc,
      unit: "percent", higherIsBetter: true, category: "agentic",
      versionPolicy: { kind: "fresh", supersedes: main.supersedes }, eligibleForDefault: true, defaultWeight: 25,
    });

    // ---- older versions on Harbor Hub (client rendered)
    for (const old of OLDER) {
      if (old.slug === main.id) continue;
      const url = `${HUB}/datasets/${old.hubPath}?tab=leaderboard`;
      try {
        const table = await ctx.withPage(url, async (page) => {
          await page.waitForSelector("table tbody tr", { timeout: 60_000, state: "attached" });
          return page.$$eval("table", (tables) => tables.map((t) => ({
            headers: Array.from(t.querySelectorAll("thead th")).map((th) => (th.textContent ?? "").trim()),
            rows: Array.from(t.querySelectorAll("tbody tr")).map((tr) => Array.from(tr.querySelectorAll("td")).map((td) => (td.textContent ?? "").replace(/\s+/g, " ").trim())),
          })));
        });
        raw[`${old.slug}-table.json`] = JSON.stringify(table, null, 2);
        const t = table.find((x) => x.headers.some((h) => /accuracy/i.test(h)));
        if (!t) throw new Error("no accuracy table");
        const col = (re: RegExp) => t.headers.findIndex((h) => re.test(h));
        const iModel = col(/^model$/i), iAgent = col(/^agent$/i), iEff = col(/effort/i), iAcc = col(/accuracy/i), iCost = col(/^cost$/i), iRank = col(/^#$/), iDate = col(/release date/i);
        let n = 0;
        for (const cells of t.rows) {
          const label = cells[iModel];
          const acc = num(cells[iAcc]);
          if (!label || acc == null) continue;
          const c = parseCi(cells[iAcc]);
          rows.push({
            benchmarkId: old.slug,
            modelLabel: label,
            effort: iEff >= 0 && cells[iEff] && cells[iEff] !== "-" ? cells[iEff] : undefined,
            value: acc,
            ci: c,
            harness: iAgent >= 0 ? cells[iAgent] : undefined,
            rank: iRank >= 0 ? num(cells[iRank]) : undefined,
            sourceUrl: url,
            note: iCost >= 0 && cells[iCost] ? `published total cost ${cells[iCost]}${iDate >= 0 ? `; ${cells[iDate]}` : ""}` : undefined,
          });
          n++;
        }
        benchmarks.push({
          id: old.slug, name: old.name, sourceId: this.id, url, description: old.desc,
          unit: "percent", higherIsBetter: true, category: "agentic", versionPolicy: { kind: "fresh", supersedes: old.supersedes }, eligibleForDefault: false, defaultWeight: 0,
        });
        notes.push(`${old.name}: ${n} rows`);
      } catch (e) {
        notes.push(`${old.name} skipped: ${e instanceof Error ? e.message : String(e)}`);
      }
    }

    return { benchmarks, rows, raw, notes };
  },
};
export default source;
