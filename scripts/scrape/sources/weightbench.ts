/**
 * WeightBench 1.0 (BenchFlow, released 2026-11-23): can a coding agent write a working neural network's weights by hand? 21 tasks fix a network and
 * its exact forward pass; the agent gets an hour in a numpy sandbox with no data, and may not train, fit, compute statistics over examples or run
 * the network. Graded on held-out data: 0 is a network that has learned nothing, 100% the same network trained on the task's data, linear between.
 * Three trials per agent and task; reviewers from two model families read every trial, and a rule break scores 0. The score is the site's: the mean
 * over tasks of each agent's mean over its trials, after rulings, with ±1 standard error from trial-to-trial variation (`data-se`, shown here as a
 * 95% interval as the site's chart draws it). Each leaderboard row carries everything in data attributes, including all 21 task scores.
 */
import type { Benchmark, RawRow, ScrapeResult, Source } from "../../../src/data/types";
import { normalizeLabel } from "../../../src/data/normalize";

export const WEIGHTBENCH_ID = "weightbench";
export const WEIGHTBENCH_SITE = "https://www.benchflow.ai/weightbench";

const attr = (tr: string, name: string) => new RegExp(`\\b${name}="([^"]*)"`).exec(tr)?.[1]?.replace(/&amp;/g, "&").replace(/&#39;/g, "'").replace(/&quot;/g, '"').replace(/&#x27;/g, "'");

/**
 * The model as the row names it ("GPT-6.2 Astra (Codex 0.166.0): ..."), with the checkpoint date its slug carries when the name leaves it out
 * (`deepseek-v41-flash-1017`), and the slug itself when the name matches no model ("Wonder Full 1.0" is `muse-wonder-full-1.0`).
 */
function labelOf(name: string, slug: string): string {
  const dated = /-(\d{4})$/.exec(slug)?.[1], label = dated && !name.includes(dated) ? `${name} ${dated}` : name;
  return normalizeLabel(label).ok ? label : slug;
}

export function parseWeightBench(html: string): { rows: RawRow[]; benchmark: Benchmark; tasks: number } {
  const trs = [...html.matchAll(/<tr data-model="[^"]+"[^>]*>/g)].map((m) => m[0]);
  if (!trs.length) throw new Error("WeightBench: no leaderboard rows; page changed?");
  let tasks = 0;
  const rows = trs.map((tr): RawRow => {
    const slug = attr(tr, "data-model")!, harness = attr(tr, "data-harness"), all = attr(tr, "data-scores") ?? "";
    const score = Number(attr(tr, "data-score")), raw = Number(attr(tr, "data-raw")), se = Number(attr(tr, "data-se"));
    // "Gemini 4 Carbon (Antigravity CLI, effort high (the Antigravity CLI's top level)): Fashion-MNIST 34% · ...": the header ends at the first "): ".
    const head = /^(.*?) \((.*?)\):\s/.exec(all), effort = head && /\beffort (\w+)/.exec(head[2])?.[1]?.toLowerCase();
    if (!head || !Number.isFinite(score)) throw new Error(`WeightBench: row ${slug} changed shape`);
    const perTask = Object.fromEntries(all.slice(head[0].length).split(" · ").map((s) => /^(.*) (-?[\d.]+)%$/.exec(s.trim())).filter((m) => m).map((m) => [m![1], Number(m![2])]));
    tasks = Math.max(tasks, Object.keys(perTask).length);
    const value = +score.toFixed(2);
    return {
      benchmarkId: WEIGHTBENCH_ID, modelLabel: labelOf(head[1], slug), value, harness, ...(effort ? { effort } : {}), sourceUrl: WEIGHTBENCH_SITE,
      ...(Number.isFinite(se) && se > 0 ? { ci: [+(score - 1.96 * se).toFixed(2), +(score + 1.96 * se).toFixed(2)] as [number, number] } : {}),
      note: `Mean of 3 trials on each of ${Object.keys(perTask).length} tasks in ${harness ?? "its harness"}, rule breaks scored 0${Number.isFinite(raw) && raw - score >= 0.05 ? ` (${raw.toFixed(1)}% before rulings)` : ""}`,
      details: { beforeRulings: Number.isFinite(raw) ? +raw.toFixed(2) : undefined, standardError: Number.isFinite(se) ? se : undefined, tasks: perTask },
    };
  });
  const benchmark: Benchmark = {
    id: WEIGHTBENCH_ID, sourceId: "weightbench", name: "WeightBench", shortName: "WeightBench", url: WEIGHTBENCH_SITE, unit: "percent", higherIsBetter: true,
    category: "coding", categories: ["coding", "agentic", "science"], normalization: { kind: "linear", min: 0, max: 100 }, eligibleForDefault: false, defaultWeight: 0,
    description: `Can a coding agent write a working neural network's weights by hand, from what it knows about the data, with no training and no running the network? ${tasks} tasks from doodles and heartbeats to chess and Qwen3.5-0.8B. 0 is a network that learned nothing, 100% the same network trained on real data.`,
  };
  return { rows, benchmark, tasks };
}

const source: Source = {
  id: "weightbench", name: "WeightBench", url: WEIGHTBENCH_SITE,
  async scrape(ctx): Promise<ScrapeResult> {
    const html = await ctx.fetchText(WEIGHTBENCH_SITE), { rows, benchmark, tasks } = parseWeightBench(html);
    if (rows.length < 5) throw new Error(`WeightBench: ${rows.length} agents`);
    return { benchmarks: [benchmark], rows, raw: { "weightbench.html": html }, notes: [`${rows.length} agents over ${tasks} tasks`] };
  },
};
export default source;
