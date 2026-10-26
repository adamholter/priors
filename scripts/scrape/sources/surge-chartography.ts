/** Surge AI's Chartography: professional chart understanding (Kaplan-Meier curves, candlesticks, Sankeys, Bode plots…). */
import type { RawRow, Source } from "../../../src/data/types";
import { splitLabel, text } from "./_board";

export const CHARTOGRAPHY_ID = "chartography";
const PAGE = "https://surgehq.ai/leaderboards/chartography";

export function parseChartography(html: string): RawRow[] {
  const from = html.indexOf("Chartography Leaderboard");
  if (from < 0) throw new Error("Chartography page has no leaderboard");
  const end = html.indexOf("More benchmarks", from), section = html.slice(from, end > 0 ? end : undefined);
  const rows: RawRow[] = [];
  for (const block of section.split(/<div\b[^>]*\bdata-leaderboard-row(?:\s|=|>)[^>]*>/i).slice(1)) {
    const brand = text(block.match(/class="head-rank-table-brand"[^>]*>[\s\S]*?>([^<]+)</i)?.[1] ?? ""), name = text(block.match(/class="head-rank-table-name"[^>]*>[\s\S]*?>([^<]+)</i)?.[1] ?? "");
    const score = Number(block.match(/data-score="([\d.]+)"/)?.[1]);
    if (!brand || !name || !Number.isFinite(score) || score < 0 || score > 100) throw new Error(`Chartography leaderboard schema changed: ${brand} ${name}`);
    const raw = `${brand} ${name}`.replace(/^(\S+) \1\b/i, "$1").trim(); // "Inkling Inkling (High)" lists the brand twice
    const { label, effort } = splitLabel(raw);
    rows.push({ benchmarkId: CHARTOGRAPHY_ID, modelLabel: label, effort, value: score, sourceUrl: PAGE, note: `Published configuration: ${raw}` });
  }
  if (!rows.length) throw new Error("Chartography leaderboard had no rows");
  return rows;
}

const source: Source = {
  id: "surge-chartography", name: "Surge Chartography", url: PAGE,
  async scrape(ctx) {
    const html = await ctx.fetchText(PAGE);
    const rows = parseChartography(html);
    return {
      benchmarks: [{
        id: CHARTOGRAPHY_ID, name: "Chartography", sourceId: this.id, url: PAGE,
        description: "Surge AI's 100 professional chart-reading prompts across 12 domains: specialized graphics (Kaplan-Meier curves, candlesticks, contour maps, Sankey diagrams, Bode plots) that need perception, domain knowledge and multi-step reasoning. Accuracy.",
        unit: "percent" as const, higherIsBetter: true, category: "reasoning" as const,
        normalization: { kind: "linear" as const, min: 0, max: 100 }, eligibleForDefault: true, defaultWeight: 0,
      }],
      rows, raw: { "chartography.html": html }, notes: [`${rows.length} live model results`],
    };
  },
};
export default source;
