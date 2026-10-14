import { describe, expect, it } from "vitest";
import { parseHearingBench } from "./sources/hearingbench";

const row = { model: "Gemini 4 Argon", maker: "Google", harness: "Antigravity", effort: "high", correct: 44, near_misses: 1, wrong: 55, refused: 0,
  tiers: { "Everyday sounds": 15 }, stated_confidence_pct: 66, output_tokens_per_clip: 20230, cost_usd_per_run: 20.4691, seconds_per_clip: 178 };

describe("Hearing Bench parser", () => {
  it("reports percent correct with per-clip economics and the effort as published", () => {
    const r = parseHearingBench({ clips: 100, updated: "2026-10-13", models: [row, { model: "", correct: 3 }] });
    expect(r.rows).toHaveLength(1);
    expect(r.rows[0]).toMatchObject({ modelLabel: "Gemini 4 Argon", effort: "high", value: 44, outputTokens: 20230, durationSec: 178, harness: "Antigravity" });
    expect(r.rows[0].costUsd).toBeCloseTo(0.204691);
    expect(r.benchmarks[0]).toMatchObject({ id: "hearingbench", unit: "percent", defaultWeight: 0, lastUpdated: "2026-10-13" });
  });
  it("fails visibly without usable data", () => {
    expect(() => parseHearingBench({})).toThrow();
    expect(() => parseHearingBench({ models: [{ model: "", correct: 1 }] })).toThrow();
  });
});
