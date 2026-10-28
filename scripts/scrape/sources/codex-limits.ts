/**
 * Codex usage limits (https://developers.openai.com/codex/pricing): OpenAI's estimate of local messages per five
 * hours on ChatGPT Plus, per model, as a low-high range. Not a benchmark: `subscriptionPrices` uses it to price a new
 * OpenAI model's plan from models Real API Pricing has measured, instead of assuming it matches a sibling.
 */
import type { ScrapeResult, Source } from "../../../src/data/types";
import { CODEX_LIMITS_BENCHMARK } from "../../../src/data/subscription";

const URL = "https://developers.openai.com/codex/pricing";
const cells = (row: string) => [...row.matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/g)].map((m) => m[1].replace(/<[^>]+>/g, "").replace(/&amp;/g, "&").trim());
const count = (s: string) => Number(s.replace(/,/g, ""));

/** The Plus column of the limits table: model, low, high. */
export function parseCodexLimits(html: string): { model: string; low: number; high: number }[] {
  for (const table of html.matchAll(/<table[\s\S]*?<\/table>/g)) {
    const rows = [...table[0].matchAll(/<tr[\s\S]*?<\/tr>/g)].map((m) => cells(m[0]));
    const plus = rows[0]?.findIndex((h) => /^Plus$/i.test(h)) ?? -1;
    if (plus < 1 || !/^Model$/i.test(rows[0][0])) continue;
    return rows.slice(1).flatMap((r) => {
      const m = r[plus]?.match(/^([\d,]+)\s*[-–]\s*([\d,]+)$/);
      return m && /^GPT/i.test(r[0]) ? [{ model: r[0], low: count(m[1]), high: count(m[2]) }] : [];
    });
  }
  return [];
}

const source: Source = {
  id: "codex-limits",
  name: "Codex usage limits",
  url: URL,
  async scrape(ctx): Promise<ScrapeResult> {
    const html = await ctx.fetchText(URL);
    const limits = parseCodexLimits(html);
    if (limits.length < 3) throw new Error(`Codex limits table not found (${limits.length} rows); page changed?`);
    return {
      benchmarks: [{
        id: CODEX_LIMITS_BENCHMARK, name: "Codex messages per 5 hours (Plus)", shortName: "Codex Plus messages", sourceId: this.id, url: URL,
        description: "OpenAI's estimate of local Codex messages per five-hour window on ChatGPT Plus, per model (geometric middle of the published range). Used to price new models' plans, not to rank.",
        unit: "count", higherIsBetter: true, category: "cost", proxy: true, eligibleForDefault: false, defaultWeight: 0,
      }],
      // The range's geometric middle: the ends differ tenfold, so the arithmetic middle would sit near the top end.
      rows: limits.map((l) => ({ benchmarkId: CODEX_LIMITS_BENCHMARK, modelLabel: l.model, labHint: "OpenAI", value: Math.sqrt(l.low * l.high), sourceUrl: URL, details: { low: l.low, high: l.high, plan: "ChatGPT Plus", window: "5 hours" } })),
      raw: { "pricing.html": html },
      notes: [limits.map((l) => `${l.model} ${l.low}-${l.high}`).join(", ")],
    };
  },
};
export default source;
