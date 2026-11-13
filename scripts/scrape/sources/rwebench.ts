/**
 * RWE-Bench (xplore.ai/rwe-bench), Xplore's real-world engineering benchmark: 20 design tasks in electrical, aerospace and
 * mechanical engineering, up to 5 runs per task per model, 24 hours per run, each model in its own agentic harness. A run passes
 * when its design passes every check. Every number on the page comes from `/js/rwe-data.js` (`window.RWE = {...}`), a JS object
 * literal, read here as data (never run). Value: `pass1`, the average pass rate with its 95% interval; cost is mean API spend for
 * one run on one task, time its mean hours. Benchmark Heaven also carries this board (`bg-rwe-bench`), behind the publisher's file.
 */
import type { RawRow, ScrapeResult, Source } from "../../../src/data/types";

export const RWE_ID = "rwe-bench";
const SITE = "https://xplore.ai/rwe-bench";
const DATA = "https://xplore.ai/js/rwe-data.js";

type Model = { name: string; lab?: string; harness?: string; effort?: string; pass1: number; lo?: number; hi?: number; passAtK?: number[]; tasks?: number; runs?: number; cost?: number | null; time?: number | null };

/** The `models: [...]` array of the file, one `{ ... }` object per line, with JS keys and single-quoted strings turned into JSON. */
export function parseRweData(js: string): { models: Model[]; resultsDate?: string; tasks: number; runsPerTask?: number } {
  const start = js.indexOf("models: [");
  if (start < 0) throw new Error("RWE-Bench: models list not found");
  const end = js.indexOf("\n  ],", start);
  const models: Model[] = [];
  for (const line of js.slice(start, end).split("\n")) {
    const m = line.match(/^\s*(\{.*\}),?\s*(\/\/.*)?$/);
    if (!m) continue;
    const json = m[1].replace(/'([^'\\]*)'/g, (_, s: string) => JSON.stringify(s)).replace(/([{,]\s*)([A-Za-z_]\w*)\s*:/g, '$1"$2":').replace(/,\s*([}\]])/g, "$1");
    models.push(JSON.parse(json) as Model);
  }
  const tasks = [...js.matchAll(/\{\s*name:\s*'[^']+',\s*tasks:\s*(\d+)\s*\}/g)].reduce((n, t) => n + Number(t[1]), 0);
  return { models, resultsDate: /resultsDate:\s*'(\d{4}-\d{2}-\d{2})'/.exec(js)?.[1], tasks, runsPerTask: Number(/\n\s*runs:\s*(\d+)/.exec(js)?.[1]) || undefined };
}

export function parseRweBench(js: string): Pick<ScrapeResult, "benchmarks" | "rows" | "notes"> {
  const d = parseRweData(js);
  const rows: RawRow[] = d.models.filter((m) => m.name && Number.isFinite(m.pass1) && m.pass1 >= 0 && m.pass1 <= 100).map((m) => ({
    benchmarkId: RWE_ID, modelLabel: m.name, effort: m.effort, labHint: m.lab, harness: m.harness, value: m.pass1, sourceUrl: SITE,
    ...(typeof m.lo === "number" && typeof m.hi === "number" ? { ci: [m.lo, m.hi] as [number, number] } : {}),
    ...(typeof m.cost === "number" && m.cost > 0 ? { costUsd: m.cost } : {}),
    ...(typeof m.time === "number" && m.time > 0 ? { durationSec: m.time * 3600 } : {}),
    note: `${m.runs ?? "?"} runs over ${m.tasks ?? "?"} tasks in ${m.harness ?? "?"}; pass@5 ${m.passAtK?.[4] ?? "?"}%`,
    details: { passAtK: m.passAtK, tasks: m.tasks, runs: m.runs },
  }));
  if (rows.length < 5) throw new Error(`RWE-Bench: ${rows.length} models; file changed?`);
  return {
    benchmarks: [{
      id: RWE_ID, name: "RWE-Bench", sourceId: RWE_ID, url: SITE,
      description: `Real engineering design work: ${d.tasks || 20} tasks in electrical, aerospace and mechanical engineering (mechanical parts, design for manufacturing, CFD, electronics), each run up to ${d.runsPerTask ?? 5} times for up to 24 hours in the model's own agent harness. A run passes when its design passes every check; the score is the average pass rate, with a 95% interval. From Xplore.`,
      unit: "percent", higherIsBetter: true, category: "professional", normalization: { kind: "linear", min: 0, max: 100 },
      eligibleForDefault: false, defaultWeight: 0, ...(d.resultsDate ? { lastUpdated: d.resultsDate } : {}),
    }],
    rows,
    notes: [`${rows.length} models, ${d.tasks} tasks${d.resultsDate ? `, results ${d.resultsDate}` : ""}`],
  };
}

const source: Source = {
  id: RWE_ID, name: "RWE-Bench", url: SITE,
  async scrape(ctx): Promise<ScrapeResult> {
    const js = await ctx.fetchText(DATA);
    return { ...parseRweBench(js), raw: { "rwe-data.js": js } };
  },
};
export default source;
