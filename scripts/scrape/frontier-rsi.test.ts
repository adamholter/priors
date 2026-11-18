import { describe, expect, it } from "vitest";
import { normalizeLabel } from "../../src/data/normalize";
import { FRONTIER_RSI_ID, parseFrontierRsi, readRsiData, type RsiData } from "./sources/frontier-rsi";

const row = (model: string, avg: number | null) => ({ model, harness: "Codex", effort: "max", avg, trials: [{}, {}] });
const data = (extra: Partial<RsiData> = {}): RsiData => ({
  categories: [{ id: "pretrain", name: "Pre-training" }, { id: "kernels", name: "GPU kernels" }],
  tasks: [{ id: "a", category: "pretrain", models: [row("GPT-6.1 Sol", 1), row("Grok 4.7", 0), row("Partial", 1)] }, { id: "b", category: "kernels", models: [row("GPT-6.1 Sol", 0.5), row("Grok 4.7", 0.25)] }],
  models: { "GPT-6.1 Sol": { lab: "OpenAI", cost: { total_usd: 8, tasks_with_cost: 2, tasks_imputed: 0, trials_without_cost: 0, estimated: 0, rebuilt: 0 } }, "Grok 4.7": { lab: "xAI", cost: { total_usd: 8, tasks_with_cost: 2, tasks_imputed: 1 } } }, ...extra,
});

describe("FrontierRSI", () => {
  it("averages each model over all tasks and over each area, as the site does", () => {
    const { rows, benchmarks, skipped } = parseFrontierRsi(data()), main = rows.filter((r) => r.benchmarkId === FRONTIER_RSI_ID);
    expect(main.map((r) => [r.modelLabel, r.effort, r.value, r.harness])).toEqual([["GPT-6.1 Sol", "max", 75, "Codex"], ["Grok 4.7", "max", 12.5, "Codex"]]);
    expect(rows.find((r) => r.benchmarkId === "frontier-rsi-kernels" && r.modelLabel === "GPT-6.1 Sol")?.value).toBe(50);
    expect(benchmarks.find((b) => b.id === "frontier-rsi-pretrain")).toMatchObject({ variantOf: FRONTIER_RSI_ID, variantLabel: "Pre-training" });
    expect(skipped).toEqual(["Partial"]);
  });
  it("gives a cost per trial only when none of it is imputed", () => {
    const main = parseFrontierRsi(data()).rows.filter((r) => r.benchmarkId === FRONTIER_RSI_ID);
    expect(main.map((r) => r.costUsd)).toEqual([2, undefined]);
  });
  it("reads the data file and refuses one that disagrees with itself", () => {
    expect(readRsiData(`window.FRSI = ${JSON.stringify(data())};`).tasks).toHaveLength(2);
    expect(() => readRsiData(`window.FRSI = ${JSON.stringify(data({ stats: { tasks: 27 } }))};`)).toThrow(/27/);
    expect(() => readRsiData("const x = {};")).toThrow(/changed/);
  });
  it("matches the models on the board", () => {
    for (const [label, id] of [["Claude Opus 5.5", "claude-opus-5.5"], ["Gemini 4 Argon", "gemini-4"], ["Kimi K3.1 Pro", "kimi-k3.1"], ["Muse Wonder 1.0", "aa-muse-wonder"]]) expect(normalizeLabel(label)).toMatchObject({ modelId: id });
  });
});
