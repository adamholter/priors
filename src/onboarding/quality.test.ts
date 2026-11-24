import { describe, expect, it } from "vitest";
import type { Benchmark, Snapshot } from "../data/types";
import { benchmarkQuality, QUALITY_WEIGHTS, REFRESHED_SCORE, sizeScore, TEST_SET_SCORE } from "./quality";

const benchmark = (id: string, name = id): Benchmark => ({
  id, name, sourceId: "test", url: "https://example.com", description: "Test benchmark",
  unit: "percent", higherIsBetter: true, category: "reasoning",
});

function snapshot(benchmarks: Benchmark[], values: Array<[string, string, number]>, date = "2026-09-08"): Snapshot {
  const modelIds = [...new Set(values.map(([, variantId]) => variantId.split("@")[0]))];
  return {
    version: 1, date, generatedAt: `${date}T00:00:00Z`, labs: [],
    models: modelIds.map((id) => ({ id, name: id, labId: "lab", kind: "llm", reasoning: true, aliases: [] })),
    variants: [...new Set(values.map(([, variantId]) => variantId))].map((id) => ({ id, modelId: id.split("@")[0], effort: id.split("@")[1] as "low" | "high" })),
    benchmarks,
    observations: values.map(([benchmarkId, variantId, value]) => ({ benchmarkId, variantId, value, observedAt: date, sourceUrl: "https://example.com" })),
    series: [], sources: [],
  };
}

describe("benchmarkQuality", () => {
  it("does not let duplicate effort rows inflate headroom and spread", () => {
    const b = benchmark("simplebench");
    const base = benchmarkQuality(snapshot([b], [[b.id, "a@high", 40], [b.id, "b@low", 60]]))[0];
    const duplicate = benchmarkQuality(snapshot([b], [[b.id, "a@low", 20], [b.id, "a@high", 40], [b.id, "b@low", 60]]))[0];
    expect(duplicate.saturation).toBe(base.saturation);
    expect(duplicate.coverage).toBe(base.coverage);
  });

  it("uses verified dates while holding unknown dates at neutral recency", () => {
    const result = benchmarkQuality(snapshot([benchmark("arc-agi-3"), benchmark("aa-humanitys-last-exam"), benchmark("arena-text")], []));
    expect(result.find((x) => x.id === "arc-agi-3")).toMatchObject({ releaseDate: "2026-03-25", dateConfidence: "verified" });
    expect(result.find((x) => x.id === "aa-humanitys-last-exam")!.recency).toBeLessThan(result.find((x) => x.id === "arc-agi-3")!.recency);
    expect(result.find((x) => x.id === "arena-text")).toMatchObject({ recency: 50, dateConfidence: "unknown" });
  });

  it("penalizes a saturated ceiling and a non-discriminative floor", () => {
    const high = benchmarkQuality(snapshot([benchmark("high")], [["high", "a@low", 100], ["high", "b@low", 100]]))[0];
    const flat = benchmarkQuality(snapshot([benchmark("flat")], [["flat", "a@low", 0], ["flat", "b@low", 0]]))[0];
    const diverse = benchmarkQuality(snapshot([benchmark("diverse")], [["diverse", "a@low", 0], ["diverse", "b@low", 25], ["diverse", "c@low", 50], ["diverse", "d@low", 75]]))[0];
    expect(high.saturation).toBeLessThan(flat.saturation);
    expect(flat.saturation).toBeLessThan(diverse.saturation);
  });

  it("lowers subjective arena grading regardless of percent unit", () => {
    const arena = benchmark("arena-percent", "Creative Arena");
    arena.description = "Pairwise human judge preference";
    expect(benchmarkQuality(snapshot([arena], []))[0].objectivity).toBe(40);
  });

  it("scores Terminal-Bench 4 above its superseded 2.1 version", () => {
    const result = benchmarkQuality(snapshot([benchmark("terminalbench-4"), benchmark("aa-terminalbench-v2-1")], []));
    expect(result.find((x) => x.id === "terminalbench-4")!.score).toBeGreaterThan(result.find((x) => x.id === "aa-terminalbench-v2-1")!.score);
  });

  it("adds the +15 preferred-benchmark contribution on top of the seven weighted parts", () => {
    const q = benchmarkQuality(snapshot([benchmark("deepswe-1.1")], [["deepswe-1.1", "a@low", 40], ["deepswe-1.1", "b@low", 60]]))[0];
    expect(q.preferred).toBe(true);
    expect(q.factors.map((f) => f.id)).toEqual(["saturation", "testSet", "recency", "objectivity", "frontier", "size", "efforts", "breadth"]);
    expect(q.factors.reduce((sum, f) => sum + f.weight, 0)).toBeCloseTo(1, 10);
    const base = q.factors.reduce((sum, f) => sum + f.score * f.weight, 0);
    expect(q.adjustments).toEqual([expect.objectContaining({ id: "preferred", points: 15 })]);
    expect(q.score).toBe(Math.min(100, Math.round(base + 15)));
    // What a breakdown shows adds up to the score.
    expect(Math.abs(q.factors.reduce((sum, f) => sum + f.points, 0) + 15 - q.score)).toBeLessThan(1.5);
  });

  it("docks a public test set against a private one, and less when its questions are replaced on a schedule", () => {
    // Facts come from src/data/benchmark-facts.ts: Terminal-Bench 4 is public, CritPt v2 private, AA-Omniscience partly private.
    const ids = ["aa-terminalbench-v4-0", "aa-critpt-v2", "aa-omniscience", "no-facts-yet"];
    const result = benchmarkQuality(snapshot(ids.map((id) => benchmark(id)), ids.flatMap((id) => [[id, "a@low", 40], [id, "b@low", 60]] as Array<[string, string, number]>)));
    const part = (id: string) => result.find((x) => x.id === id)!;
    expect(part("aa-terminalbench-v4-0")).toMatchObject({ testSet: "public", testSetScore: TEST_SET_SCORE.public });
    expect(part("aa-critpt-v2")).toMatchObject({ testSet: "private", testSetScore: TEST_SET_SCORE.private });
    expect(part("aa-omniscience")).toMatchObject({ testSet: "partial", testSetScore: TEST_SET_SCORE.partial });
    expect(part("no-facts-yet")).toMatchObject({ testSet: "unknown", testSetScore: TEST_SET_SCORE.unknown });
    expect(part("aa-critpt-v2").factors.find((f) => f.id === "testSet")!.points - part("aa-terminalbench-v4-0").factors.find((f) => f.id === "testSet")!.points).toBeCloseTo((TEST_SET_SCORE.private - TEST_SET_SCORE.public) * QUALITY_WEIGHTS.testSet, 5);
    expect(REFRESHED_SCORE.public).toBeGreaterThan(TEST_SET_SCORE.public);
  });

  it("scores how quickly a benchmark adds new models from the snapshot's measurement, else from today's lineup", () => {
    const measured = { ...benchmark("quick"), newModels: { of: 10, added: 9, medianDays: 2, score: 88 } };
    const result = benchmarkQuality(snapshot([measured, benchmark("untimed")], [["quick", "a@low", 40], ["quick", "b@low", 60], ["untimed", "a@low", 40], ["untimed", "b@low", 60]]));
    const quick = result.find((x) => x.id === "quick")!.factors.find((f) => f.id === "frontier")!;
    expect(quick.score).toBe(88);
    expect(quick.detail).toMatch(/Scored 9 of the 10 notable models .* typically 2 days after release/);
    expect(result.find((x) => x.id === "untimed")!.factors.find((f) => f.id === "frontier")!.detail).not.toMatch(/notable models/);
  });

  it("downweights publisher results that predate the September 22 frontier releases", () => {
    const fresh = { ...benchmark("fresh"), lastUpdated: "2026-09-22" };
    const stale = { ...benchmark("stale"), lastUpdated: "2026-09-21" };
    const values: Array<[string, string, number]> = [
      ["fresh", "claude-opus-5.5@max", 20], ["fresh", "gpt-6-sol@max", 30],
      ["stale", "claude-opus-5.5@max", 20], ["stale", "gpt-6-sol@max", 30],
    ];
    const result = benchmarkQuality(snapshot([fresh, stale], values, "2026-09-23"));
    expect(result.find((q) => q.id === "fresh")?.staleFrontier).toBe(false);
    expect(result.find((q) => q.id === "stale")?.staleFrontier).toBe(true);
    expect(result.find((q) => q.id === "fresh")!.score - result.find((q) => q.id === "stale")!.score).toBe(20);
  });

  it("rewards measured top models rather than only the total row count", () => {
    const full = benchmark("full"), gaps = benchmark("gaps");
    const values: Array<[string, string, number]> = [
      ["full", "claude-opus-5.5@max", 20], ["full", "gpt-6-sol@max", 40], ["full", "gpt-6-luna@max", 60],
      ["gaps", "claude-opus-5.5@max", 20], ["gaps", "other-a@max", 40], ["gaps", "other-b@max", 60],
    ];
    const cohort = ["claude-opus-5.5", "gpt-6-sol", "gpt-6-luna"];
    const result = benchmarkQuality(snapshot([full, gaps], values, "2026-09-23"), cohort);
    const a = result.find((q) => q.id === "full")!, b = result.find((q) => q.id === "gaps")!;
    expect(a.coverage).toBe(b.coverage);
    expect(a.frontierMeasured).toBe(3);
    expect(b.frontierMeasured).toBe(1);
    expect(a.score).toBeGreaterThan(b.score);
  });

  it("scores broader measured coverage higher with other inputs held equal", () => {
    const narrow = benchmark("narrow"), broad = benchmark("broad");
    const flat = (benchmarkId: string, n: number): Array<[string, string, number]> =>
      Array.from({ length: n }, (_, i): [string, string, number] => [benchmarkId, `m${i}@low`, 50]);
    const result = benchmarkQuality(snapshot([narrow, broad], [...flat("narrow", 10), ...flat("broad", 60)]));
    const qNarrow = result.find((x) => x.id === "narrow")!, qBroad = result.find((x) => x.id === "broad")!;
    expect(qNarrow.coverage).toBe(25);
    expect(qBroad.coverage).toBe(100);
    expect(qNarrow.recency).toBe(qBroad.recency);
    expect(qNarrow.saturation).toBe(qBroad.saturation);
    expect(qNarrow.objectivity).toBe(qBroad.objectivity);
    expect(qNarrow.score).toBeLessThan(qBroad.score);
  });
});

describe("a benchmark its publisher stopped updating", () => {
  it("loses the same points as a superseded one, so fits stop reaching for it", () => {
    const values: Array<[string, string, number]> = [["a", "m1@high", 10], ["a", "m2@high", 50], ["a", "m3@high", 90], ["b", "m1@high", 10], ["b", "m2@high", 50], ["b", "m3@high", 90]];
    const [live, ended] = benchmarkQuality(snapshot([benchmark("a"), { ...benchmark("b"), stoppedPublishing: "2026-10-08" }], values));
    expect(ended.score).toBeLessThan(live.score);
  });
});


describe("efforts", () => {
  const snap = (rows: [model: string, effort: string][], extra: [model: string, effort: string][] = []): Snapshot => ({
    date: "2026-11-20", generatedAt: "2026-11-20T00:00:00Z", sources: [], labs: [],
    models: ["a", "b", "c", "d"].map((id) => ({ id, name: id, labId: "x", kind: "llm" })),
    variants: [...rows, ...extra].map(([m, e]) => ({ id: `${m}@${e}`, modelId: m, effort: e })),
    benchmarks: [{ id: "bench", name: "Bench", sourceId: "s", url: "", description: "", unit: "percent", higherIsBetter: true, category: "coding" }, { id: "other", name: "Other", sourceId: "s", url: "", description: "", unit: "percent", higherIsBetter: true, category: "coding" }],
    observations: [...rows.map(([m, e]) => ({ benchmarkId: "bench", variantId: `${m}@${e}`, value: 50 })), ...extra.map(([m, e]) => ({ benchmarkId: "other", variantId: `${m}@${e}`, value: 50 }))],
  }) as unknown as Snapshot;
  const effortsOf = (s: Snapshot) => benchmarkQuality(s, []).find((q) => q.id === "bench")!.factors.find((f) => f.id === "efforts")!;

  it("scores the share of multi-effort models measured at two or more efforts, full at half", () => {
    // a and b measured at two efforts here; c and d only at one here, though they have others elsewhere.
    const f = effortsOf(snap([["a", "low"], ["a", "high"], ["b", "low"], ["b", "high"], ["c", "high"], ["d", "high"]], [["c", "low"], ["d", "low"]]));
    expect(f.score).toBe(100);
    expect(f.summary).toBe("2 of 4 models at 2+ efforts");
    const one = effortsOf(snap([["a", "high"], ["b", "high"], ["c", "high"], ["d", "high"]], [["a", "low"], ["b", "low"], ["c", "low"], ["d", "low"]]));
    expect([one.score, one.summary]).toEqual([0, "One effort per model"]);
  });
  it("does not count a model's unnamed default setting as a second effort, and holds at 50 with too few models", () => {
    const f = effortsOf(snap([["a", "default"], ["a", "high"], ["b", "default"], ["b", "high"]], [["a", "low"], ["b", "low"]]));
    expect([f.score, f.summary]).toEqual([50, "Too few models to tell"]);
  });
});

describe("facts for a new version", () => {
  it("come from the board it supersedes, keeping test set and grading but not the old release date", async () => {
    const { factsOf } = await import("@/data/benchmark-facts");
    const facts = factsOf({ id: "gamefeel-re-v9", versionPolicy: { kind: "fresh", supersedes: "gamefeel-re" } });
    expect(facts).toMatchObject({ test: "private", grading: "automatic" });
    expect(facts.released).toBeUndefined();
    expect(factsOf({ id: "gamefeel-re-v1.5.2" })).toMatchObject({ test: "private", grading: "automatic", released: "2026-11-19" });
    expect(factsOf({ id: "no-such-board" })).toEqual({});
  });
});

describe("size", () => {
  it("scores the samples a result rests on, on a log scale, with repeat runs worth less than new tasks", () => {
    expect(sizeScore(undefined)).toBe(50);
    expect(sizeScore({ tasks: 10 })).toBe(0);
    expect(sizeScore({ tasks: 100 })).toBe(50);
    expect(sizeScore({ tasks: 1000 })).toBe(100);
    expect(sizeScore({ tasks: 70000 })).toBe(100);
    // Four runs count as twice the tasks, and more runs add nothing: 25 problems run 100 times are still 25 problems.
    expect(sizeScore({ tasks: 50, runs: 4 })).toBe(sizeScore({ tasks: 100 }));
    expect(sizeScore({ tasks: 25, runs: 100 })).toBe(sizeScore({ tasks: 50 }));
    expect(sizeScore({ tasks: 5000, votes: true })).toBe(sizeScore({ tasks: 500 }));
  });

  it("reads each benchmark's researched size into its own part of the score", () => {
    const ids = ["aa-hle-diamond", "aa-terminalbench-v4-0", "no-size-yet"];
    const all = benchmarkQuality(snapshot(ids.map((id) => benchmark(id)), ids.flatMap((id) => [[id, "a@low", 40], [id, "b@low", 60]] as Array<[string, string, number]>)));
    const q = all.find((x) => x.id === "aa-hle-diamond")!;
    const f = q.factors.find((x) => x.id === "size")!;
    expect(f.score).toBe(100);
    expect(f.summary).toBe("1,000 tasks");
    expect(all.find((x) => x.id === "aa-terminalbench-v4-0")!.factors.find((x) => x.id === "size")!.summary).toBe("66 tasks × 3 runs");
    expect(all.find((x) => x.id === "no-size-yet")!.factors.find((x) => x.id === "size")!).toMatchObject({ score: 50, summary: "Size not known" });
    expect(QUALITY_WEIGHTS).toEqual({ saturation: 0.2, testSet: 0.2, recency: 0.1, objectivity: 0.15, frontier: 0.1, size: 0.1, efforts: 0.05, breadth: 0.1 });
    expect(Object.values(QUALITY_WEIGHTS).reduce((a, b) => a + b, 0)).toBeCloseTo(1);
  });

  it("uses the updated v1.5.2 task counts for GameFeel Benchmark and GameFeel RE", () => {
    const ids = ["gamefeel-v1.5.2", "gamefeel-re-v1.5.2"];
    const all = benchmarkQuality(snapshot(ids.map((id) => benchmark(id)), ids.flatMap((id) => [[id, "a@low", 40], [id, "b@low", 60]] as Array<[string, string, number]>)));
    expect(all.find((x) => x.id === "gamefeel-v1.5.2")!.factors.find((x) => x.id === "size")!).toMatchObject({ score: 100, summary: "70,000 tasks" });
    expect(all.find((x) => x.id === "gamefeel-re-v1.5.2")!.factors.find((x) => x.id === "size")!).toMatchObject({ score: 100, summary: "18,000 tasks" });
  });

  it("awards MazeBench a +15 bonus for being verified by Epoch AI", () => {
    const ids = ["mazebench", "bg-maze-bench"];
    const all = benchmarkQuality(snapshot(ids.map((id) => benchmark(id)), ids.flatMap((id) => [[id, "a@low", 40], [id, "b@low", 60]] as Array<[string, string, number]>)));
    for (const id of ids) {
      const q = all.find((x) => x.id === id)!;
      expect(q.adjustments).toContainEqual({ id: "epochVerified", label: "Verified by Epoch AI", points: 15 });
      const base = q.factors.reduce((sum, f) => sum + f.score * f.weight, 0);
      expect(q.baseScore).toBe(Math.round(base));
      // MazeBench itself is Priors Recommended too, so it gets both bonuses.
      expect(q.score).toBe(Math.min(100, Math.round(base + (id === "mazebench" ? 30 : 15))));
    }
  });

  it("marks MazeBench, both GameFeel boards and FrontierCode 2.0-AA Priors Recommended", () => {
    const ids = ["mazebench", "gamefeel-v1.5.2", "gamefeel-re-v1.5.2", "aa-frontiercode-2-0", "bg-maze-bench"];
    const all = benchmarkQuality(snapshot(ids.map((id) => benchmark(id)), ids.flatMap((id) => [[id, "a@low", 40], [id, "b@low", 60]] as Array<[string, string, number]>)));
    for (const id of ids.slice(0, 4)) {
      const q = all.find((x) => x.id === id)!;
      expect(q.preferred).toBe(true);
      expect(q.adjustments).toContainEqual({ id: "preferred", label: "Priors Recommended", points: 15 });
    }
    expect(all.find((x) => x.id === "bg-maze-bench")!.preferred).toBe(false);
  });

  it("reports baseScore before bonuses and penalties alongside the adjusted score", () => {
    const benches = [
      benchmark("deepswe-1.1"),
      benchmark("aa-terminalbench-v2-1"),
      benchmark("plain-bench"),
      benchmark("khalilbench"),
    ];
    const all = benchmarkQuality(snapshot(benches, benches.flatMap((b) => [[b.id, "a@low", 40], [b.id, "b@low", 60]] as Array<[string, string, number]>)));
    const byId = (id: string) => all.find((x) => x.id === id)!;
    // Preferred (+15) lifts score above baseScore.
    expect(byId("deepswe-1.1").score).toBeGreaterThan(byId("deepswe-1.1").baseScore);
    // Superseded (-25) lowers score below baseScore.
    expect(byId("aa-terminalbench-v2-1").score).toBeLessThan(byId("aa-terminalbench-v2-1").baseScore);
    // No adjustments means baseScore equals score.
    expect(byId("plain-bench").adjustments).toEqual([]);
    expect(byId("plain-bench").baseScore).toBe(byId("plain-bench").score);
    // Non-serious benchmarks stay 0 both before and after.
    expect([byId("khalilbench").baseScore, byId("khalilbench").score]).toEqual([0, 0]);
  });
});
