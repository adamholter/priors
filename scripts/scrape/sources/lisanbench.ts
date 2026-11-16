/**
 * LisanBench (@scaling01, https://lisanbench.com/): word chains. From each of 50 starting words the model links valid dictionary words
 * that differ by one letter, never repeating one, for as long as it can; three trials per word. The score is the site's "Path Length":
 * valid transitions per chain, summed over the 50 words. Read from the site's own data file.
 *
 * Two boards. With reasoning on, path length mostly measures how many reasoning tokens a run spent (within a model, more tokens gave a
 * longer path in 41 of 43 effort steps on November 16, 2026; Opus 5.5 went from 3,142 at low to 24,029 at xhigh), so the author asked for
 * the main ranking to use runs without reasoning. `lisanbench` is those runs, chosen exactly as the site's Non-thinking filter chooses
 * them (a run whose measured reasoning tokens are zero, else a model the site marks as not thinking), except a thinking model's run that
 * reports zero but bills over HIDDEN_REASONING_TOKENS_PER_STEP output tokens a step (Gemini 4 Argon low and medium). Low-effort runs that spend no
 * reasoning tokens (the author plans them for newer models) join it on their own. `lisanbench-all-runs` keeps every run, the site's
 * default view.
 */
import type { RawRow, Source } from "../../../src/data/types";
import { splitLabel } from "./_board";

const PAGE = "https://lisanbench.com/";
const DATA = "https://lisanbench.com/data/core.json";
export const LISANBENCH_ID = "lisanbench";
export const LISANBENCH_ALL_ID = "lisanbench-all-runs";

interface Model { id: string; label: string; company?: string; thinking?: boolean }
interface Aggregate {
  model: string; sum_chain_avg: number; sum_chain_avg_ci?: [number, number]; sum_sparse_chain_avg?: number; estimated_cost_usd?: number;
  avg_validity?: number; output_tokens?: number; avg_reasoning_tokens?: number | null; coverage?: { words?: number; trials?: number; missing_words?: string[] };
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

/**
 * Output tokens per valid step above which a thinking model's run reasoned even though its provider reported none. Writing the chain
 * costs a few tokens a step (Sonnet 5.5's zero-reasoning low and medium runs: 6.5 and 7.0); Gemini 4 Argon's low and medium runs report
 * zero reasoning tokens yet bill 645 and 1,016 a step, about what its high run (83,270 reasoning tokens a trial) bills.
 */
export const HIDDEN_REASONING_TOKENS_PER_STEP = 100;

/**
 * The site's Non-thinking filter (measured reasoning tokens decide when the run has them, the model's thinking flag otherwise), with
 * one guard: a thinking model's run that reports zero reasoning but bills far more output than the chain needs reasoned uncounted.
 */
export function usedReasoning(a: Pick<Aggregate, "avg_reasoning_tokens">, m: Pick<Model, "thinking"> | undefined, tokensPerStep?: number): boolean {
  const t = a.avg_reasoning_tokens;
  if (!(typeof t === "number" && Number.isFinite(t) && t >= 0)) return !!m?.thinking;
  return t > 0 || (!!m?.thinking && tokensPerStep !== undefined && tokensPerStep > HIDDEN_REASONING_TOKENS_PER_STEP);
}

export interface LisanBenchParse { rows: RawRow[]; /** Models on the all-runs board with no run without reasoning yet, best first. */ awaiting: string[] }

export function parseLisanBench(json: string): LisanBenchParse {
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
    const trials = a.coverage?.trials ?? 150, steps = (a.sum_chain_avg * trials) / words, tokensPerStep = steps > 0 && a.output_tokens ? a.output_tokens / steps : undefined;
    const reasoning = usedReasoning(a, m, tokensPerStep), hidden = reasoning && a.avg_reasoning_tokens === 0;
    const row: RawRow = {
      benchmarkId: LISANBENCH_ALL_ID, modelLabel: label, effort, effortUnstated: effort ? undefined : true, value: a.sum_chain_avg,
      ci: a.sum_chain_avg_ci, labHint: m.company ? LABS[m.company] : undefined, releaseDateHint: d.release_dates?.[a.model], sourceUrl: PAGE, sourceModelId: a.model,
      note: `${m.label}${budget === "thinking" ? "; thinking on, no effort setting" : budget ? `; ${budget} thinking-token budget` : ""}${!reasoning && m.thinking ? "; no reasoning tokens used" : ""}${hidden ? `; provider reported no reasoning tokens, but ${Math.round(tokensPerStep!)} output tokens a step` : ""}`,
      // The site's cost is token counts at catalog prices, not a measured bill, so it stays out of costUsd. Tokens per step is the site's
      // own (all output tokens over all valid steps); the validity ratio is its "Avg Validity Ratio".
      details: {
        avgValidityRatio: a.avg_validity, tokensPerStep,
        reasoningTokensPerTrial: typeof a.avg_reasoning_tokens === "number" ? a.avg_reasoning_tokens : undefined,
        difficultyWeighted: a.sum_sparse_chain_avg, estimatedCostUsd: a.estimated_cost_usd, trials, usedReasoning: reasoning,
      },
    };
    rows.push(row);
    if (!reasoning) rows.push({ ...row, benchmarkId: LISANBENCH_ID });
  }
  if (rows.filter((r) => r.benchmarkId === LISANBENCH_ALL_ID).length < 20) throw new Error(`LisanBench had only ${rows.length} rows`);
  // Who the main board is still waiting on: models whose every complete run used reasoning, ranked by their best all-runs score.
  const without = new Set(rows.filter((r) => r.benchmarkId === LISANBENCH_ID).map((r) => r.modelLabel)), best = new Map<string, number>();
  for (const r of rows) if (!without.has(r.modelLabel)) best.set(r.modelLabel, Math.max(best.get(r.modelLabel) ?? 0, r.value));
  const awaiting = [...best].sort((x, y) => y[1] - x[1]).map(([l]) => l);
  return { rows, awaiting };
}

/** The main board's line about models it has no run for yet: the strongest few by name, the rest counted. */
export function awaitingNotice(awaiting: string[], named = 6): string | undefined {
  if (!awaiting.length) return undefined;
  const names = awaiting.slice(0, named).join(", "), more = awaiting.length - named;
  return `No run without reasoning yet for ${names}${more > 0 ? ` and ${more} more` : ""}. LisanBench's author plans low-effort runs for newer models; a run that spends no reasoning tokens appears here when it is published. Until then their scores are under All runs.`;
}

const DESCRIPTION = "Word chains: from 50 starting words, link valid words that each differ from the last by one letter (added, removed or swapped) without repeats for as long as possible. Valid steps per chain, summed over the 50 words, three trials each.";

const source: Source = {
  id: "lisanbench", name: "LisanBench", url: PAGE,
  async scrape(ctx) {
    const json = await ctx.fetchText(DATA);
    const { rows, awaiting } = parseLisanBench(json), notice = awaitingNotice(awaiting);
    const common = { sourceId: this.id, url: PAGE, unit: "score" as const, higherIsBetter: true, category: "reasoning" as const, defaultWeight: 0 };
    return {
      benchmarks: [
        { ...common, id: LISANBENCH_ID, name: "LisanBench", shortName: "LisanBench", variantLabel: "Without reasoning", eligibleForDefault: true, ...(notice ? { notice } : {}),
          description: `${DESCRIPTION} Only runs that used no reasoning tokens, as the site's Non-thinking filter.` },
        { ...common, id: LISANBENCH_ALL_ID, name: "LisanBench (all runs, reasoning on)", shortName: "LisanBench all runs", variantOf: LISANBENCH_ID, variantLabel: "All runs, reasoning on", eligibleForDefault: false,
          description: `${DESCRIPTION} Every run, reasoning included: the site's default view, where longer reasoning gives longer chains.` },
      ],
      rows, raw: { "core.json": json }, notes: [`${rows.filter((r) => r.benchmarkId === LISANBENCH_ID).length} runs without reasoning, ${rows.filter((r) => r.benchmarkId === LISANBENCH_ALL_ID).length} in all; ${awaiting.length} models awaiting a run without reasoning`],
    };
  },
};
export default source;
