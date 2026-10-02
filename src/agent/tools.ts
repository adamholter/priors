/**
 * Tools the mix-adjustment agent can call. Each takes JSON arguments from the model, resolves model and
 * benchmark names against the snapshot, runs real engine code, and returns compact JSON the model can
 * reason over. All mixes are judged against `original` (the user's mix when the request arrived).
 */
import type { Snapshot } from "../data/types";
import { computeIndex, type IndexConfig } from "../engine";
import { fitPriors } from "../onboarding/optimizer";
import { benchmarkQuality } from "../onboarding/quality";
import { FOCUS_IDS, type FocusId } from "../onboarding/focus";
import { benchmarksFor, distance, exactRanking, explainModel, mixMetrics, solveEdit, toShares, toWeights, qualityOf, churn, type Goal, type Move } from "./solver";

export type Proposal = { weights: Record<string, number>; required: string[]; summary: string; question?: string; suggestions: string[] };
export type ToolContext = { snapshot: Snapshot; original: IndexConfig; proposal?: Proposal; warned?: boolean };

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9.]+/g, " ").trim();
export function resolveModel(snapshot: Snapshot, name: string): string | null {
  const n = norm(name);
  const llms = snapshot.models.filter((m) => m.kind === "llm");
  return (llms.find((m) => m.id === name) ?? llms.find((m) => norm(m.name) === n) ?? llms.find((m) => norm(m.id) === n) ?? llms.find((m) => m.aliases?.some((a) => norm(a) === n))
    ?? llms.filter((m) => norm(m.name).includes(n) || n.includes(norm(m.name))).sort((a, b) => Math.abs(a.name.length - n.length) - Math.abs(b.name.length - n.length))[0])?.id ?? null;
}
export function resolveBenchmark(snapshot: Snapshot, name: string): string | null {
  const n = norm(name);
  const b = snapshot.benchmarks;
  return (b.find((x) => x.id === name) ?? b.find((x) => norm(x.name) === n || norm(x.shortName ?? "") === n || norm(x.id) === n)
    ?? b.filter((x) => norm(x.name).includes(n) || norm(x.shortName ?? "").includes(n) || norm(x.id).includes(n)).sort((x, y) => x.name.length - y.name.length)[0])?.id ?? null;
}

const benchName = (snapshot: Snapshot, id: string) => { const b = snapshot.benchmarks.find((x) => x.id === id); return b?.shortName ?? b?.name ?? id; };

/** A mix's description: shares, metrics, and the ranking with movement versus the original. */
export function describe(ctx: ToolContext, weights: Record<string, number>, top = 20) {
  const { snapshot, original } = ctx, q = qualityOf(snapshot);
  const shares = toShares(weights), cfg = { ...original, weights, required: original.required.filter((id) => weights[id]) };
  const before = exactRanking(snapshot, original).rows, after = exactRanking(snapshot, cfg).rows;
  const was = new Map(before.map((r, i) => [r.modelId, i + 1]));
  const m = mixMetrics(snapshot, shares);
  return {
    benchmarks: Object.entries(shares).sort((a, b) => b[1] - a[1]).map(([id, s]) => ({ id, name: benchName(snapshot, id), share: +(s * 100).toFixed(1), was: +((toShares(original.weights)[id] ?? 0) * 100).toFixed(1), quality: Math.round(q.get(id) ?? 50) })),
    metrics: { count: m.count, effective: +m.effective.toFixed(1), largest: +(m.largest * 100).toFixed(1), smallest: +(m.smallest * 100).toFixed(1), outsideSoftBand: +m.outsideBand.toFixed(1), quality: Math.round(m.quality), complexity: +m.complexity.toFixed(1) },
    removed: Object.entries(toShares(original.weights)).filter(([id]) => !shares[id]).map(([id, s]) => ({ id, name: benchName(snapshot, id), was: +(s * 100).toFixed(1) })),
    movedFromOriginal: +(distance(toShares(original.weights), shares) * 100).toFixed(1),
    churn: +churn(before.map((r) => r.modelId), after.map((r) => r.modelId), new Set()).toFixed(1),
    ranking: after.slice(0, top).map((r, i) => ({ rank: i + 1, model: r.name, score: +r.score.toFixed(1), was: was.get(r.modelId) ?? null })),
  };
}

function cleanWeights(snapshot: Snapshot, raw: Record<string, unknown>): { weights: Record<string, number>; unknown: string[] } {
  const weights: Record<string, number> = {}, unknown: string[] = [];
  for (const [name, w] of Object.entries(raw ?? {})) {
    const id = resolveBenchmark(snapshot, name), v = Number(w);
    if (!id) { unknown.push(name); continue; }
    if (Number.isFinite(v) && v > 0) weights[id] = (weights[id] ?? 0) + v;
  }
  return { weights: toWeights(toShares(weights)), unknown };
}

type MoveArg = { model: string; below?: string; above?: string; rank?: number; min_rank?: number; max_rank?: number };
const ids = (snapshot: Snapshot, list: unknown, fn: typeof resolveBenchmark) => ((Array.isArray(list) ? list : []) as string[]).map((x) => fn(snapshot, String(x))).filter((x): x is string => !!x);

export const TOOL_SPECS = [
  { name: "get_mix", description: "Current mix (benchmark shares), mix metrics, and the top of the ranking.", parameters: { type: "object", properties: {}, additionalProperties: false } },
  { name: "explain_model", description: "Why a model ranks where it does: each benchmark's share, the model's normalized score on it, its rank on that benchmark, and how much each benchmark pulls it ahead of (+) or behind (−) its neighbors above and below, in index points.", parameters: { type: "object", properties: { model: { type: "string" } }, required: ["model"], additionalProperties: false } },
  { name: "find_benchmarks", description: "Benchmarks (in or out of the mix) where a model is unusually strong or weak versus a comparison set (default: the other top-10 models). Use to find benchmarks to add or reweight to move a model.", parameters: { type: "object", properties: { model: { type: "string" }, direction: { type: "string", enum: ["strong", "weak"] }, against: { type: "array", items: { type: "string" } } }, required: ["model", "direction"], additionalProperties: false } },
  { name: "search_benchmarks", description: "Find benchmarks by name, topic or category (coding, agentic, reasoning, knowledge, math, long-context, instruction, creative, safety, economics). Returns ids, coverage and quality.", parameters: { type: "object", properties: { query: { type: "string" } }, required: ["query"], additionalProperties: false } },
  { name: "solve_edit", description: "Optimizer for edits. Finds the smallest change to the current mix that satisfies ranking moves and benchmark constraints, while keeping other rankings stable and the mix clean (few benchmarks, roughly even shares, soft 5–40% band). Returns up to 3 verified candidates: balanced, smallest change, cleanest. Moves: below/above another model, exact rank, or min_rank (at least this low) / max_rank (at least this high).", parameters: { type: "object", properties: { moves: { type: "array", items: { type: "object", properties: { model: { type: "string" }, below: { type: "string" }, above: { type: "string" }, rank: { type: "integer" }, min_rank: { type: "integer" }, max_rank: { type: "integer" } }, required: ["model"], additionalProperties: false } }, exclude: { type: "array", items: { type: "string" }, description: "benchmarks that must be removed" }, include: { type: "array", items: { type: "string" }, description: "benchmarks that must be in the mix" }, keep_top: { type: "integer", description: "keep the order of the current top N (moved models aside)" }, max_benchmarks: { type: "integer" }, allow_add: { type: "boolean", description: "may add new benchmarks (default true)" } }, additionalProperties: false } },
  { name: "fit_ranking", description: "Quality-aware generator (the onboarding algorithm). Builds a fresh mix that reproduces a model order, preferring fewer, higher-quality, focus-relevant benchmarks. Use for big changes or 'rebuild without X but keep my ranking'. Default order: the current top 16. Slower (~10 s).", parameters: { type: "object", properties: { order: { type: "array", items: { type: "string" } }, exclude: { type: "array", items: { type: "string" } }, focus: { type: "string", enum: FOCUS_IDS } }, additionalProperties: false } },
  { name: "try_mix", description: "Evaluate any mix you write by hand (benchmark → percent share). Returns metrics, how much weight moved from the original, churn, and the ranking with each model's previous rank. Use for simple manual tweaks or to check an idea.", parameters: { type: "object", properties: { weights: { type: "object", additionalProperties: { type: "number" } } }, required: ["weights"], additionalProperties: false } },
  { name: "propose", description: "Final step for any change: apply this mix for the user now. Include a short plain-language summary of what changed and why, and, when the request was vague, one clarifying question plus 2–3 short reply suggestions.", parameters: { type: "object", properties: { weights: { type: "object", additionalProperties: { type: "number" } }, summary: { type: "string" }, question: { type: "string" }, suggestions: { type: "array", items: { type: "string" }, maxItems: 3 } }, required: ["weights", "summary"], additionalProperties: false } },
] as const;

/** Human-readable progress line for each tool call. */
export function stepLabel(name: string, args: Record<string, unknown>): string {
  switch (name) {
    case "get_mix": return "Reading your mix";
    case "explain_model": return `Looking at why ${args.model} ranks where it does`;
    case "find_benchmarks": return `Finding benchmarks where ${args.model} is ${args.direction}`;
    case "search_benchmarks": return `Searching benchmarks for “${args.query}”`;
    case "solve_edit": return "Solving for the smallest change";
    case "fit_ranking": return "Rebuilding the mix with the quality-aware fitter";
    case "try_mix": return "Testing a mix";
    case "propose": return "Applying the change";
    default: return name;
  }
}

export async function runTool(ctx: ToolContext, name: string, args: Record<string, unknown>): Promise<unknown> {
  const { snapshot, original } = ctx;
  switch (name) {
    case "get_mix": return describe(ctx, original.weights);
    case "explain_model": {
      const id = resolveModel(snapshot, String(args.model ?? ""));
      if (!id) return { error: `Unknown model: ${args.model}` };
      return explainModel(snapshot, original, id) ?? { error: `${args.model} isn't ranked in this index (filtered out or too little measured data).` };
    }
    case "find_benchmarks": {
      const id = resolveModel(snapshot, String(args.model ?? ""));
      if (!id) return { error: `Unknown model: ${args.model}` };
      return benchmarksFor(snapshot, original, id, args.direction === "weak" ? "weak" : "strong", ids(snapshot, args.against, resolveModel));
    }
    case "search_benchmarks": {
      const n = norm(String(args.query ?? "")), q = qualityOf(snapshot), seen = new Set(snapshot.observations.map((o) => o.benchmarkId));
      return snapshot.benchmarks.filter((b) => seen.has(b.id) && (norm(`${b.name} ${b.shortName ?? ""} ${b.id} ${b.category} ${b.description}`).includes(n) || b.category === n)).slice(0, 12).map((b) => ({ id: b.id, name: b.shortName ?? b.name, category: b.category, quality: Math.round(q.get(b.id) ?? 50), inMix: !!original.weights[b.id], about: b.description.slice(0, 140) }));
    }
    case "solve_edit": {
      const moves: Move[] = [];
      for (const m of (Array.isArray(args.moves) ? args.moves : []) as MoveArg[]) {
        const model = resolveModel(snapshot, m.model);
        if (!model) return { error: `Unknown model: ${m.model}` };
        const below = m.below ? resolveModel(snapshot, m.below) : undefined, above = m.above ? resolveModel(snapshot, m.above) : undefined;
        if ((m.below && !below) || (m.above && !above)) return { error: `Unknown model: ${m.below ?? m.above}` };
        moves.push({ model, below: below ?? undefined, above: above ?? undefined, rank: m.rank, minRank: m.min_rank, maxRank: m.max_rank });
      }
      const goal: Goal = { moves, exclude: ids(snapshot, args.exclude, resolveBenchmark), include: ids(snapshot, args.include, resolveBenchmark), keepTop: typeof args.keep_top === "number" ? args.keep_top : undefined, maxBenchmarks: typeof args.max_benchmarks === "number" ? args.max_benchmarks : undefined, allowAdd: args.allow_add !== false };
      const r = solveEdit(snapshot, original, goal, { budgetMs: 9000 });
      return { note: r.note || undefined, candidates: r.candidates.map((c) => ({ label: c.label, satisfied: c.satisfied, weights: Object.fromEntries(Object.entries(c.weights).map(([id, w]) => [benchName(snapshot, id), w])), ...describe(ctx, c.weights, 15) })) };
    }
    case "fit_ranking": {
      const exclude = new Set(ids(snapshot, args.exclude, resolveBenchmark));
      const current = exactRanking(snapshot, original).rows.map((r) => r.modelId);
      const order = (Array.isArray(args.order) && args.order.length >= 3 ? (args.order as string[]).map((x) => resolveModel(snapshot, x)).filter((x): x is string => !!x) : current.slice(0, 16));
      const pruned: Snapshot = exclude.size ? { ...snapshot, benchmarks: snapshot.benchmarks.filter((b) => !exclude.has(b.id)), observations: snapshot.observations.filter((o) => !exclude.has(o.benchmarkId)) } : snapshot;
      const quality = Object.fromEntries(benchmarkQuality(pruned).map((x) => [x.id, x.score]));
      const focus = FOCUS_IDS.includes(args.focus as FocusId) ? (args.focus as FocusId) : (original.focus ?? "capabilities");
      const r = await fitPriors(pruned, order, () => {}, quality, 0, {}, { focus, budgetMs: { soft: 6000, hard: 12000 } });
      return { exactOrder: r.exactMatch, fitScore: Math.round(r.fitScore), weights: Object.fromEntries(Object.entries(toWeights(toShares(r.weights))).map(([id, w]) => [benchName(snapshot, id), w])), ...describe(ctx, toWeights(toShares(r.weights)), 15) };
    }
    case "try_mix": {
      const { weights, unknown } = cleanWeights(snapshot, args.weights as Record<string, unknown>);
      if (!Object.keys(weights).length) return { error: "No known benchmarks in that mix.", unknown };
      return { unknown: unknown.length ? unknown : undefined, ...describe(ctx, weights) };
    }
    case "propose": {
      const { weights, unknown } = cleanWeights(snapshot, args.weights as Record<string, unknown>);
      if (!Object.keys(weights).length) return { error: "No known benchmarks in that mix.", unknown };
      if (computeIndex(snapshot, { ...original, weights, required: original.required.filter((id) => weights[id]) }).ranked.length < 3) return { error: "That mix ranks fewer than three models. Pick benchmarks with wider coverage." };
      // Guard against hand-made mixes that "move" a model by pulling previously unranked models above it.
      const entrants = describe(ctx, weights, 10).ranking.filter((r) => r.was == null || r.was > 20).map((r) => r.model);
      if (entrants.length && !ctx.warned) { ctx.warned = true; return { error: `Not applied: this mix pulls models into the top 10 that weren't there before (${entrants.join(", ")}), which the user didn't ask for. Use solve_edit (it keeps new entrants out) or adjust, then propose again. If the user explicitly wants this, propose the same mix again.` }; }
      ctx.proposal = { weights, required: original.required.filter((id) => weights[id]), summary: String(args.summary ?? "").slice(0, 1200), question: args.question ? String(args.question).slice(0, 300) : undefined, suggestions: (Array.isArray(args.suggestions) ? args.suggestions : []).map((s) => String(s).slice(0, 80)).filter((s) => !/^(undo|revert)\b/i.test(s.trim())).slice(0, 3) };
      return { applied: true };
    }
    default: return { error: `Unknown tool ${name}` };
  }
}
