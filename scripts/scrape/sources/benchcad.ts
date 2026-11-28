/**
 * BenchCAD (benchcad.com/leaderboard): programmatic CAD. The Core set is 100 held-out cases across six tasks, such as drawing to part, scored
 * from 0 to 1 by executing the model's CadQuery program against the ground-truth solid. The leaderboard is server-rendered with two boards at
 * every reasoning effort: each model in a customized harness such as its lab's own agent (the site's default), and every model in the standard
 * 2.1 harness. Each board is its own benchmark with `version` from the page heading, so a new BenchCAD version freezes the old scores
 * (version-splits.ts). Scores marked ≈ were read off a chart and are left out, as are estimated costs and rows on another version's scorer.
 */
import type { Benchmark, RawRow, ScrapeResult, Source } from "../../../src/data/types";
import { EFFORT_WORDS } from "../../../src/data/normalize";
import { text } from "./_board";

export const BENCHCAD_ID = "benchcad";
export const BENCHCAD_STANDARD_ID = "benchcad-standard";
const PAGE = "https://benchcad.com/leaderboard";
const cellsOf = (row: string) => [...row.matchAll(/<t[dh]\b[^>]*>([\s\S]*?)<\/t[dh]>/g)].map((m) => m[1]);

function board(html: string, key: string, harnessColumn: boolean, id: string): RawRow[] {
  const at = html.indexOf(`data-lb21="${key}"`), end = html.indexOf("</table>", at);
  if (at < 0 || end < 0) throw new Error(`BenchCAD: no ${key} board`);
  const [head, ...body] = [...html.slice(at, end).matchAll(/<tr\b[\s\S]*?<\/tr>/g)].map((m) => cellsOf(m[0]));
  const want = ["Rank", "Model", ...(harnessColumn ? ["Harness"] : []), "Score", "±95%", "Cost / case"];
  if (head?.map(text).join("|") !== want.join("|")) throw new Error(`BenchCAD: ${key} board columns changed`);
  const rows: RawRow[] = [];
  for (const cells of body) {
    const [model, ...rest] = cells.slice(1), [harness, score, margin, cost] = harnessColumn ? rest : [undefined, ...rest];
    const label = text(model.match(/<b>([\s\S]*?)<\/b>/)?.[1] ?? ""), credit = text(model.match(/<small>([\s\S]*?)<\/small>/)?.[1] ?? "");
    const named = label.match(/^(.+?)\s*\(([^)]+)\)$/), effort = named && EFFORT_WORDS[named[2].toLowerCase()];
    const shown = text(score ?? ""), value = Number(shown), plus = Number(text(margin ?? "")), usd = text(cost ?? "");
    if (shown.startsWith("≈") || /\b\d\.\d scorer\b/.test(credit)) continue;
    if (!named || !effort || !shown) throw new Error(`BenchCAD: bad ${key} row ${label}`);
    if (!(value >= 0 && value <= 1)) throw new Error(`BenchCAD: bad score for ${label}`);
    const pts = +(value * 100).toFixed(1), costUsd = /^\$[\d.]+$/.test(usd) ? Number(usd.slice(1)) : undefined, ci = plus > 0 ? [+(pts - plus * 100).toFixed(1), +(pts + plus * 100).toFixed(1)] as [number, number] : undefined;
    rows.push({ benchmarkId: id, modelLabel: named[1], effort, value: pts, ...(ci ? { ci } : {}), ...(costUsd != null ? { costUsd } : {}), harness: harness ? text(harness) : "BenchCAD 2.1 harness", sourceUrl: PAGE, note: `Core score ${shown} on 100 held-out cases${credit ? `; ${credit}` : ""}`, details: { score: value } });
  }
  return rows;
}

export function parseBenchCAD(html: string): { benchmarks: Benchmark[]; rows: RawRow[] } {
  const version = html.match(/<h1\b[^>]*>\s*BenchCAD\s+(\d+(?:\.\d+)*)\s+Core\s*<\/h1>/)?.[1];
  if (!version) throw new Error("BenchCAD: no version in the page heading");
  const base = { sourceId: BENCHCAD_ID, url: PAGE, version, unit: "percent", higherIsBetter: true, category: "coding", categories: ["coding", "agentic", "vision"], normalization: { kind: "linear", min: 0, max: 100 }, versionPolicy: { kind: "fresh" }, eligibleForDefault: false, defaultWeight: 0 } satisfies Partial<Benchmark>;
  return {
    rows: [...board(html, "own", true, BENCHCAD_ID), ...board(html, "harness", false, BENCHCAD_STANDARD_ID)],
    benchmarks: [
      { ...base, id: BENCHCAD_ID, name: `BenchCAD v${version}`, shortName: `BenchCAD v${version}`, description: "Programmatic CAD: 100 held-out cases across six tasks, such as turning a drawing into a part, solved as CadQuery code that is run and compared with the true solid. Each model in a customized harness such as its lab's own agent. Core score from 0 to 1, shown as a percent." },
      { ...base, id: BENCHCAD_STANDARD_ID, name: `BenchCAD v${version} (standard harness)`, shortName: `BenchCAD v${version} std`, description: "BenchCAD's 100 Core cases with every model in the same BenchCAD harness, so the harness is held constant. Mean of five passes, Core score from 0 to 1, shown as a percent." },
    ],
  };
}

const source: Source = {
  id: BENCHCAD_ID, name: "BenchCAD", url: PAGE,
  async scrape(ctx): Promise<ScrapeResult> {
    const html = await ctx.fetchText(PAGE), { benchmarks, rows } = parseBenchCAD(html), count = (id: string) => rows.filter((r) => r.benchmarkId === id).length;
    if (count(BENCHCAD_ID) < 10 || count(BENCHCAD_STANDARD_ID) < 5) throw new Error("BenchCAD: leaderboard changed");
    return { benchmarks, rows, raw: { "leaderboard.html": html }, notes: [`v${benchmarks[0].version}: ${count(BENCHCAD_ID)} customized-harness rows, ${count(BENCHCAD_STANDARD_ID)} standard-harness rows`] };
  },
};
export default source;
