/**
 * Roboflow Vision Evals — Visual Reasoning: questions that need arithmetic, comparison, spatial and
 * multi-step reasoning over an image (the answer is never written in it). LLM-judge accuracy, mean of
 * runs, per Roboflow effort setting. The table renders client-side, so it's read from the live page.
 */
import type { RawRow, ScrapeResult, Source } from "../../../src/data/types";
import { num } from "../harness";

const PAGE = "https://playground.roboflow.com/evals/visual-reasoning";
const EFFORT = /^(none|minimal|low|medium|high|xhigh|max)$/i;

export function parseRoboflow(table: string[][]): RawRow[] {
  const head = table[0] ?? [];
  const col = (re: RegExp) => head.findIndex((h) => re.test(h));
  const m = col(/^Model$/), e = col(/^Effort$/), acc = col(/LLM judge/i), cost = col(/cost/i), tok = col(/Tokens/i);
  if (m < 0 || acc < 0) throw new Error("Roboflow table columns changed");
  const rows: RawRow[] = [];
  for (const r of table.slice(1)) {
    const value = num(r[acc]?.match(/^[\d.]+/)?.[0]);
    const label = r[m]?.replace(/\bNEW\b/g, "").trim();
    if (value == null || !label) continue;
    const effort = EFFORT.test(r[e] ?? "") ? r[e].toLowerCase() : undefined;
    const tokens = r[tok]?.match(/^([\d.]+)(K|M)?/i);
    rows.push({ benchmarkId: "roboflow-visual-reasoning", modelLabel: label, effort, value, sourceUrl: PAGE,
      costUsd: num(r[cost]?.replace("$", "")), outputTokens: tokens ? Math.round(Number(tokens[1]) * (tokens[2]?.toUpperCase() === "M" ? 1e6 : tokens[2] ? 1e3 : 1)) : undefined,
      note: r[acc].replace(/\s+/g, " ").trim() });
  }
  return rows;
}

const source: Source = {
  id: "roboflow", name: "Roboflow Vision Evals", url: PAGE,
  async scrape(ctx): Promise<ScrapeResult> {
    const table = await ctx.withPage(PAGE, (page) => page.$$eval("table tr", (trs) => trs.map((tr) => [...tr.querySelectorAll("td,th")].map((c) => (c as HTMLElement).innerText.replace(/\s+/g, " ").trim()))));
    const rows = parseRoboflow(table);
    if (rows.length < 10) throw new Error(`Roboflow returned only ${rows.length} rows`);
    return {
      benchmarks: [{ id: "roboflow-visual-reasoning", name: "Roboflow Visual Reasoning", shortName: "Visual Reasoning", sourceId: "roboflow", url: PAGE, unit: "percent", higherIsBetter: true, category: "reasoning", eligibleForDefault: true, defaultWeight: 0,
        description: "Roboflow Vision Evals: image questions requiring arithmetic, comparisons, spatial relations and multi-step inference (the answer is never written in the image). LLM-judge accuracy, mean of runs." }],
      rows, raw: { "visual-reasoning.json": JSON.stringify(table) }, notes: [`${rows.length} rows`],
    };
  },
};
export default source;
