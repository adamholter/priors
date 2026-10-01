/**
 * Pairwise bracket. Seeds (the index's top models, best first) play a merge-sort tournament:
 * neighbours meet in the first round and each later round merges two sorted groups. Before a
 * merge, the weakest of the stronger group meets the best of the other; when the user agrees
 * with the seeds that single match settles the whole merge, so a fully agreeing user ranks 16
 * models in 15 calls. "Not sure" defers that match to seed order. Pairs implied by earlier calls
 * are never asked, except for a couple of double-checks near the top; a contradiction there is
 * a loop, and the final order minimizes broken calls, breaking remaining ties toward the index.
 *
 * The bracket is a pure replay of `answers`, so undo is just dropping the last answer.
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

export const CHECKS = 2;
const ROUND_NAMES = ["Final", "Semifinals", "Quarterfinals", "Round of 16", "Round of 32", "Round of 64"];
export const pairKey = (a: string, b: string) => (a < b ? `${a}|${b}` : `${b}|${a}`);
function hash(s: string) { let h = 2166136261; for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619); return h >>> 0; }
/** Sides are stable per pair but not seed-ordered, so left isn't always the index favourite. */
const sides = (a: string, b: string): [string, string] => (hash(pairKey(a, b)) & 1 ? [b, a] : [a, b]);

class Need { constructor(readonly a: string, readonly b: string) {} }

export function roundName(level: number, levels: number, check = false) {
  return check ? "Double-check" : ROUND_NAMES[levels - level] ?? `Round ${level}`;
}

export function runBracket(seeds: string[], answers: Answer[], checks = CHECKS): BracketStep {
  const n = seeds.length;
  const levels = Math.max(1, Math.ceil(Math.log2(Math.max(2, n))));
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
    throw new Need(a, b);
  };
  const base = { asked: answers.filter((x) => !x.auto).length, unsure: answers.filter((x) => !x.winner && !x.auto).length, levels };
  const units = n * levels + checks * 2;
  let blocks = seeds.map((s) => [s]);
  let level = 0, work = 0;
  let view: () => string[][] = () => blocks;
  let partial = 0;
  try {
    while (blocks.length > 1) {
      level++;
      const next: string[][] = [];
      for (let i = 0; i < blocks.length; i += 2) {
        const A = blocks[i], B = blocks[i + 1];
        if (!B) { next.push(A); work += A.length; continue; }
        const out: string[] = [];
        let ai = 0, bi = 0;
        view = () => [...next, [...out, ...A.slice(ai), ...B.slice(bi)], ...blocks.slice(i + 2)];
        partial = 0;
        if (above(A[A.length - 1], B[0])) out.push(...A, ...B);
        else {
          while (ai < A.length && bi < B.length) { out.push(above(A[ai], B[bi]) ? A[ai++] : B[bi++]); partial = out.length; }
          out.push(...A.slice(ai), ...B.slice(bi));
        }
        next.push(out);
        work += out.length;
      }
      blocks = next;
    }
    view = () => blocks;
    const order = blocks[0] ?? [];
    const asked = answers.filter((x) => x.check).length;
    if (asked < checks) {
      for (let i = 0; i + 2 < Math.min(order.length, 6); i++) {
        if (!direct.has(pairKey(order[i], order[i + 2]))) throw Object.assign(new Need(order[i], order[i + 2]), { check: true });
      }
    }
    const final = resolve(order, answers, rank);
    return { ...base, done: true, check: false, round: "Your ranking", level: levels, progress: 1, blocks: [final.order], order: final.order, loops: final.loops };
  } catch (e) {
    if (!(e instanceof Need)) throw e;
    const check = (e as Need & { check?: boolean }).check === true;
    const progress = check ? (n * levels + answers.filter((x) => x.check).length * 2 + 1) / units : (work + partial) / units;
    return { ...base, done: false, pair: sides(e.a, e.b), check, round: roundName(level, levels, check), level, progress: Math.min(0.98, progress), blocks: view(), order: view().flat(), loops: 0 };
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
export function finishWithIndex(seeds: string[], answers: Answer[]): Answer[] {
  const out = [...answers];
  for (let step = runBracket(seeds, out), guard = 0; !step.done && step.pair && guard < 400; step = runBracket(seeds, out), guard++) {
    const [a, b] = step.pair;
    const winner = step.check ? (step.order.indexOf(a) < step.order.indexOf(b) ? a : b) : null;
    out.push({ a, b, winner, check: step.check, auto: true });
  }
  return out;
}
