/**
 * Pairwise ranking, tuned for few calls. Seeds are the index's top models, best first.
 * 1. The top group (default 5) is sorted with a merge bracket: neighbours meet first, and before
 *    each merge the weakest of the stronger group meets the best of the other, so agreeing with
 *    the index settles a merge in one call.
 * 2. Each challenger (the next 7 seeds) meets the current last place of the top group; a winner
 *    is placed by binary search and bumps that last place out. Seeds after the challengers keep
 *    index order — the ranking is editable afterwards, and the fit cares most about the top.
 * Agreeing with the index takes 11 calls; nothing takes more than the cap (15), after which
 * remaining matches follow index order. "Not sure" defers that match to index order. Pairs implied
 * by earlier calls are never asked. Optional double-checks of inferred pairs can expose loops;
 * the final order then breaks the fewest calls, ties going to the index. With `top: n` this is
 * a full merge-sort bracket (the earlier behaviour).
 *
 * A pure replay of `answers`, so undo is just dropping the last answer.
 */
export type Answer = { a: string; b: string; winner: string | null; check?: boolean; auto?: boolean };
export type BracketStep = {
  done: boolean;
  /** [left, right] for the next match. */
  pair?: [string, string];
  check: boolean;
  round: string;
  level: number;
  levels: number;
  /** 0–1. */
  progress: number;
  asked: number;
  unsure: number;
  /** Current groups, best first; a finished bracket has one. */
  blocks: string[][];
  order: string[];
  /** Calls the final order had to overrule to resolve loops. */
  loops: number;
};

const ROUND_NAMES = ["Final", "Semifinals", "Quarterfinals", "Round of 16", "Round of 32", "Round of 64"];
export const pairKey = (a: string, b: string) => (a < b ? `${a}|${b}` : `${b}|${a}`);
function hash(s: string) { let h = 2166136261; for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619); return h >>> 0; }
/** Sides are stable per pair but not seed-ordered, so left isn't always the index favourite. */
const sides = (a: string, b: string): [string, string] => (hash(pairKey(a, b)) & 1 ? [b, a] : [a, b]);

class Need { constructor(readonly a: string, readonly b: string) {} }

export function roundName(level: number, levels: number, check = false) {
  return check ? "Double-check" : ROUND_NAMES[levels - level] ?? `Round ${level}`;
}

export type BracketOptions = {
  /** Size of the fully sorted top group (default 6); `seeds.length` sorts everything. */
  top?: number;
  /** Seeds after the top group that get one chance to break into it (default 6). Later seeds keep index order. */
  challengers?: number;
  /** Double-checks of inferred pairs near the top (default 0). */
  checks?: number;
  /** After this many answers, every remaining match goes to index order (default 15). */
  cap?: number;
};
export const QUICK: Required<BracketOptions> = { top: 5, challengers: 7, checks: 0, cap: 15 };

export function runBracket(seeds: string[], answers: Answer[], opts: BracketOptions = {}): BracketStep {
  const n = seeds.length;
  const top = Math.max(1, Math.min(n, opts.top ?? QUICK.top));
  const challengers = Math.max(0, Math.min(n - top, opts.challengers ?? QUICK.challengers));
  const checks = opts.checks ?? QUICK.checks;
  const cap = opts.cap ?? (top < n ? QUICK.cap : Infinity);
  const levels = Math.max(1, Math.ceil(Math.log2(Math.max(2, top))));
  const rank = new Map(seeds.map((id, i) => [id, i]));
  const direct = new Map<string, string | null>();
  const beats = new Map<string, Set<string>>();
  for (const x of answers) {
    direct.set(pairKey(x.a, x.b), x.winner);
    if (!x.winner) continue;
    const loser = x.winner === x.a ? x.b : x.a;
    if (!beats.has(x.winner)) beats.set(x.winner, new Set());
    beats.get(x.winner)!.add(loser);
  }
  const reaches = (from: string, to: string) => {
    const seen = new Set([from]); const stack = [from];
    while (stack.length) for (const next of beats.get(stack.pop()!) ?? []) { if (next === to) return true; if (!seen.has(next)) { seen.add(next); stack.push(next); } }
    return false;
  };
  const above = (a: string, b: string) => {
    const k = pairKey(a, b);
    if (direct.has(k)) { const w = direct.get(k); return w ? w === a : rank.get(a)! < rank.get(b)!; }
    if (reaches(a, b)) return true;
    if (reaches(b, a)) return false;
    if (answers.length >= cap) return rank.get(a)! < rank.get(b)!;
    throw new Need(a, b);
  };
  const real = answers.filter((x) => !x.auto).length;
  const base = { asked: real, unsure: answers.filter((x) => !x.winner && !x.auto).length, levels };
  const tail = seeds.slice(top + challengers);
  let blocks = seeds.slice(0, top).map((s) => [s]);
  let level = 0;
  let view: () => string[][] = () => blocks;
  // Remaining matches, at least one per pending merge and challenger; drives the progress bar.
  let pending = () => 0;
  let round = "";
  try {
    // 1. Sort the top group with a merge bracket.
    round = top < n ? `Your top ${top}` : "";
    while (blocks.length > 1) {
      level++;
      if (!round) round = roundName(level, levels);
      const next: string[][] = [];
      for (let i = 0; i < blocks.length; i += 2) {
        const A = blocks[i], B = blocks[i + 1];
        if (!B) { next.push(A); continue; }
        const out: string[] = [];
        let ai = 0, bi = 0;
        view = () => [[...next.flat(), ...out, ...A.slice(ai), ...B.slice(bi), ...blocks.slice(i + 2).flat()], seeds.slice(top, top + challengers), tail].filter((b) => b.length);
        pending = () => Math.ceil((blocks.length - i) / 2) + Math.max(0, Math.ceil(Math.log2(next.length + Math.ceil((blocks.length - i) / 2))) - 1) + challengers;
        if (top === n) view = () => [...next, [...out, ...A.slice(ai), ...B.slice(bi)], ...blocks.slice(i + 2)];
        if (above(A[A.length - 1], B[0])) out.push(...A, ...B);
        else {
          while (ai < A.length && bi < B.length) out.push(above(A[ai], B[bi]) ? A[ai++] : B[bi++]);
          out.push(...A.slice(ai), ...B.slice(bi));
        }
        next.push(out);
      }
      blocks = next;
      if (top === n) round = "";
    }
    // 2. Each challenger meets the current #top; a winner is placed by binary search and bumps the last.
    const L = [...(blocks[0] ?? [])];
    const rest: string[] = [];
    for (let c = 0; c < challengers; c++) {
      const id = seeds[top + c];
      round = "Challengers";
      view = () => [L, [...rest, ...seeds.slice(top + c, top + challengers)].sort((a, b) => rank.get(a)! - rank.get(b)!), tail].filter((b) => b.length);
      pending = () => challengers - c;
      if (above(L[L.length - 1], id)) { rest.push(id); continue; }
      let lo = 0, hi = L.length - 1;
      while (lo < hi) { const mid = (lo + hi) >> 1; if (above(id, L[mid])) hi = mid; else lo = mid + 1; }
      L.splice(lo, 0, id);
      rest.push(L.pop()!);
    }
    const order = [...L, ...rest.sort((a, b) => rank.get(a)! - rank.get(b)!), ...tail];
    view = () => [order];
    const asked = answers.filter((x) => x.check).length;
    if (asked < checks && answers.length < cap) {
      for (let i = 0; i + 2 < Math.min(L.length, 6); i++) {
        if (!direct.has(pairKey(order[i], order[i + 2]))) { round = "Double-check"; pending = () => checks - asked; throw Object.assign(new Need(order[i], order[i + 2]), { check: true }); }
      }
    }
    const final = resolve(order, answers, rank);
    return { ...base, done: true, check: false, round: "Your ranking", level: levels, progress: 1, blocks: [final.order], order: final.order, loops: final.loops };
  } catch (e) {
    if (!(e instanceof Need)) throw e;
    const check = (e as Need & { check?: boolean }).check === true;
    const progress = Math.max(answers.length / cap, answers.length / (answers.length + pending() + 1));
    return { ...base, done: false, pair: sides(e.a, e.b), check, round, level, progress: Math.min(0.95, progress), blocks: view(), order: view().flat(), loops: 0 };
  }
}

/** Fewest broken calls; "not sure" calls lean lightly toward seed order; then closest to the index. */
function resolve(start: string[], answers: Answer[], rank: Map<string, number>) {
  const edges = answers.filter((x) => x.winner || !x.check).map((x) => x.winner
    ? { hi: x.winner, lo: x.winner === x.a ? x.b : x.a, w: 1 }
    : rank.get(x.a)! < rank.get(x.b)! ? { hi: x.a, lo: x.b, w: 0.2 } : { hi: x.b, lo: x.a, w: 0.2 });
  const cost = (order: string[]) => {
    const pos = new Map(order.map((id, i) => [id, i]));
    let broken = 0, loops = 0, tau = 0;
    for (const e of edges) if (pos.get(e.hi)! > pos.get(e.lo)!) { broken += e.w; if (e.w === 1) loops++; }
    for (let i = 0; i < order.length; i++) for (let j = i + 1; j < order.length; j++) if (rank.get(order[i])! > rank.get(order[j])!) tau++;
    return { broken, loops, tau };
  };
  let best = start, bestCost = cost(start);
  if (bestCost.broken === 0) return { order: best, loops: 0 };
  for (let improved = true, rounds = 0; improved && rounds < 40; rounds++) {
    improved = false;
    for (let i = 0; i < best.length; i++) for (let j = 0; j < best.length; j++) {
      if (i === j) continue;
      const next = [...best]; const [id] = next.splice(i, 1); next.splice(j, 0, id);
      const c = cost(next);
      if (c.broken < bestCost.broken - 1e-9 || (Math.abs(c.broken - bestCost.broken) < 1e-9 && c.tau < bestCost.tau)) { best = next; bestCost = c; improved = true; }
    }
  }
  return { order: best, loops: bestCost.loops };
}

/** Answers every remaining match with "not sure", letting the index place the rest. */
export function finishWithIndex(seeds: string[], answers: Answer[], opts?: BracketOptions): Answer[] {
  const out = [...answers];
  for (let step = runBracket(seeds, out, opts), guard = 0; !step.done && step.pair && guard < 400; step = runBracket(seeds, out, opts), guard++) {
    const [a, b] = step.pair;
    const winner = step.check ? (step.order.indexOf(a) < step.order.indexOf(b) ? a : b) : null;
    out.push({ a, b, winner, check: step.check, auto: true });
  }
  return out;
}
