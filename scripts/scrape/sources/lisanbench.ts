/**
 * LisanBench (@scaling01, https://lisanbench.com/): word chains. From each of 50 starting words the model links valid dictionary words
 * that differ by one letter, never repeating one, for as long as it can; three trials per word. Headline is the site's default "Path
 * Length": valid transitions per chain, summed over the 50 words. Read from the site's own data file.
 */
import type { RawRow, Source } from "../../../src/data/types";
import { splitLabel } from "./_board";

const PAGE = "https://lisanbench.com/";
const DATA = "https://lisanbench.com/data/core.json";
export const LISANBENCH_ID = "lisanbench";

interface Model { id: string; label: string; company?: string; thinking?: boolean }
interface Aggregate {
  model: string; sum_chain_avg: number; sum_chain_avg_ci?: [number, number]; sum_sparse_chain_avg?: number; estimated_cost_usd?: number;
  avg_validity?: number; output_tokens?: number; coverage?: { words?: number; trials?: number; missing_words?: string[] };
}
interface Core { metadata?: { num_words?: number }; models: Model[]; aggregated: Aggregate[]; release_dates?: Record<string, string> }

const LABS: Record<string, string> = { anthropic: "Anthropic", openai: "OpenAI", google: "Google", deepseek: "DeepSeek", meta: "Meta", "x-ai": "xAI" };

/** The site's label to Priors' spelling: Claude models without the family, "GPT 5.5" for GPT-5.5, "O3" for o3. */
export function lisanLabel(raw: string): { label: string; effort?: string; budget?: string } {
  let rest = raw.trim(), budget: string | undefined;
  // "(16k)" is a thinking-token budget and "(thinking)" a thinking mode with no effort setting: neither is an effort.
  const m = rest.match(/\s*\((\d+k|thinking)\)$/i);
  if (m) { budget = m[1].toLowerCase(); rest = rest.slice(0, m.index).trim(); }
  const { label, effort } = splitLabel(rest);
  let out = label.replace(/^GPT (\d)/, "GPT-$1").replace(/^O(\d)\b/, "o$1");
  if (/^(Fable|Opus|Sonnet|Haiku)\b/.test(out)) out = `Claude ${out}`;
  return { label: out, effort, budget };
}

export function parseLisanBench(json: string): RawRow[] {
  const d = JSON.parse(json) as Core;
  if (!Array.isArray(d.models) || !Array.isArray(d.aggregated)) throw new Error("LisanBench data has no models or aggregated rows");
  const words = d.metadata?.num_words ?? 50, byId = new Map(d.models.map((m) => [m.id, m]));
  // A model run both with and without thinking: the run without is effort "none", or the two would share one variant.
  const thinkingBases = new Set(d.models.filter((m) => m.thinking).map((m) => lisanLabel(m.label).label));
  const rows: RawRow[] = [];
  for (const a of d.aggregated) {
    const m = byId.get(a.model);
    // A sum over fewer starting words is not comparable; one trial short of three on a word still is.
    if (!m || !Number.isFinite(a.sum_chain_avg) || (a.coverage?.words ?? words) < words) continue;
    const parsed = lisanLabel(m.label), { label, budget } = parsed;
    const effort = parsed.effort ?? (!m.thinking && thinkingBases.has(label) ? "none" : undefined);
    rows.push({
      benchmarkId: LISANBENCH_ID, modelLabel: label, effort, effortUnstated: effort ? undefined : true, value: a.sum_chain_avg,
      ci: a.sum_chain_avg_ci, labHint: m.company ? LABS[m.company] : undefined, releaseDateHint: d.release_dates?.[a.model], sourceUrl: PAGE, sourceModelId: a.model,
      note: `${m.label}${budget === "thinking" ? "; thinking on, no effort setting" : budget ? `; ${budget} thinking-token budget` : ""}`,
      // The site's cost is token counts at catalog prices, not a measured bill, so it stays out of costUsd.
      details: { difficultyWeighted: a.sum_sparse_chain_avg, estimatedCostUsd: a.estimated_cost_usd, validity: a.avg_validity, trials: a.coverage?.trials },
    });
  }
  if (rows.length < 20) throw new Error(`LisanBench had only ${rows.length} rows`);
  return rows;
}

const source: Source = {
  id: "lisanbench", name: "LisanBench", url: PAGE,
  async scrape(ctx) {
    const json = await ctx.fetchText(DATA);
    const rows = parseLisanBench(json);
    return {
      benchmarks: [{
        id: LISANBENCH_ID, name: "LisanBench", shortName: "LisanBench", sourceId: this.id, url: PAGE,
        description: "Word chains: from 50 starting words, link valid words that each differ from the last by one letter (added, removed or swapped) without repeats for as long as possible. Valid steps per chain, summed over the 50 words, three trials each.",
        unit: "score" as const, higherIsBetter: true, category: "reasoning" as const, eligibleForDefault: true, defaultWeight: 0,
      }],
      rows, raw: { "core.json": json }, notes: [`${rows.length} models`],
    };
  },
};
export default source;
