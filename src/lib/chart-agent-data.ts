/**
 * The chart settings agent's lookup tool (server only): what Priors' data holds for a model, effort by effort, so the agent can say
 * why a point is missing, sits where it does, or costs what it costs. Reads the live snapshot the pages read.
 */
import { loadSnapshot } from "@/data/load";
import { blendedApiPrice, SUBSCRIPTION_BENCHMARK, type SubscriptionDetails } from "@/data/subscription";
import { T3_MIN_USERS } from "@/data/task-metrics";
import type { Observation, Snapshot } from "@/data/types";
import { resolveModel } from "@/agent/resolve";
import type { ToolSpec } from "@/agent/providers";

export const LOOKUP_TOOL: ToolSpec = {
  name: "lookup_model",
  description: "Read what Priors' data holds for up to 6 models, effort by effort: scores, cost per task (Artificial Analysis and T3 Code), T3 Code time per turn with the users, turns and token counts behind it, subscription plans with their subsidy, and which other benchmarks have a value. Use it before explaining why a model or effort is missing from a chart, sits where it does, or costs what it costs. Pass benchmarks (ids or words from their names) to read those values too.",
  parameters: {
    type: "object", additionalProperties: false, required: ["models"],
    properties: { models: { type: "array", items: { type: "string" }, maxItems: 6 }, benchmarks: { type: "array", items: { type: "string" }, maxItems: 12 } },
  },
};

/** Rows every lookup shows in full: what the cost, time and index charts are drawn from. */
const KEY = /^(aa-intelligence-index|aa-cost-per-task-index|aa-cost-to-run-index|aa-output-speed|aa-ttft|aa-price-blended|t3-|subscription-token-price)/;
const num = (v: unknown) => typeof v === "number" ? Number(v.toPrecision(4)) : v;

function describeRow(o: Observation, snapshot: Snapshot) {
  const d = (o.details ?? {}) as Record<string, unknown>;
  const row: Record<string, unknown> = { value: num(o.value) };
  if (o.costUsd != null) row.costUsd = num(o.costUsd);
  if (o.durationSec != null) row.durationSec = num(o.durationSec);
  if (o.benchmarkId.startsWith("t3-")) {
    for (const k of ["users", "turns", "tokenTurns", "tokenUsers", "window"]) if (d[k] != null) row[k] = d[k];
    row.tokenCounts = d.perTurn ? "yes" : `none: under 30 turns from ${T3_MIN_USERS} users with token counts, so no T3 cost at this effort`;
  }
  if (o.benchmarkId === SUBSCRIPTION_BENCHMARK) {
    const s = d as unknown as SubscriptionDetails & { free?: boolean; paid?: SubscriptionDetails };
    const paid = s.free && s.paid ? s.paid : s, api = paid.listPrice && paid.mix ? blendedApiPrice(paid.listPrice, paid.mix) : 0;
    if (s.free) row.free = `${s.plan} (priced at 0 while free tiers count)`;
    row.defaultPlan = paid.listOnly ? `none here: ${paid.plan} is a plan to pick, not this model's price` : paid.plan;
    row.plans = (paid.plans ?? []).map((p) => `${p.plan}${p.feeUsd ? ` $${p.feeUsd}/mo` : ""}${api ? ` ${(api / p.usdPerMtok).toFixed(1)}x API value` : ""}${p.confidence ? ` (${p.confidence})` : ""}`);
  }
  const bench = snapshot.benchmarks.find((b) => b.id === o.benchmarkId);
  if (bench?.name) row.name = bench.name;
  return row;
}

/** One model's data as plain JSON for the agent, or what was not found. */
export async function lookupModels(args: { models?: unknown; benchmarks?: unknown }): Promise<string> {
  const snapshot = await loadSnapshot();
  if (!snapshot) return JSON.stringify({ error: "The data is not available right now." });
  const names = Array.isArray(args.models) ? args.models.filter((m): m is string => typeof m === "string").slice(0, 6) : [];
  const wanted = Array.isArray(args.benchmarks) ? args.benchmarks.filter((b): b is string => typeof b === "string").map((b) => b.toLowerCase()) : [];
  const extra = (id: string) => { const b = snapshot.benchmarks.find((x) => x.id === id), name = `${id} ${b?.name ?? ""}`.toLowerCase(); return wanted.some((w) => name.includes(w)); };
  const out = names.map((name) => {
    const id = resolveModel(snapshot, name), model = id ? snapshot.models.find((m) => m.id === id) : undefined;
    if (!model) return { query: name, error: "No model by that name." };
    const variants = snapshot.variants.filter((v) => v.modelId === model.id);
    const byVariant = variants.map((v) => {
      const rows = snapshot.observations.filter((o) => o.variantId === v.id);
      const key = Object.fromEntries(rows.filter((o) => KEY.test(o.benchmarkId) || extra(o.benchmarkId)).map((o) => [o.benchmarkId, describeRow(o, snapshot)]));
      const others = rows.filter((o) => !KEY.test(o.benchmarkId) && !extra(o.benchmarkId)).map((o) => o.benchmarkId);
      const t3 = rows.some((o) => o.benchmarkId === "t3-turn-time") ? undefined : "no T3 Code row at this effort (under 30 turns from 5 users), so no T3 Code time or cost";
      return { variant: v.id, effort: v.effort ?? null, ...(v.configuration ? { configuration: v.configuration } : {}), rows: key, ...(t3 ? { t3 } : {}), otherBenchmarks: { count: others.length, some: others.slice(0, 15) } };
    });
    const lab = snapshot.labs.find((l) => l.id === model.labId)?.name ?? model.labId;
    return { query: name, id: model.id, name: model.name, lab, released: model.releaseDate ?? null, openWeights: model.openWeights ?? null, variants: byVariant };
  });
  return JSON.stringify({ snapshot: snapshot.generatedAt, models: out }).slice(0, 30_000);
}
