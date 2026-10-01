import { describe, expect, it } from "vitest";
import { finishWithIndex, runBracket, type Answer } from "./bracket";

const seeds = Array.from({ length: 16 }, (_, i) => `m${String(i + 1).padStart(2, "0")}`);
/** Plays the bracket against a judge; returns the final step and the number of calls. */
function play(judge: (a: string, b: string) => string | null, list = seeds) {
  const answers: Answer[] = [];
  let step = runBracket(list, answers);
  while (!step.done) {
    const [a, b] = step.pair!;
    answers.push({ a, b, winner: judge(a, b), check: step.check });
    step = runBracket(list, answers);
    if (answers.length > 120) throw new Error("bracket did not finish");
  }
  return { step, answers };
}
function shuffled(seed: number) {
  const out = [...seeds]; let s = seed;
  for (let i = out.length - 1; i > 0; i--) { s = (s * 1103515245 + 12345) % 2 ** 31; const j = s % (i + 1); [out[i], out[j]] = [out[j], out[i]]; }
  return out;
}

describe("runBracket", () => {
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
    let s = runBracket(seeds, answers);
    while (!s.done) { const [a, b] = s.pair!; answers.push({ a, b, winner: s.check ? (a < b ? b : a) : (a < b ? a : b), check: s.check }); s = runBracket(seeds, answers); }
    expect(s.loops).toBeGreaterThan(0);
    expect([...s.order].sort()).toEqual([...step.order].sort());
  });

  it("undo is a replay without the last answer", () => {
    const answers: Answer[] = [];
    const first = runBracket(seeds, answers);
    answers.push({ a: first.pair![0], b: first.pair![1], winner: first.pair![1] });
    expect(runBracket(seeds, answers.slice(0, -1)).pair).toEqual(first.pair);
  });

  it("finishes with the index from any point", () => {
    const pos = new Map(shuffled(3).map((id, i) => [id, i]));
    const { answers } = play((a, b) => (pos.get(a)! < pos.get(b)! ? a : b));
    const partial = answers.slice(0, 6);
    const done = runBracket(seeds, finishWithIndex(seeds, partial));
    expect(done.done).toBe(true);
    expect(done.asked).toBe(6);
    expect(done.order).toHaveLength(16);
  });

  it("handles small and uneven lineups", () => {
    for (const n of [2, 3, 5, 11]) {
      const list = seeds.slice(0, n);
      expect(play((a, b) => (a > b ? a : b), list).step.order).toEqual([...list].reverse());
    }
  });
});
