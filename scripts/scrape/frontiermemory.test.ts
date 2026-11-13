import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { normalizeLabel } from "../../src/data/normalize";
import { FRONTIERMEMORY_ID, parseFrontierMemory } from "./sources/frontiermemory";

const html = readFileSync(path.join(__dirname, "fixtures/frontiermemory.html"), "utf8");

describe("FrontierMemory", () => {
  it("reads each memory model's score from the model table, with its task agent, spread and cost kept aside", () => {
    const { rows, benchmarks } = parseFrontierMemory(html);
    expect(rows).toHaveLength(17);
    expect(benchmarks[0]).toMatchObject({ id: FRONTIERMEMORY_ID, name: "FrontierMemory v1.1", version: "1.1", higherIsBetter: true, eligibleForDefault: false, unit: "percent" });
    expect(rows[0]).toMatchObject({ modelLabel: "Opus 5.5", effort: "max", value: 73.33, harness: "Letta Dream", details: { taskModel: "Opus 5.5 (max)", sdPts: 0, runs: 3, taskCostUsd: 3.42 } });
    // The task agent's spend is in the task cost, so it is never the memory model's own cost.
    expect(rows.every((r) => r.costUsd === undefined)).toBe(true);
    expect(rows.find((r) => r.modelLabel === "Gemini 4 Argon")?.details).toMatchObject({ taskModel: "GPT-6 Sol (max)" });
    expect(rows.map((r) => normalizeLabel(r.modelLabel, r.effort).ok).every(Boolean)).toBe(true);
  });
  it("fails loudly when the table is gone", () => {
    expect(() => parseFrontierMemory("<html></html>")).toThrow(/model table not found/);
  });
});
