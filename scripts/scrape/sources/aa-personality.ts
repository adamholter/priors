/**
 * AA-PersonalityBench (Artificial Analysis), https://artificialanalysis.ai/evaluations/aa-personalitybench
 *
 * How models write rather than how correct they are. 30 traits are judged pairwise by an LLM panel
 * (Bradley-Terry Elo per trait) and roll up into 8 indexes, each a 1 to 100 percentile rank across the
 * models evaluated. 21 communication characteristics (length, structure, punctuation) are measured
 * directly. The page is not on the shared evaluation manifest: every model record ships inline in the
 * RSC payload as `{id, slug, name, ..., judged: {scores, cis, indexScores, indexIntervals}, means}`.
 * One benchmark per index; the trait Elos, their intervals and the measured characteristics ride along
 * in each row's details. Descriptive, not a capability score, so `defaultWeight: 0`.
 */
import type { Benchmark, RawRow, ScrapeResult, Source } from "../../../src/data/types";
import { resolveAAIdentity } from "../aa-identity";
import { balancedJson, rscText } from "./_rsc";

const ORIGIN = "https://artificialanalysis.ai";
const PAGE = `${ORIGIN}/evaluations/aa-personalitybench`;

export const INDEXES: { key: string; name: string; description: string; higherIsBetter?: boolean }[] = [
  { key: "expressiveness", name: "Expressiveness", description: "rich, varied, well-turned language" },
  { key: "organization", name: "Organization", description: "structured, scannable answers that lead with the bottom line" },
  { key: "informativeness", name: "Informativeness", description: "dense, evidence-based, specific, actionable answers" },
  { key: "transparency", name: "Transparency", description: "truthful answers that admit uncertainty and flag assumptions and nuance" },
  { key: "warmth", name: "Warmth", description: "friendly, sincere, emotionally intelligent, with little sycophancy" },
  { key: "conviction", name: "Conviction", description: "direct, confident, opinionated, and willing to push back" },
  { key: "imagination", name: "Imagination", description: "creative, open-ended answers" },
  { key: "slop", name: "Slop", description: "how much the writing reads as generic AI filler; lower is better", higherIsBetter: false },
];

export const benchmarkFor = (i: (typeof INDEXES)[number]): Benchmark => ({
  id: `aa-personality-${i.key}`, name: `AA-PersonalityBench ${i.name}`, shortName: i.name, sourceId: "aa-personality", url: PAGE,
  description: `AA-PersonalityBench ${i.name} index: ${i.description}. Percentile rank (1 to 100) across the models AA evaluated, from pairwise LLM-judged trait Elos. Describes style, not correctness.`,
  normalization: { kind: "linear", min: 0, max: 100 },
  unit: "score", higherIsBetter: i.higherIsBetter ?? true, category: i.key === "slop" ? "creative" : "other", defaultWeight: 0,
});

type Num = Record<string, number>;
interface Record_ { id: string; slug: string; name: string; judged: { scores: Num; cis?: Record<string, { lower: number; upper: number }>; indexScores: Num; indexIntervals?: Record<string, { lower: number; upper: number }> }; means?: Num; [k: string]: unknown }

/** Every model record that carries a `judged` block. Exported for tests. */
export function modelRecords(rsc: string): Record_[] {
  const out = new Map<string, Record_>();
  for (const m of rsc.matchAll(/\{"id":"[0-9a-f-]{36}","slug":"[^"]+","name":"/g)) {
    const body = balancedJson(rsc, m.index!);
    if (!body || !body.includes('"judged"')) continue;
    try { const r = JSON.parse(body) as Record_; if (r.judged?.indexScores) out.set(r.id, r); } catch { /* not a model record */ }
  }
  return [...out.values()];
}

export function parsePersonality(rsc: string): Pick<ScrapeResult, "benchmarks" | "rows" | "notes"> {
  const records = modelRecords(rsc);
  if (!records.length) throw new Error("AA-PersonalityBench: no model records found in the page payload");
  const rows: RawRow[] = [];
  for (const r of records) {
    const identity = resolveAAIdentity(r);
    for (const i of INDEXES) {
      const value = r.judged.indexScores[i.key], ci = r.judged.indexIntervals?.[i.key];
      if (typeof value !== "number" || !Number.isFinite(value)) continue;
      rows.push({
        benchmarkId: `aa-personality-${i.key}`, modelLabel: r.name, effort: identity.effort, identity, sourceModelId: r.id,
        labHint: (r.creator as { name?: string } | undefined)?.name, releaseDateHint: r.releaseDate as string | undefined,
        value, ci: ci ? [ci.lower, ci.upper] : undefined, sourceUrl: PAGE,
        details: { traitElo: r.judged.scores, traitIntervals: r.judged.cis, indexes: r.judged.indexScores, characteristics: r.means },
      });
    }
  }
  if (!rows.length) throw new Error("AA-PersonalityBench: models found but no index scores");
  return { benchmarks: INDEXES.map(benchmarkFor), rows, notes: [`${records.length} models, ${INDEXES.length} indexes`] };
}

const source: Source = {
  id: "aa-personality", name: "AA-PersonalityBench · Artificial Analysis", url: PAGE,
  async scrape(ctx): Promise<ScrapeResult> {
    const html = await ctx.fetchText(PAGE);
    const result = parsePersonality(rscText(html));
    return { ...result, raw: { "page.html": html } };
  },
};
export default source;
