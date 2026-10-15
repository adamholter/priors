import { describe, expect, it } from "vitest";
import { normalizeLabel } from "../../src/data/normalize";
import { parseAgiPilled } from "./sources/agi-pilled";
import { parseClutterBench } from "./sources/clutterbench";

const agi = () => ({
  now: 2026, never_sentinel: 100, events: ["enigma", "exoplanet", "gene_editing", "riemann", "erdos", "jacobian", "unique_games", "navier_stokes"],
  models: [
    { id: "cli:haiku-xhigh", name: "Claude Haiku 5.5 (xhigh)", effort: "xhigh", score: 6, ci: [4, 10], n: 40 },
    { id: "cli:haiku-low", name: "Claude Haiku 5.5 (low)", effort: "low", score: 0, ci: [0, 2], n: 40 },
  ],
});
const clutter = () => ({
  builtAt: "2026-10-15T12:00:00.000Z", grader: "consensus-v4",
  tasks: { scored: "Scored post", showcase: "Showcase" }, showcase: ["showcase"],
  models: { sonnet: { effort: "low" } },
  board: [{ model: "sonnet", name: "Claude Sonnet 5.5", raw: { n: 1, clutter: 30 }, simple: { n: 1, clutter: 0 } }],
  runs: [
    { id: "scored__sonnet__raw", task: "scored", model: "sonnet", variant: "raw", clutter: 30 },
    { id: "scored__sonnet__simple", task: "scored", model: "sonnet", variant: "simple", clutter: 0 },
    { id: "showcase__sonnet__raw", task: "showcase", model: "sonnet", variant: "raw", clutter: 99 },
  ],
});

describe("Adam's published benchmarks", () => {
  it("keeps Muse Wonder separate from Wonder Full and preserves the measured low effort", () => {
    expect(normalizeLabel("Muse Wonder", "low")).toMatchObject({ modelId: "aa-muse-wonder", effort: "low" });
    expect(normalizeLabel("Muse Wonder Full", "max")).toMatchObject({ modelId: "aa-muse-wonder-full", effort: "max" });
  });
  it("preserves AGI years, confidence intervals and distinct reasoning efforts, including zero", () => {
    const r = parseAgiPilled(agi());
    expect(r.benchmarks[0]).toMatchObject({ unit: "count", higherIsBetter: false, defaultWeight: 0 });
    expect(r.rows.map(row => [row.value, row.ci])).toEqual([[6, [4, 10]], [0, [0, 2]]]);
    expect(r.rows.map(row => normalizeLabel(row.modelLabel, row.effort))).toMatchObject([
      { modelId: "claude-haiku-5.5", effort: "xhigh" }, { modelId: "claude-haiku-5.5", effort: "low" },
    ]);
    expect(r.rows.every(row => row.costUsd === undefined)).toBe(true);
  });

  it("rejects malformed or ambiguous AGI results instead of dropping rows", () => {
    expect(() => parseAgiPilled({})).toThrow();
    const d = agi();
    d.models[0].ci = [7, 10];
    expect(() => parseAgiPilled(d)).toThrow();
    d.models[0] = d.models[1];
    expect(() => parseAgiPilled(d)).toThrow();
    expect(() => parseAgiPilled({ ...agi(), models: [{ ...agi().models[0], effort: undefined }] })).toThrow();
    const incomplete = agi();
    incomplete.models[0].n = 39;
    expect(() => parseAgiPilled(incomplete)).toThrow(/coverage/);
  });

  it("preserves forecasts beyond the never sentinel, which is not an upper bound on years", () => {
    const d = agi();
    d.models[0].score = 150;
    d.models[0].ci = [125, 175];
    expect(parseAgiPilled(d).rows[0]).toMatchObject({ value: 150, ci: [125, 175] });
  });

  it("keeps raw and simple ClutterBench scores separate and excludes showcase posts", () => {
    const r = parseClutterBench(clutter());
    expect(r.rows.map(row => [row.benchmarkId, row.value, row.effort])).toEqual([
      ["clutterbench-raw", 30, "low"], ["clutterbench-simple", 0, "low"],
    ]);
    expect(r.benchmarks.every(b => b.unit === "percent" && !b.higherIsBetter && b.defaultWeight === 0)).toBe(true);
  });

  it("rejects partial model coverage, duplicate tasks and inconsistent aggregate scores", () => {
    const d = clutter();
    d.runs = d.runs.filter(r => r.variant !== "simple");
    expect(() => parseClutterBench(d)).toThrow(/incomplete/);
    const changed = clutter();
    changed.board[0].raw.clutter = 40;
    expect(() => parseClutterBench(changed)).toThrow(/inconsistent/);
    const duplicate = clutter();
    duplicate.runs.push(duplicate.runs[0]);
    expect(() => parseClutterBench(duplicate)).toThrow(/incomplete/);
  });

  it("requires explicit effort or authoritative legacy metadata; never attributes low to max", () => {
    const d = clutter();
    d.models = {} as typeof d.models;
    expect(() => parseClutterBench(d)).toThrow(/effort not published/);
    expect(parseClutterBench(d, { sonnet: "low" }).rows[0].effort).toBe("low");
    d.board[0].name = "Claude Sonnet 5.5 (xhigh)";
    expect(parseClutterBench(d).rows[0].effort).toBe("xhigh");
  });
});
