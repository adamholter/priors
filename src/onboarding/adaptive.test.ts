import { describe, expect, it } from "vitest";
import type { Model } from "@/data/types";
import { runAdaptive, versionAssumptions, type RankingEvidence } from "./adaptive";
import { rankingSimilarity, fitScore } from "./ranking-metric";
import type { Answer } from "./bracket";

const model = (id: string, name = id, labId = "lab"): Model => ({ id, name, labId, kind: "llm", reasoning: true, aliases: [] });
describe("solver ranking similarity", () => {
 const a = Array.from({ length: 16 }, (_, i) => String(i));
 it("reuses the solver score without score-margin or benchmark penalties", () => {
  const b = [...a]; [b[0], b[2]] = [b[2], b[0]];
  const scores = (x: string[]) => new Map(x.map((id, i) => [id, 3 * (x.length - i)]));
  expect(rankingSimilarity(a, b)).toBe((fitScore(a, scores(b), 0) + fitScore(b, scores(a), 0)) / 2);
 });
 it("counts order and ranks below the top five, with a larger cost at number one", () => {
  const top = [...a], bottom = [...a];
  [top[0], top[1]] = [top[1], top[0]]; [bottom[12], bottom[13]] = [bottom[13], bottom[12]];
  expect(rankingSimilarity(a, a)).toBe(100);
  expect(rankingSimilarity(a, top)).toBeLessThan(rankingSimilarity(a, bottom));
  expect(rankingSimilarity(a, bottom)).toBeLessThan(100);
  expect(rankingSimilarity(a, top)).toBe(rankingSimilarity(top, a));
 });
 it("penalizes missing models and refuses to report certainty for empty rankings", () => {
  expect(rankingSimilarity(a, a.slice(1))).toBeLessThan(90);
  expect(rankingSimilarity([], [])).toBe(0);
 });
});

describe("adaptive sprint", () => {
 it("compares numeric versions only within a lab and exact family", () => {
  const m = [model("old", "Lumen 5"), model("new", "Lumen 5.10"), model("mid", "Lumen 5.2"), model("other", "Lumen 5.11", "other"), model("pro", "Lumen 5.11 Pro"), model("size1", "Lumen 27B"), model("size2", "Lumen 35B")];
  expect(versionAssumptions(m)).toEqual(expect.arrayContaining([{ above: "new", below: "old" }, { above: "new", below: "mid" }]));
  expect(versionAssumptions(m).some(e => [e.above, e.below].some(id => ["other", "pro", "size1", "size2"].includes(id)))).toBe(false);
 });
 const ids = ["a", "b", "c", "d", "e", "f", "g", "h"];
 const models = new Map(ids.map(id => [id, model(id)]));
 const evidence: RankingEvidence[] = [{ order: ids, weight: 1 }, { order: ["b", "a", ...ids.slice(2)], weight: 1 }, { order: ["c", "b", "a", ...ids.slice(3)], weight: 1 }];
 it("starts with disputed leaders, never distant unanimous pairs, and stays under its cap", () => {
  let answers: Answer[] = [];
  let step = runAdaptive(ids, models, answers, { evidence, cap: 6 });
  expect(step.pair?.every(id => ids.indexOf(id) < 3)).toBe(true);
  while (!step.done) {
   const [a, b] = step.pair!;
   expect(Math.max(ids.indexOf(a), ids.indexOf(b))).toBeLessThan(5);
   answers = [...answers, { a, b, winner: ids.indexOf(a) < ids.indexOf(b) ? a : b }];
   step = runAdaptive(ids, models, answers, { evidence, cap: 6 });
   expect(answers.length).toBeLessThanOrEqual(6);
  }
  expect(step.asked).toBeLessThan(6);
  expect(step.order).toHaveLength(ids.length);
 });
 it("allows a user's reversal to override evidence and a version assumption", () => {
  const m = new Map([["a", model("a", "Lumen 5.1")], ["b", model("b", "Lumen 5")], ...ids.slice(2).map(id => [id, model(id)] as const)]);
  const step = runAdaptive(ids, m, [{ a: "a", b: "b", winner: "b" }], { evidence, cap: 6 });
  expect(step.order.indexOf("b")).toBeLessThan(step.order.indexOf("a"));
  expect(step.pair?.sort()).not.toEqual(["a", "b"]);
 });
 it("skips transitive answers and unsure pairs, and undo replays identically", () => {
  const calls = [{ a: "a", b: "b", winner: "a" }, { a: "b", b: "c", winner: "b" }];
  const step = runAdaptive(ids, models, calls, { evidence, cap: 6, threshold: 0 });
  expect(step.pair?.sort()).not.toEqual(["a", "c"]);
  expect(runAdaptive(ids, models, calls.slice(0, -1), { evidence, cap: 6 })).toEqual(runAdaptive(ids, models, calls.slice(0, 1), { evidence, cap: 6 }));
  const unsure = runAdaptive(ids, models, [{ a: "a", b: "b", winner: null }], { evidence, cap: 6 });
  expect(unsure.pair?.sort()).not.toEqual(["a", "b"]);
 });
});
