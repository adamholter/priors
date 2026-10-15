import { z } from "zod";
import type { ScrapeResult, Source } from "../../../src/data/types";

export const AGI_PILLED_URL = "https://agi-pilled-bench.adamholter.chatgpt.site/";
export const AGI_PILLED_ID = "agi-pilled-bench";
const effort = z.enum(["none", "minimal", "low", "medium", "high", "xhigh", "max"]);
const dataSchema = z.object({
  now: z.number().int(),
  never_sentinel: z.number().positive(),
  events: z.array(z.string()).min(1),
  models: z.array(z.object({
    id: z.string().min(1), name: z.string().min(1), effort,
    score: z.number().finite().nonnegative(),
    ci: z.tuple([z.number().finite(), z.number().finite()]),
    n: z.number().int().positive(),
  })).min(1),
});

export function parseAgiPilled(json: unknown): ScrapeResult {
  const d = dataSchema.parse(json);
  const runsPerMilestone = d.models[0].n / d.events.length;
  if (!Number.isInteger(runsPerMilestone) || d.models.some(m => m.n !== d.models[0].n)) {
    throw new Error("AGI-Pilled: incomplete or unequal response coverage");
  }
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
      description: `Median forecast in years after ${d.now} for ${d.events.length} AI milestones. Lower means more AGI-pilled. ${runsPerMilestone} runs per milestone; the IMO control is excluded.`,
      unit: "count", higherIsBetter: false, category: "other", defaultWeight: 0, eligibleForDefault: false,
    }],
    rows: d.models.map((m, i) => ({
      benchmarkId: AGI_PILLED_ID, modelLabel: m.name, effort: m.effort,
      value: m.score, ci: m.ci, rank: i + 1, sourceUrl: AGI_PILLED_URL,
      details: { sourceSettingId: m.id, scoreUnit: "years after 2026", scoredResponses: m.n, milestones: d.events.length, neverSentinel: d.never_sentinel },
      note: `90% bootstrap confidence interval; ${m.n} scored responses; lower = more AGI-pilled`,
    })),
    raw: { "data.json": JSON.stringify(json) },
  };
}

const source: Source = {
  id: "agi-pilled", name: "AGI-Pilled Bench", url: AGI_PILLED_URL,
  async scrape(ctx) { return parseAgiPilled(await ctx.fetchJson(`${AGI_PILLED_URL}data.json`)); },
};
export default source;
