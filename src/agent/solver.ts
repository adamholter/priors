/**
 * Mix editing toolkit for the adjustment agent: mix metrics, a fast surrogate of the engine, and an
 * edit solver that finds the smallest change to a mix that satisfies ranking goals.
 *
 * Surrogate: an index score is a weighted mean of single-benchmark scores over the benchmarks a
 * variant has (renormalized), gated by the strictness coverage floor. Each benchmark's column is the
 * engine's own single-benchmark index under the base settings (effort matching, release window,
 * exclusions), so candidates are scored in microseconds; finalists are verified with computeIndex.
 */
import type { Snapshot } from "../data/types";
import { computeIndex, minMeasuredShare, type IndexConfig } from "../engine";
import { benchmarkQuality } from "../onboarding/quality";

export type Shares = Record<string, number>; // benchmarkId -> share (sum 1)

/** One ranking requirement. `below`/`above` name another model; ranks are 1-based, models (best effort) only. */
export type Move = { model: string; rank?: number; minRank?: number; maxRank?: number; below?: string; above?: string };
export type Goal = {
  moves?: Move[];
  /** Benchmarks that must not appear. */
  exclude?: string[];
  /** Benchmarks that must stay in (or be added at a modest share). */
  include?: string[];
  /** Keep the relative order of the current top N (moved models aside). */
  keepTop?: number;
  maxBenchmarks?: number;
  /** May the solver add benchmarks that aren't in the mix (default true). */
  allowAdd?: boolean;
};

export type MixMetrics = {
  count: number;
  /** 1/Σs²: how many equally weighted benchmarks the mix behaves like. */
  effective: number;
  largest: number;
  smallest: number;
  /** Share outside the soft 5–40% band, in percentage points (a nudge, not a rule). */
  outsideBand: number;
  /** Share-weighted benchmark quality (0–100). */
  quality: number;
  /** Lower is simpler/cleaner. */
  complexity: number;
};

export const SOFT_MIN = 0.05, SOFT_MAX = 0.4;

export function toShares(weights: Record<string, number>): Shares {
  const e = Object.entries(weights).filter(([, w]) => w > 0), sum = e.reduce((n, [, w]) => n + w, 0) || 1;
  return Object.fromEntries(e.map(([id, w]) => [id, w / sum]));
}
/** URL-friendly weights: percentages at 0.1 precision. */
export function toWeights(shares: Shares): Record<string, number> {
  const out: Record<string, number> = {};
  for (const [id, s] of Object.entries(shares)) { const w = Math.round(s * 1000) / 10; if (w > 0) out[id] = w; }
  return out;
}
/** Total weight moved between two mixes, 0–1 (half the L1 distance of the shares). */
export function distance(a: Shares, b: Shares) {
  let d = 0; for (const id of new Set([...Object.keys(a), ...Object.keys(b)])) d += Math.abs((a[id] ?? 0) - (b[id] ?? 0));
  return d / 2;
}

const qualityCache = new WeakMap<Snapshot, Map<string, number>>();
export function qualityOf(snapshot: Snapshot) {
  let q = qualityCache.get(snapshot);
  if (!q) { q = new Map(benchmarkQuality(snapshot).map((x) => [x.id, x.score])); qualityCache.set(snapshot, q); }
  return q;
}

export function mixMetrics(snapshot: Snapshot, shares: Shares): MixMetrics {
  const q = qualityOf(snapshot), s = Object.entries(shares).filter(([, v]) => v > 0);
  const count = s.length, sq = s.reduce((n, [, v]) => n + v * v, 0);
  const outsideBand = 100 * s.reduce((n, [, v]) => n + Math.max(0, SOFT_MIN - v) + Math.max(0, v - SOFT_MAX), 0);
  const quality = s.reduce((n, [id, v]) => n + v * (q.get(id) ?? 50), 0);
  // Few benchmarks, evenly spread, good ones. Each term is small on its own; together they prefer clean mixes.
  const complexity = 1.5 * Math.max(0, count - 5) + 0.4 * outsideBand + 8 * (count ? 1 - (1 / sq) / count : 0) + 0.05 * (100 - quality);
  return { count, effective: sq ? 1 / sq : 0, largest: Math.max(0, ...s.map(([, v]) => v)), smallest: s.length ? Math.min(...s.map(([, v]) => v)) : 0, outsideBand, quality, complexity };
}

/** Benchmarks the solver may add on its own: measured, ranked-model benchmarks (no price/speed/proxy/composite). */
export function addable(snapshot: Snapshot) {
  const seen = new Set(snapshot.observations.map((o) => o.benchmarkId));
  // Same exclusions as the onboarding fitter: no price/speed/reliability proxies, composites, human-preference arenas or image/vision boards.
  return snapshot.benchmarks.filter((b) => seen.has(b.id) && !b.proxy && !["cost", "speed", "reliability", "composite", "creative"].includes(b.category) && !/price|uptime|usage|arena|image|vision|subjective/i.test(`${b.id} ${b.name}`)).map((b) => b.id);
}

type Col = Float64Array; // per variant, NaN = missing
export type Surrogate = {
  variants: { id: string; modelId: string }[];
  models: string[];
  cols: Map<string, Col>;
  floor: number;
  col(id: string): Col | undefined;
};

const surrogateCache = new Map<string, Surrogate>();
/** Settings that change single-benchmark columns; weights don't. */
const settingsKey = (snapshot: Snapshot, c: IndexConfig) => JSON.stringify([snapshot.date, snapshot.generatedAt, c.strictness, c.cutoff, c.estimateMissing, c.effortMatching, c.releasedAfter, c.labs, c.excludeModels, c.onlyModels]);

export function surrogate(snapshot: Snapshot, base: IndexConfig): Surrogate {
  const key = settingsKey(snapshot, base);
  const hit = surrogateCache.get(key);
  if (hit) return hit;
  // Every variant the full pool can rank, in a stable order.
  const pool = computeIndex(snapshot, { ...base, weights: Object.fromEntries(addable(snapshot).map((id) => [id, 1])), required: [], strictness: 0, estimateMissing: false, variants: "all" });
  const variants = pool.ranked.map((r) => ({ id: r.variant.id, modelId: r.model.id }));
  const pos = new Map(variants.map((v, i) => [v.id, i]));
  const cols = new Map<string, Col>();
  const build = (id: string) => {
    const r = computeIndex(snapshot, { ...base, weights: { [id]: 1 }, required: [], strictness: 0, estimateMissing: false, variants: "all" });
    const col = new Float64Array(variants.length).fill(NaN);
    for (const x of r.ranked) { const i = pos.get(x.variant.id); const v = x.values.find((y) => y.benchmarkId === id); if (i != null && v && !v.estimated) col[i] = x.score; }
    cols.set(id, col);
    return col;
  };
  const s: Surrogate = { variants, models: [...new Set(variants.map((v) => v.modelId))], cols, floor: minMeasuredShare(base), col: (id) => cols.get(id) ?? (snapshot.benchmarks.some((b) => b.id === id) ? build(id) : undefined) };
  for (const id of Object.keys(base.weights)) s.col(id);
  surrogateCache.set(key, s);
  if (surrogateCache.size > 12) surrogateCache.delete(surrogateCache.keys().next().value!);
  return s;
}

/** Model → best-variant surrogate score for a mix. */
export function surrogateScores(s: Surrogate, shares: Shares): Map<string, number> {
  const active = Object.entries(shares).filter(([, v]) => v > 0).map(([id, v]) => [s.col(id), v] as const).filter((x): x is [Col, number] => !!x[0]);
  const total = active.reduce((n, [, v]) => n + v, 0) || 1;
  const out = new Map<string, number>();
  for (let i = 0; i < s.variants.length; i++) {
    let num = 0, den = 0;
    for (const [c, w] of active) { const v = c[i]; if (!Number.isNaN(v)) { num += v * w; den += w; } }
    if (!den || den / total < s.floor - 1e-9) continue;
    const m = s.variants[i].modelId, sc = num / den;
    if (!out.has(m) || sc > out.get(m)!) out.set(m, sc);
  }
  return out;
}
const orderOf = (scores: Map<string, number>) => [...scores.entries()].sort((a, b) => b[1] - a[1]).map(([m]) => m);

/** Exact model ranking (best effort per model) under the real engine. */
export function exactRanking(snapshot: Snapshot, config: IndexConfig) {
  const r = computeIndex(snapshot, { ...config, variants: "all" });
  const seen = new Set<string>(), rows: { modelId: string; name: string; score: number; variantId: string }[] = [];
  for (const x of r.ranked) if (!seen.has(x.model.id)) { seen.add(x.model.id); rows.push({ modelId: x.model.id, name: x.model.name, score: x.score, variantId: x.variant.id }); }
  return { rows, result: r };
}

const MARGIN = 0.3;
/** Rank churn among everyone except the moved models, weighted toward the top of the original order. */
export function churn(before: string[], after: string[], ignore: Set<string>, depth = 20) {
  const b = before.filter((m) => !ignore.has(m)), a = after.filter((m) => !ignore.has(m));
  const pos = new Map(a.map((m, i) => [m, i]));
  let c = 0;
  for (let i = 0; i < Math.min(depth, b.length); i++) { const j = pos.get(b[i]); c += (j == null ? depth : Math.abs(j - i)) / Math.sqrt(i + 1); }
  return c;
}
function inversionsInTop(before: string[], after: string[], ignore: Set<string>, n: number) {
  const top = before.filter((m) => !ignore.has(m)).slice(0, n), pos = new Map(after.map((m, i) => [m, i]));
  let inv = 0; for (let i = 0; i < top.length; i++) for (let j = i + 1; j < top.length; j++) if ((pos.get(top[i]) ?? 1e9) > (pos.get(top[j]) ?? 1e9)) inv++;
  return inv;
}

export type Candidate = {
  label: "smallest change" | "balanced" | "cleanest";
  shares: Shares;
  weights: Record<string, number>;
  satisfied: boolean;
  /** Total weight moved, percentage points. */
  moved: number;
  churn: number;
  metrics: MixMetrics;
  /** Exact model order (top 25) and changes vs the original. */
  ranking: { modelId: string; name: string; score: number; was: number | null }[];
};

type Eval = { shares: Shares; gap: number; dist: number; churn: number; metrics: MixMetrics; cost: number; key: string };

export function solveEdit(snapshot: Snapshot, base: IndexConfig, goal: Goal, opts: { beam?: number; depth?: number; budgetMs?: number } = {}): { candidates: Candidate[]; note: string; evaluated: number } {
  const t0 = Date.now(), budget = opts.budgetMs ?? 8000, open = () => Date.now() - t0 < budget;
  const S = surrogate(snapshot, base);
  const exclude = withFamilies(snapshot, goal.exclude ?? []), include = new Set(goal.include ?? []);
  const original = toShares(base.weights);
  let start: Shares = normalizeShares(Object.fromEntries(Object.entries(original).filter(([id]) => !exclude.has(id))));
  for (const id of include) if (!start[id]) start = { ...scaleAll(start, 0.9), [id]: 0.1 };
  const cfgFor = (sh: Shares): IndexConfig => { const weights = toWeights(sh); return { ...base, weights, required: base.required.filter((id) => !exclude.has(id) && weights[id]) }; };
  const baseRows = exactRanking(snapshot, base).rows;
  const before = baseRows.map((r) => r.modelId);
  const moved = new Set((goal.moves ?? []).map((m) => m.model));
  const pairs = movePairs(goal, before);
  const maxB = goal.maxBenchmarks ?? 12;
  let exactCount = 0;
  const exactMemo = new Map<string, Map<string, number>>();
  const keyOf = (sh: Shares) => Object.entries(toWeights(sh)).map(([id, w]) => `${id}:${w}`).sort().join(",");
  const exactScores = (sh: Shares) => {
    const k = keyOf(sh); let m = exactMemo.get(k);
    if (!m) { m = new Map(exactRanking(snapshot, cfgFor(sh)).rows.map((r) => [r.modelId, r.score])); exactMemo.set(k, m); exactCount++; }
    return m;
  };
  const costOf = (sh: Shares, scores: Map<string, number>): Eval => {
    const after = orderOf(scores);
    const gap = pairGap(pairs, scores), dist = distance(original, sh), ch = churn(before, after, moved) + entrants(before, after, moved), metrics = mixMetrics(snapshot, sh);
    const keep = goal.keepTop ? 50 * inversionsInTop(before, after, moved, goal.keepTop) : 0;
    const overCount = Math.max(0, metrics.count - maxB) * 100;
    const missingInclude = [...include].filter((id) => !sh[id]).length * 100;
    return { shares: sh, gap, dist, churn: ch, metrics, cost: 1000 * gap + 100 * dist + 2 * ch + 0.6 * metrics.complexity + keep + overCount + missingInclude, key: keyOf(sh) };
  };
  const exactEval = (sh: Shares) => costOf(normalizeShares(sh), exactScores(normalizeShares(sh)));
  /** Surrogate scores shifted by the exact-vs-surrogate residual at a nearby exact point: accurate for small moves. */
  const corrected = (sh: Shares, anchor: Shares) => {
    const ex = exactScores(anchor), su = surrogateScores(S, anchor), mine = surrogateScores(S, sh), out = new Map<string, number>();
    for (const [m, v] of mine) { const e = ex.get(m), u = su.get(m); out.set(m, e != null && u != null ? v + (e - u) : v); }
    // Models the exact engine ranks but the surrogate can't (estimates fill their gaps) keep their exact score.
    for (const [m, e] of ex) if (!out.has(m)) out.set(m, e);
    return out;
  };

  // Benchmarks most likely to produce the requested movement: where the moved model trails (or leads) the models it should fall below (rise above).
  const adds = (() => {
    if (goal.allowAdd === false) return [];
    const q = qualityOf(snapshot), order = before;
    const pairs: [string, string, 1 | -1][] = [];
    for (const m of goal.moves ?? []) {
      const others = order.filter((x) => x !== m.model);
      const lo = m.rank ?? m.minRank, hi = m.rank ?? m.maxRank;
      if (m.below) pairs.push([m.model, m.below, -1]);
      if (m.above) pairs.push([m.model, m.above, 1]);
      if (lo && lo > 1) for (const x of others.slice(Math.max(0, lo - 4), lo - 1)) pairs.push([m.model, x, -1]);
      if (hi) for (const x of others.slice(hi - 1, hi + 2)) pairs.push([m.model, x, 1]);
    }
    // Without moves (e.g. "drop TerminalBench, keep the ranking"), substitutes are benchmarks that rank the current top models alike.
    const bestOf = (col: Col, model: string) => { let best = NaN; for (let i = 0; i < S.variants.length; i++) if (S.variants[i].modelId === model && !Number.isNaN(col[i]) && !(col[i] <= best)) best = col[i]; return best; };
    const top = order.slice(0, 30);
    return addable(snapshot).filter((id) => !exclude.has(id) && !start[id]).map((id) => {
      const col = S.col(id)!;
      const cover = top.filter((m) => !Number.isNaN(bestOf(col, m))).length / Math.max(1, top.length);
      if (cover < 0.5) return { id, score: -Infinity };
      let score: number;
      if (pairs.length) {
        let help = 0, n = 0;
        for (const [m, x, dir] of pairs) { const a = bestOf(col, m), b = bestOf(col, x); if (!Number.isNaN(a) && !Number.isNaN(b)) { help += dir * (a - b); n++; } }
        score = n === pairs.length ? (help / n) * (0.5 + (q.get(id) ?? 50) / 100) : -Infinity;
      } else {
        // Rank agreement with the current top 12 (concordant pairs share).
        const t = top.slice(0, 12).map((m) => bestOf(col, m)); let c = 0, d = 0;
        for (let i = 0; i < t.length; i++) for (let j = i + 1; j < t.length; j++) if (!Number.isNaN(t[i]) && !Number.isNaN(t[j])) { if (t[i] > t[j]) c++; else d++; }
        score = c + d ? ((c - d) / (c + d)) * cover * (0.5 + (q.get(id) ?? 50) / 100) : -Infinity;
      }
      return { id, score };
    }).filter((x) => x.score > 0).sort((a, b) => b.score - a.score).slice(0, 10).map((x) => x.id);
  })();

  const neighbors = (sh: Shares): Shares[] => {
    const out: Shares[] = [];
    for (const id of Object.keys(sh)) for (const f of [0, 0.5, 0.7, 0.85, 1.2, 1.45, 1.9]) { if (f === 0 && include.has(id)) continue; const t = { ...sh, [id]: sh[id] * f }; if (f === 0) delete t[id]; if (Object.keys(t).length) out.push(normalizeShares(t)); }
    for (const id of adds) if (!sh[id]) for (const a of [0.05, 0.1, 0.15, 0.25]) out.push(normalizeShares({ ...scaleAll(sh, 1 - a), [id]: a }));
    return out;
  };

  const all = new Map<string, Eval>();
  const keep = (e: Eval) => { all.set(e.key, e); return e; };
  let beam = [keep(exactEval(start))];
  for (let d = 0; d < (opts.depth ?? 5) && open(); d++) {
    const found: Eval[] = [];
    for (const node of beam) {
      // Screen every neighbor with the corrected surrogate, then verify the most promising exactly.
      const screened = neighbors(node.shares).map((n) => costOf(n, corrected(n, node.shares))).sort((a, b) => a.cost - b.cost).slice(0, 8);
      for (const c of screened) { if (!open()) break; found.push(keep(exactEval(c.shares))); }
    }
    const next = [...new Map([...beam, ...found].map((e) => [e.key, e])).values()].sort((a, b) => a.cost - b.cost).slice(0, opts.beam ?? 3);
    const improved = next[0].cost < beam[0].cost - 1e-6;
    beam = next;
    if (!improved) break;
  }
  // Pull every changed benchmark back toward its original share while the goal still holds: smallest change.
  const pullBack = (e: Eval): Eval => {
    let cur = e;
    for (let pass = 0; pass < 2 && open(); pass++) for (const id of new Set([...Object.keys(cur.shares), ...Object.keys(original)])) {
      if (exclude.has(id) || !open()) continue;
      const target = original[id] ?? 0, now = cur.shares[id] ?? 0;
      if (Math.abs(target - now) < 5e-3) continue;
      for (const t of [1, 0.5]) {
        const sh = { ...cur.shares, [id]: now + (target - now) * t }; if (!sh[id]) delete sh[id];
        const x = keep(exactEval(sh));
        if (x.gap <= cur.gap + 1e-9 && x.cost < cur.cost - 1e-6) { cur = x; break; }
      }
    }
    return cur;
  };
  // Drop passengers (tiny shares) when that keeps the goal: simpler beats marginally better spacing.
  const simplify = (e: Eval): Eval => {
    let cur = e;
    for (const [id, v] of Object.entries(cur.shares).sort((a, b) => a[1] - b[1])) {
      if (v >= SOFT_MIN || include.has(id) || !open()) continue;
      const sh = { ...cur.shares }; delete sh[id];
      const x = keep(exactEval(sh));
      if (x.gap <= cur.gap + 1e-9 && x.cost <= cur.cost + 2) cur = x;
    }
    return cur;
  };
  for (const e of beam.slice(0, 2)) keep(simplify(pullBack(e)));

  const pool = [...all.values()];
  const solved = pool.filter((e) => e.gap === 0);
  const src = solved.length ? solved : pool;
  const pick = (label: Candidate["label"], by: (e: Eval) => number) => { const e = [...src].sort((a, b) => by(a) - by(b))[0]; return e ? { label, e } : null; };
  const picks = [
    pick("balanced", (e) => e.cost),
    pick("smallest change", (e) => e.dist * 100 + e.churn * 0.5 + e.gap * 1000),
    pick("cleanest", (e) => e.metrics.complexity + e.dist * 20 + e.churn * 0.5 + e.gap * 1000),
  ].filter((x): x is { label: Candidate["label"]; e: Eval } => !!x);
  const seen = new Set<string>();
  const wasPos = new Map(baseRows.map((r, i) => [r.modelId, i + 1]));
  const candidates: Candidate[] = [];
  for (const { label, e } of picks) {
    if (seen.has(e.key)) continue; seen.add(e.key);
    const cfg = cfgFor(e.shares), { rows } = exactRanking(snapshot, cfg);
    candidates.push({ label, shares: e.shares, weights: cfg.weights, satisfied: e.gap === 0, moved: Math.round(e.dist * 1000) / 10, churn: Math.round(e.churn * 10) / 10, metrics: e.metrics, ranking: rows.slice(0, 25).map((r) => ({ modelId: r.modelId, name: r.name, score: Math.round(r.score * 10) / 10, was: wasPos.get(r.modelId) ?? null })) });
  }
  const note = solved.length ? "" : "No mix in the search satisfied every requirement; these are the closest found. Try a looser target, allow added benchmarks, or adjust by hand with try_mix.";
  return { candidates, note, evaluated: exactCount };
}

/**
 * Moves as pairwise requirements against specific models from the original order, so a model can't
 * "drop to #5" just because two newly ranked models appeared above it.
 */
export function movePairs(goal: Goal, before: string[]): { model: string; other: string; dir: "below" | "above" }[] {
  const out: { model: string; other: string; dir: "below" | "above" }[] = [];
  for (const m of goal.moves ?? []) {
    const others = before.filter((x) => x !== m.model), cur = before.indexOf(m.model);
    if (m.below) out.push({ model: m.model, other: m.below, dir: "below" });
    if (m.above) out.push({ model: m.model, other: m.above, dir: "above" });
    const lo = m.rank ?? m.minRank, hi = m.rank ?? m.maxRank;
    if (lo && lo > 1) for (const x of others.slice(0, lo - 1)) out.push({ model: m.model, other: x, dir: "below" });
    if (hi) for (const x of others.slice(hi - 1, cur < 0 ? hi + 2 : Math.max(hi, cur))) out.push({ model: m.model, other: x, dir: "above" });
  }
  return out;
}
export function pairGap(pairs: ReturnType<typeof movePairs>, scores: Map<string, number>) {
  let gap = 0;
  for (const p of pairs) {
    const a = scores.get(p.model), b = scores.get(p.other);
    if (a == null) { gap += 50; continue; }
    if (b == null) continue; // the other model left the ranking: requirement trivially met
    gap += p.dir === "below" ? Math.max(0, a - b + MARGIN) : Math.max(0, b - a + MARGIN);
  }
  return gap;
}

/** A benchmark's family: its name without versions or punctuation ("Terminal-Bench v4.0" and AA's mirror both → "terminalbench"). */
const family = (name: string) => name.toLowerCase().replace(/\b(v?\d+(\.\d+)*|aa|real index|tier|main|extended|text)\b/g, "").replace(/[^a-z]/g, "");
/** Excluding a benchmark excludes its mirrors and other versions too, so "no TerminalBench" can't come back via a copy. */
export function withFamilies(snapshot: Snapshot, ids: string[]): Set<string> {
  const out = new Set(ids), fams = new Set(ids.map((id) => snapshot.benchmarks.find((b) => b.id === id)).filter((b) => !!b).flatMap((b) => [family(b.name), family(b.shortName ?? b.name)]).filter((f) => f.length >= 4));
  for (const b of snapshot.benchmarks) if (fams.has(family(b.name)) || fams.has(family(b.shortName ?? b.name))) out.add(b.id);
  return out;
}

/** New faces in the top 20 that weren't ranked (or were far lower) before. */
function entrants(before: string[], after: string[], ignore: Set<string>, depth = 20) {
  const was = new Map(before.map((m, i) => [m, i]));
  let c = 0;
  after.slice(0, depth).forEach((m, i) => { if (ignore.has(m)) return; const w = was.get(m); if (w == null || w >= depth) c += (depth - i) / Math.sqrt(i + 1); });
  return c;
}

function scaleAll(sh: Shares, f: number): Shares { return Object.fromEntries(Object.entries(sh).map(([id, v]) => [id, v * f])); }
function normalizeShares(sh: Shares): Shares {
  const e = Object.entries(sh).filter(([, v]) => v > 1e-4), sum = e.reduce((n, [, v]) => n + v, 0) || 1;
  return Object.fromEntries(e.map(([id, v]) => [id, v / sum]));
}

/** Per-benchmark breakdown of a model's score and its gap to neighbors (exact engine values). */
export function explainModel(snapshot: Snapshot, config: IndexConfig, modelId: string) {
  const { rows, result } = exactRanking(snapshot, config);
  const idx = rows.findIndex((r) => r.modelId === modelId);
  if (idx < 0) return null;
  const shares = toShares(config.weights);
  const byVariant = new Map(result.ranked.map((r) => [r.variant.id, r]));
  const valuesOf = (variantId: string) => new Map((byVariant.get(variantId)?.values ?? []).map((v) => [v.benchmarkId, v]));
  const me = valuesOf(rows[idx].variantId);
  const above = rows[idx - 1], below = rows[idx + 1];
  const va = above ? valuesOf(above.variantId) : null, vb = below ? valuesOf(below.variantId) : null;
  const names = new Map(snapshot.benchmarks.map((b) => [b.id, b.shortName ?? b.name]));
  const benchRank = (id: string, value: number) => { let n = 1; const seen = new Set<string>(); for (const r of result.ranked) { if (seen.has(r.model.id)) continue; seen.add(r.model.id); const v = r.values.find((x) => x.benchmarkId === id); if (v && v.value > value + 1e-9) n++; } return n; };
  return {
    model: rows[idx].name, rank: idx + 1, score: +rows[idx].score.toFixed(1),
    above: above ? { name: above.name, score: +above.score.toFixed(1) } : null,
    below: below ? { name: below.name, score: +below.score.toFixed(1) } : null,
    benchmarks: Object.entries(shares).map(([id, s]) => {
      const v = me.get(id);
      const vsAbove = v && va?.get(id) ? +(s * (v.value - va.get(id)!.value)).toFixed(2) : null;
      const vsBelow = v && vb?.get(id) ? +(s * (v.value - vb.get(id)!.value)).toFixed(2) : null;
      return { id, name: names.get(id) ?? id, share: +(s * 100).toFixed(1), value: v ? +v.value.toFixed(1) : null, estimated: v?.estimated ?? null, rankOnBenchmark: v ? benchRank(id, v.value) : null, pullVsAbove: vsAbove, pullVsBelow: vsBelow };
    }).sort((a, b) => (b.share ?? 0) - (a.share ?? 0)),
  };
}

/** Benchmarks (in or out of the mix) where a model is unusually strong or weak relative to a comparison set. */
export function benchmarksFor(snapshot: Snapshot, config: IndexConfig, modelId: string, direction: "strong" | "weak", against?: string[], limit = 8) {
  const S = surrogate(snapshot, config), q = qualityOf(snapshot);
  const current = orderOf(surrogateScores(S, toShares(config.weights)));
  const comp = (against?.length ? against : current.filter((m) => m !== modelId).slice(0, 10));
  const names = new Map(snapshot.benchmarks.map((b) => [b.id, b.shortName ?? b.name]));
  const best = (col: Col, model: string) => { let b = NaN; for (let i = 0; i < S.variants.length; i++) if (S.variants[i].modelId === model && !Number.isNaN(col[i]) && !(col[i] <= b)) b = col[i]; return b; };
  const inMix = toShares(config.weights);
  return addable(snapshot).map((id) => {
    const col = S.col(id)!, mine = best(col, modelId);
    if (Number.isNaN(mine)) return null;
    const vals = comp.map((m) => best(col, m)).filter((x) => !Number.isNaN(x));
    if (vals.length < Math.min(4, comp.length)) return null;
    const mean = vals.reduce((n, x) => n + x, 0) / vals.length, rank = 1 + vals.filter((x) => x > mine).length;
    return { id, name: names.get(id) ?? id, inMixShare: inMix[id] ? +(inMix[id] * 100).toFixed(1) : 0, modelValue: +mine.toFixed(1), comparisonMean: +mean.toFixed(1), edge: +(mine - mean).toFixed(1), rankAmongComparison: `${rank}/${vals.length + 1}`, quality: Math.round(q.get(id) ?? 50) };
  }).filter((x): x is NonNullable<typeof x> => !!x).sort((a, b) => direction === "strong" ? b.edge - a.edge : a.edge - b.edge).slice(0, limit);
}
