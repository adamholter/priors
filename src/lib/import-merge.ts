import type { Benchmark, RawRow, Snapshot } from "@/data/types";
import { normalizeLabel, variantId } from "@/data/normalize";

/* Apart from the import schema, so pages that merge imports do not download the schema library. */
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
