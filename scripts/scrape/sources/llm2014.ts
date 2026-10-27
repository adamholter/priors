/**
 * LLM2014 logic board ("致知", llm2014.github.io/llm_benchmark): one person's private, monthly-rotating
 * logic question bank (about 28 questions, three runs each, derivation must be right). The site
 * lists a CSV per month; we read the newest logic month and score on the median column the site
 * ranks by. Rows labelled "w/ refuse" are a different prompt condition and are left out; "~Estimated"
 * rows stay, flagged in the note. Costs are published in yuan and are not carried over.
 */
import { parse } from "csv-parse/sync";
import type { RawRow, ScrapeResult, Source } from "../../../src/data/types";

const SITE = "https://llm2014.github.io/llm_benchmark/";
const EFFORT = /^(none|minimal|low|medium|high|xhigh|max)$/i;

type Dataset = { category: string; reportDate: string; tableIndex: number; csv: string };

export function latestLogic(datasets: Dataset[]): Dataset {
  const logic = datasets.filter((d) => d.category === "logic" && d.tableIndex === 0 && /^\d{4}-\d{2}$/.test(d.reportDate));
  if (!logic.length) throw new Error("LLM2014: no logic datasets listed");
  return logic.reduce((a, b) => (b.reportDate > a.reportDate ? b : a));
}

export function parseLlm2014(csv: string, month: string): ScrapeResult {
  const recs = parse(csv, { columns: true, bom: true, skip_empty_lines: true, relax_column_count: true }) as Record<string, string>[];
  const best = new Map<string, RawRow>();
  for (const r of recs) {
    const raw = (r["模型"] ?? "").trim();
    const value = Number(r["中位分数"]);
    if (!raw || !Number.isFinite(value)) continue;
    const paren = raw.match(/\(([^)]*)\)\s*$/)?.[1] ?? "";
    if (/refuse/i.test(paren)) continue;
    const label = raw.replace(/\([^)]*\)\s*$/, "").trim();
    const tokens = paren.split(/\s+/).filter(Boolean);
    const effort = tokens[0] && EFFORT.test(tokens[0]) ? tokens[0].toLowerCase() : undefined;
    const estimated = /estimated/i.test(paren);
    const max = Number(r["极限分数"]);
    const row: RawRow = {
      benchmarkId: "llm2014-logic", modelLabel: label, effort, value, sourceUrl: SITE,
      durationSec: Number(r["平均耗时(秒)"]) || undefined, outputTokens: Number(r["Token"]) || undefined,
      note: `${raw}${estimated ? " (score estimated by the author)" : ""} · median of runs, best ${Number.isFinite(max) ? max : "?"}`,
      details: { best: Number.isFinite(max) ? max : undefined, estimated, released: r["发布时间"] },
    };
    const key = `${label}|${effort ?? ""}`;
    if (!best.has(key) || value > best.get(key)!.value) best.set(key, row);
  }
  const rows = [...best.values()];
  if (!rows.length) throw new Error("LLM2014: no usable rows");
  return {
    benchmarks: [{
      id: "llm2014-logic", name: "LLM2014 Logic", shortName: "LLM2014 logic", sourceId: "llm2014", url: SITE, lastUpdated: month,
      description: "A private, monthly-rotating bank of about 28 logic and reasoning questions (interleaved text, rule induction, log analysis, puzzles), three runs each; the derivation must be correct, guesses earn nothing. Median score out of 100.",
      normalization: { kind: "linear", min: 0, max: 100 },
      unit: "score", higherIsBetter: true, category: "reasoning", eligibleForDefault: false, defaultWeight: 0,
    }],
    rows, raw: { [`logic-${month}.csv`]: csv }, notes: [`${rows.length} rows, ${month}`],
  };
}

const source: Source = {
  id: "llm2014", name: "LLM2014", url: SITE,
  async scrape(ctx): Promise<ScrapeResult> {
    const manifest = await ctx.fetchJson<{ datasets: Dataset[] }>(`${SITE}data/datasets.json`);
    const d = latestLogic(manifest.datasets ?? []);
    return parseLlm2014(await ctx.fetchText(`${SITE}${d.csv}`), d.reportDate);
  },
};
export default source;
