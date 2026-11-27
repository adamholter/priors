/**
 * Humanity's First Exam (Google DeepMind, launched 2026-11-24 on Kaggle; led by Oran Kelly): 544 simple, everyday prompts, most of them
 * visual (counting and identifying objects in a picture), in 136 families of four slight variations. The headline is family pass^4: a
 * family counts only if the model gets every variation right on every attempt, so it measures reliability, not peak accuracy (the top
 * models score 96 to 98% on single attempts). 112 prompts in 28 families are public on Kaggle (CC BY 4.0); 432 are held back.
 *
 * Data: Kaggle's benchmark API, the same one SimpleQA Verified uses. Each row names the model (`modelVersionName`) and the setting it ran
 * at (`modelVersionConfigNameNullable`, e.g. "GPT-6.2 Astra Xhigh Reasoning"), whose effort word is the row's effort.
 */
import type { RawRow, ScrapeResult, Source } from "../../../src/data/types";

export const HFE_ID = "hfe";
export const HFE_URL = "https://www.kaggle.com/benchmarks/deepmind/hfe";
const API = "https://www.kaggle.com/api/v1/benchmarks/deepmind/hfe/leaderboard";

interface KaggleResult { value?: number; confidenceInterval?: number }
export interface KaggleHfeRow {
  modelVersionName?: string; modelVersionConfigNameNullable?: string;
  taskResults?: { benchmarkTaskName?: string; result?: { numericResult?: KaggleResult; evaluationDate?: string } }[];
}

const EFFORTS: Record<string, string> = { none: "none", minimal: "minimal", low: "low", medium: "medium", high: "high", xhigh: "xhigh", max: "max" };
/** "GPT-6.2 Astra Xhigh Reasoning" → "xhigh"; a config with no effort word leaves the row without one. */
export const hfeEffort = (config?: string) => EFFORTS[/\b(none|minimal|low|medium|high|xhigh|max)\s+reasoning\b/i.exec(config ?? "")?.[1]?.toLowerCase() ?? ""];

const round = (x: number) => Math.round(x * 100) / 100;

export function parseHfe(json: { rows?: KaggleHfeRow[] }): RawRow[] {
  const rows: RawRow[] = [];
  for (const r of json.rows ?? []) {
    const label = r.modelVersionName?.trim();
    const task = r.taskResults?.find((t) => /pass\^4/i.test(t.benchmarkTaskName ?? "")) ?? r.taskResults?.find((t) => t.benchmarkTaskName === "(Overall)");
    const v = task?.result?.numericResult?.value;
    if (!label || typeof v !== "number" || !Number.isFinite(v)) continue;
    const half = task?.result?.numericResult?.confidenceInterval, effort = hfeEffort(r.modelVersionConfigNameNullable);
    rows.push({
      benchmarkId: HFE_ID, modelLabel: label, ...(effort ? { effort } : {}), value: round(v * 100), sourceUrl: HFE_URL,
      ...(typeof half === "number" && half > 0 ? { ci: [round((v - half) * 100), round((v + half) * 100)] as [number, number] } : {}),
      note: `Family pass^4: share of prompt families answered right in every variation and attempt${r.modelVersionConfigNameNullable ? `; run as "${r.modelVersionConfigNameNullable}"` : ""}`,
      ...(task?.result?.evaluationDate ? { details: { evaluated: task.result.evaluationDate.slice(0, 10) } } : {}),
    });
  }
  return rows;
}

const source: Source = {
  id: "hfe", name: "Humanity's First Exam", url: HFE_URL,
  async scrape(ctx): Promise<ScrapeResult> {
    const json = await ctx.fetchJson<{ rows?: KaggleHfeRow[] }>(API);
    const rows = parseHfe(json);
    if (rows.length < 5) throw new Error(`Humanity's First Exam: ${rows.length} rows; Kaggle's API changed?`);
    return {
      benchmarks: [{
        id: HFE_ID, sourceId: "hfe", name: "Humanity's First Exam", shortName: "HFE", url: HFE_URL, unit: "percent", higherIsBetter: true,
        category: "vision", categories: ["vision", "reasoning", "reliability"], eligibleForDefault: false, defaultWeight: 0,
        description: "Google DeepMind's reliability test: 544 simple everyday prompts, mostly about pictures (count the mugs, name the object), in families of four slight variations. A family counts only if the model gets every variation right every time (family pass^4), so it catches models that are right on one try but not reliably.",
      }],
      rows, raw: { "leaderboard.json": JSON.stringify(json) }, notes: [`${rows.length} models; #1 ${rows[0]?.modelLabel} ${rows[0]?.value}%`],
    };
  },
};
export default source;
