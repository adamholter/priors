/**
 * FrontierBreach (PromptArmor, promptarmor.com/frontier-breach): how often prompt-injection attacks succeed against agents doing long enterprise
 * tasks, with consequences such as ransomware, data exfiltration and phishing. Test cases come from GDPval tasks perturbed with attack chains from
 * PromptArmor's threat intelligence. Lower is better. The leaderboard is server-rendered, one list item per model whose label carries the attack
 * success rate and its 95% interval. The rate is at k=5 attempts, and every model ran at medium effort.
 */
import type { Benchmark, RawRow, ScrapeResult, Source } from "../../../src/data/types";

export const FRONTIER_BREACH_ID = "frontier-breach";
const SITE = "https://www.promptarmor.com/frontier-breach";
const ROW = /<li aria-label="([^"]+?), ([^",:]+): ([\d.]+)% attack success rate, plus or minus ([\d.]+)"/g;

export function parseFrontierBreach(html: string): { rows: RawRow[]; benchmark: Benchmark } {
  const seen = new Set<string>(), rows: RawRow[] = [];
  for (const [, model, lab, rate, margin] of html.matchAll(ROW)) {
    if (seen.has(model)) continue;
    seen.add(model);
    const value = Number(rate), plus = Number(margin);
    rows.push({ benchmarkId: FRONTIER_BREACH_ID, modelLabel: model, labHint: lab, effort: "medium", value, ci: [Math.max(0, +(value - plus).toFixed(2)), Math.min(100, +(value + plus).toFixed(2))], rank: rows.length + 1, sourceUrl: SITE, note: "Attack success rate at k=5, medium effort" });
  }
  return { rows, benchmark: { id: FRONTIER_BREACH_ID, name: "FrontierBreach", shortName: "FrontierBreach", sourceId: "frontier-breach", url: SITE, description: "How often attacks hidden in an agent's work succeed on long enterprise tasks, with outcomes such as ransomware, data theft and phishing. Share of test cases breached within five attempts. Lower is better.", unit: "percent", higherIsBetter: false, category: "safety", categories: ["safety", "agentic"], normalization: { kind: "linear", min: 0, max: 100 }, eligibleForDefault: false, defaultWeight: 0 } };
}

const source: Source = {
  id: "frontier-breach", name: "FrontierBreach", url: SITE,
  async scrape(ctx): Promise<ScrapeResult> {
    const html = await ctx.fetchText(SITE), { rows, benchmark } = parseFrontierBreach(html);
    if (rows.length < 5) throw new Error("FrontierBreach: leaderboard changed");
    return { benchmarks: [benchmark], rows, raw: { "frontier-breach.html": html }, notes: [`${rows.length} models`] };
  },
};
export default source;
