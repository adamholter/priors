import { describe, expect, it } from "vitest";
import type { Benchmark, Observation } from "@/data/types";
import type { RankedVariant } from "@/engine";
import type { BenchMetric } from "./benchmark-metrics";
import { axisPct, bestOf, buildResults, cycleSort, groupModels, linearAxis, matchesName, notches, RANK, scoreAxis, searchGroups, sortGroups, tickText, type Row } from "./benchmark-results";

const bench = (over: Partial<Benchmark> = {}) => ({ id: "t", name: "T", unit: "percent", ...over }) as Benchmark;
const ranked = (model: string, effort: string, score: number, extra: { raw?: number; cost?: number } = {}) => ({
  model: { id: model, name: model.toUpperCase(), labId: "lab" }, variant: { id: `${model}@${effort}`, modelId: model, effort },
  score, costUsd: extra.cost, values: extra.raw != null ? [{ raw: extra.raw }] : [],
}) as unknown as RankedVariant;
const input = (table: RankedVariant[], over: Partial<Parameters<typeof buildResults>[0]> = {}) => ({ table, b: bench(), hasCost: false, basis: "api" as const, apiObs: new Map<string, Observation>(), ci: false, harness: false, standard: [] as BenchMetric[], ...over });
const metric = (key: string, kind: BenchMetric["kind"], values: [string, number][]) => ({ id: key, key, label: `${key} per task`, kind, better: "lower", values: new Map(values) }) as BenchMetric;

const table = [ranked("a", "xhigh", 70, { raw: 70, cost: 4 }), ranked("b", "high", 60, { raw: 60, cost: 1 }), ranked("a", "high", 58, { raw: 58, cost: 0.5 }), ranked("a", "low", 40, { raw: 40 }), ranked("b", "low", 59.5, { raw: 59.5, cost: 0.2 })];
const model = () => buildResults(input(table, { hasCost: true, standard: [metric("steps", "count", [["a@xhigh", 30], ["a@high", 22], ["b@high", 40]])] }));

describe("buildResults", () => {
  it("prints the published value, one row per variant, and keeps only measures some row has", () => {
    const m = model();
    expect(m.rows.map((r) => r.text)).toEqual(["70.0%", "60.0%", "58.0%", "40.0%", "59.5%"]);
    expect(m.measures.map((x) => x.key)).toEqual(["cost", "steps"]);
    expect(m.rows[0].v).toEqual({ cost: 4, steps: 30 });
    expect(m.rows[3].v).toEqual({});
  });
  it("falls back to the index score where a result has no published value", () => {
    const r = buildResults(input([ranked("a", "high", 41.26)])).rows[0];
    expect([r.score, r.text]).toEqual([41.26, "41.3"]);
  });
  it("names the effort, or 'best measured' when the board keeps each model's best, and leaves the search word empty for those", () => {
    const [one] = buildResults(input([ranked("a", "default", 1)])).rows;
    expect([one.effort, one.effortLabel]).toEqual(["", "default"]);
    const [best] = buildResults(input([ranked("a", "max", 1)], { b: bench({ effortBasis: "best-measured" }) })).rows;
    expect([best.effort, best.effortLabel]).toEqual(["", "best measured"]);
    expect(model().rows[0].effortLabel).toBe("xhigh");
  });
  it("splits subscription and API cost only on the subscription basis", () => {
    const obs = new Map([["a@xhigh", { costUsd: 9 } as Observation]]);
    const sub = buildResults(input([ranked("a", "xhigh", 1, { cost: 2 })], { hasCost: true, basis: "subscription", apiObs: obs }));
    expect(sub.measures.map((x) => x.label)).toEqual(["Plan cost", "API cost"]);
    expect(sub.rows[0].v).toEqual({ cost: 2, api: 9 });
    const api = buildResults(input([ranked("a", "xhigh", 1, { cost: 2 })], { hasCost: true, apiObs: obs }));
    expect(api.measures.map((x) => x.label)).toEqual(["Cost"]);
  });
  it("shows an interval's half width and title only when the page reads intervals", () => {
    const obs = new Map([["a@high", { ci: [60, 66] } as Observation]]), t = [ranked("a", "high", 63, { raw: 63 })];
    expect(buildResults(input(t, { apiObs: obs })).rows[0].half).toBeUndefined();
    const r = buildResults(input(t, { apiObs: obs, ci: true }));
    expect(r.rows[0]).toMatchObject({ half: "3.0", intervalTitle: "interval 60.0% to 66.0%" });
    expect(r.hasInterval).toBe(true);
  });
  it("flags launch claims, and a harness shared by every row is one constant", () => {
    const obs = new Map([["a@high", { harness: "h", details: { launchClaim: 1 } } as unknown as Observation], ["b@high", { harness: "h" } as Observation]]);
    const t = [ranked("a", "high", 2), ranked("b", "high", 1)];
    const m = buildResults(input(t, { apiObs: obs, harness: true }));
    expect(m.rows.map((r) => r.launch)).toEqual([true, false]);
    expect([m.harnessConst, m.harnessVaries]).toEqual(["h", false]);
    const mixed = buildResults(input(t, { apiObs: new Map([["a@high", { harness: "h" } as Observation], ["b@high", { harness: "k" } as Observation]]), harness: true }));
    expect([mixed.harnessConst, mixed.harnessVaries]).toEqual([undefined, true]);
  });
});

describe("one row per model", () => {
  const rows = model().rows, groups = groupModels(rows);
  it("groups by model in order of first appearance, best effort first, with sequential ranks", () => {
    expect(groups.map((g) => [g.id, g.rank, g.best.variant.id, g.rows.length])).toEqual([["a", 1, "a@xhigh", 3], ["b", 2, "b@high", 2]]);
  });
  it("searches names, ids and efforts, every word having to match", () => {
    expect(searchGroups(groups, "").length).toBe(2);
    expect(searchGroups(groups, "A").map((g) => g.id)).toEqual(["a"]);
    expect(searchGroups(groups, "xhigh").map((g) => g.id)).toEqual(["a"]);
    expect(searchGroups(groups, "b low").map((g) => g.id)).toEqual(["b"]);
    expect(searchGroups(groups, "a low zzz")).toEqual([]);
    expect(searchGroups(groups, "default")).toEqual([]);
  });
  it("tells a name match from an effort match", () => {
    expect(matchesName(groups[0], "a")).toBe(true);
    expect(matchesName(groups[0], "xhigh")).toBe(false);
  });
  it("sorts by a model's lowest value of a measure, models without it last, ties by rank", () => {
    expect(sortGroups(groups, { key: "cost", rev: false }).map((g) => g.id)).toEqual(["b", "a"]); // b's lowest is 0.2, a's 0.5
    expect(sortGroups(groups, { key: "cost", rev: true }).map((g) => g.id)).toEqual(["a", "b"]);
    expect(sortGroups(groups, { key: "steps", rev: false }).map((g) => g.id)).toEqual(["a", "b"]); // a 22, b 40
    expect(sortGroups(groups, { key: "api", rev: false }).map((g) => g.id)).toEqual(["a", "b"]); // nobody has it: rank order
    expect(sortGroups(groups, RANK)).toBe(groups);
    expect(sortGroups(groups, { key: "score", rev: true }).map((g) => g.id)).toEqual(["b", "a"]);
  });
  it("cycles a header: best first, reversed, then rank order", () => {
    const first = cycleSort(RANK, "cost");
    expect(first).toEqual({ key: "cost", rev: false });
    expect(cycleSort(first, "cost")).toEqual({ key: "cost", rev: true });
    expect(cycleSort({ key: "cost", rev: true }, "cost")).toEqual(RANK);
    expect(cycleSort(RANK, "score")).toEqual({ key: "score", rev: true });
    expect(cycleSort({ key: "score", rev: true }, "score")).toEqual(RANK);
    expect(cycleSort(first, "score")).toEqual(RANK);
  });
  it("points at a model's best score and cheapest result only when it has two to compare", () => {
    expect(bestOf(groups[0], "score", false)).toBe(70);
    expect(bestOf(groups[0], "score", true)).toBe(40);
    expect(bestOf(groups[0], "cost", false)).toBe(0.5);
    expect(bestOf(groups[0], "steps", false)).toBe(22);
    expect(bestOf(groups[1], "steps", false)).toBeUndefined();
  });
});

describe("the score axis", () => {
  const rowsOf = (scores: number[]) => scores.map((score, i) => ({ id: `${i}`, score }) as Row);
  it("counts percent from zero with round ends", () => {
    const a = scoreAxis(rowsOf([70, 58, 41]), bench(), false);
    expect([a.lo, a.hi]).toEqual([0, 80]);
    expect(a.ticks[0]).toBe(0);
    expect(axisPct(a, 40)).toBe(50);
  });
  it("fits Elo to the best results so a long tail clamps to the left end instead of shrinking the leaders", () => {
    const rows = rowsOf([...Array.from({ length: 30 }, (_, i) => 1866 - i * 4), 1200, 1100]);
    const a = scoreAxis(rows, bench({ unit: "elo" }), false);
    expect(a.lo).toBeGreaterThan(1600);
    expect(axisPct(a, 1100)).toBeCloseTo(1.2);
    expect(axisPct(a, 99999)).toBe(100);
  });
  it("runs best to the right when lower is better", () => {
    const a = scoreAxis(rowsOf([5, 10, 20]), bench(), true);
    expect(a.pos(5)).toBeGreaterThan(a.pos(20));
  });
  it("has a usable axis for one result or none", () => {
    expect(scoreAxis([], bench(), false).hi).toBeGreaterThan(0);
    const one = linearAxis(50, 50, false);
    expect(one.hi).toBeGreaterThan(one.lo);
  });
  it("labels ticks in the benchmark's unit", () => {
    expect(tickText(bench(), 40)).toBe("40%");
    expect(tickText(bench({ unit: "usd" }), 2)).toBe("$2");
    expect(tickText(bench({ unit: "elo" }), 1500)).toBe("1,500");
  });
  it("draws a model's other efforts as notches and drops ones that would sit on the last", () => {
    const [a] = groupModels(model().rows), axis = linearAxis(0, 100, true);
    const n = notches(a, axis);
    expect(n.map((x) => x.row.effortLabel)).toEqual(["high", "low"]);
    expect(n.map((x) => x.x)).toEqual([expect.closeTo(58), expect.closeTo(40)]);
    const close = groupModels(buildResults(input([ranked("a", "xhigh", 50, { raw: 50 }), ranked("a", "high", 49.5, { raw: 49.5 }), ranked("a", "low", 30, { raw: 30 })])).rows)[0];
    expect(notches(close, axis).map((n) => n.row.effortLabel)).toEqual(["low"]);
  });
});
