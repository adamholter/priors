import { describe, expect, it } from "vitest";
import { parseOsworld2, parseOsworldVerified } from "./sources/osworld";
import { parseProV2, parseScaleEntries, parseSweAtlas, PRO_V2_BOARDS, SWE_ATLAS_BOARDS } from "./sources/scale";
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

  it("reads SWE-Bench Pro V2's Full and HARD tabs, with the harness kept out of the model name", () => {
    const e = (model: string, score: number) => ({ model, score, confidenceInterval_upper: 1, company: "x" });
    const payload = JSON.stringify(`1e:["$","div",null,{"children":["$","$L20",null,{"variants":[{"key":"full","label":"SWE-Bench Pro V2 Full","entries":[${[e("Haiku 5.5 (mini-swe-agent) high", 87.23), e("GPT-6.1-Sol (mini-swe-agent) xhigh", 96.11), e("Inkling 2 Small", 97.66)].map((x) => JSON.stringify(x)).join(",")}]},{"key":"hard","label":"SWE-Bench Pro V2 HARD","entries":[${[e("Haiku 5.5 (mini-swe-agent) high", 52.94), e("Minimax M3p1 Flash (mini-swe-agent) xhigh", 84.31)].map((x) => JSON.stringify(x)).join(",")}]}]}]}]`);
    const v2 = parseProV2(`<script>self.__next_f.push([1,${payload}])</script>`);
    expect(v2.full.map((r) => [r.benchmarkId, r.modelLabel, r.effort, r.harness, r.value])).toEqual([
      [PRO_V2_BOARDS.full.id, "Haiku 5.5", "high", "mini-swe-agent", 87.23],
      [PRO_V2_BOARDS.full.id, "GPT-6.1-Sol", "xhigh", "mini-swe-agent", 96.11],
      [PRO_V2_BOARDS.full.id, "Inkling 2 Small", undefined, undefined, 97.66],
    ]);
    expect(v2.hard.map((r) => [r.modelLabel, r.value])).toEqual([["Haiku 5.5", 52.94], ["Minimax M3.1 Flash", 84.31]]);
    expect(() => parseProV2(`<script>self.__next_f.push([1,${JSON.stringify(`1e:{"variants":[{"key":"full","label":"x","entries":[${JSON.stringify(e("A", 1))}]}]}`)}])</script>`)).toThrow(/hard/);
  });
});

describe("Scale SWE Atlas v1.1", () => {
  it("reads the Overall tab and each lane's tab, each lane replacing its v1.0 board", () => {
    const e = (model: string, score: number) => ({ model, score, confidenceInterval_upper: 2, company: "x" });
    const tab = (key: string, entries: object[]) => ({ key, label: key, entries });
    const payload = JSON.stringify(`1e:{"variants":${JSON.stringify([
      tab("overall", [e("Claude Fable 5.2 (Claude Code) max", 80.55), e("Gemini 4 Neon (Antigravity CLI) xhigh", 72.01)]),
      tab("qna", [e("Claude Fable 5.2 (Claude Code) max", 83.87), e("Qwen 3.8 Max (mini-swe-agent) max", 81.45)]),
      tab("testwriting", [e("Claude Fable 5.1 (Claude Code) max", 78.89)]),
      tab("refactoring", [e("Claude Fable 5.2 (Claude Code) max", 80)]),
    ])}}`);
    const atlas = parseSweAtlas(`<script>self.__next_f.push([1,${payload}])</script>`);
    expect(atlas.overall.map((r) => [r.benchmarkId, r.modelLabel, r.effort, r.harness, r.value])).toEqual([
      ["swe-atlas-v1-1", "Claude Fable 5.2", "max", "Claude Code", 80.55],
      ["swe-atlas-v1-1", "Gemini 4 Neon", "xhigh", "Antigravity CLI", 72.01],
    ]);
    expect(atlas.qna.map((r) => [r.benchmarkId, r.modelLabel, r.value])).toEqual([["swe-atlas-qna-v1-1", "Claude Fable 5.2", 83.87], ["swe-atlas-qna-v1-1", "Qwen 3.8 Max", 81.45]]);
    expect(atlas.testwriting[0]).toMatchObject({ benchmarkId: "swe-atlas-tw-v1-1", value: 78.89 });
    expect(atlas.refactoring[0]).toMatchObject({ benchmarkId: "swe-atlas-refactoring-v1-1", value: 80 });
    expect([SWE_ATLAS_BOARDS.qna.supersedes, SWE_ATLAS_BOARDS.testwriting.supersedes, SWE_ATLAS_BOARDS.refactoring.supersedes]).toEqual(["swe-atlas-qna", "bh-swe-atlas-test-writing", "bh-swe-atlas-refactoring"]);
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
