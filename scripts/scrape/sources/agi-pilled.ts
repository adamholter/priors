import { z } from "zod";
import type { ScrapeResult, Source } from "../../../src/data/types";

export const AGI_PILLED_URL = "https://agi-pilled-bench.adamholter.chatgpt.site/";
export const AGI_PILLED_ID = "agi-pilled-bench";
const effort = z.enum(["none", "minimal", "low", "medium", "high", "xhigh", "max"]);
const dataSchema = z.object({
  now: z.number().int(),
  never_sentinel: z.number().positive(),
  events: z.array(z.string()).min(1),
  /** The milestones in the score. A milestone added to `events` is not scored until every model has its runs. */
  score_events: z.array(z.string()).min(1).optional(),
  models: z.array(z.object({
    id: z.string().min(1), name: z.string().min(1), effort,
    score: z.number().finite().nonnegative(),
    ci: z.tuple([z.number().finite(), z.number().finite()]),
    n: z.number().int().positive(),
    /** Runs per milestone. `n` also counts runs on a milestone that is not scored yet. */
    cells: z.record(z.string(), z.object({ n: z.number().int().nonnegative() })).optional(),
  })).min(1),
});

export function parseAgiPilled(json: unknown): ScrapeResult {
  const d = dataSchema.parse(json);
  const scored = d.score_events ?? d.events;
  // Every model needs the same number of runs on every scored milestone.
  const runs = d.models.flatMap(m => m.cells ? scored.map(e => m.cells?.[e]?.n ?? 0) : [m.n / scored.length]);
  const runsPerMilestone = runs[0];
  if (!Number.isInteger(runsPerMilestone) || runsPerMilestone < 1 || runs.some(n => n !== runsPerMilestone)) {
    throw new Error("AGI-Pilled: incomplete or unequal response coverage");
  }
  const responses = runsPerMilestone * scored.length;
  const ids = new Set<string>();
  for (const m of d.models) {
    if (ids.has(m.id) || m.ci[0] < 0 || m.ci[0] > m.score || m.ci[1] < m.score) {
      throw new Error(`AGI-Pilled: invalid or duplicate result ${m.id}`);
    }
    ids.add(m.id);
  }
  return {
    benchmarks: [{
      id: AGI_PILLED_ID, name: "AGI-Pilled Bench", sourceId: "agi-pilled", url: AGI_PILLED_URL,
      description: `Median forecast in years after ${d.now} for ${scored.length} AI milestones. Lower means more AGI-pilled. ${runsPerMilestone} runs per milestone; the IMO control is excluded.`,
      unit: "count", higherIsBetter: false, category: "other", defaultWeight: 0, eligibleForDefault: false,
    }],
    rows: d.models.map((m, i) => ({
      benchmarkId: AGI_PILLED_ID, modelLabel: m.name, effort: m.effort,
      value: m.score, ci: m.ci, rank: i + 1, sourceUrl: AGI_PILLED_URL,
      details: { sourceSettingId: m.id, scoreUnit: "years after 2026", scoredResponses: responses, milestones: scored.length, neverSentinel: d.never_sentinel },
      note: `90% bootstrap confidence interval; ${responses} scored responses; lower = more AGI-pilled`,
    })),
    raw: { "data.json": JSON.stringify(json) },
  };
}

const source: Source = {
  id: "agi-pilled", name: "AGI-Pilled Bench", url: AGI_PILLED_URL,
  async scrape(ctx) { return parseAgiPilled(await ctx.fetchJson(`${AGI_PILLED_URL}data.json`)); },
};
export default source;
