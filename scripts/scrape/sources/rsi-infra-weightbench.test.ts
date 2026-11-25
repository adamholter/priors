import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { RSI_INFRA_ID, parseRsiInfra } from "./rsi-infra-bench";
import { WEIGHTBENCH_ID, parseWeightBench } from "./weightbench";
import { normalizeLabel } from "../../../src/data/normalize";
import { factsOf } from "../../../src/data/benchmark-facts";
import { sizeOf } from "../../../src/data/benchmark-size";

const fixture = (f: string) => readFileSync(path.resolve("scripts/scrape/fixtures", f), "utf8");
const id = (label: string) => { const n = normalizeLabel(label); return n.ok ? n.modelId : null; };

describe("RSI-Infra Bench", () => {
  const { rows, benchmark, tasks } = parseRsiInfra(fixture("rsi-infra-bench/leaderboard.html"));
  const row = (m: string) => rows.find((r) => r.modelLabel === m);
  it("reads the index, harness and each task's speedup from the board", () => {
    expect(tasks).toEqual(["LLaVA", "YOCO", "NanoChat", "BAGEL SFT", "R3", "3DGS", "Slime GRPO", "Slime OPD"]);
    expect(rows).toHaveLength(17);
    expect(row("Gemini 4 Neon")).toMatchObject({ benchmarkId: RSI_INFRA_ID, value: 43.2, harness: "Antigravity CLI", labHint: "Google" });
    expect(row("Claude Opus 5.5")).toMatchObject({ value: 40, harness: "Claude Code" });
    expect((row("Claude Opus 5.5")!.details as { speedups: Record<string, number> }).speedups["3DGS"]).toBeCloseTo(5.82, 2);
    expect(row("GPT-6 Astra")!.note).toMatch(/degraded/);
    expect(benchmark).toMatchObject({ unit: "score", defaultWeight: 0 });
  });
  it("matches every model on the board", () => {
    expect(rows.map((r) => [r.modelLabel, id(r.modelLabel!)]).filter(([, m]) => !m)).toEqual([]);
    expect(id("Kimi k3.1-pro")).toBe("kimi-k3.1");
  });
  it("carries its facts: public tasks, released 2026-11-17, 8 tasks with one run each", () => {
    expect(factsOf({ id: RSI_INFRA_ID })).toMatchObject({ test: "public", released: "2026-11-17", grading: "automatic" });
    expect(sizeOf({ id: RSI_INFRA_ID })).toMatchObject({ tasks: 8, runs: 1 });
  });
});

describe("WeightBench", () => {
  const { rows, tasks } = parseWeightBench(fixture("weightbench/weightbench.html"));
  const row = (m: string) => rows.find((r) => id(r.modelLabel!) === m);
  it("reads the score after rulings, its interval and all task scores", () => {
    expect(tasks).toBe(21);
    expect(rows).toHaveLength(16);
    expect(row("gpt-6.2-astra")).toMatchObject({ benchmarkId: WEIGHTBENCH_ID, value: 62.76, harness: "Codex 0.166.0" });
    expect(row("gpt-6.2-astra")!.ci![0]).toBeCloseTo(62.76 - 1.96 * 0.5936, 1);
    const opus = row("claude-opus-5.5")!;
    expect(opus.value).toBeCloseTo(47.0, 0);
    expect(opus.note).toMatch(/53\.4% before rulings/);
    expect((opus.details as { tasks: Record<string, number> }).tasks["Classic control"]).toBeGreaterThan(0);
  });
  it("matches every agent's model, using the slug's checkpoint date or the slug itself where the name falls short", () => {
    expect(rows.map((r) => [r.modelLabel, id(r.modelLabel!)]).filter(([, m]) => !m)).toEqual([]);
    expect(row("deepseek-v4.1-flash-1017")).toBeDefined();
    expect(row("aa-muse-wonder-full")).toMatchObject({ effort: "max" });
    expect(row("gemini-4-carbon")).toMatchObject({ effort: "high", harness: "Antigravity CLI" });
    expect(row("gpt-6.2-astra")!.effort).toBeUndefined();
  });
  it("carries its facts: public tasks, released 2026-11-23, 21 tasks with three trials each", () => {
    expect(factsOf({ id: WEIGHTBENCH_ID })).toMatchObject({ test: "public", released: "2026-11-23" });
    expect(sizeOf({ id: WEIGHTBENCH_ID })).toMatchObject({ tasks: 21, runs: 3 });
  });
});
