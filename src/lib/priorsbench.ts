/**
 * PriorsBench: what Priors visitors believe, as a leaderboard. Every finished ranking on /rank (`convex/lineups.ts`) puts a lineup
 * of models in order, best first; each ordered pair in it counts as one vote that the higher model is better. The votes are fitted
 * with a Bradley-Terry model, the method behind arena leaderboards, and shown on an Elo scale. Shared by the scraper source
 * (`scripts/scrape/sources/priorsbench.ts`), which files the ratings as an ordinary board, and the /priorsbench page.
 *
 * - A ranking of n models gives n(n-1)/2 pairs, each weighted 1/(n-1), so a long lineup is not worth many short ones.
 * - The same lineup saved again within a day is one ranking (people refit, go back, save twice).
 * - Older rankings count less: a ranking's weight halves every `HALF_LIFE_DAYS`, so the board follows what people think now.
 * - Every model also plays one virtual game, drawn, against a fixed 1000-rated opponent. That keeps a model seen in few
 *   rankings near the middle instead of at an extreme, and pins the scale so ratings on different days line up.
 * - The rankings are anonymous, so the votes are untrusted: only the focuses the page offers count, and a day with far more rankings
 *   than usual (`BURST`) is scaled down to that cap, so a flood of saved rankings cannot move the board much on its own.
 */
import { FOCUS_IDS } from "@/data/types";

export const PRIORSBENCH_ID = "priorsbench";
export const PRIORSBENCH_URL = "https://mypriors.com/priorsbench";
/** Production Convex, the same public address the site's client uses. */
export const PRIORS_CONVEX_URL = "https://small-eel-326.convex.cloud";
export const HALF_LIFE_DAYS = 30;
/** Rankings a model needs, in the weighted window, to get a rating. */
export const MIN_RANKINGS = 15;
const DAY = 86_400_000;
/** A day counts as at most this many times the median day, and never less than `BURST_FLOOR` rankings. */
const BURST = 3, BURST_FLOOR = 60;
const FOCUSES = new Set<string>(FOCUS_IDS);

export interface Ranking { lineup: string[]; focus: string; createdAt: number }
export interface Rating { modelId: string; rating: number; ci?: [number, number]; rankings: number; weight: number }

/** Reads every finished ranking from Convex's public HTTP query API, a page at a time. */
export async function fetchRankings(convexUrl = PRIORS_CONVEX_URL, fetchJson: (url: string, init: RequestInit) => Promise<unknown> = async (url, init) => (await fetch(url, init)).json()): Promise<Ranking[]> {
  const out: Ranking[] = [];
  let cursor: string | null = null;
  for (let page = 0; page < 200; page++) {
    const res = await fetchJson(`${convexUrl}/api/query`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ path: "lineups:forBench", args: { paginationOpts: { numItems: 1000, cursor } }, format: "json" }) }) as { status?: string; value?: { page: Ranking[]; isDone: boolean; continueCursor: string }; errorMessage?: string };
    if (res.status !== "success" || !res.value) throw new Error(`PriorsBench: Convex query failed: ${res.errorMessage ?? JSON.stringify(res).slice(0, 200)}`);
    out.push(...res.value.page);
    if (res.value.isDone) return out;
    cursor = res.value.continueCursor;
  }
  throw new Error("PriorsBench: too many pages");
}

/** Drops a ranking that repeats the same focus and lineup within a day of the last copy kept. */
export function dedupe(rankings: Ranking[]): Ranking[] {
  const last = new Map<string, number>();
  return [...rankings].sort((a, b) => a.createdAt - b.createdAt).filter((r) => {
    const key = `${r.focus}|${r.lineup.join(",")}`, prev = last.get(key);
    if (prev != null && r.createdAt - prev < DAY) return false;
    last.set(key, r.createdAt);
    return true;
  });
}

interface Fit { ids: string[]; strength: Float64Array; rankings: Map<string, number>; weight: Map<string, number> }

/** Per ranking, the share of its weight it keeps once its day is capped at `BURST` times the median day. */
function dayScale(rankings: Ranking[]): Map<Ranking, number> {
  const byDay = new Map<number, Ranking[]>();
  for (const r of rankings) { const d = Math.floor(r.createdAt / DAY), list = byDay.get(d); if (list) list.push(r); else byDay.set(d, [r]); }
  const sizes = [...byDay.values()].map((l) => l.length).sort((a, b) => a - b);
  const cap = Math.max(BURST_FLOOR, BURST * (sizes[Math.floor(sizes.length / 2)] ?? 0));
  const out = new Map<Ranking, number>();
  for (const list of byDay.values()) for (const r of list) out.set(r, Math.min(1, cap / list.length));
  return out;
}

function fit(rankings: Ranking[], asOf: number, known?: (id: string) => boolean): Fit {
  const scale = dayScale(rankings);
  const index = new Map<string, number>(), ids: string[] = [];
  const at = (id: string) => { let i = index.get(id); if (i == null) { i = ids.length; index.set(id, i); ids.push(id); } return i; };
  const pairs = new Map<number, number>(), counts = new Map<string, number>(), weights = new Map<string, number>();
  for (const r of rankings) {
    if (r.createdAt > asOf) continue;
    const lineup = r.lineup.filter((id, k, all) => all.indexOf(id) === k && (!known || known(id)));
    if (lineup.length < 2) continue;
    const decay = 0.5 ** ((asOf - r.createdAt) / (HALF_LIFE_DAYS * DAY)) * (scale.get(r) ?? 1), w = decay / (lineup.length - 1);
    for (const id of lineup) { counts.set(id, (counts.get(id) ?? 0) + 1); weights.set(id, (weights.get(id) ?? 0) + decay); }
    const slots = lineup.map(at);
    // Key: winner * 4096 + loser.
    for (let a = 0; a < slots.length; a++) for (let b = a + 1; b < slots.length; b++) { const k = slots[a] * 4096 + slots[b]; pairs.set(k, (pairs.get(k) ?? 0) + w); }
  }
  const n = ids.length, wins = new Float64Array(n), games: { i: number; j: number; w: number }[] = [];
  const both = new Map<number, number>();
  for (const [k, w] of pairs) {
    const i = Math.floor(k / 4096), j = k % 4096;
    wins[i] += w;
    const key = Math.min(i, j) * 4096 + Math.max(i, j);
    both.set(key, (both.get(key) ?? 0) + w);
  }
  for (const [k, w] of both) games.push({ i: Math.floor(k / 4096), j: k % 4096, w });
  // Minorization-maximization (Hunter 2004), with one drawn virtual game against a strength-1 (1000-rated) opponent per model.
  let p = new Float64Array(n).fill(1);
  for (let iter = 0; iter < 300; iter++) {
    const denom = new Float64Array(n);
    for (const g of games) { const d = g.w / (p[g.i] + p[g.j]); denom[g.i] += d; denom[g.j] += d; }
    const next = new Float64Array(n);
    let change = 0;
    for (let i = 0; i < n; i++) { next[i] = (wins[i] + 0.5) / (denom[i] + 1 / (p[i] + 1)); change = Math.max(change, Math.abs(Math.log(next[i] / p[i]))); }
    p = next;
    if (change < 1e-7) break;
  }
  return { ids, strength: p, rankings: counts, weight: weights };
}

const elo = (strength: number) => 1000 + 400 * Math.log10(strength);
const round1 = (x: number) => Math.round(x * 10) / 10;

/** Ratings as of `asOf`, best first, for models with at least `MIN_RANKINGS` rankings; `bootstrap` resamples give a 95% interval. */
export function rate(rankings: Ranking[], { asOf = Date.now(), bootstrap = 0, known, seed = 1 }: { asOf?: number; bootstrap?: number; known?: (id: string) => boolean; seed?: number } = {}): Rating[] {
  const kept = dedupe(rankings).filter((r) => r.createdAt <= asOf && FOCUSES.has(r.focus));
  const f = fit(kept, asOf, known);
  const out: Rating[] = f.ids.map((id, i) => ({ modelId: id, rating: round1(elo(f.strength[i])), rankings: f.rankings.get(id) ?? 0, weight: round1(f.weight.get(id) ?? 0) })).filter((r) => r.rankings >= MIN_RANKINGS);
  if (bootstrap > 0 && kept.length > 0) {
    let s = seed >>> 0 || 1;
    const rand = () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296);
    const samples = new Map<string, number[]>();
    for (let b = 0; b < bootstrap; b++) {
      const resample = kept.map(() => kept[Math.floor(rand() * kept.length)]);
      const g = fit(resample, asOf, known);
      g.ids.forEach((id, i) => { const list = samples.get(id) ?? []; list.push(elo(g.strength[i])); samples.set(id, list); });
    }
    for (const r of out) {
      const list = (samples.get(r.modelId) ?? []).sort((a, b) => a - b);
      if (list.length >= bootstrap / 2) r.ci = [round1(list[Math.floor(list.length * 0.025)]), round1(list[Math.min(list.length - 1, Math.floor(list.length * 0.975))])];
    }
  }
  return out.sort((a, b) => b.rating - a.rating);
}

/** The board at the end of each week since the first ranking: what the ratings were on that day, with only the rankings made by then. */
export function history(rankings: Ranking[], { now = Date.now(), known }: { now?: number; known?: (id: string) => boolean } = {}): { date: string; ratings: Rating[] }[] {
  if (!rankings.length) return [];
  const first = Math.min(...rankings.map((r) => r.createdAt));
  const out: { date: string; ratings: Rating[] }[] = [];
  for (let t = first + 7 * DAY; ; t += 7 * DAY) {
    const asOf = Math.min(t, now);
    out.push({ date: new Date(asOf).toISOString().slice(0, 10), ratings: rate(rankings, { asOf, known }) });
    if (asOf === now) return out;
  }
}
