/**
 * Lech Mazur's LLM Creative Story-Writing Benchmark (github.com/lechmazur/writing), read from the repo's README, which holds the
 * full leaderboard: every rated writer with its comparison score (a Thurstone rating, zero near the middle of the field), the
 * estimated chance of beating another model, and a 95% bootstrap interval. Each brief asks for a 600 to 800 word story using 10
 * required elements; story pairs are judged by three models from other families, in both orders. Benchmark Heaven carries an older
 * copy (`bh-mazur-creative-story-writing`); this is the publisher's current one. Effort comes from the label ("(high)").
 */
import type { RawRow, ScrapeResult, Source } from "../../../src/data/types";

export const MAZUR_WRITING_ID = "mazur-creative-writing";
const REPO = "https://github.com/lechmazur/writing";
const README = "https://raw.githubusercontent.com/lechmazur/writing/main/README.md";

export function parseMazurWriting(md: string): Pick<ScrapeResult, "benchmarks" | "rows" | "notes"> {
  const start = md.search(/^\| Rank \| Model \| Comparison score \|/m);
  if (start < 0) throw new Error("Mazur writing: leaderboard table not found (header changed?)");
  const rows: RawRow[] = [];
  for (const line of md.slice(start).split("\n").slice(2)) {
    if (!line.startsWith("|")) break;
    const cells = line.split("|").slice(1, -1).map((c) => c.trim());
    const [rank, name, score, win, interval] = cells;
    const value = Number(score), label = name.replace(/\*\*/g, "").replace(/[§†‡¶*]+$/u, "").trim(); // footnote marks ("§", "†") point at caveats below the table
    if (!label || !Number.isFinite(value)) continue;
    const ci = interval?.match(/(-?[\d.]+)\s+to\s+(-?[\d.]+)/);
    rows.push({
      benchmarkId: MAZUR_WRITING_ID, modelLabel: label, value, sourceUrl: REPO, rank: Number(rank) || undefined,
      ...(ci ? { ci: [Number(ci[1]), Number(ci[2])] as [number, number] } : {}),
      note: `estimated win chance ${win}`,
      details: { winChance: Number(win?.replace("%", "")) },
    });
  }
  if (rows.length < 10) throw new Error(`Mazur writing: ${rows.length} rows; table changed?`);
  const updated = [...md.matchAll(/^- ([A-Z][a-z]+ \d{1,2}, \d{4}):/gm)].map((m) => new Date(`${m[1]} UTC`)).filter((d) => !isNaN(+d)).sort((a, b) => +b - +a)[0];
  return {
    benchmarks: [{
      id: MAZUR_WRITING_ID, name: "LLM Creative Story-Writing Benchmark", shortName: "Mazur Writing", sourceId: MAZUR_WRITING_ID, url: REPO,
      description: "Turning a constrained brief into a compelling 600 to 800 word story that uses 10 required elements (character, object, setting, motivation, tone and more). Story pairs are judged by three models from other families, in both orders. A relative score where zero is near the middle of the field. From Lech Mazur.",
      unit: "score", higherIsBetter: true, category: "creative",
      eligibleForDefault: false, defaultWeight: 0, ...(updated ? { lastUpdated: updated.toISOString().slice(0, 10) } : {}),
    }],
    rows,
    notes: [`${rows.length} writers${updated ? `, updated ${updated.toISOString().slice(0, 10)}` : ""}`],
  };
}

const source: Source = {
  id: MAZUR_WRITING_ID, name: "Lech Mazur creative writing", url: REPO,
  async scrape(ctx): Promise<ScrapeResult> {
    const md = await ctx.fetchText(README);
    return { ...parseMazurWriting(md), raw: { "README.md": md } };
  },
};
export default source;
