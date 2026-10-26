/**
 * Zapier AutomationBench: agents execute end-to-end business workflows across 47 real tools (CRM,
 * inbox, sheets…), scored strictly on the final environment state. The leaderboard renders its top 10
 * and expands client-side, so this opens the page, clicks "See N more" and reads every row.
 */
import type { RawRow, ScrapeResult, Source } from "../../../src/data/types";
import { num } from "../harness";

const PAGE = "https://zapier.com/benchmarks";
const EFFORT = /^(none|minimal|low|medium|high|xhigh|max)$/i;

/** Leaderboard text after the header: rank, model, score %, cost per task — repeated. */
export function parseAutomationBench(lines: string[]): { version?: string; rows: RawRow[] } {
  const h = lines.findIndex((l, i) => l === "Rank" && lines[i + 1] === "Model" && lines[i + 2] === "Score");
  if (h < 0) throw new Error("AutomationBench leaderboard header not found");
  const version = /^\d+\.\d+(\.\d+)?$/.test(lines[h - 1] ?? "") ? lines[h - 1] : undefined;
  const best = new Map<string, RawRow>();
  for (let i = h + 4; i + 3 < lines.length && /^\d+$/.test(lines[i]); i += 4) {
    const name = lines[i + 1], score = num(lines[i + 2].replace("%", "")), cost = num(lines[i + 3].replace(/[$*,]/g, ""));
    if (score == null || /\bwith\b/i.test(name)) continue; // combined-model entries ("Fable 5.1 (with Opus 5 Fallback)") aren't one model
    const parts = name.match(/\(([^)]*)\)\s*$/)?.[1].split(",").map((s) => s.trim()) ?? [];
    const effort = parts.find((p) => EFFORT.test(p))?.toLowerCase();
    const label = name.replace(/\s*\([^)]*\)\s*$/, "").trim();
    const row: RawRow = { benchmarkId: "automationbench", modelLabel: label, effort, value: score, costUsd: cost, sourceUrl: PAGE, note: [name, version && `v${version}`, lines[i + 3].includes("*") && "promotional pricing; cost at list price"].filter(Boolean).join(" · ") };
    const key = `${label}|${effort ?? ""}`;
    if (!best.has(key) || row.value > best.get(key)!.value) best.set(key, row);
  }
  return { version, rows: [...best.values()] };
}

const source: Source = {
  id: "zapier", name: "Zapier AutomationBench", url: PAGE,
  async scrape(ctx): Promise<ScrapeResult> {
    const lines = await ctx.withPage(PAGE, async (page) => {
      const more = page.getByText(/^See \d+ more$/).first();
      if (await more.count()) { await more.click(); await page.waitForTimeout(1500); }
      return (await page.evaluate(() => document.body.innerText)).split("\n").map((s) => s.trim()).filter(Boolean);
    });
    const { version, rows } = parseAutomationBench(lines);
    if (rows.length < 10) throw new Error(`AutomationBench returned only ${rows.length} rows`);
    return {
      benchmarks: [{ id: "automationbench", name: "AutomationBench (Zapier)", shortName: "AutomationBench", sourceId: "zapier", url: PAGE, unit: "percent", higherIsBetter: true, category: "agentic", eligibleForDefault: true, defaultWeight: 0,
        description: `Zapier's agent benchmark${version ? ` (v${version})` : ""}: end-to-end business workflows across 47 real tools in six functions, graded strictly on the final environment state (every assertion must pass). Private held-out set.` }],
      rows, raw: { "benchmarks.txt": lines.join("\n") }, notes: [`${rows.length} rows${version ? `, v${version}` : ""}`],
    };
  },
};
export default source;
