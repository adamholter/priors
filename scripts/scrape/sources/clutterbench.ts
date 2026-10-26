import { z } from "zod";
import type { Effort, ScrapeResult, Source } from "../../../src/data/types";

export const CLUTTERBENCH_URL = "https://clutterbench.adamholter.chatgpt.site/";
const EFFORTS = ["none", "minimal", "low", "medium", "high", "xhigh", "max"] as const;
const effortSchema = z.enum(EFFORTS);
const resultSchema = z.object({ n: z.number().int().positive(), clutter: z.number().min(0).max(100) });
const dataSchema = z.object({
  builtAt: z.iso.datetime(), grader: z.literal("consensus-v4"),
  tasks: z.record(z.string(), z.string()), showcase: z.array(z.string()),
  models: z.record(z.string(), z.object({ effort: effortSchema.optional() })),
  board: z.array(z.object({ model: z.string().min(1), name: z.string().min(1), effort: effortSchema.optional(), raw: resultSchema, simple: resultSchema })).min(1),
  runs: z.array(z.object({ id: z.string(), task: z.string(), model: z.string(), variant: z.enum(["raw", "simple"]), clutter: z.number().min(0).max(100) })).min(1),
});
type Data = z.infer<typeof dataSchema>;

export function parseClutterBench(json: unknown, metadataEfforts: Record<string, Effort> = {}): ScrapeResult {
  const d = dataSchema.parse(json);
  const scored = Object.keys(d.tasks).filter(t => !d.showcase.includes(t));
  if (!scored.length) throw new Error("ClutterBench: no scored posts");
  const seen = new Set<string>();
  const rows: ScrapeResult["rows"] = [];
  for (const model of d.board) {
    if (seen.has(model.model)) throw new Error(`ClutterBench: duplicate model ${model.model}`);
    seen.add(model.model);
    const suffix = model.name.match(/\((none|minimal|low|medium|high|xhigh|max)\)$/i)?.[1].toLowerCase();
    const effort = model.effort ?? d.models[model.model]?.effort ?? (suffix as Effort | undefined) ?? metadataEfforts[model.model];
    if (!effort) throw new Error(`ClutterBench: effort not published for ${model.model}`);
    for (const variant of ["raw", "simple"] as const) {
      const published = model[variant];
      const runs = d.runs.filter(r => r.model === model.model && r.variant === variant && scored.includes(r.task));
      const tasks = new Set(runs.map(r => r.task));
      const mean = Math.round(runs.reduce((n, r) => n + r.clutter, 0) / runs.length * 10) / 10;
      if (published.n !== scored.length || runs.length !== scored.length || tasks.size !== scored.length || Math.abs(mean - published.clutter) > 0.11) {
        throw new Error(`ClutterBench: incomplete or inconsistent ${model.model}/${variant}`);
      }
      rows.push({
        benchmarkId: `clutterbench-${variant}`, modelLabel: model.name, effort,
        value: published.clutter, sourceUrl: CLUTTERBENCH_URL,
        details: { sourceSettingId: model.model, prompt: variant, scoredPosts: published.n, grader: d.grader, builtAt: d.builtAt },
        note: `${published.n} scored posts; ${variant} prompt; consensus-v4; showcase post excluded`,
      });
    }
  }
  return {
    benchmarks: (["raw", "simple"] as const).map(variant => ({
      id: `clutterbench-${variant}`, name: variant === "raw" ? "ClutterBench" : "ClutterBench, simple prompt",
      shortName: variant === "raw" ? "ClutterBench" : "ClutterBench Simple", sourceId: "clutterbench", url: CLUTTERBENCH_URL,
      description: `Clutter as a share of drawn area in generated graphics, using the ${variant} prompt. Red area plus half the orange area, averaged over ${scored.length} scored posts. Lower is better.`,
      lastUpdated: d.builtAt.slice(0, 10), unit: "percent" as const, higherIsBetter: false, category: "creative" as const,
      defaultWeight: 0, eligibleForDefault: false,
    })),
    rows, raw: { "data.json": JSON.stringify(json) },
  };
}

// Older releases omitted effort in data.json. Their public per-run metadata is authoritative.
const source: Source = {
  id: "clutterbench", name: "ClutterBench", url: CLUTTERBENCH_URL,
  async scrape(ctx) {
    const json = await ctx.fetchJson(`${CLUTTERBENCH_URL}data.json`);
    const d: Data = dataSchema.parse(json);
    const efforts: Record<string, Effort> = {};
    const raw: Record<string, string> = {};
    for (const model of d.board) {
      if (model.effort || d.models[model.model]?.effort || /\((none|minimal|low|medium|high|xhigh|max)\)$/i.test(model.name)) continue;
      const run = d.runs.find(r => r.model === model.model && r.variant === "raw");
      if (!run) throw new Error(`ClutterBench: missing run for ${model.model}`);
      const url = `https://raw.githubusercontent.com/adamholter/clutterbench/main/runs/${encodeURIComponent(run.id)}/meta.json`;
      const meta = z.object({ model: z.string(), effort: effortSchema }).parse(await ctx.fetchJson(url));
      if (meta.model !== model.model) throw new Error(`ClutterBench: metadata mismatch for ${model.model}`);
      efforts[model.model] = meta.effort;
      raw[`metadata-${model.model}.json`] = JSON.stringify(meta);
    }
    const result = parseClutterBench(json, efforts);
    Object.assign(result.raw, raw);
    return result;
  },
};
export default source;
