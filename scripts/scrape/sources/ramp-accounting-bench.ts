/**
 * Ramp Accounting Bench (labs.ramp.com/ramp-accounting-bench, internally "APEX Accounting"). 137
 * long-horizon accounting tasks across realistic financial systems, three attempts each, every model in
 * the same Mercor Archipelago ReAct harness and graded by an LLM judge against per-task criteria.
 * The site is a Vite SPA with no data endpoint: the results ship as an object literal inside the
 * benchmark page's JS chunk, which main.js names, so both hashed file names are discovered live.
 * Value is mean criteria score @3 (the site's headline number); cost is mean measured cost per attempt
 * (the site's cost axis), tokens and minutes are per-attempt means.
 */
import type { Source, ScrapeResult, RawRow } from "../../../src/data/types";

const SITE = "https://labs.ramp.com/ramp-accounting-bench";
const ORIGIN = "https://labs.ramp.com";

type Metrics = {
  taskCount?: number; episodeCount?: number; passAt1?: number; passAt3?: number; passPower3?: number;
  retryUplift?: number; inconsistencyRate?: number; meanCriteriaAt3?: number; meanCost?: number;
  meanDurationMinutes?: number; meanToolCalls?: number; meanTurns?: number; meanInputTokens?: number;
  meanOutputTokens?: number; attemptMeanScores?: number[];
};
type Entry = { id: string; displayName: string; provider?: string; sourceModel?: string; metrics?: Metrics; completedAt?: string };

/** Index of the bracket closing the one at `open`, skipping string literals. */
function closing(s: string, open: number): number {
  let depth = 0, quote = "";
  for (let i = open; i < s.length; i++) {
    const c = s[i];
    if (quote) { if (c === "\\") i++; else if (c === quote) quote = ""; continue; }
    if (c === '"' || c === "'" || c === "`") quote = c;
    else if (c === "[" || c === "{") depth++;
    else if (c === "]" || c === "}") { depth--; if (depth === 0) return i; }
  }
  return -1;
}

/** Minified JS object literal to JSON: quote bare keys, restore leading zeros. Strings are left alone. */
function literalToJson(lit: string): string {
  let out = "", i = 0;
  while (i < lit.length) {
    const c = lit[i];
    if (c === '"') {
      let j = i + 1;
      while (j < lit.length && lit[j] !== '"') j += lit[j] === "\\" ? 2 : 1;
      out += lit.slice(i, j + 1); i = j + 1; continue;
    }
    const key = /^[A-Za-z_$][\w$]*(?=:)/.exec(lit.slice(i, i + 64));
    if (key && /[{,]/.test(out.slice(-1))) { out += `"${key[0]}"`; i += key[0].length; continue; }
    if (c === "." && /[:[,]/.test(out.slice(-1))) { out += "0."; i++; continue; }
    out += c; i++;
  }
  return out;
}

export function parseRampAccountingBench(js: string): ScrapeResult {
  const at = js.search(/=\[\{id:"[a-z0-9_]+",displayName:"/);
  if (at < 0) throw new Error("Ramp Accounting Bench: model list not found in bundle");
  const start = js.indexOf("[", at), end = closing(js, start);
  if (end < 0) throw new Error("Ramp Accounting Bench: model list unterminated");
  const entries = JSON.parse(literalToJson(js.slice(start, end + 1))) as Entry[];
  const meta = /name:"APEX Accounting",version:"([^"]*)",taskCount:(\d+),attemptCount:(\d+)[^}]*?harness:"([^"]*)",judgeModel:"([^"]*)",latestCompletedAt:"([^"]*)"/.exec(js);
  const [, version, tasks, attempts, harness, judge, updated] = meta ?? [];
  const rows: RawRow[] = [];
  for (const e of entries) {
    const m = e.metrics;
    if (!e.displayName || typeof m?.meanCriteriaAt3 !== "number") continue;
    const pct = (x?: number) => (typeof x === "number" ? +(x * 100).toFixed(2) : undefined);
    rows.push({
      benchmarkId: "ramp-accounting-bench", modelLabel: e.displayName, value: +(m.meanCriteriaAt3 * 100).toFixed(2),
      sourceUrl: SITE, labHint: e.provider, harness: harness || undefined,
      costUsd: typeof m.meanCost === "number" ? m.meanCost : undefined,
      outputTokens: m.meanOutputTokens, durationSec: typeof m.meanDurationMinutes === "number" ? m.meanDurationMinutes * 60 : undefined,
      note: `pass@1 ${pct(m.passAt1)}%, pass@3 ${pct(m.passAt3)}%, pass^3 ${pct(m.passPower3)}% · ${m.taskCount ?? tasks} tasks x ${attempts ?? 3} attempts`,
      details: {
        passAt1: pct(m.passAt1), passAt3: pct(m.passAt3), passPower3: pct(m.passPower3), retryUplift: pct(m.retryUplift),
        inconsistencyRate: pct(m.inconsistencyRate), attemptMeanScores: m.attemptMeanScores?.map((x) => +(x * 100).toFixed(2)),
        meanToolCalls: m.meanToolCalls, meanTurns: m.meanTurns, meanInputTokens: m.meanInputTokens, sourceModel: e.sourceModel,
        completedAt: e.completedAt, judgeModel: judge,
      },
    });
  }
  if (!rows.length) throw new Error("Ramp Accounting Bench: no usable rows");
  return {
    benchmarks: [{
      id: "ramp-accounting-bench", name: "Ramp Accounting Bench", sourceId: "ramp-accounting-bench", url: SITE, lastUpdated: updated,
      description: `Long-horizon accounting work across realistic financial systems: ${tasks ?? 137} tasks, ${attempts ?? 3} attempts each in one shared agent harness${harness ? ` (${harness})` : ""}, graded by ${judge ?? "an LLM judge"} against per-task criteria. Value is the mean share of criteria met, best-of-3 as Ramp publishes it. Cost is per attempt.`,
      normalization: { kind: "linear", min: 0, max: 100 },
      unit: "percent", higherIsBetter: true, category: "agentic", eligibleForDefault: false, defaultWeight: 0,
    }],
    rows,
    raw: { "bench.js": js },
    notes: [`${rows.length} models${version ? `, ${version}` : ""}`],
  };
}

const source: Source = {
  id: "ramp-accounting-bench",
  name: "Ramp Accounting Bench",
  url: SITE,
  async scrape(ctx): Promise<ScrapeResult> {
    const html = await ctx.fetchText(SITE);
    const main = /\/assets\/main-[\w-]+\.js/.exec(html)?.[0];
    if (!main) throw new Error("Ramp Accounting Bench: main bundle not found");
    const mainJs = await ctx.fetchText(`${ORIGIN}${main}`);
    const chunk = /assets\/UnsettledAccountingBench-[\w-]+\.js/.exec(mainJs)?.[0];
    if (!chunk) throw new Error("Ramp Accounting Bench: benchmark chunk not found");
    return parseRampAccountingBench(await ctx.fetchText(`${ORIGIN}/${chunk}`));
  },
};
export default source;
