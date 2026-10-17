import { describe, expect, it } from "vitest";
import { splitLabel } from "./sources/_board";
import { parseAle } from "./sources/snorkel-ale";
import { parseChartography } from "./sources/surge-chartography";
import { parseBabyVision } from "./sources/unipat-babyvision";
import { parseZeroBench } from "./sources/zerobench";
import { parseApexTable } from "./sources/matharena-apex";
import { parseHleText } from "./sources/scale-hle-text";
import { parseRanking } from "./sources/llmlearner";

describe("splitLabel", () => {
  it("takes the effort and tools marker off a label, leaving other parentheses alone", () => {
    expect(splitLabel("Fable 5 (max) (with tools)")).toEqual({ label: "Fable 5", effort: "max", tools: true });
    expect(splitLabel("GPT-5.2 (medium reasoning)")).toEqual({ label: "GPT-5.2", effort: "medium", tools: false });
    expect(splitLabel("DeepSeek V4 Flash Vision (experimental) (Max reasoning)")).toEqual({ label: "DeepSeek V4 Flash Vision (experimental)", effort: "max", tools: false });
    expect(splitLabel("Claude Opus 5.5 (Adaptive/Max)").effort).toBe("max");
  });
});

describe("new leaderboards", () => {
  it("reads every effort of each Agents' Last Exam row, best harness winning", () => {
    const efforts = (v: object[]) => JSON.stringify(v).replace(/"/g, "&quot;");
    const row = (model: string, harness: string, list: object[]) => `<tr class="tb-table-row " data-efforts="${efforts(list)}" data-rank="1" data-model="${model}" data-effort="Max" data-harness="${harness}"></tr>`;
    const html = `<table class="tb-data-table">${row("GPT-6 Astra", "Codex", [{ effort: "Max", pass_rate_pct: 34.2, score_pct: 59.3 }, { effort: "XHigh", pass_rate_pct: 32.2, score_pct: 58.3 }])}${row("GPT-6 Astra", "OpenClaw", [{ effort: "Max", pass_rate_pct: 20, score_pct: 40 }])}</table><table class="tb-data-table">${row("Other", "X", [{ effort: "Max", pass_rate_pct: 1, score_pct: 2 }])}</table>`;
    const rows = parseAle(html);
    expect(rows.map((r) => [r.modelLabel, r.effort, r.value, r.harness])).toEqual([["GPT-6 Astra", "max", 59.3, "Codex"], ["GPT-6 Astra", "xhigh", 58.3, "Codex"]]);
  });

  it("reads Chartography's brand, name and score, ignoring the other Surge boards", () => {
    const item = (brand: string, name: string, score: string) => `<div data-leaderboard-row=""><div class="head-rank-table-name-wrap"><div class="head-rank-table-brand"><div class="txt">${brand}</div></div><div class="head-rank-table-name"><div class="txt">${name}</div></div></div><div data-score="${score}">${score}</div></div>`;
    const html = `Chartography Leaderboard ${item("Gemini", "4 Argon (High reasoning)", "71.6")}${item("Inkling", "Inkling (High reasoning)", "10")} More benchmarks ${item("Claude", "Sonnet 5.5 (Adaptive/Max)", "41.7")}`;
    expect(parseChartography(html).map((r) => [r.modelLabel, r.effort, r.value])).toEqual([["Gemini 4 Argon", "high", 71.6], ["Inkling", "high", 10]]);
  });

  it("splits BabyVision's tool runs from the plain board and skips the human baseline", () => {
    const tr = (rank: string, name: string, type: string, co: string, score: string) => `<tr> <td class="bv-lb-rank">${rank}</td> <td class="bv-lb-model-name">${name}</td> <td>${type}</td> <td>${co}</td> <td>Aug 3, 2026</td> <td class="bv-lb-score">${score}%</td> </tr>`;
    const rows = parseBabyVision(`<tr> <td class="bv-lb-rank">-</td> <td class="bv-lb-model-name">Human<span>BASELINE</span></td> <td>Human</td> <td>-</td> <td>-</td> <td class="bv-lb-score">94.1%</td> </tr>${tr("1", "Fable 5 (max) (with tools)", "Proprietary", "Anthropic", "90.5")}${tr("2", "Qwen3.8-Max", "Open", "Alibaba", "82.0")}`);
    expect(rows.map((r) => [r.benchmarkId, r.modelLabel, r.effort, r.value, r.labHint])).toEqual([["babyvision-tools", "Fable 5", "max", 90.5, "Anthropic"], ["babyvision", "Qwen3.8-Max", undefined, 82, "Alibaba"]]);
  });

  it("reads ZeroBench's official table (pass@5), leader bolded or not, and stops before the other tables", () => {
    const tr = (m: string, a: string, b: string, bold = false) => `<tr><td>${m}</td><td class="metric-cell" data-sort="${a}"><span class="bar-value">${bold ? `<b>${a}</b>` : a}<sup>●</sup></span></td><td class="metric-cell"><span class="bar-value">${bold ? `<b>${b}</b>` : b}</span></td><td class="metric-cell"><span class="bar-value">7.0</span></td><td data-sort="0.5581">$0.56</td></tr>`;
    const rows = parseZeroBench(`<table id="sortableTable"><thead><tr><th>Model</th></tr></thead>${tr("GPT-6 Astra (max)", "43.2", "52.0", true)}${tr("Gemini 3.1 Pro", "20.0", "30.0")}</table><table>${tr("External (max)", "1", "2")}</table>`);
    expect(rows.map((r) => [r.modelLabel, r.effort, r.value])).toEqual([["GPT-6 Astra", "max", 52], ["Gemini 3.1 Pro", undefined, 30]]);
    expect(rows[0].costUsd).toBeCloseTo(0.5581);
  });

  it("reads MathArena Apex rows with their confidence interval, dropping the contamination marker", () => {
    const table = `<tr><th>Rank</th><th>Model Name</th></tr><tr><td>1</td><td>Claude-Opus-4.8 (max) ⚠️</td><td>Anthropic</td><td>81.25% ± 7.81%</td><td>$4.59</td><td>183562</td></tr><tr><td>4</td><td>Kimi K3 (Think) ⚠️</td><td>Moonshot AI</td><td>65.62% ± 9.50%</td><td>$1.11</td><td>74265</td></tr>`;
    const rows = parseApexTable(JSON.stringify({ table }), "matharena-apex", "p");
    expect(rows.map((r) => [r.modelLabel, r.effort, r.value, r.ci])).toEqual([["Claude-Opus-4.8", "max", 81.25, [73.44, 89.06]], ["Kimi K3", undefined, 65.62, [56.12, 75.12]]]);
    expect(rows[0].costUsd).toBe(4.59);
  });

  it("reads HLE text-only entries from the RSC payload, taking the effort from the parenthetical", () => {
    const entries = [{ model: "gemini-3.1-pro-preview (thinking high)", score: 47.31, confidenceInterval_upper: 2.11, company: "google" }, { model: "GPT 6 Astra", score: 54.17, confidenceInterval_upper: 2.09, company: "openai" }, { model: "Old", score: 5, deprecated: true }];
    const html = `<script>self.__next_f.push([1,${JSON.stringify(`1b:["$","div",null,{"children":["$","$L1d",null,{"entries":${JSON.stringify(entries)}}]}]`)}])</script>`;
    const rows = parseHleText(html);
    expect(rows.map((r) => [r.modelLabel, r.effort, r.value, r.labHint])).toEqual([["gemini-3.1-pro-preview", "high", 47.31, "google"], ["GPT 6 Astra", undefined, 54.17, "openai"]]);
    expect(rows[0].ci?.[1]).toBeCloseTo(49.42);
  });

  it("reads LLMLearner ranking rows with the lab and effort from the setting line", () => {
    const li = (rank: number, name: string, setting: string, score: string) => `<li class="border-b border-ll-line py-4"><span class="w-8 tabular-nums">${rank}</span><a href="/models/x">${name}</a><p class="mt-0.5 break-words">${setting}</p><span class="font-num text-lg leading-7 tabular-nums">${score}</span></li>`;
    const rows = parseRanking(`${li(1, "Claude Opus 5", "Anthropic · Max (With Tools)", "75.3")}${li(2, "Qwen3.8-Max-0902", "Alibaba · Extra-High (With Tools)", "64.9")}${li(3, "Hy4 Preview", "Tencent · Thinking High (With Tools)", "58.9")}`, "nl2repo-bench", "p");
    expect(rows.map((r) => [r.modelLabel, r.effort, r.value, r.labHint])).toEqual([["Claude Opus 5", "max", 75.3, "Anthropic"], ["Qwen3.8-Max-0902", "xhigh", 64.9, "Alibaba"], ["Hy4 Preview", "high", 58.9, "Tencent"]]);
  });
});
