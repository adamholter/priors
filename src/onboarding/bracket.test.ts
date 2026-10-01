import { describe, expect, it } from "vitest";
import { finishWithIndex, runBracket, type Answer, type BracketOptions } from "./bracket";

const seeds = Array.from({ length: 16 }, (_, i) => `m${String(i + 1).padStart(2, "0")}`);
/** Plays the bracket against a judge; returns the final step and the number of calls. */
const FULL = (n = 16): BracketOptions => ({ top: n, checks: 2 });
function play(judge: (a: string, b: string) => string | null, list = seeds, opts: BracketOptions = FULL(list.length)) {
  const answers: Answer[] = [];
  let step = runBracket(list, answers, opts);
  while (!step.done) {
    const [a, b] = step.pair!;
    answers.push({ a, b, winner: judge(a, b), check: step.check });
    step = runBracket(list, answers, opts);
    if (answers.length > 120) throw new Error("bracket did not finish");
  }
  return { step, answers };
}
function shuffled(seed: number) {
  const out = [...seeds]; let s = seed;
  for (let i = out.length - 1; i > 0; i--) { s = (s * 1103515245 + 12345) % 2 ** 31; const j = s % (i + 1); [out[i], out[j]] = [out[j], out[i]]; }
  return out;
}

describe("runBracket full sort", () => {
  it("ranks 16 models in 15 calls plus double-checks when the user agrees with the index", () => {
    const { step, answers } = play((a, b) => (a < b ? a : b));
    expect(step.order).toEqual(seeds);
    expect(answers.filter((x) => !x.check)).toHaveLength(15);
    expect(answers.filter((x) => x.check)).toHaveLength(2);
    expect(step.loops).toBe(0);
  });

  it("recovers any consistent preference exactly", () => {
    for (let t = 1; t <= 25; t++) {
      const truth = shuffled(t);
      const pos = new Map(truth.map((id, i) => [id, i]));
      const { step, answers } = play((a, b) => (pos.get(a)! < pos.get(b)! ? a : b));
      expect(step.order).toEqual(truth);
      expect(answers.length).toBeLessThanOrEqual(58);
      expect(new Set(answers.map((x) => [x.a, x.b].sort().join())).size).toBe(answers.length);
    }
  });

  it("falls back to index order for every unsure call", () => {
    const { step } = play(() => null);
    expect(step.order).toEqual(seeds);
    expect(step.unsure).toBe(step.asked);
  });

  it("resolves loops instead of failing", () => {
    // Agrees with the index, except it rejects every double-check — a cycle.
    const { step } = play((a, b) => (a < b ? a : b));
    const answers: Answer[] = [];
    let s = runBracket(seeds, answers, FULL());
    while (!s.done) { const [a, b] = s.pair!; answers.push({ a, b, winner: s.check ? (a < b ? b : a) : (a < b ? a : b), check: s.check }); s = runBracket(seeds, answers, FULL()); }
    expect(s.loops).toBeGreaterThan(0);
    expect([...s.order].sort()).toEqual([...step.order].sort());
  });

  it("undo is a replay without the last answer", () => {
    const answers: Answer[] = [];
    const first = runBracket(seeds, answers);
    answers.push({ a: first.pair![0], b: first.pair![1], winner: first.pair![1] });
    expect(runBracket(seeds, answers.slice(0, -1)).pair).toEqual(first.pair);
    expect(runBracket(seeds, answers).pair).not.toEqual(first.pair);
  });

  it("finishes with the index from any point", () => {
    const pos = new Map(shuffled(3).map((id, i) => [id, i]));
    const { answers } = play((a, b) => (pos.get(a)! < pos.get(b)! ? a : b));
    const partial = answers.slice(0, 6);
    const done = runBracket(seeds, finishWithIndex(seeds, partial, FULL()), FULL());
    expect(done.done).toBe(true);
    expect(done.asked).toBe(6);
    expect(done.order).toHaveLength(16);
  });

  it("handles small and uneven lineups", () => {
    for (const n of [2, 3, 5, 11]) {
      const list = seeds.slice(0, n);
      expect(play((a, b) => (a > b ? a : b), list).step.order).toEqual([...list].reverse());
      expect(play((a, b) => (a > b ? a : b), list, {}).step.order).toHaveLength(n);
    }
  });
});

describe("runBracket quick (default)", () => {
  const judgeFor = (truth: string[]) => (a: string, b: string) => (truth.indexOf(a) < truth.indexOf(b) ? a : b);
  const mv = (l: string[], from: number, to: number) => { const o = [...l]; const [x] = o.splice(from, 1); o.splice(to, 0, x); return o; };

  it("takes 11 calls when the user agrees with the index", () => {
    const { step, answers } = play(judgeFor(seeds), seeds, {});
    expect(answers).toHaveLength(11);
    expect(step.order).toEqual(seeds);
  });

  it("lets a lower model break into the top and finds its place", () => {
    for (const [from, to] of [[11, 1], [4, 0], [0, 5], [9, 3]]) {
      const truth = mv(seeds, from, to);
      const { step, answers } = play(judgeFor(truth), seeds, {});
      expect(step.order.slice(0, 5)).toEqual(truth.slice(0, 5));
      expect(answers.length).toBeLessThanOrEqual(15);
    }
  });

  it("never asks more than the cap", () => {
    for (let t = 1; t <= 25; t++) {
      const truth = shuffled(t);
      const { step, answers } = play(judgeFor(truth), seeds, {});
      expect(answers.length).toBeLessThanOrEqual(15);
      expect([...step.order].sort()).toEqual([...seeds]);
    }
  });

  it("keeps models after the challengers in index order", () => {
    const { step } = play(judgeFor([...seeds].reverse()), seeds, {});
    expect(step.order.slice(-4)).toEqual(seeds.slice(-4));
  });
});
