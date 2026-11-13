import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { normalizeLabel } from "../../src/data/normalize";
import { parseBugHunt } from "./sources/bughunt";
import { parsePenaltyBench } from "./sources/penaltybench";
import { parseRweBench } from "./sources/rwebench";

const fixture = (f: string) => readFileSync(path.join(__dirname, "fixtures", f), "utf8");

describe("Bug Hunt Bench", () => {
  const { rows, benchmarks } = parseBugHunt(JSON.parse(fixture("bughunt.json")));
  it("scores planted bugs fixed out of 105, current rows only, one per model and effort", () => {
    expect(benchmarks[0]).toMatchObject({ id: "bughunt", unit: "percent", higherIsBetter: true, eligibleForDefault: false, lastUpdated: "2026-11-13" });
    expect(rows.find((r) => r.modelLabel === "Fable 5.2" && r.effort === "max")).toMatchObject({ value: 55.2, costUsd: 139.65, details: { fixed: 58, runs: 3 } });
    const keys = rows.map((r) => `${r.modelLabel}|${r.effort ?? ""}`);
    expect(new Set(keys).size).toBe(keys.length);
    // DeepSeek ran in four harnesses: the site's featured one stands for the model.
    expect(rows.find((r) => r.modelLabel === "DeepSeek V4.1 Flash 1017" && r.effort === "max")?.harness).toBe("DeepSeek Harness / DeepSeek API");
  });
  it("leaves out quantized local builds and files a default effort as unstated", () => {
    expect(rows.some((r) => /\d+-bit/.test(r.modelLabel))).toBe(false);
    expect(rows.filter((r) => r.effort === undefined).every((r) => r.effortUnstated)).toBe(true);
  });
});

describe("RWE-Bench", () => {
  const { rows, benchmarks } = parseRweBench(fixture("rwe-data.js"));
  it("reads Xplore's data file as data: pass rate with its interval, cost and hours per run", () => {
    expect(rows).toHaveLength(15);
    expect(benchmarks[0]).toMatchObject({ id: "rwe-bench", lastUpdated: "2026-11-12" });
    expect(benchmarks[0].description).toContain("20 tasks");
    expect(rows[0]).toMatchObject({ modelLabel: "Claude Fable 5.2", effort: "max", value: 62, ci: [55.2, 68.2], costUsd: 114.86 });
    expect(rows[0].durationSec).toBeCloseTo(5.45 * 3600, 6);
    expect(rows.map((r) => normalizeLabel(r.modelLabel, r.effort).ok).every(Boolean)).toBe(true);
  });
});

describe("Penalty Bench", () => {
  const { rows, benchmarks } = parsePenaltyBench(fixture("penalty-bench.html"));
  it("keeps agents as rows and the two referee baselines in the description", () => {
    expect(rows.map((r) => r.modelLabel)).not.toContain("Referee with VAR");
    expect(rows[0]).toMatchObject({ modelLabel: "GPT-6.1 Terra", value: 64.4, ci: [55.4, 73.3], effortUnstated: true, harness: "Codex" });
    expect(benchmarks[0].description).toContain("the referee with VAR 63.4%");
    expect(rows.map((r) => normalizeLabel(r.modelLabel).ok).every(Boolean)).toBe(true);
  });
});
