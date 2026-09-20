/**
 * PostTrainBench v1.1. Models act as post-training engineers: given a base model and compute
 * budget, produce a fine-tuned model, scored on downstream benchmarks. scores.json holds
 * aggregatedScores (config slug -> {avg,std,n} in percentage points) with effort encoded in
 * the config slug ("gpt-5.4-high", "opus-4.8-max").
 */
import type { Source, ScrapeResult, RawRow } from "../../../src/data/types";
import { num } from "../harness";

const SITE = "https://posttrainbench.com/?version=v1.1";
const DATA = "https://posttrainbench.com/scores.json";

interface Scores { aggregatedScores?: Record<string, { avg?: number; std?: number; n?: number }> }

const source: Source = {
  id: "posttrainbench",
  name: "PostTrainBench v1.1",
  url: SITE,
  async scrape(ctx): Promise<ScrapeResult> {
    const json = await ctx.fetchJson<Scores>(DATA);
    const rows: RawRow[] = [];
    const sorted = Object.entries(json.aggregatedScores ?? {}).sort((a, b) => (b[1].avg ?? 0) - (a[1].avg ?? 0));
    let rank = 0;
    for (const [slug, agg] of sorted) {
      const avg = num(agg.avg);
      if (avg == null) continue;
      rank++;
      // Config slugs carry the reasoning effort as the last -segment ("gpt-5.5-xhigh").
      const m = slug.match(/^(.*?)-((?:x)?high|medium|low|minimal|max|none)$/);
      rows.push({
        benchmarkId: "posttrainbench-v1.1",
        modelLabel: m?.[1] ?? slug,
        effort: m ? (m[2] === "max" ? "xhigh" : m[2]) : undefined,
        value: avg,
        rank,
        sourceUrl: SITE,
        note: `n=${agg.n ?? "?"} runs · std ${agg.std != null ? agg.std.toFixed(1) : "?"}`,
      });
    }
    return {
      benchmarks: [{
        id: "posttrainbench-v1.1", name: "PostTrainBench v1.1", sourceId: this.id, url: SITE,
        description: "Agents act as post-training engineers: given a base model and a compute budget, run a full fine-tuning pipeline, scored on downstream benchmark gains averaged over seeds.",
        unit: "percent", higherIsBetter: true, category: "agentic", eligibleForDefault: true, defaultWeight: 5,
      }],
      rows,
      raw: { "scores.json": JSON.stringify(json) },
      notes: [`${rows.length} config rows from scores.json`],
    };
  },
};
export default source;
