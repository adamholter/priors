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
import { norm, resolveBenchmark, resolveModel, resolveVariant } from "./resolve";
import { DataView } from "./data";
import { makeChart, queryData, specOf, type DataArgs } from "./charts";
import type { AnswerChart } from "../lib/answer-chart";
import { THEME_CHOICES, themeById } from "../lib/page-presets";
import { compareModels } from "./compare";
import { benchmarksFor, distance, exactRanking, explainModel, mixMetrics, solveEdit, toShares, toWeights, qualityOf, churn, type Goal, type Move } from "./solver";

export type Proposal = { weights: Record<string, number>; required: string[]; summary: string; question?: string; suggestions: string[] };
export type ThemeMode = "system" | "light" | "dark";
/** Where the user is and how it looks, sent with each request. */
export type ViewState = { page: "builder" | "page"; theme: string; mode: ThemeMode };
export type ToolContext = {
  snapshot: Snapshot; original: IndexConfig; proposal?: Proposal; warned?: boolean;
  view?: ViewState; data?: DataView;
  /** Charts built this turn, referenced from the reply as [[chart:N]] (1-based). */
  charts: AnswerChart[];
  /** Highlight list to apply (model or variant ids), when the agent changed it. */
  highlight?: string[];
  theme?: { id?: string; mode?: ThemeMode };
  /** Mixes the solver or fitter returned: already checked for new entrants, so propose takes them as they are. */
  vetted?: Record<string, number>[];
};
const dataOf = (ctx: ToolContext) => (ctx.data ??= new DataView(ctx.snapshot, ctx.original));

/** Lab display name for a model id, so the agent knows Fable is a Claude model and Sol a GPT one. */
const labName = (snapshot: Snapshot, modelId: string) => { const labId = snapshot.models.find((m) => m.id === modelId)?.labId; return snapshot.labs.find((l) => l.id === labId)?.name ?? labId; };
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
    ranking: after.slice(0, top).map((r, i) => ({ rank: i + 1, model: r.name, lab: labName(snapshot, r.modelId), score: +r.score.toFixed(1), was: was.get(r.modelId) ?? null })),
  };
}

/** Weights by benchmark name or id; `pin` fixes some shares exactly and scales the rest into what's left. */
function cleanWeights(snapshot: Snapshot, raw: Record<string, unknown>, pinRaw?: Record<string, unknown>, inMix?: Record<string, number>): { weights: Record<string, number>; unknown: string[] } {
  const read = (obj: Record<string, unknown> | undefined) => {
    const out: Record<string, number> = {};
    for (const [name, w] of Object.entries(obj ?? {})) {
      const id = resolveBenchmark(snapshot, name, inMix), v = Number(w);
      if (!id) { unknown.push(name); continue; }
      if (Number.isFinite(v) && v > 0) out[id] = (out[id] ?? 0) + v;
    }
    return out;
  };
  const unknown: string[] = [], pin = read(pinRaw);
  // Pinning alone means "this share, the rest of my mix as it is".
  const weights = Object.keys(raw ?? {}).length || !Object.keys(pin).length ? read(raw) : { ...(inMix ?? {}) };
  const pinned = Object.values(pin).reduce((a, b) => a + b, 0);
  if (!pinned || pinned >= 100) return { weights: toWeights(toShares({ ...weights, ...pin })), unknown };
  const rest = toShares(Object.fromEntries(Object.entries(weights).filter(([id]) => !(id in pin))));
  return { weights: toWeights({ ...Object.fromEntries(Object.entries(rest).map(([id, x]) => [id, x * (1 - pinned / 100)])), ...Object.fromEntries(Object.entries(pin).map(([id, x]) => [id, x / 100])) }), unknown };
}

/** Some models send 0 for every optional number; only a positive value counts. */
const positive = (x: unknown) => (typeof x === "number" && x > 0 ? x : undefined);
type MoveArg = { model: string; below?: string; above?: string; rank?: number; min_rank?: number; max_rank?: number };
const ids = (snapshot: Snapshot, list: unknown, fn: (snapshot: Snapshot, name: string) => string | null) => ((Array.isArray(list) ? list : []) as string[]).map((x) => fn(snapshot, String(x))).filter((x): x is string => !!x);

export const TOOL_SPECS = [
  { name: "get_mix", description: "Current mix (benchmark shares), mix metrics, and the top of the ranking.", parameters: { type: "object", properties: {}, additionalProperties: false } },
  { name: "explain_model", description: "Why a model ranks where it does: each benchmark's share, the model's normalized score on it, its rank on that benchmark, and how much each benchmark pulls it ahead of (+) or behind (−) its neighbors above and below, in index points.", parameters: { type: "object", properties: { model: { type: "string" } }, required: ["model"], additionalProperties: false } },
  { name: "compare_models", description: "Why one model ranks above or below another under the current mix: each benchmark's share, both models' normalized scores on it, and how many index points it gives to which model. The points add up to the score gap.", parameters: { type: "object", properties: { a: { type: "string" }, b: { type: "string" } }, required: ["a", "b"], additionalProperties: false } },
  { name: "find_benchmarks", description: "Benchmarks (in or out of the mix) where a model is unusually strong or weak versus a comparison set (default: the other top-10 models). Use to find benchmarks to add or reweight to move a model.", parameters: { type: "object", properties: { model: { type: "string" }, direction: { type: "string", enum: ["strong", "weak"] }, against: { type: "array", items: { type: "string" } } }, required: ["model", "direction"], additionalProperties: false } },
  { name: "search_benchmarks", description: "Find benchmarks by name, topic or category (coding, agentic, reasoning, knowledge, math, long-context, instruction, creative, safety, economics). Returns ids, coverage and quality.", parameters: { type: "object", properties: { query: { type: "string" } }, required: ["query"], additionalProperties: false } },
  { name: "solve_edit", description: "Optimizer for edits. Finds the smallest change to the current mix that satisfies ranking moves and benchmark constraints, while keeping other rankings stable and the mix clean (few benchmarks, roughly even shares, soft 5–40% band). Returns up to 3 verified candidates: balanced, smallest change, cleanest. Moves: below/above another model, exact rank, or min_rank (at least this low) / max_rank (at least this high).", parameters: { type: "object", properties: { moves: { type: "array", items: { type: "object", properties: { model: { type: "string" }, below: { type: "string" }, above: { type: "string" }, rank: { type: "integer" }, min_rank: { type: "integer" }, max_rank: { type: "integer" } }, required: ["model"], additionalProperties: false } }, exclude: { type: "array", items: { type: "string" }, description: "benchmarks that must be removed" }, include: { type: "array", items: { type: "string" }, description: "benchmarks that must be in the mix" }, keep_top: { type: "integer", description: "keep the order of the current top N (moved models aside)" }, max_benchmarks: { type: "integer" }, allow_add: { type: "boolean", description: "may add new benchmarks (default true)" } }, additionalProperties: false } },
  { name: "fit_ranking", description: "Quality-aware generator (the onboarding algorithm). Builds a fresh mix that reproduces a model order, preferring fewer, higher-quality, focus-relevant benchmarks. Use for big changes or 'rebuild without X but keep my ranking'. Default order: the current top 16. Slower (~10 s).", parameters: { type: "object", properties: { order: { type: "array", items: { type: "string" } }, exclude: { type: "array", items: { type: "string" } }, focus: { type: "string", enum: FOCUS_IDS } }, additionalProperties: false } },
  { name: "try_mix", description: "Evaluate any mix you write by hand (benchmark → percent share). Returns metrics, how much weight moved from the original, churn, and the ranking with each model's previous rank. Use for simple manual tweaks or to check an idea.", parameters: { type: "object", properties: { pin: { type: "object", additionalProperties: { type: "number" }, description: "benchmarks whose share must be exactly this percent; the other weights are scaled to fill the rest" }, weights: { type: "object", additionalProperties: { type: "number" } } }, required: ["weights"], additionalProperties: false } },
  { name: "query_data", description: "Read values from the data as a table. Metrics: index (score under the user's current mix), cost (cost per task, USD), time (time per task, s), speed (output tok/s), latency (time to first token, s), tokens (output tokens per task), or any benchmark by name or id (its published raw value). Pick models by name, or the top N of the user's ranking (default 10). efforts: best (each model's top-scoring effort, the default; one row per model), all (every measured effort; use this for any question about reasoning effort), or a list like [\"xhigh\",\"max\"]. Rows carry the model's lab and its rank in the user's ranking.", parameters: { type: "object", properties: { metrics: { type: "array", items: { type: "string" } }, models: { type: "array", items: { type: "string" } }, labs: { type: "array", items: { type: "string" }, description: "only these labs' ranked models (OpenAI, Anthropic, Google…; Claude, GPT, Gemini work too)" }, top: { type: "integer" }, efforts: { anyOf: [{ type: "string", enum: ["best", "all"] }, { type: "array", items: { type: "string" } }] } }, required: ["metrics"], additionalProperties: false } },
  { name: "make_chart", description: "Build a chart from the data to embed in your answer. The values are filled from the data, not by you. Returns a chart number N and the numbers it shows; put [[chart:N]] on its own line in your reply where the chart belongs. Types: bar (one value per model; with efforts all or a list, one bar per model and effort), effort_lines (a metric across reasoning efforts, one line per model), effort_compare (grouped bars for the listed efforts, default xhigh and max), effort_delta (to_effort minus from_effort per model, absolute or percent; default max minus xhigh), scatter (metric on y against x_metric). Metrics as in query_data. Default models: the top of the user's ranking. For an exact mix of efforts across models (GPT-5.6 Sol at max next to Opus 5.5 at low), use bar or scatter with variants: each entry is a model plus effort (\"GPT-5.6 Sol max\"), and only those exact configurations are drawn (never both efforts of each model).", parameters: { type: "object", properties: { type: { type: "string", enum: ["bar", "effort_lines", "effort_compare", "effort_delta", "scatter"] }, metric: { type: "string" }, x_metric: { type: "string" }, models: { type: "array", items: { type: "string" } }, variants: { type: "array", items: { type: "string" }, description: "exact model + effort configurations, e.g. [\"GPT-5.6 Sol max\", \"Opus 5.5 low\"]; bar and scatter only; overrides models, labs and efforts" }, labs: { type: "array", items: { type: "string" }, description: "only these labs' ranked models (OpenAI, Anthropic, Google…; Claude, GPT, Gemini work too)" }, top: { type: "integer" }, efforts: { anyOf: [{ type: "string", enum: ["best", "all"] }, { type: "array", items: { type: "string" } }] }, from_effort: { type: "string" }, to_effort: { type: "string" }, delta: { type: "string", enum: ["absolute", "percent"] }, title: { type: "string", description: "short, plain; defaults to the metric name" } }, required: ["type", "metric"], additionalProperties: false } },
  { name: "highlight", description: "Highlight models on every chart in the user's current view (or clear highlights). A name may carry an effort (\"Opus 5.5 max\") to feature exactly that effort; otherwise the model's best effort is featured. mode: set (replace, the default), add, remove, clear.", parameters: { type: "object", properties: { models: { type: "array", items: { type: "string" } }, mode: { type: "string", enum: ["set", "add", "remove", "clear"] } }, additionalProperties: false } },
  { name: "set_theme", description: `Change how the site looks for this user: a theme (${THEME_CHOICES.map((t) => t.name).join(", ")}) and/or light/dark mode (system, light, dark). Some themes come in one mode only.`, parameters: { type: "object", properties: { theme: { type: "string" }, mode: { type: "string", enum: ["system", "light", "dark"] } }, additionalProperties: false } },
  { name: "propose", description: "Final step for any change: apply this mix for the user now. It ends your turn, so make any highlight or set_theme calls before it. Include a short plain-language summary of what changed and why, and, when the request was vague, one clarifying question plus 2–3 short reply suggestions.", parameters: { type: "object", properties: { pin: { type: "object", additionalProperties: { type: "number" }, description: "benchmarks whose share must be exactly this percent; the other weights are scaled to fill the rest" }, weights: { type: "object", additionalProperties: { type: "number" } }, summary: { type: "string" }, question: { type: "string" }, suggestions: { type: "array", items: { type: "string" }, maxItems: 3 } }, required: ["weights", "summary"], additionalProperties: false } },
] as const;

/** Human-readable progress line for each tool call. */
export function stepLabel(name: string, args: Record<string, unknown>): string {
  switch (name) {
    case "get_mix": return "Reading your mix";
    case "explain_model": return `Looking at why ${args.model} ranks where it does`;
    case "compare_models": return `Comparing ${args.a} and ${args.b}`;
    case "find_benchmarks": return `Finding benchmarks where ${args.model} is ${args.direction}`;
    case "search_benchmarks": return `Searching benchmarks for “${args.query}”`;
    case "solve_edit": return "Solving for the smallest change";
    case "fit_ranking": return "Rebuilding the mix with the quality-aware fitter";
    case "try_mix": return "Testing a mix";
    case "query_data": return "Reading the data";
    case "make_chart": return "Drawing a chart";
    case "highlight": return args.mode === "clear" ? "Clearing highlights" : "Highlighting models";
    case "set_theme": return "Changing the theme";
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
    case "compare_models": {
      const a = resolveModel(snapshot, String(args.a ?? ""), dataOf(ctx).bestRank), b = resolveModel(snapshot, String(args.b ?? ""), dataOf(ctx).bestRank);
      if (!a || !b) return { error: `Unknown model: ${!a ? args.a : args.b}` };
      return compareModels(snapshot, original, a, b) ?? { error: "One of those models isn't ranked under this index (filtered out or too little measured data)." };
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
        moves.push({ model, below: below ?? undefined, above: above ?? undefined, rank: positive(m.rank), minRank: positive(m.min_rank), maxRank: positive(m.max_rank) });
      }
      const goal: Goal = { moves, exclude: ids(snapshot, args.exclude, resolveBenchmark), include: ids(snapshot, args.include, resolveBenchmark), keepTop: positive(args.keep_top), maxBenchmarks: positive(args.max_benchmarks), allowAdd: args.allow_add !== false };
      const r = solveEdit(snapshot, original, goal, { budgetMs: 9000 });
      ctx.vetted = [...(ctx.vetted ?? []), ...r.candidates.filter((c) => c.satisfied).map((c) => toShares(c.weights))];
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
      const { weights, unknown } = cleanWeights(snapshot, args.weights as Record<string, unknown>, args.pin as Record<string, unknown>, original.weights);
      if (!Object.keys(weights).length) return { error: "No known benchmarks in that mix.", unknown };
      return { unknown: unknown.length ? unknown : undefined, ...describe(ctx, weights) };
    }
    case "query_data": return queryData(dataOf(ctx), args as DataArgs);
    case "make_chart": {
      if (ctx.charts.length >= 4) return { error: "Four charts is the limit for one answer." };
      const r = makeChart(dataOf(ctx), args as DataArgs);
      if (!r.chart) return r;
      r.chart.title = r.chart.title.replace(/\s*[—–]\s*/g, ": ");
      // The same data under another title is the same chart: point at the one already drawn.
      const strip = (c: AnswerChart) => JSON.stringify({ ...c, title: "", spec: undefined }), key = strip(r.chart), same = (c: AnswerChart) => strip(c) === key;
      const dup = ctx.charts.findIndex(same);
      if (dup >= 0) return { chart: dup + 1, title: ctx.charts[dup].title, duplicate: true, use: `Chart ${dup + 1} already shows exactly this; place [[chart:${dup + 1}]] once and don't draw it again.` };
      r.chart.spec = specOf(args as DataArgs);
      ctx.charts.push(r.chart);
      return { chart: ctx.charts.length, title: r.chart.title, shown: r.shown, missing: r.missing?.length ? r.missing : undefined, use: `Put [[chart:${ctx.charts.length}]] on its own line in your reply.` };
    }
    case "highlight": {
      const mode = (args.mode as string) ?? "set", current = ctx.highlight ?? original.highlight ?? [];
      if (mode === "clear") { ctx.highlight = []; return { highlighted: [] }; }
      const items: string[] = [], unknown: string[] = [], noEffort: string[] = [];
      for (const name of (Array.isArray(args.models) ? args.models : []) as string[]) {
        const v = resolveVariant(snapshot, String(name), dataOf(ctx).bestRank);
        if (!v) { unknown.push(name); continue; }
        if (v.missingEffort) noEffort.push(`${name} (no ${v.missingEffort} measured)`);
        items.push(v.variantId ?? v.modelId);
      }
      if (!items.length) return { error: `No known models to highlight${unknown.length ? `: ${unknown.join(", ")} not in the data` : ""}.` };
      const model = (it: string) => it.split("@")[0];
      ctx.highlight = mode === "remove" ? current.filter((it) => !items.some((x) => model(x) === model(it))) : mode === "add" ? [...current, ...items.filter((x) => !current.includes(x))] : items;
      const names = new Map(snapshot.models.map((m) => [m.id, m.name]));
      return { highlighted: ctx.highlight.map((it) => { const [m, e] = it.split("@"); return e ? `${names.get(m) ?? m} ${e}` : names.get(m) ?? m; }), unknown: unknown.length ? unknown : undefined, notMeasured: noEffort.length ? noEffort : undefined, notRanked: items.filter((it) => !dataOf(ctx).bestRank.has(model(it))).map((it) => names.get(model(it)) ?? it) };
    }
    case "set_theme": {
      const out: { id?: string; mode?: ThemeMode } = {};
      if (args.theme) {
        const n = norm(String(args.theme)).replace(/\b(theme|dark|light|mode)\b/g, "").trim();
        const t = THEME_CHOICES.find((x) => norm(x.name) === n || x.id === n) ?? THEME_CHOICES.find((x) => n && (norm(x.name).includes(n) || n.includes(norm(x.name).split(" ")[0])));
        if (!t) return { error: `Unknown theme ${args.theme}. Themes: ${THEME_CHOICES.map((x) => x.name).join(", ")}.` };
        out.id = t.id;
      }
      if (args.mode === "system" || args.mode === "light" || args.mode === "dark") out.mode = args.mode;
      if (!out.id && !out.mode) return { error: "Give a theme, a mode, or both." };
      const t = themeById(out.id ?? ctx.view?.theme ?? "bone"), pair = themeById(t?.pair);
      const single = t && !pair ? (t.dark ? "dark" : "light") : undefined;
      ctx.theme = out;
      return { applied: { theme: t?.name, mode: out.mode }, note: [single && out.mode && out.mode !== "system" && out.mode !== single ? `${t!.name} only comes in ${single}, so the mode change has no visible effect until another theme is picked.` : "", ctx.view?.page === "page" ? "This is a published page: its owner's theme stays; the user's theme applies to the builder, Explore and model pages." : ""].filter(Boolean).join(" ") || undefined };
    }
    case "propose": {
      const { weights, unknown } = cleanWeights(snapshot, args.weights as Record<string, unknown>, args.pin as Record<string, unknown>, original.weights);
      if (!Object.keys(weights).length) return { error: "No known benchmarks in that mix.", unknown };
      if (computeIndex(snapshot, { ...original, weights, required: original.required.filter((id) => weights[id]) }).ranked.length < 3) return { error: "That mix ranks fewer than three models. Pick benchmarks with wider coverage." };
      // Guard against hand-made mixes that "move" a model by pulling previously unranked models above it.
      const vetted = ctx.vetted?.some((v) => distance(v, toShares(weights)) < 0.02);
      const entrants = vetted ? [] : describe(ctx, weights, 10).ranking.filter((r) => r.was == null || r.was > 20).map((r) => r.model);
      if (entrants.length && !ctx.warned) { ctx.warned = true; return { error: `Not applied: this mix pulls models into the top 10 that weren't there before (${entrants.join(", ")}), which the user didn't ask for. Use solve_edit (it keeps new entrants out) or adjust, then propose again. If the user explicitly wants this, propose the same mix again.` }; }
      ctx.proposal = { weights, required: original.required.filter((id) => weights[id]), summary: String(args.summary ?? "").slice(0, 1200), question: args.question ? String(args.question).slice(0, 300) : undefined, suggestions: (Array.isArray(args.suggestions) ? args.suggestions : []).map((s) => String(s).slice(0, 80)).filter((s) => !/^(undo|revert)\b/i.test(s.trim())).slice(0, 3) };
      return { applied: true };
    }
    default: return { error: `Unknown tool ${name}` };
  }
}
