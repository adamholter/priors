import { api } from "../../convex/_generated/api";
import { TOOL_SPECS, runTool, type ToolContext } from "@/agent/tools";
import { resolveBenchmark, resolveModel, resolveLab, norm } from "@/agent/resolve";
import { computeIndex, defaultConfig, defaultReleasedAfter, PAGE_VIEW, rankingRows, strictnessOf, chartVariantMode, type IndexConfig, type IndexResult, type RankedVariant } from "@/engine";
import { DataView } from "@/agent/data";
import { chartLink } from "@/lib/answer-chart";
import { effectiveBasis } from "@/data/subscription";
import { scatterSpec } from "@/lib/og-chart";
import { frontierOf } from "@/components/chart/scatter-option";
import { computeHistory } from "@/lib/history";
import { importSchema } from "@/lib/import";
import { chartTitle } from "@/lib/metrics";
import { encodeIndex, encodeIndices, prettyQuery } from "@/lib/url";
import { THEME_CHOICES } from "@/lib/page-presets";
import type { Snapshot } from "@/data/types";
import { INDEX_PARAM, ToolError, convex, publicPage, resolveIndex } from "./index-ref";

export interface ToolEnv { token?: string; origin: string }
export interface Tool {
  name: string; description: string; inputSchema: Record<string, unknown>;
  /** Needs the owner's agent token (`pri_...`); every other tool is public and read-only. */
  write?: boolean;
  run: (args: Record<string, unknown>, env: ToolEnv) => Promise<unknown>;
}

const obj = (properties: Record<string, unknown>, required: string[] = []) => ({ type: "object", properties, required, additionalProperties: false });
const str = (description: string) => ({ type: "string", description });
const num = (description: string) => ({ type: "number", description });
const round = (x: number | undefined, d = 2) => (typeof x === "number" && Number.isFinite(x) ? +x.toFixed(d) : null);
const cap = (n: unknown, def: number, max: number) => Math.min(Math.max(Math.round(Number(n) || def), 1), max);
const labName = (s: Snapshot, id: string) => s.labs.find((l) => l.id === id)?.name ?? id;
const benchOf = (s: Snapshot, name: unknown) => {
  const id = resolveBenchmark(s, String(name ?? "")), b = id && s.benchmarks.find((x) => x.id === id);
  if (!b) throw new ToolError(`Unknown benchmark "${name}". Use list_benchmarks or search_benchmarks to find its id.`, 404);
  return b;
};
const modelOf = (s: Snapshot, name: unknown) => {
  const id = resolveModel(s, String(name ?? "")), m = id && s.models.find((x) => x.id === id);
  if (!m) throw new ToolError(`Unknown model "${name}". Use list_models to find its id.`, 404);
  return m;
};

function rowOut(r: RankedVariant, s: Snapshot) {
  return { rank: r.rank, model: r.model.name, modelId: r.model.id, variantId: r.variant.id, effort: r.variant.effort, lab: labName(s, r.model.labId), score: round(r.score), measuredShare: round(r.measuredShare * 100, 0), costUsd: round(r.costUsd, 3), speedTps: round(r.speed, 1), onFrontier: r.onFrontier, openWeights: r.model.openWeights ?? null, released: r.model.releaseDate ?? null };
}

/** What decides who is ranked: the settings a reader needs to state alongside any result. */
function settingsOut(s: Snapshot, config: IndexConfig, res?: IndexResult) {
  const strictness = Math.round(strictnessOf(config));
  return {
    strictness, rule: `A model (at an effort) is ranked only when it has measured results covering at least ${strictness}% of the index's weight; the rest of its score is estimated from similar models${config.estimateMissing ? "" : " (off here: missing benchmarks are dropped and the rest reweighted)"}. Lower strictness (0 to 100) to rank models with less measured data.`,
    releasedAfter: config.releasedAfter === undefined ? defaultReleasedAfter(s.date) : config.releasedAfter || null,
    releasedAfterNote: config.releasedAfter === undefined ? "Default: models released in the last six months. Pass releasedAfter: \"\" for every model, or a date." : undefined,
    required: config.required.length ? config.required : undefined,
    labs: config.labs?.length ? config.labs : undefined,
    excludeModels: config.excludeModels,
    olderVersionsHidden: res?.autoHidden.length ? res.autoHidden.map((id) => s.models.find((m) => m.id === id)?.name ?? id) : undefined,
    olderVersionsNote: res?.autoHidden.length ? "Older versions of a newer model are left out of an index nobody has curated, as the site does. Pass excludeModels: [] to show them." : undefined,
    costBasis: effectiveBasis(config.costBasis),
  };
}

/** Models the index scored no effort of, with why: too little measured data, or a required benchmark missing. Best-covered first. */
function excludedOut(s: Snapshot, res: IndexResult, limit = 25) {
  const ranked = new Set(res.ranked.map((r) => r.model.id)), names = new Map(s.benchmarks.map((b) => [b.id, b.shortName ?? b.name]));
  const best = new Map<string, IndexResult["excluded"][number]>();
  for (const e of res.excluded) if (!ranked.has(e.model.id) && !(res.autoHidden ?? []).includes(e.model.id) && (!best.has(e.model.id) || e.measuredShare > best.get(e.model.id)!.measuredShare)) best.set(e.model.id, e);
  const list = [...best.values()].sort((a, b) => b.measuredShare - a.measuredShare || (b.model.releaseDate ?? "").localeCompare(a.model.releaseDate ?? ""));
  return { count: list.length, models: list.slice(0, limit).map((e) => ({ model: e.model.name, modelId: e.model.id, effort: e.variant.effort, reason: e.reason === "required" ? "missing a required benchmark" : "too little measured data", measuredPct: Math.round(e.measuredShare * 100), missing: e.missing.map((id) => names.get(id) ?? id) })) };
}

/** The assistant's read tools, run over any index: the same code the in-app assistant uses, so answers match the site. */
const reused = ["get_mix", "explain_model", "compare_models", "find_benchmarks", "search_benchmarks", "try_mix", "solve_edit", "fit_ranking", "query_data", "make_chart"] as const;
const REUSED_NOTES: Record<string, string> = {
  get_mix: "The index's benchmark shares, mix metrics and top of the ranking.",
  try_mix: "Evaluate a hand-written mix (benchmark → percent share) against the index: metrics, churn and the ranking with each model's previous rank. Nothing is saved.",
  solve_edit: "Optimizer: the smallest change to the index's mix that satisfies ranking moves and benchmark constraints. Returns candidates; nothing is saved. Apply one with upsert_index.",
  fit_ranking: "Build a fresh mix that reproduces a model order (the onboarding algorithm). Returns weights; nothing is saved. Apply with upsert_index.",
  query_data: "A table of values per model under the index. Metrics: index (index score), cost (cost per task, USD), time (time per task, s), speed (output tok/s), latency (time to first token, s), tokens (output tokens per task), or any benchmark by name or id (its published value). Pick models by name, a lab, or the top N of the ranking (default 10, at most 200). efforts: best (one row per model, the default), all, or a list like [\"xhigh\",\"max\"]. Rows carry rank, effort and measuredPct (how much of the index score is measured, not estimated). Read `note`: it says which named models are unranked and why, and when the rows are only the top of a longer ranking. For a cost or time frontier use pareto_frontier instead.",
  make_chart: "Draw a chart from the data and get it back as a PNG URL (`image`) to show the user and a link to the interactive chart on mypriors.com (`link`). Every value comes from the data. Types: bar (one value per model), effort_lines (a metric across reasoning efforts), effort_compare (grouped bars for listed efforts), effort_delta (to_effort minus from_effort), scatter (metric on y against x_metric). Metrics as in query_data. Default models: the top of the ranking (at most 40). `variants` draws exact model + effort configurations (\"GPT-6 Sol max\").",
};
const reusedTools: Tool[] = reused.map((name) => {
  const spec = TOOL_SPECS.find((t) => t.name === name)!, p = spec.parameters as { properties?: Record<string, unknown>; required?: string[] };
  return {
    name, description: `${REUSED_NOTES[name] ?? spec.description} Takes an optional \`index\`.`,
    inputSchema: { type: "object", properties: { ...(p.properties ?? {}), index: INDEX_PARAM }, required: p.required ?? [], additionalProperties: false },
    async run(args, env) {
      const { index, ...rest } = args, { snapshot, config } = await resolveIndex(index);
      // A table may run past the in-app assistant's 40 rows; chart links cap at 40, so charts keep the default.
      // Tables and charts rank as rank_models and the site do (pageView), so every tool agrees on who is ranked.
      const ctx: ToolContext = { snapshot, original: config, charts: [], data: new DataView(snapshot, config, { pageView: true, maxRows: name === "query_data" ? 200 : 40 }) };
      const out = await runTool(ctx, name, rest);
      if (name !== "make_chart" || !ctx.charts[0]?.spec) return out;
      // An MCP client cannot place [[chart:N]]: hand back the image and the live chart instead. The link redraws in the same view.
      const c = ctx.charts[0], { chart: _n, use: _u, ...o } = out as Record<string, unknown>; void _n; void _u;
      c.spec = { ...c.spec, view: "page" };
      const link = chartLink(env.origin, { spec: c.spec, index: encodeIndex(config) })!;
      return { ...o, image: link.replace(`${env.origin}/?`, `${env.origin}/og?`), link, chartData: c };
    },
  };
});

const withIndex = (properties: Record<string, unknown>, required: string[] = []) => obj({ ...properties, index: INDEX_PARAM }, required);

const readTools: Tool[] = [
  {
    name: "data_status", description: "How fresh the data is: snapshot date, when it was built, and counts of benchmarks, models and measurements. Priors rebuilds its data about every 15 minutes.",
    inputSchema: obj({}),
    async run() {
      const { snapshot: s } = await resolveIndex(null);
      return { date: s.date, generatedAt: s.generatedAt, benchmarks: s.benchmarks.length, models: s.models.filter((m) => m.kind === "llm").length, labs: s.labs.length, measurements: s.observations.length, sources: s.sources.length, defaultIndex: defaultConfig(s).weights };
    },
  },
  {
    name: "list_benchmarks", description: "The benchmark catalog: id, name, category, unit, direction, how many measurements and models it has, when the publisher last updated it, and what it measures. Filter by words or category.",
    inputSchema: obj({ query: str("Words to match against names, ids, categories and descriptions."), category: str("coding, agentic, reasoning, knowledge, math, long-context, instruction, creative, safety, economics, composite, speed, cost, reliability or other."), limit: num("Rows to return (default 80, max 400).") }),
    async run(a) {
      const { snapshot: s } = await resolveIndex(null);
      const rows = new Map<string, number>(), models = new Map<string, Set<string>>();
      for (const o of s.observations) { rows.set(o.benchmarkId, (rows.get(o.benchmarkId) ?? 0) + 1); (models.get(o.benchmarkId) ?? models.set(o.benchmarkId, new Set()).get(o.benchmarkId)!).add(o.variantId.split("@")[0]); }
      const terms = norm(String(a.query ?? "")).split(" ").filter((t) => t.length > 1);
      const hit = (b: Snapshot["benchmarks"][number]) => terms.reduce((n, t) => n + (norm(`${b.name} ${b.shortName ?? ""} ${b.id}`).includes(t) ? 3 : 0) + (b.category === t ? 2 : 0) + (norm(b.description).includes(t) ? 1 : 0), 0);
      const list = s.benchmarks.filter((b) => rows.has(b.id) && (!a.category || b.category === a.category)).map((b) => ({ b, s: terms.length ? hit(b) : 1 })).filter((x) => x.s > 0);
      if (terms.length) list.sort((x, y) => y.s - x.s);
      const limit = cap(a.limit, 80, 400);
      return { total: list.length, benchmarks: list.slice(0, limit).map(({ b }) => ({ id: b.id, name: b.name, shortName: b.shortName, category: b.category, unit: b.unit, higherIsBetter: b.higherIsBetter, measurements: rows.get(b.id), models: models.get(b.id)!.size, lastUpdated: b.lastUpdated ?? null, url: b.url, description: b.description })) };
    },
  },
  {
    name: "get_benchmark", description: "One benchmark's leaderboard exactly as published: every model and effort with its score, confidence interval, cost per task and source link, best first.",
    inputSchema: obj({ benchmark: str("Benchmark id or name."), limit: num("Rows (default 50, max 300)."), effort: str("Only this reasoning effort (low, medium, high, xhigh, max).") }, ["benchmark"]),
    async run(a) {
      const { snapshot: s } = await resolveIndex(null), b = benchOf(s, a.benchmark);
      const vs = new Map(s.variants.map((v) => [v.id, v])), ms = new Map(s.models.map((m) => [m.id, m]));
      let obs = s.observations.filter((o) => o.benchmarkId === b.id && !o.details?.priorsEstimate);
      if (a.effort) obs = obs.filter((o) => vs.get(o.variantId)?.effort === a.effort);
      obs.sort((x, y) => (b.higherIsBetter ? y.value - x.value : x.value - y.value));
      return { benchmark: { id: b.id, name: b.name, category: b.category, unit: b.unit, higherIsBetter: b.higherIsBetter, url: b.url, priorsUrl: `https://mypriors.com/benchmarks/${b.id}`, lastUpdated: b.lastUpdated ?? null, description: b.description }, total: obs.length,
        rows: obs.slice(0, cap(a.limit, 50, 300)).map((o, i) => { const v = vs.get(o.variantId), m = v && ms.get(v.modelId); return { rank: i + 1, model: m?.name ?? o.variantId, modelId: v?.modelId, variantId: o.variantId, effort: v?.effort, value: o.value, ci: o.ci ?? null, costUsd: o.costUsd ?? null, outputTokens: o.outputTokens ?? null, durationSec: o.durationSec ?? null, sourceUrl: o.sourceUrl }; }) };
    },
  },
  {
    name: "list_models", description: "Models in the data with lab, release date, open-weights flag and the reasoning efforts measured. Filter by words, lab or open weights.",
    inputSchema: obj({ query: str("Words in the model name or id."), lab: str("Lab name or id, e.g. anthropic."), open_weights: { type: "boolean", description: "true: only open-weights models; false: only closed." }, limit: num("Rows (default 100, max 500).") }),
    async run(a) {
      const { snapshot: s } = await resolveIndex(null), lab = a.lab ? resolveLab(s, String(a.lab)) : null, q = norm(String(a.query ?? ""));
      if (a.lab && !lab) throw new ToolError(`Unknown lab "${a.lab}".`, 404);
      const list = s.models.filter((m) => m.kind === "llm" && (!lab || m.labId === lab) && (a.open_weights == null || m.openWeights === a.open_weights) && (!q || norm(`${m.name} ${m.id}`).includes(q)))
        .sort((x, y) => (y.releaseDate ?? "").localeCompare(x.releaseDate ?? ""));
      return { total: list.length, models: list.slice(0, cap(a.limit, 100, 500)).map((m) => ({ id: m.id, name: m.name, lab: labName(s, m.labId), released: m.releaseDate ?? null, openWeights: m.openWeights ?? null, paramsB: m.paramsB ?? null, efforts: [...new Set(s.variants.filter((v) => v.modelId === m.id).map((v) => v.effort))] })) };
    },
  },
  {
    name: "get_model", description: "Everything about one model: identity, its efforts, every benchmark value published for each effort (with cost, tokens and time where measured), and where it ranks under the index.",
    inputSchema: withIndex({ model: str("Model id or name.") }, ["model"]),
    async run(a) {
      const { snapshot: s, config } = await resolveIndex(a.index), m = modelOf(s, a.model);
      const res = computeIndex(s, { ...config, variants: "all" }, PAGE_VIEW), bench = new Map(s.benchmarks.map((b) => [b.id, b]));
      // Ranks as the site's ranking list shows them: best effort per model.
      const rank = new Map(rankingRows(res.ranked, { ...config, rankingVariants: "best" }).map((r) => [r.model.id, r.rank]));
      const ranked = res.ranked.filter((r) => r.model.id === m.id);
      const vs = s.variants.filter((v) => v.modelId === m.id);
      const settings = settingsOut(s, config, res), mine = excludedOut(s, res, 1e9).models.find((e) => e.modelId === m.id);
      const status = ranked.length ? `Ranked #${rank.get(m.id)} under ${config.name} (best effort).`
        : res.autoHidden.includes(m.id) ? "Not ranked: an older version of a newer model, which an uncurated index leaves out. Pass excludeModels: [] in the index to rank it."
        : mine ? `Not ranked: ${mine.reason} (${mine.measuredPct}% of the index's weight measured at its best effort, ${settings.strictness}% needed). Missing: ${mine.missing.join(", ")}. Lower strictness in the index to rank it with estimates.`
        : settings.releasedAfter && m.releaseDate && m.releaseDate < settings.releasedAfter ? `Not ranked: released ${m.releaseDate}, before this index's cutoff ${settings.releasedAfter}. Pass releasedAfter: "" to include older models.`
        : config.labs?.length && !config.labs.includes(m.labId) ? "Not ranked: this index only ranks some labs."
        : config.excludeModels?.includes(m.id) || (config.onlyModels && !config.onlyModels.includes(m.id)) ? "Not ranked: hidden by this index's model selection."
        : "Not ranked: no results on any benchmark in this index.";
      return { model: { id: m.id, name: m.name, lab: labName(s, m.labId), released: m.releaseDate ?? null, openWeights: m.openWeights ?? null, paramsB: m.paramsB ?? null, activeParamsB: m.activeParamsB ?? null, aliases: m.aliases.slice(0, 12) },
        status, index: { id: config.id, name: config.name, strictness: settings.strictness },
        ranking: ranked.map((r) => ({ ...rowOut(r, s), rank: rank.get(m.id) ?? null })),
        efforts: vs.map((v) => ({ variantId: v.id, effort: v.effort, measurements: s.observations.filter((o) => o.variantId === v.id && !o.details?.priorsEstimate).map((o) => ({ benchmarkId: o.benchmarkId, benchmark: bench.get(o.benchmarkId)?.name, value: o.value, unit: bench.get(o.benchmarkId)?.unit, costUsd: o.costUsd ?? null, durationSec: o.durationSec ?? null, sourceUrl: o.sourceUrl })) })) };
    },
  },
  {
    name: "rank_models", description: "The leaderboard under an index, as the site shows it: rank, score, measuredPct (how much of the score is measured, not estimated), cost per task, speed. Also `settings` (what decides who is ranked) and `excluded`: models left out for too little measured data or a missing required benchmark, best covered first, with what they lack.",
    inputSchema: withIndex({ top: num("Rows (default 25, max 200)."), efforts: { type: "string", enum: ["best", "all"], description: "One row per model (best effort, default) or every effort." }, lab: str("Only this lab."), models: { type: "array", items: { type: "string" }, description: "Only these models (names or ids)." } }),
    async run(a) {
      const { snapshot: s, config, page, unknownImports } = await resolveIndex(a.index);
      const cfg = { ...config, rankingVariants: (a.efforts === "all" ? "all" : "best") as "all" | "best" };
      // As the Builder computes it: every effort ranked, then the list's own best-or-all choice.
      const res = computeIndex(s, { ...cfg, variants: "all" }, PAGE_VIEW);
      let rows = rankingRows(res.ranked, cfg);
      if (a.lab) { const l = resolveLab(s, String(a.lab)); if (!l) throw new ToolError(`Unknown lab "${a.lab}".`, 404); rows = rows.filter((r) => r.model.labId === l); }
      if (Array.isArray(a.models) && a.models.length) { const ids = new Set(a.models.map((m) => resolveModel(s, String(m))).filter(Boolean)); rows = rows.filter((r) => ids.has(r.model.id)); }
      const top = cap(a.top, 25, 200);
      return { index: { id: cfg.id, name: cfg.name, page: page ?? null, snapshot: s.date }, settings: settingsOut(s, cfg, res), benchmarks: res.benchmarks.map((b) => ({ id: b.benchmark.id, name: b.benchmark.name, sharePct: round(b.share, 1) })),
        total: rows.length, returned: Math.min(top, rows.length), rows: rows.slice(0, top).map((r) => rowOut(r, s)),
        excluded: excludedOut(s, res), unknownImports };
    },
  },
  {
    name: "pareto_frontier", description: "Index score against cost, time, speed, latency or output tokens, exactly as the chart on mypriors.com computes it: every point, which ones are on the Pareto frontier (nothing else is both better on x and higher in score), and a PNG of the site's chart (`image`) to show the user plus the interactive chart (`link`). Use it for any 'best value', 'fastest for its score' or tradeoff question.",
    inputSchema: withIndex({ x: { type: "string", enum: ["cost", "time", "speed", "latency", "tokens"], description: "What score is plotted against (default cost: cost per task under the index's cost basis)." }, efforts: { type: "string", enum: ["all", "best"], description: "all: every measured reasoning effort is its own point (the site's default); best: each model's best-scoring effort that has the measure." } }),
    async run(a, env) {
      const { snapshot: s, config, page } = await resolveIndex(a.index);
      const c = ({ cost: "cost", time: "time-per-task", speed: "output-speed", latency: "latency", tokens: "output-tokens" } as Record<string, string>)[String(a.x ?? "cost")];
      if (!c) throw new ToolError(`Unknown x "${a.x}". Use cost, time, speed, latency or tokens.`);
      const mode = a.efforts === "best" || a.efforts === "all" ? a.efforts : chartVariantMode(config, "pareto");
      const res = computeIndex(s, { ...config, variants: "all" }, PAGE_VIEW);
      const spec = scatterSpec(s, res.ranked, config, c, mode, undefined, undefined, undefined, true);
      if (!spec) throw new ToolError(`No ${a.x} data for the models under this index.`, 404);
      const better = spec.chart.better, front = new Set(frontierOf(spec.pts, better).map((p) => p.r.variant.id));
      const xv = (p: (typeof spec.pts)[number]) => round(p.raw ?? p.x, 4);
      const point = (p: (typeof spec.pts)[number]) => ({ model: p.r.model.name, effort: p.r.variant.effort, lab: labName(s, p.r.model.labId), score: round(p.r.score), x: xv(p), measuredPct: round(p.r.measuredShare * 100, 0), onFrontier: front.has(p.r.variant.id) });
      const pts = [...spec.pts].sort((p, q) => better === "lower" ? p.x - q.x : q.x - p.x);
      const scored = new Set(res.ranked.map((r) => r.model.id)), withX = new Set(spec.pts.map((p) => p.r.model.id));
      const q = prettyQuery(encodeIndices([{ ...config, ...(mode !== chartVariantMode(config, "pareto") ? { paretoVariants: mode } : {}) }]));
      return {
        index: { id: config.id, name: config.name, page: page ?? null, snapshot: s.date }, settings: settingsOut(s, config, res),
        x: { name: spec.chart.xName, better, scale: spec.chart.scale }, efforts: mode,
        frontier: pts.filter((p) => front.has(p.r.variant.id)).map(point),
        points: pts.map(point),
        missingX: [...scored].filter((id) => !withX.has(id)).map((id) => s.models.find((m) => m.id === id)?.name ?? id),
        excluded: excludedOut(s, res, 15),
        image: `${env.origin}/og?${q}&c=${c}${mode !== "all" ? `&cm=${mode}` : ""}`, link: `${env.origin}/builder?${q}&c=${c}`,
        note: `${front.size} of ${pts.length} points are on the frontier. missingX are ranked models with no ${spec.chart.xName.replace(/ \(.*\)$/, "").toLowerCase()} measured, so they cannot be placed. The image shows the frontier and current flagships; points lists every one.`,
      };
    },
  },
  {
    name: "index_history", description: "How an index's ranking moved: the top models on each snapshot date. mode fixed scores every day with the index as written; adapting drops benchmarks that were not yet established that day.",
    inputSchema: withIndex({ mode: { type: "string", enum: ["fixed", "adapting"] }, top: num("Models per date (default 8, max 20).") }),
    async run(a) {
      const { config, snapshot: s } = await resolveIndex(a.index);
      const data = await computeHistory(config, a.mode === "adapting" ? "adapting" : "fixed", `mcp|${JSON.stringify(a.index ?? null)}|${s.date}`);
      const top = cap(a.top, 8, 20);
      return { name: data.name, mode: data.mode, frames: data.frames.map((f) => ({ date: f.date, models: f.models, benchmarksCounted: f.used, rows: f.rows.slice(0, top).map((r) => ({ model: r.name, effort: r.effort, score: round(r.score) })) })) };
    },
  },
  {
    name: "default_index", description: "The default General frontier index (used whenever `index` is omitted): `index` is the object to edit and pass back as `index`; `settings` explains who it ranks and leaves out, and `benchmarks` names what each weight is.",
    inputSchema: obj({}),
    async run() {
      const { snapshot: s, config } = await resolveIndex(null), res = computeIndex(s, { ...config, variants: "all" }, PAGE_VIEW);
      return { index: config, settings: settingsOut(s, config, res), benchmarks: res.benchmarks.map((b) => ({ id: b.benchmark.id, name: b.benchmark.name, sharePct: round(b.share, 1), what: b.benchmark.description })) };
    },
  },
  {
    name: "index_link", description: "Shareable mypriors.com links for an index: the builder, the share-card image, and chart cards for cost, time and speed. Also the encoded `i=` string.",
    inputSchema: withIndex({}),
    async run(a, env) {
      const { config } = await resolveIndex(a.index), { id: _id, highlight: _h, ...cfg } = config; void _id; void _h;
      const q = prettyQuery(encodeIndices([config]));
      const charts = ["cost", "time-per-task", "output-speed", "latency", "output-tokens", "release-date", "uptime", "strengths"];
      return { builder: `${env.origin}/builder?${q}`, card: `${env.origin}/og?${q}`, charts: Object.fromEntries(charts.map((c) => [c, `${env.origin}/builder?${q}&c=${c}`])), chartCards: Object.fromEntries(charts.map((c) => [c, `${env.origin}/og?${q}&c=${c}`])), chartTitles: Object.fromEntries(charts.map((c) => [c, chartTitle(c) ?? c])), encoded: encodeIndex(config) };
    },
  },
  {
    name: "decode_index_link", description: "Read an index out of a mypriors.com link (or an `i=` value) as a full index object, which can be edited and passed back as `index`.",
    inputSchema: obj({ link: str("A mypriors.com link, an `i=` value, or @handle.") }, ["link"]),
    async run(a) { const { config, page } = await resolveIndex(String(a.link)); return { page: page ?? null, index: config }; },
  },
  {
    name: "get_page", description: "A published page by handle: name, bio, theme, sections and indices, and which benchmarks the owner imported. Same as mypriors.com/<handle>.",
    inputSchema: obj({ handle: str("Page handle, with or without @.") }, ["handle"]),
    async run(a, env) {
      const p = await publicPage(String(a.handle));
      if (!p) throw new ToolError(`No page at ${a.handle}.`, 404);
      const { imports, _id, _creationTime, ...rest } = p as typeof p & { _id?: unknown; _creationTime?: unknown }; void _id; void _creationTime;
      return { ...rest, url: `${env.origin}/${p.handle}`, imports: (imports ?? []).map((i) => ({ id: i.benchmark.id, name: i.benchmark.name, rows: i.rows.length })) };
    },
  },
  {
    name: "explore_pages", description: "Published pages, newest first (what /explore shows): handle, name, bio and the main index's name and size.",
    inputSchema: obj({ query: str("Words in the handle, name or bio."), limit: num("Rows (default 30, max 300).") }),
    async run(a, env) {
      const list = (await convex().query(api.profiles.explore, {})) as { handle: string; displayName: string; bio?: string; updatedAt: number; indices: IndexConfig[]; others: string[] }[];
      const q = norm(String(a.query ?? ""));
      return list.filter((p) => !q || norm(`${p.handle} ${p.displayName} ${p.bio ?? ""}`).includes(q)).slice(0, cap(a.limit, 30, 300))
        .map((p) => ({ handle: p.handle, name: p.displayName, bio: p.bio ?? null, url: `${env.origin}/${p.handle}`, updated: new Date(p.updatedAt).toISOString().slice(0, 10), mainIndex: p.indices[0]?.name, benchmarks: Object.keys(p.indices[0]?.weights ?? {}).length, otherIndices: p.others }));
    },
  },
  {
    name: "theme_presets", description: "Page themes a page can use (`preset` in set_theme), with their light or dark mode.",
    inputSchema: obj({}),
    async run() { return THEME_CHOICES.map((t) => ({ id: t.id, name: t.name, dark: t.dark, pair: t.pair ?? null })); },
  },
];

/* ---------------- write tools: act as the page's owner ---------------- */

type Mine = { handle: string; displayName: string; indices: IndexConfig[]; sections: Record<string, unknown>[]; socials: unknown[]; bio: string; theme: Record<string, unknown> };
async function apply(env: ToolEnv, action: "whoami" | "import" | "indices" | "page", payload?: unknown) {
  if (!env.token) throw new ToolError("This tool changes your page, so it needs your agent token (pri_...). Mint one on your page under Edit page, Agent access.", 401);
  if (!/^pri_[0-9a-f]{48}$/.test(env.token)) throw new ToolError("That is not a Priors agent token. It starts with pri_ and is 52 characters; mint one on your page under Edit page, Agent access.", 401);
  try { return await convex().mutation(api.profiles.agentApply, { token: env.token, action, payload }); }
  catch (e) {
    if (e instanceof ToolError) throw e;
    const msg = e instanceof Error ? e.message : String(e);
    // Convex hides the text of a plain Error in production, so an unknown token and a real failure look alike.
    if (/Server Error/.test(msg) && !/Uncaught|ConvexError/.test(msg)) throw new ToolError("The server refused this. The usual cause is a token that was replaced or revoked: mint a new one on your page under Edit page, Agent access.", 401);
    throw new ToolError(msg.replace(/^[\s\S]*(Uncaught|ConvexError):\s*/, "").split("\n")[0], /Invalid token/.test(msg) ? 401 : 400);
  }
}
const mine = async (env: ToolEnv) => (await apply(env, "whoami")) as Mine;
const link = (env: ToolEnv, handle: string) => `${env.origin}/${handle}`;

const writeTools: Tool[] = [
  {
    name: "whoami", write: true, description: "Your own page: handle, display name, bio, socials, theme, every index (full configs) and every section. Read this before changing anything.",
    inputSchema: obj({}),
    async run(_a, env) { const m = await mine(env); return { ...m, url: link(env, m.handle) }; },
  },
  {
    name: "update_page", write: true, description: "Change any of: displayName, bio, socials ([{label,url}]), avatarUrl. Only the fields you give change.",
    inputSchema: obj({ displayName: str("Name at the top of the page."), bio: str("Short bio."), socials: { type: "array", items: obj({ label: str("Link text."), url: str("Full URL.") }, ["label", "url"]) }, avatarUrl: str("Image URL.") }),
    async run(a, env) {
      const patch: Record<string, unknown> = {};
      for (const k of ["displayName", "bio", "socials", "avatarUrl"]) if (a[k] !== undefined) patch[k] = a[k];
      if (!Object.keys(patch).length) throw new ToolError("Give at least one of displayName, bio, socials, avatarUrl.");
      return apply(env, "page", patch);
    },
  },
  {
    name: "set_theme", write: true, description: "Change the page's look. Only the fields you give change; pass css as an empty string to clear it. preset: see theme_presets. css is scoped by convention to .page-root and limited to 10KB.",
    inputSchema: obj({ preset: str("Theme id, e.g. bone, night, aa, slop, paper, sand, graphite, midnight, forest."), mode: { type: "string", enum: ["auto", "fixed"], description: "fixed keeps the chosen light or dark version." }, accent: str("Hex color."), surface: { type: "string", enum: ["bone", "white"] }, serif: str("Display font name."), mono: str("Data font name."), css: str("Raw stylesheet.") }),
    async run(a, env) {
      const now = (await mine(env)).theme ?? {}, next: Record<string, unknown> = { ...now };
      for (const k of ["preset", "mode", "accent", "surface", "serif", "mono", "css"]) if (a[k] !== undefined) next[k] = a[k] === "" ? undefined : a[k];
      if (typeof next.css === "string" && next.css.length > 10_000) throw new ToolError("css is limited to 10KB.");
      if (a.preset && !THEME_CHOICES.some((t) => t.id === a.preset) && !["aa-dark", "slop-light", "night"].includes(String(a.preset))) throw new ToolError(`Unknown preset "${a.preset}". See theme_presets.`);
      return apply(env, "page", { theme: next });
    },
  },
  {
    name: "set_indices", write: true, description: "Replace the whole list of indices (tabs). Prefer upsert_index and delete_index, which never touch the others. Each needs id, name, weights, required, cutoff, estimateMissing, variants.",
    inputSchema: obj({ indices: { type: "array", items: { type: "object" } } }, ["indices"]),
    async run(a, env) { if (!Array.isArray(a.indices) || !a.indices.length) throw new ToolError("indices must be a non-empty array."); return apply(env, "indices", a.indices); },
  },
  {
    name: "upsert_index", write: true, description: "Create an index or change one by id, leaving every other index alone. Fields you give replace the stored ones (weights as a whole); fields you omit stay. Any IndexConfig field works: weights, required, strictness, estimateMissing, effortMatching, rankingVariants, paretoVariants, efforts, excludeModels, releasedAfter, costSource, costBasis, timeSource, highlight, labs.",
    inputSchema: obj({ index: { type: "object", description: "{ id, name?, weights?, ...fields }. A new id creates a tab." }, position: num("0-based tab position for a new index (default: last).") }, ["index"]),
    async run(a, env) {
      const given = a.index as Partial<IndexConfig> | undefined;
      if (!given?.id || typeof given.id !== "string") throw new ToolError("index.id is required (a stable slug).");
      const m = await mine(env), at = m.indices.findIndex((x) => x.id === given.id);
      const fresh = defaultConfig({} as Snapshot);
      const merged = at >= 0 ? { ...m.indices[at], ...given } : { ...fresh, required: [], optional: undefined, ...given, name: given.name ?? given.id } as IndexConfig;
      const list = [...m.indices];
      if (at >= 0) list[at] = merged; else list.splice(typeof a.position === "number" ? Math.max(0, Math.min(list.length, a.position)) : list.length, 0, merged);
      const out = await apply(env, "indices", list);
      return { ...(out as object), created: at < 0, indexId: merged.id, indices: list.map((x) => x.id) };
    },
  },
  {
    name: "delete_index", write: true, description: "Remove one index (tab) by id. The last index cannot be removed.",
    inputSchema: obj({ id: str("Index id.") }, ["id"]),
    async run(a, env) {
      const m = await mine(env), list = m.indices.filter((x) => x.id !== a.id);
      if (list.length === m.indices.length) throw new ToolError(`No index "${a.id}". You have: ${m.indices.map((x) => x.id).join(", ")}.`, 404);
      if (!list.length) throw new ToolError("A page needs at least one index.");
      return { ...(await apply(env, "indices", list) as object), indices: list.map((x) => x.id) };
    },
  },
  {
    name: "set_sections", write: true, description: "Replace the page layout: the ordered list of sections. Prefer upsert_section and remove_section. A section is { id, kind, title?, indexId?, benchmarkId?, body?, links?, hidden?, view?, metrics? }; kind is rankings, pareto, speed, benchmark, history, gallery, text or links.",
    inputSchema: obj({ sections: { type: "array", items: { type: "object" } } }, ["sections"]),
    async run(a, env) { if (!Array.isArray(a.sections)) throw new ToolError("sections must be an array."); return apply(env, "page", { sections: a.sections }); },
  },
  {
    name: "upsert_section", write: true, description: "Add a section or change one by id, leaving the others alone. position is the 0-based place for a new section (default: end).",
    inputSchema: obj({ section: { type: "object", description: "{ id, kind, ... }" }, position: num("Where to put a new section.") }, ["section"]),
    async run(a, env) {
      const s = a.section as Record<string, unknown> | undefined;
      if (!s?.id || !s.kind) throw new ToolError("section.id and section.kind are required.");
      const m = await mine(env), list = [...m.sections], at = list.findIndex((x) => x.id === s.id);
      if (at >= 0) list[at] = { ...list[at], ...s }; else list.splice(typeof a.position === "number" ? Math.max(0, Math.min(list.length, a.position)) : list.length, 0, s);
      return { ...(await apply(env, "page", { sections: list }) as object), sections: list.map((x) => `${x.id}:${x.kind}`) };
    },
  },
  {
    name: "remove_section", write: true, description: "Remove a section by id.",
    inputSchema: obj({ id: str("Section id.") }, ["id"]),
    async run(a, env) {
      const m = await mine(env), list = m.sections.filter((x) => x.id !== a.id);
      if (list.length === m.sections.length) throw new ToolError(`No section "${a.id}". You have: ${m.sections.map((x) => x.id).join(", ")}.`, 404);
      return { ...(await apply(env, "page", { sections: list }) as object), sections: list.map((x) => `${x.id}:${x.kind}`) };
    },
  },
  {
    name: "import_benchmark", write: true, description: "Add your own benchmark's results to your page (re-importing the same benchmark id replaces it). Rows whose model name Priors does not recognize are dropped. Never invent scores; costUsd only if the source publishes it. Wire it into an index afterwards with upsert_index.",
    inputSchema: obj({ benchmark: { type: "object", description: "{ id (lowercase slug), name, shortName?, url, description (10-600 chars), unit: percent|score|elo|usd|seconds|count, higherIsBetter, category }" }, rows: { type: "array", items: { type: "object" }, description: "[{ modelLabel, value, effort?, ci?: [lo,hi], costUsd?, outputTokens?, steps?, sourceUrl, note? }]" }, missing: { type: "array", items: { type: "object" } } }, ["benchmark", "rows"]),
    async run(a, env) {
      const parsed = importSchema.safeParse({ benchmark: a.benchmark, rows: a.rows, missing: a.missing });
      if (!parsed.success) throw new ToolError(`Invalid import: ${parsed.error.issues.slice(0, 5).map((i) => `${i.path.join(".")}: ${i.message}`).join("; ")}`);
      return apply(env, "import", parsed.data);
    },
  },
  {
    name: "list_imports", write: true, description: "Benchmarks you imported on your page: id, name and row count.",
    inputSchema: obj({}),
    async run(_a, env) {
      const m = await mine(env), p = await publicPage(m.handle);
      return (p?.imports ?? []).map((i) => ({ id: i.benchmark.id, name: i.benchmark.name, rows: i.rows.length, inIndices: m.indices.filter((x) => (x.weights[String(i.benchmark.id)] ?? 0) > 0).map((x) => x.id) }));
    },
  },
];

export const TOOLS: Tool[] = [...readTools, ...reusedTools, ...writeTools];
export const toolByName = (name: string) => TOOLS.find((t) => t.name === name);

/** One entry point for the MCP endpoint and the REST route: runs a tool and reports failures as { error }. */
export async function callTool(name: string, args: unknown, env: ToolEnv): Promise<{ ok: true; result: unknown } | { ok: false; error: string; status: number }> {
  const tool = toolByName(name);
  if (!tool) return { ok: false, error: `Unknown tool "${name}". Tools: ${TOOLS.map((t) => t.name).join(", ")}.`, status: 404 };
  const a = args && typeof args === "object" && !Array.isArray(args) ? (args as Record<string, unknown>) : {};
  if (tool.write && !env.token) return { ok: false, error: "This tool changes your page, so it needs your agent token (pri_...). Mint one on your page under Edit page, Agent access.", status: 401 };
  try { return { ok: true, result: await tool.run(a, env) }; }
  catch (e) { return e instanceof ToolError ? { ok: false, error: e.message, status: e.status } : { ok: false, error: e instanceof Error ? e.message : String(e), status: 500 }; }
}

