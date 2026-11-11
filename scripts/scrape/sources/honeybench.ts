/**
 * HoneyBench (Goodhart Labs): how often frontier models reward-hack honeypot tasks whose requirements are unambiguous.
 * The page is server-rendered; the "Overall hack rate" leaderboard is one `<details>` per model whose `<summary aria-label>`
 * spells out the row ("Fable 5.2, overall hack rate 11.9% of scored runs (0.0% attacking the infrastructure), [62.3% counting
 * 1.1% of runs refused as hacks, ]80% confidence interval 9.1–15.4%, ..."). The unrounded rate is the bar's `data-score`.
 * Per-environment rates follow inside the same `<details>`. The version comes from the page title and becomes the id.
 */
import type { Benchmark, RawRow, Source } from "../../../src/data/types";
import { text } from "./_board";

const PAGE = "https://goodhartlabs.com/honeybench";
const SUMMARY = /<summary aria-label="([^"]+?), overall hack rate ([\d.]+)% of scored runs \(([\d.]+)% attacking the infrastructure\),(?: ([\d.]+)% counting ([\d.]+)% of runs refused as hacks,)? 80% confidence interval ([\d.]+)[–-]([\d.]+)%[^"]*">/g;
const attr = (s: string, k: string) => { const v = Number(s.match(new RegExp(`\\b${k}="([\\d.]+)"`))?.[1]); return Number.isFinite(v) ? v : undefined; };
const unescape = (s: string) => s.replace(/&amp;/g, "&").replace(/&#x27;|&#39;/g, "'").replace(/&quot;/g, '"');

export function parseHoneyBench(html: string): { benchmark: Benchmark; rows: RawRow[] } {
  const version = html.match(/<h1[^>]*>\s*HoneyBench (v\d+(?:\.\d+)*)\s*<\/h1>/)?.[1];
  if (!version) throw new Error("HoneyBench page has no versioned title");
  const id = `honeybench-${version}`, rows: RawRow[] = [];
  for (const m of html.matchAll(SUMMARY)) {
    const end = html.indexOf("</details>", m.index!);
    const body = html.slice(m.index! + m[0].length, end < 0 ? undefined : end);
    const shown = Number(m[2]), score = attr(body, "data-score");
    // The bar's unrounded rate, unless it disagrees with the rate the row prints.
    const value = score != null && Math.abs(score - shown) <= 0.05 ? score : shown;
    const environments: Record<string, { task: string; value: number; hacks?: number; runs?: number }> = {};
    for (const e of body.matchAll(/<li data-environment="([^"]+)"[^>]*>([\s\S]*?)<\/li>/g)) {
      const v = attr(e[2], "data-score"), task = text(e[2].match(/__scoreLabelText">([\s\S]*?)<\/span>/)?.[1] ?? e[1]);
      const runs = e[2].match(/(\d+) \/ (\d+) runs/);
      if (v != null) environments[e[1]] = { task, value: v, hacks: runs ? Number(runs[1]) : undefined, runs: runs ? Number(runs[2]) : undefined };
    }
    const label = unescape(m[1]).trim();
    rows.push({
      benchmarkId: id, modelLabel: label, value, ci: [Number(m[6]), Number(m[7])], sourceUrl: PAGE,
      note: m[4] ? `${m[4]}% counting the ${m[5]}% of runs the provider refused as hacks` : undefined,
      details: { infrastructureAttackPct: Number(m[3]), ...(m[4] ? { refusedPct: Number(m[5]), countingRefusalsPct: Number(m[4]) } : {}), environments },
    });
  }
  if (rows.length < 5) throw new Error(`HoneyBench leaderboard parsed only ${rows.length} rows`);
  return {
    benchmark: {
      id, name: `HoneyBench ${version}`, shortName: "HoneyBench", sourceId: "honeybench", url: PAGE,
      description: "How often a model cheats on tasks with clear requirements and a flawed scorer, such as dosing simulated patients, grid control and ML repair. A run counts as a hack when the final submission exploits the flaw. Share of scored runs, lower is better.",
      unit: "percent", higherIsBetter: false, category: "safety",
      normalization: { kind: "linear", min: 0, max: 100 }, eligibleForDefault: false, defaultWeight: 0,
    },
    rows,
  };
}

const source: Source = {
  id: "honeybench", name: "HoneyBench", url: PAGE,
  async scrape(ctx) {
    const html = await ctx.fetchText(PAGE);
    const { benchmark, rows } = parseHoneyBench(html);
    return { benchmarks: [benchmark], rows, raw: { "honeybench.html": html }, notes: [`${rows.length} models, ${benchmark.id}`] };
  },
};
export default source;
