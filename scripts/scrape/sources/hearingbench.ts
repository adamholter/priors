/**
 * Hearing Bench (hearing-bench.adamholter.chatgpt.site). Models see only a mel spectrogram image of a
 * clip, never the audio, and name the sound: 100 clips in five tiers of 20 (ESC-50 everyday sounds,
 * NSynth instrument notes, VocalSound, Speech Commands words, LibriSpeech sentences). Each model runs
 * in its vendor's own CLI with no tools; grading is strict (near misses are reported, never credited).
 * The site publishes `/results.json` with complete runs only, one row per model and reasoning effort.
 * Cost is the full run priced at API list rates from the measured output tokens; we report it per clip.
 */
import type { Source, ScrapeResult, RawRow } from "../../../src/data/types";

const SITE = "https://hearing-bench.adamholter.chatgpt.site/";
const API = `${SITE}results.json`;

type Row = {
  model: string;
  maker?: string;
  harness?: string;
  effort?: string;
  correct: number;
  near_misses?: number;
  wrong?: number;
  refused?: number;
  tiers?: Record<string, number>;
  stated_confidence_pct?: number | null;
  output_tokens_per_clip?: number | null;
  cost_usd_per_run?: number | null;
  seconds_per_clip?: number | null;
};

export function parseHearingBench(json: { clips?: number; updated?: string; models?: Row[] }): ScrapeResult {
  const clips = json.clips ?? 100;
  const list = json.models ?? [];
  if (!list.length) throw new Error("Hearing Bench: empty results");
  const rows: RawRow[] = [];
  for (const r of list) {
    if (!r.model || typeof r.correct !== "number") continue;
    rows.push({
      benchmarkId: "hearingbench", modelLabel: r.model, effort: r.effort, value: (r.correct * 100) / clips,
      sourceUrl: SITE, labHint: r.maker, harness: r.harness,
      costUsd: typeof r.cost_usd_per_run === "number" ? r.cost_usd_per_run / clips : undefined,
      outputTokens: r.output_tokens_per_clip ?? undefined,
      durationSec: r.seconds_per_clip ?? undefined,
      note: `${r.correct}/${clips} correct, ${r.near_misses ?? 0} near misses · ${r.harness ?? "?"} · cost at API list price`,
      details: {
        correct: r.correct, nearMisses: r.near_misses, wrong: r.wrong, refused: r.refused,
        tiers: r.tiers, statedConfidencePct: r.stated_confidence_pct,
      },
    });
  }
  if (!rows.length) throw new Error("Hearing Bench: no usable rows");
  return {
    benchmarks: [{
      id: "hearingbench", name: "Hearing Bench", sourceId: "hearingbench", url: SITE, lastUpdated: json.updated,
      description: "Models see only a spectrogram image of a sound clip, never the audio, and must name the sound: everyday sounds, instrument notes, vocal sounds, spoken words and sentences. Strict grading; value is % of 100 clips correct.",
      normalization: { kind: "linear", min: 0, max: 100 },
      unit: "percent", higherIsBetter: true, category: "other", eligibleForDefault: false, defaultWeight: 0,
    }],
    rows,
    raw: { "results.json": JSON.stringify(json) },
    notes: [`${rows.length} rows (complete runs only)`],
  };
}

const source: Source = {
id: "hearingbench",
name: "Hearing Bench",
  url: SITE,
  async scrape(ctx): Promise<ScrapeResult> {
    return parseHearingBench(await ctx.fetchJson(API) as Parameters<typeof parseHearingBench>[0]);
  },
};
export default source;
