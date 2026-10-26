import { z } from "zod";
import type { Benchmark, RawRow, Snapshot } from "@/data/types";
import { normalizeLabel, variantId } from "@/data/normalize";

/** Schema for user/agent-provided benchmark data. Mirrors Benchmark + RawRow from the data contract. */
export const importSchema = z.object({
  benchmark: z.object({
    id: z.string().regex(/^[a-z0-9][a-z0-9.-]{1,60}$/, "lowercase slug"),
    name: z.string().min(1).max(80),
    shortName: z.string().max(30).optional(),
    url: z.string().url(),
    description: z.string().min(10).max(600),
    unit: z.enum(["percent", "score", "elo", "usd", "seconds", "count"]),
    higherIsBetter: z.boolean(),
    category: z.enum(["coding", "agentic", "reasoning", "knowledge", "math", "long-context", "instruction", "creative", "safety", "economics", "composite", "speed", "cost", "reliability", "other"]),
  }),
  rows: z.array(z.object({
    modelLabel: z.string().min(1),
    effort: z.string().optional(),
    value: z.number().finite(),
    ci: z.tuple([z.number(), z.number()]).optional(),
    costUsd: z.number().nonnegative().optional(),
    outputTokens: z.number().nonnegative().optional(),
    steps: z.number().nonnegative().optional(),
    sourceUrl: z.string().url(),
    note: z.string().max(300).optional(),
  })).min(1),
  /** Models the agent looked for but could not find a score for. Kept for transparency. */
  missing: z.array(z.object({ modelLabel: z.string(), reason: z.string().optional() })).optional(),
});
export type ImportPayload = z.infer<typeof importSchema>;

/** Merge imported benchmarks into a snapshot (client- or server-side). Unknown labels are dropped and reported. */
export function mergeImports(snapshot: Snapshot, imports: { benchmark: Omit<Benchmark, "sourceId"> & { sourceId?: string }; rows: Omit<RawRow, "benchmarkId">[] }[]): { snapshot: Snapshot; unknown: string[] } {
  if (!imports.length) return { snapshot, unknown: [] };
  const s: Snapshot = { ...snapshot, benchmarks: [...snapshot.benchmarks], observations: [...snapshot.observations], variants: [...snapshot.variants], models: [...snapshot.models] };
  const variants = new Set(s.variants.map((v) => v.id));
  const models = new Map(s.models.map((m) => [m.id, m]));
  const unknown: string[] = [];
  for (const imp of imports) {
    s.benchmarks = s.benchmarks.filter((b) => b.id !== imp.benchmark.id);
    s.benchmarks.push({ ...imp.benchmark, sourceId: "import" });
    s.observations = s.observations.filter((o) => o.benchmarkId !== imp.benchmark.id);
    for (const r of imp.rows) {
      const n = normalizeLabel(r.modelLabel, r.effort);
      if (!n.ok) { unknown.push(r.modelLabel); continue; }
      const m = models.get(n.modelId);
      if (!m) { models.set(n.modelId, { id: n.modelId, name: n.modelName, labId: n.labId, kind: "llm", reasoning: n.reasoningFamily, aliases: [r.modelLabel.toLowerCase()] }); s.models.push(models.get(n.modelId)!); }
      // effort: explicit, else the model's max known effort, else default
      const effort = n.effort ?? maxEffort(s, n.modelId);
      const vid = variantId(n.modelId, effort);
      if (!variants.has(vid)) { variants.add(vid); s.variants.push({ id: vid, modelId: n.modelId, effort }); }
      s.observations.push({ benchmarkId: imp.benchmark.id, variantId: vid, value: r.value, ci: r.ci, costUsd: r.costUsd, outputTokens: r.outputTokens, steps: r.steps, observedAt: snapshot.date, sourceUrl: r.sourceUrl, note: r.note });
    }
  }
  return { snapshot: s, unknown };
}

const ORDER = ["none", "minimal", "low", "medium", "high", "xhigh", "max"] as const;
function maxEffort(s: Snapshot, modelId: string) {
  const efforts = s.variants.filter((v) => v.modelId === modelId && v.effort !== "default").map((v) => v.effort);
  if (!efforts.length) return "default" as const;
  return efforts.sort((a, b) => ORDER.indexOf(b as typeof ORDER[number]) - ORDER.indexOf(a as typeof ORDER[number]))[0];
}
