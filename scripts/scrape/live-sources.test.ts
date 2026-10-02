import { describe, expect, it } from "vitest";
import { parseOsworld2, parseOsworldVerified } from "./sources/osworld";
import { parseScaleEntries } from "./sources/scale";
import { parseAutomationBench } from "./sources/zapier";
import { parseRoboflow } from "./sources/roboflow";

describe("OSWorld", () => {
  it("2.0 keeps the newest release, full set, default step budget, with effort", () => {
    const rows = parseOsworld2({ releaseVersions: ["v2026.06.24", "v2.1", "v2026.08.08"], defaultStepBudget: 500, results: [
      { model: "Claude Opus 5", reasoning: "max", stepBudget: 500, releaseVersion: "v2026.08.08", datasetScope: "full", binaryAccuracy: 31.43, partialScore: 68 },
      { model: "Claude Opus 5", reasoning: "max", stepBudget: 500, releaseVersion: "v2.1", datasetScope: "full", binaryAccuracy: 44.33 },
      { model: "Claude Opus 5", reasoning: "max", stepBudget: 500, releaseVersion: "v2026.08.08", datasetScope: "offline", binaryAccuracy: 50 },
    ] });
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ modelLabel: "Claude Opus 5", effort: "max", value: 31.43 });
  });
  it("Verified keeps general models only, best across step budgets, and drops context tags", () => {
    const rows = parseOsworldVerified([
      { Model: "claude-opus-5[1m]", "Approach type": "General model", "Success rate": "83.39", "Max steps": "100" },
      { Model: "o3", "Approach type": "General model", "Success rate": "9.1", "Max steps": "15" },
      { Model: "o3", "Approach type": "General model", "Success rate": "23", "Max steps": "100" },
      { Model: "Agent S3", "Approach type": "Agentic framework", "Success rate": "70" },
    ]);
    expect(rows.map((r) => [r.modelLabel, r.value])).toEqual([["claude-opus-5", 83.39], ["o3", 23]]);
  });
});

describe("Scale SWE Atlas-QnA", () => {
  it("reads entries from the RSC payload, splitting harness and effort out of the label", () => {
    const payload = JSON.stringify(`1b:["$","div",null,{"children":["$","$L1d",null,{"entries":[{"model":"Opus 5 (Claude Code) xHigh\\n","score":63.17,"confidenceInterval_upper":5.01,"company":"anthropic"},{"model":"Fable-5.1 (Claude Code) xHigh*","score":59.95,"company":"anthropic"}]}]}]`);
    const html = `<script>self.__next_f.push([1,${payload}])</script>`;
    const rows = parseScaleEntries(html);
    expect(rows[0]).toMatchObject({ modelLabel: "Opus 5", effort: "xhigh", harness: "Claude Code", value: 63.17 });
    expect(rows[0].ci).toEqual([63.17 - 5.01, 63.17 + 5.01]);
    expect(rows[1].modelLabel).toBe("Fable-5.1");
  });
});

describe("Zapier AutomationBench", () => {
  it("parses rank/model/score/cost groups, effort from the parenthetical, skipping combined entries", () => {
    const { version, rows } = parseAutomationBench(["Leaderboard", "1.0.6", "Rank", "Model", "Score", "Cost / task", "1", "Gemini 4 Argon (High)", "51.29%", "$1.70*", "2", "Claude Sonnet 5.5 (default fallbacks, Max)", "44.75%", "$1.14", "3", "Claude Fable 5.1 (with Opus 5 Fallback)", "31.4%", "$2.00", "See 111 more"]);
    expect(version).toBe("1.0.6");
    expect(rows.map((r) => [r.modelLabel, r.effort, r.value, r.costUsd])).toEqual([["Gemini 4 Argon", "high", 51.29, 1.7], ["Claude Sonnet 5.5", "max", 44.75, 1.14]]);
  });
});

describe("Roboflow Visual Reasoning", () => {
  it("reads LLM-judge accuracy, effort, cost and tokens from the table", () => {
    const rows = parseRoboflow([["Rank", "Model", "", "Effort", "Accuracy (LLM judge)", "Accuracy (strict match)", "Tokens / sample", "Est. cost / sample", "Speed"], ["1", "GPT-6 Astra", "Deploy", "High", "91.2% ±0.3 , Mean of 3 runs", "89.6%", "1.4K", "$0.021", "5.51s"], ["2", "GPT-6.1 Sol NEW", "Deploy", "Low", "88.7%", "87%", "900", "$0.0042", "8s"]]);
    expect(rows.map((r) => [r.modelLabel, r.effort, r.value, r.costUsd, r.outputTokens])).toEqual([["GPT-6 Astra", "high", 91.2, 0.021, 1400], ["GPT-6.1 Sol", "low", 88.7, 0.0042, 900]]);
  });
});
