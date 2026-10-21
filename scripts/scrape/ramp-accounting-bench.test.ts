import { describe, expect, it } from "vitest";
import { parseRampAccountingBench } from "./sources/ramp-accounting-bench";

const bundle = `const x=1;const dt={name:"APEX Accounting",version:"Benchmark 137",taskCount:137,attemptCount:3,modelCount:2,episodeCount:822,harness:"Mercor Archipelago",judgeModel:"GPT-5.6 Luna",latestCompletedAt:"2026-10-14T19:15:50.422493Z",sourceFingerprint:"b4"},ut=[{id:"gemini_4_argon",displayName:"Gemini 4 Argon",provider:"Google",sourceModel:"gemini/gemini-4-argon",color:"#0f9d58",metrics:{taskCount:137,episodeCount:411,passAt1:.23357664233576642,passAt3:.26277372262773724,passPower3:.1678832116788321,retryUplift:.0291,inconsistencyRate:.0949,meanCriteriaAt3:.6111713007541244,meanCost:3.0332359345498783,meanDurationMinutes:16.7,meanToolCalls:76.35,meanTurns:39.7,meanInputTokens:7137912912408759e-9,meanOutputTokens:86405.18,attemptMeanScores:[.6339,.593,.6065]},completedAt:"2026-10-14T19:15:50.422493Z"},{id:"claude_opus_5_5",displayName:"Claude Opus 5.5",provider:"Anthropic",sourceModel:"claude-opus-5-5",color:"#D97757",metrics:{meanCriteriaAt3:.5052761447290262,meanCost:1.341146483698297,meanDurationMinutes:3.366}},{id:"broken",displayName:"No Score",metrics:{}}],after=2;`;

describe("Ramp Accounting Bench parser", () => {
  it("reads the minified model list: criteria @3 as percent, per-attempt cost, harness and judge", () => {
    const r = parseRampAccountingBench(bundle);
    expect(r.rows).toHaveLength(2);
    expect(r.rows[0]).toMatchObject({ modelLabel: "Gemini 4 Argon", labHint: "Google", harness: "Mercor Archipelago", value: 61.12 });
    expect(r.rows[0].costUsd).toBeCloseTo(3.0332);
    expect(r.rows[0].durationSec).toBeCloseTo(16.7 * 60);
    expect(r.rows[0].details).toMatchObject({ passAt1: 23.36, passAt3: 26.28, judgeModel: "GPT-5.6 Luna" });
    expect(r.rows[1]).toMatchObject({ modelLabel: "Claude Opus 5.5", value: 50.53 });
    expect(r.benchmarks[0]).toMatchObject({ id: "ramp-accounting-bench", unit: "percent", defaultWeight: 0, lastUpdated: "2026-10-14T19:15:50.422493Z" });
  });
  it("fails visibly when the bundle shape changes", () => {
    expect(() => parseRampAccountingBench("const a=1")).toThrow(/not found/);
    expect(() => parseRampAccountingBench(`x=[{id:"a",displayName:"A",metrics:{}}]`)).toThrow();
  });
});
