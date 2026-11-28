/**
 * KrillionBench (internetphysics, krillion.infinite.games, announced 2026-11-27 at x.com/internetphysics/status/2126378656528543755):
 * 15 models each play the same 76 daily games of Krillion (krillion.io). A game is seven categories ("Name a noodle dish"); each
 * answer scores by how rarely real players gave it: One in a Krillion 100, Deep Cut 85, Rare 60, Schooler 30, Too Clever 15,
 * Plankton 10, a miss 0, so a game is out of 700. Doing well needs knowledge plus a guess at what other people will say.
 *
 * Data: the site's own `data.json`. `runs.high.models` holds each model's 76 game scores, the publisher's mean and median, the share
 * of people's first tries it beat in each game, and its answer-tier counts; `humanAvg` is the players' first-try score distribution.
 * The value is the publisher's mean points per game (checked against the scores); the interval is 1.96 × the standard error across
 * the 76 games. Only the "high" run exists; a new effort in `runs` would be read too.
 */
import type { Benchmark, RawRow, ScrapeResult, Source } from "../../../src/data/types";

export const KRILLION_ID = "krillionbench";
export const KRILLION_URL = "https://krillion.infinite.games";

interface KModel {
  id: string; name: string; lab: string; effort?: string; scores: number[]; pct: number[];
  mean: number; median: number; min: number; max: number; meanPct: number; tokens?: number; tiers?: Record<string, number>;
}
export interface KrillionData { games: Record<string, { prompts: string[] }>; humanAvg: number[]; binWidth: number; runs: Record<string, { models: KModel[]; playedFrom?: string; playedTo?: string }> }

const fail = (what: string): never => { throw new Error(`KrillionBench: ${what}; the site's data.json changed?`); };
const round = (x: number, d = 2) => Math.round(x * 10 ** d) / 10 ** d;
const mean = (a: number[]) => a.reduce((s, x) => s + x, 0) / a.length;

/** Mean first-try score of people, from the binned distribution the site draws. */
export function humanMean(d: KrillionData): number {
  const total = d.humanAvg.reduce((s, p) => s + p, 0);
  return d.humanAvg.reduce((s, p, i) => s + (i + 0.5) * d.binWidth * p, 0) / total;
}

export function parseKrillion(d: KrillionData): { rows: RawRow[]; benchmark: Benchmark } {
  const games = Object.keys(d.games ?? {}).length;
  if (games < 20) fail(`only ${games} games`);
  const human = round(humanMean(d), 0);
  const rows: RawRow[] = [];
  for (const [run, r] of Object.entries(d.runs ?? {})) {
    const models = [...r.models].sort((a, b) => b.mean - a.mean);
    if (models.length < 5) fail(`only ${models.length} models in the ${run} run`);
    models.forEach((m, i) => {
      // Every model plays every game: a partial run would be scored on different days.
      if (m.scores.length !== games || m.scores.some((s) => !Number.isFinite(s))) fail(`${m.name} has ${m.scores.length} of ${games} games`);
      if (Math.abs(mean(m.scores) - m.mean) > 0.01) fail(`${m.name}'s mean ${m.mean} does not match its scores`);
      const sd = Math.sqrt(m.scores.reduce((s, x) => s + (x - m.mean) ** 2, 0) / (m.scores.length - 1));
      const ci95 = 1.96 * sd / Math.sqrt(m.scores.length);
      rows.push({
        benchmarkId: KRILLION_ID, modelLabel: m.name, effort: m.effort ?? run, value: round(m.mean), rank: i + 1, sourceUrl: KRILLION_URL,
        ci: [round(m.mean - ci95), round(m.mean + ci95)],
        note: `Mean points per game out of 700 over ${m.scores.length} daily games (people's first tries average about ${human}); median ${m.median}, beat ${round(m.meanPct, 1)}% of people on average; the interval is the 95% CI across games`,
        details: {
          games: m.scores.length, median: m.median, min: m.min, max: m.max, beatsPeoplePct: round(m.meanPct, 2), humanMean: human,
          answerTiers: m.tiers, tokensPerAnswer: m.tokens, played: r.playedFrom && r.playedTo ? `${r.playedFrom.slice(0, 10)} to ${r.playedTo.slice(0, 10)}` : undefined,
        },
      });
    });
  }
  if (!rows.length) fail("no runs");
  const benchmark: Benchmark = {
    id: KRILLION_ID, sourceId: KRILLION_ID, name: "KrillionBench", shortName: "Krillion", url: KRILLION_URL, unit: "score", higherIsBetter: true,
    category: "knowledge", categories: ["knowledge", "creative", "reasoning"], normalization: { kind: "linear", min: 0, max: 700 }, eligibleForDefault: false, defaultWeight: 0,
    description: `Models play 76 days of the daily game Krillion: name something in each of seven categories, scored by how rarely real players gave the same answer (up to 100 each, 700 a game). It takes knowing obscure valid answers and guessing what other people won't say. Mean points per game; people's first tries average about ${human}.`,
  };
  return { rows, benchmark };
}

const source: Source = {
  id: KRILLION_ID, name: "KrillionBench", url: KRILLION_URL,
  async scrape(ctx): Promise<ScrapeResult> {
    const text = await ctx.fetchText(`${KRILLION_URL}/data.json`);
    const { rows, benchmark } = parseKrillion(JSON.parse(text) as KrillionData);
    return { benchmarks: [benchmark], rows, raw: { "data.json": text }, notes: [`${rows.length} models, #1 ${rows[0].modelLabel} ${rows[0].value}`] };
  },
};
export default source;
