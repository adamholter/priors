/**
 * Game Autoresearch Bench (Kevin Zhang and Max Bittker, released 2026-11-25): can an AI agent train a strong game-playing bot on
 * its own with a small GPU budget? Each agent (Harbor's Terminus-2 harness) gets a game simulator, editable training code and a
 * budget on NVIDIA L40S GPUs; it chooses what to try and how long to train, then the authors retrain its final recipe from scratch
 * and grade it against private evaluation panels.
 *
 * The headline is the article's "overall score" (Figure 1), which the page computes in the browser
 * (external-website/src/posts/autoresearch/TopScore.tsx). We fetch the same inputs from the public repo and repeat that math:
 *   - six tasks: Polytopia from an empty file, Polytopia recipe efficiency (the starter's training compute to match the recipe,
 *     at 1 h and 8 h, adjusted for each budget cell), Pokémon 3v3 from a working starter, forecasting training runs, a Generals
 *     tournament and Hex 13×13;
 *   - each task is standardized against frozen constants (50 = the ten reference models' average, 10 = their SD), and a model's
 *     score is the mean of the tasks it ran. A model needs the first four to be ranked.
 * The frozen constants are read from the page's own source files, so a re-norm by the authors carries over; if those files change
 * shape the scrape fails instead of guessing.
 */
import type { Benchmark, RawRow, ScrapeResult, Source } from "../../../src/data/types";

export const GAME_AUTORESEARCH_ID = "game-autoresearch";
export const GAME_AUTORESEARCH_URL = "https://gameautoresearch.github.io/";
export const GAME_AUTORESEARCH_REPO = "https://github.com/gameautoresearch/gameautoresearch.github.io";
const RAW = "https://raw.githubusercontent.com/gameautoresearch/gameautoresearch.github.io/HEAD/external-website/src/posts/autoresearch/";
export const GAME_AUTORESEARCH_FILES = ["TopScore.tsx", "CostMultiplier.tsx", "top-scores.json", "budget.json", "generals-tournament.json", "hex13.json"] as const;
type Files = Record<(typeof GAME_AUTORESEARCH_FILES)[number], string>;

const REQUIRED = ["poly_empty", "poke", "forecast", "recipe8"];
const OPTIONAL = ["generals_t", "hex"];
const TASKS = [...REQUIRED, ...OPTIONAL];
const TASK_NAMES: Record<string, string> = {
  poly_empty: "Polytopia, empty file", recipe8: "Polytopia, recipe efficiency", poke: "Pokémon 3v3", generals_t: "Generals tournament", hex: "Hex 13×13", forecast: "Forecasting training runs",
};

const fail = (what: string): never => { throw new Error(`Game Autoresearch Bench: ${what}; the article's source changed?`); };
const mean = (v: number[]) => v.reduce((s, x) => s + x, 0) / v.length;
const num = (s: string) => { const n = Number(s); return Number.isFinite(n) ? n : fail(`unreadable number ${s}`); };

/** The `{ ... }` body after `const NAME ... = {`, matched to its closing brace. */
function block(src: string, name: string): string {
  const at = new RegExp(`const ${name}\\b[^=]*=\\s*\\{`).exec(src) ?? fail(`no ${name}`);
  let depth = 1, i = at.index + at[0].length;
  for (; i < src.length && depth; i++) depth += src[i] === "{" ? 1 : src[i] === "}" ? -1 : 0;
  return src.slice(at.index + at[0].length, i - 1);
}
const stringArray = (src: string, name: string) =>
  [...(new RegExp(`const ${name}\\s*=\\s*\\[([^\\]]*)\\]`).exec(src)?.[1] ?? fail(`no ${name}`)).matchAll(/"([^"]+)"/g)].map((m) => m[1]);

export interface FrozenScale {
  norms: Record<string, { mean: number; sd: number }>;
  cells: Record<"1h" | "8h", Record<string, number>>;
  crash: number;
  fit: { einf: number; b: number; alpha: number };
}

export function readScale(topScore: string, costMultiplier: string): FrozenScale {
  if (stringArray(topScore, "RECIPE_TASKS").join() !== REQUIRED.join() || stringArray(topScore, "OPTIONAL_TASKS").join() !== OPTIONAL.join()) fail("the task list moved");
  const norms = Object.fromEntries([...block(topScore, "NORMS").matchAll(/(\w+):\s*\{\s*mean:\s*(-?[\d.e-]+),\s*sd:\s*([\d.e-]+)\s*\}/g)].map((m) => [m[1], { mean: num(m[2]), sd: num(m[3]) }]));
  for (const t of TASKS) if (!norms[t]) fail(`no norm for ${t}`);
  const offsets = block(topScore, "CELL_OFFSETS");
  const cells = Object.fromEntries((["1h", "8h"] as const).map((k) => {
    const body = new RegExp(`"${k}":\\s*\\{([^}]*)\\}`).exec(offsets)?.[1] ?? fail(`no ${k} cell offsets`);
    return [k, Object.fromEntries([...body.matchAll(/^\s*(?:"([^"]+)"|([^\s":]+)):\s*(-?[\d.e-]+)/gm)].map((m) => [m[1] ?? m[2], num(m[3])]))];
  })) as FrozenScale["cells"];
  if (Object.keys(cells["1h"]).length < 3 || Object.keys(cells["8h"]).length < 3) fail("too few cell offsets");
  const crash = num(/const CRASH_MULT\s*=\s*([\d.]+)/.exec(topScore)?.[1] ?? fail("no CRASH_MULT"));
  const f = /const FIT\s*=\s*\{\s*einf:\s*([\d.]+),\s*b:\s*([\d.]+),\s*alpha:\s*([\d.]+)\s*\}/.exec(costMultiplier) ?? fail("no starter curve fit");
  return { norms, cells, crash, fit: { einf: num(f[1]), b: num(f[2]), alpha: num(f[3]) } };
}

interface Recipe { model: string; cell: string; broken: boolean; multiplier1h: number | null; curve: { hours: number; elo: number }[] }
interface Budget { starter: { hours: number; elo: number; n: number }[]; recipes: Recipe[]; fill?: Recipe[] }

/** Starter training hours to reach an Elo: the monotone (PAVA) starter curve, extended past its longest run by the fitted power law. */
function starterHours(budget: Budget, fit: FrozenScale["fit"]): (elo: number) => number {
  const blocks: { lt: number; elo: number; w: number }[] = [];
  for (const p of budget.starter) {
    blocks.push({ lt: Math.log2(p.hours), elo: p.elo, w: p.n });
    while (blocks.length > 1 && blocks[blocks.length - 2].elo >= blocks[blocks.length - 1].elo) {
      const b = blocks.pop()!, a = blocks.pop()!, w = a.w + b.w;
      blocks.push({ lt: (a.lt * a.w + b.lt * b.w) / w, elo: (a.elo * a.w + b.elo * b.w) / w, w });
    }
  }
  const k = blocks.map((b) => ({ hours: 2 ** b.lt, elo: b.elo }));
  if (k.length < 2) fail("starter curve has under two points");
  const top = k[k.length - 1];
  const fitHours = (elo: number) => (fit.b / Math.max(fit.einf - elo, 1e-9)) ** (1 / fit.alpha);
  return (elo) => {
    if (elo >= top.elo) return top.hours * (fitHours(elo) / fitHours(top.elo));
    if (elo <= k[0].elo) return k[0].hours * 2 ** ((elo - k[0].elo) / ((k[1].elo - k[0].elo) / Math.log2(k[1].hours / k[0].hours)));
    for (let i = 1; i < k.length; i++) if (elo <= k[i].elo) return k[i - 1].hours * (k[i].hours / k[i - 1].hours) ** ((elo - k[i - 1].elo) / (k[i].elo - k[i - 1].elo));
    return top.hours;
  };
}

/** Recipe efficiency per model: exp(mean of its 1 h and 8 h log multipliers, each net of the frozen offset of the budget cell it ran). */
function recipeScores(budget: Budget, scale: FrozenScale): Record<string, number> {
  const hoursFor = starterHours(budget, scale.fit);
  const obs: Record<"1h" | "8h", { model: string; cell: string; y: number }[]> = { "1h": [], "8h": [] };
  for (const r of [...budget.recipes, ...(budget.fill ?? [])]) {
    if (r.cell === "zero-shot") continue;
    const model = r.model === "Opus 5.5" ? "Claude Opus 5.5" : r.model, end = r.curve[r.curve.length - 1];
    obs["1h"].push({ model, cell: r.cell, y: Math.log(r.broken || r.multiplier1h === null ? scale.crash : r.multiplier1h) });
    obs["8h"].push({ model, cell: r.cell, y: Math.log(r.broken || !end ? scale.crash : hoursFor(end.elo) / end.hours) });
  }
  const effect = (k: "1h" | "8h", m: string) => {
    const mine = obs[k].filter((o) => o.model === m && scale.cells[k][o.cell] !== undefined);
    return mine.length ? mean(mine.map((o) => o.y - scale.cells[k][o.cell])) : undefined;
  };
  const out: Record<string, number> = {};
  for (const m of new Set(obs["8h"].map((o) => o.model))) {
    const e1 = effect("1h", m), e8 = effect("8h", m);
    if (e1 !== undefined && e8 !== undefined) out[m] = Math.exp((e1 + e8) / 2);
  }
  return out;
}

export interface OverallRow { model: string; score: number; se: number; tasks: Record<string, { raw: number; score: number }> }

export function overallScores(files: Files): OverallRow[] {
  const scale = readScale(files["TopScore.tsx"], files["CostMultiplier.tsx"]);
  const top = JSON.parse(files["top-scores.json"]) as { tasks: { id: string; scores: Record<string, number> }[] };
  const raw: Record<string, Record<string, number>> = Object.fromEntries(top.tasks.map((t) => [t.id, t.scores]));
  raw.recipe8 = recipeScores(JSON.parse(files["budget.json"]) as Budget, scale);
  raw.generals_t = Object.fromEntries((JSON.parse(files["generals-tournament.json"]) as { rows: { model: string; elo: number }[] }).rows.map((r) => [r.model, r.elo]));
  raw.hex = Object.fromEntries((JSON.parse(files["hex13.json"]) as { models: { model: string; elo: number }[] }).models.map((r) => [r.model, r.elo]));
  for (const t of TASKS) if (!raw[t] || !Object.keys(raw[t]).length) fail(`no scores for ${t}`);
  const standardize = (t: string, v: number) => 50 + (10 * ((t === "recipe8" ? Math.log(v) : v) - scale.norms[t].mean)) / scale.norms[t].sd;
  return Object.keys(raw.poly_empty)
    .filter((m) => REQUIRED.every((t) => raw[t][m] !== undefined))
    .map((m) => {
      const tasks = Object.fromEntries(TASKS.filter((t) => raw[t][m] !== undefined).map((t) => [t, { raw: raw[t][m], score: standardize(t, raw[t][m]) }]));
      const have = Object.values(tasks).map((x) => x.score), score = mean(have);
      const se = Math.sqrt(have.reduce((a, b) => a + (b - score) ** 2, 0) / (have.length - 1) / have.length);
      return { model: m, score, se, tasks };
    })
    .sort((a, b) => b.score - a.score);
}

const round = (x: number, d = 2) => Math.round(x * 10 ** d) / 10 ** d;

export function parseGameAutoresearch(files: Files): { rows: RawRow[]; benchmark: Benchmark } {
  const overall = overallScores(files);
  const rows: RawRow[] = overall.map((r, i) => ({
    benchmarkId: GAME_AUTORESEARCH_ID, modelLabel: r.model, value: round(r.score, 1), rank: i + 1, harness: "Terminus-2", sourceUrl: GAME_AUTORESEARCH_URL,
    ci: [round(r.score - r.se, 1), round(r.score + r.se, 1)],
    note: `Mean of ${Object.keys(r.tasks).length} standardized tasks (50 = the reference models' average, 10 = one SD); the interval is ±1 standard error across those tasks`,
    details: {
      standardError: round(r.se, 2),
      tasks: Object.fromEntries(Object.entries(r.tasks).map(([t, x]) => [TASK_NAMES[t], { raw: round(x.raw, 3), score: round(x.score, 1) }])),
    },
  }));
  const benchmark: Benchmark = {
    id: GAME_AUTORESEARCH_ID, sourceId: "game-autoresearch", name: "Game Autoresearch Bench", shortName: "Game Autoresearch", url: GAME_AUTORESEARCH_URL, unit: "score", higherIsBetter: true,
    category: "science", categories: ["science", "agentic", "coding"], normalization: { kind: "linear", min: 30, max: 70 }, eligibleForDefault: false, defaultWeight: 0,
    description: "Can an agent train a strong game bot on its own with a small GPU budget? It gets a simulator, editable training code and L40S GPU time, picks its experiments, and its final recipe is retrained and graded on private panels. Six tasks across Polytopia, Pokémon, Generals and Hex plus forecasting training runs, standardized so 50 is the reference models' average.",
  };
  return { rows, benchmark };
}

const source: Source = {
  id: "game-autoresearch", name: "Game Autoresearch Bench", url: GAME_AUTORESEARCH_URL,
  async scrape(ctx): Promise<ScrapeResult> {
    const files = Object.fromEntries(await Promise.all(GAME_AUTORESEARCH_FILES.map(async (f) => [f, await ctx.fetchText(RAW + f)]))) as Files;
    const { rows, benchmark } = parseGameAutoresearch(files);
    if (rows.length < 5) throw new Error(`Game Autoresearch Bench: ${rows.length} ranked models`);
    return { benchmarks: [benchmark], rows, raw: Object.fromEntries(Object.entries(files).map(([f, t]) => [f.endsWith(".tsx") ? `${f}.txt` : f, t])), notes: [`${rows.length} models ranked over six tasks; #1 ${rows[0].modelLabel} ${rows[0].value}`] };
  },
};
export default source;
