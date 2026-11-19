/**
 * CursorBench (cursor.com/cursorbench): Cursor's evaluation of agents on ambiguous, multi-file tasks from real Cursor sessions. The page is
 * server-rendered with one table row per model and effort: score, average cost, tokens and steps per task. The page shows only the current
 * version, so the heading's number is the benchmark's `version` and the build freezes the old scores when it changes (version-splits.ts).
 * v4.0 is frozen in sources/frozen/versions under the id it had when Benchmark Heaven supplied it.
 */
import type { Benchmark, RawRow, ScrapeResult, Source } from "../../../src/data/types";

export const CURSORBENCH_ID = "cursorbench";
const PAGE = "https://cursor.com/cursorbench";
const EFFORTS: Record<string, string> = { "extra high": "xhigh", max: "max", high: "high", medium: "medium", low: "low", minimal: "minimal", none: "none" };
const EFFORT_SUFFIX = /\s+(extra high|max|high|medium|low|minimal|none)$/i;
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

const text = (html: string) => html.replace(/<[^>]+>/g, "").replace(/&amp;/g, "&").trim();
const cells = (row: string) => [...row.matchAll(/<t[dh]\b[^>]*>([\s\S]*?)<\/t[dh]>/g)].map((m) => text(m[1]));
const number = (cell: string) => Number(cell.replace(/[$,%\s]/g, ""));

export function parseCursorBench(html: string): { benchmark: Benchmark; rows: RawRow[] } {
  const version = html.match(/<h1\b[^>]*>\s*CursorBench\s+(\d+(?:\.\d+)*)\s*<\/h1>/)?.[1];
  if (!version) throw new Error("CursorBench: no version in the page heading");
  const table = html.match(/<table\b[\s\S]*?<\/table>/)?.[0];
  if (!table) throw new Error("CursorBench: no results table");
  const [head, ...body] = [...table.matchAll(/<tr\b[\s\S]*?<\/tr>/g)].map((m) => cells(m[0]));
  if (!/^Model$/.test(head?.[1] ?? "") || head[2] !== "Score" || !head[3]?.startsWith("Cost") || !head[4]?.startsWith("Tokens") || !head[5]?.startsWith("Steps")) throw new Error("CursorBench: table columns changed");
  const rows = body.map(([rank, label, score, cost, tokens, steps]): RawRow => {
    const value = number(score), costUsd = number(cost), tokensPerTask = number(tokens), stepsPerTask = number(steps), suffix = label.match(EFFORT_SUFFIX)?.[1];
    if (!(value >= 0 && value <= 100) || !(costUsd > 0) || !(tokensPerTask > 0) || !(stepsPerTask > 0)) throw new Error(`CursorBench: bad row for ${label}`);
    return {
      benchmarkId: CURSORBENCH_ID, modelLabel: suffix ? label.slice(0, -suffix.length).trim() : label, ...(suffix ? { effort: EFFORTS[suffix.toLowerCase()] } : { effortUnstated: true }),
      value, costUsd, steps: stepsPerTask, rank: Number(rank), sourceUrl: PAGE, details: { tokensPerTask },
    };
  });
  // The changelog lists its newest entry first, after the table.
  const dated = html.slice(html.indexOf("</table>")).replace(/<[^>]+>/g, " ").match(/\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec) (\d{1,2}), (20\d{2})\b/);
  const lastUpdated = dated ? `${dated[3]}-${String(MONTHS.indexOf(dated[1]) + 1).padStart(2, "0")}-${dated[2].padStart(2, "0")}` : undefined;
  return {
    rows,
    benchmark: {
      id: CURSORBENCH_ID, name: `CursorBench v${version}`, shortName: `CursorBench v${version}`, version, sourceId: CURSORBENCH_ID, url: PAGE, unit: "percent", higherIsBetter: true, category: "coding", categories: ["coding", "agentic"],
      description: "Ambiguous, multi-file coding tasks taken from real Cursor sessions. Cursor's own score; it does not publish how tasks are graded.",
      versionPolicy: { kind: "fresh", supersedes: "bh-cursorbench-4.0" }, eligibleForDefault: false, defaultWeight: 0, ...(lastUpdated ? { lastUpdated } : {}),
    },
  };
}

const source: Source = {
  id: CURSORBENCH_ID, name: "CursorBench", url: PAGE,
  async scrape(ctx): Promise<ScrapeResult> {
    const html = await ctx.fetchText(PAGE), { benchmark, rows } = parseCursorBench(html);
    if (rows.length < 10) throw new Error(`CursorBench: only ${rows.length} rows`);
    return { benchmarks: [benchmark], rows, raw: { "cursorbench.html": html }, notes: [`v${benchmark.version}: ${rows.length} rows, ${new Set(rows.map((r) => r.modelLabel)).size} models`] };
  },
};
export default source;
