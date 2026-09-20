/**
 * SimpleQA Verified (Google DeepMind relabeling of OpenAI's SimpleQA). Factuality: share of
 * 1,000 short fact-seeking questions answered correctly with verified answer keys. Leaderboard
 * JSON is served by Kaggle's benchmark API; scores are fractions displayed as percentages.
 */
import type { Source, ScrapeResult, RawRow } from "../../../src/data/types";
import { num } from "../harness";

const SITE = "https://www.kaggle.com/benchmarks/deepmind/simpleqa-verified";
const API = "https://www.kaggle.com/api/v1/benchmarks/deepmind/simpleqa-verified/leaderboard";

interface KaggleRow {
  modelVersionName?: string;
  taskResults?: { result?: { numericResult?: { value?: number }; confidenceInterval?: number } }[];
}

const source: Source = {
  id: "simpleqa",
  name: "SimpleQA Verified",
  url: SITE,
  async scrape(ctx): Promise<ScrapeResult> {
    const json = await ctx.fetchJson<{ rows?: KaggleRow[] }>(API);
    const rows: RawRow[] = [];
    for (const r of json.rows ?? []) {
      const task = r.taskResults?.[0];
      const v = num(task?.result?.numericResult?.value);
      const label = r.modelVersionName?.trim();
      if (v == null || !label) continue;
      const ciHalf = num(task?.result?.confidenceInterval);
      rows.push({
        benchmarkId: "simpleqa-verified",
        modelLabel: label,
        value: v * 100,
        ci: ciHalf != null ? [(v - ciHalf) * 100, (v + ciHalf) * 100] : undefined,
        sourceUrl: SITE,
      });
    }
    return {
      benchmarks: [{
        id: "simpleqa-verified", name: "SimpleQA Verified", shortName: "SimpleQA", sourceId: this.id, url: SITE,
        description: "1,000 short fact-seeking questions with human-verified answer keys (DeepMind's relabeling of OpenAI's SimpleQA); accuracy on the verified set.",
        unit: "percent", higherIsBetter: true, category: "reasoning", eligibleForDefault: true, defaultWeight: 5,
      }],
      rows,
      raw: { "leaderboard.json": JSON.stringify(json) },
      notes: [`${rows.length} leaderboard rows from Kaggle API`],
    };
  },
};
export default source;
