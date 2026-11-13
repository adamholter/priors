import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { cellNum, getPath, htmlTables, parseAriaText, readAriaLabel, readJson, readNextData, readTable } from "./readers";

const fixture = (f: string) => readFileSync(new URL(`../fixtures/${f}`, import.meta.url), "utf8");

describe("ariaLabel reader", () => {
  const html = fixture("boards-aria.html");
  it("picks the label that parses into the most rows and reads efforts, intervals and cost per task", () => {
    const rows = readAriaLabel(html);
    expect(rows.map((r) => r.modelLabel)).toEqual(["Human", "Random", "GPT-6.1 Sol", "GPT-6.1 Sol", "Sonnet 5.5", "Sonnet 5.5"]);
    expect(rows[2]).toEqual({ modelLabel: "GPT-6.1 Sol", effort: "low", value: 73.9, costUsd: 0.043 });
    expect(rows[3].ci![0]).toBeCloseTo(77.9);
    expect(rows[3]).toMatchObject({ effort: "high", value: 79.1, costUsd: 0.108 });
  });
  it("drops the text before `after`, and selects by `match`", () => {
    expect(readAriaLabel(html, { match: /^Accuracy across/, after: /Baselines:.*?%\.\s/ }).map((r) => r.modelLabel)).toEqual(["GPT-6.1 Sol", "GPT-6.1 Sol", "Sonnet 5.5", "Sonnet 5.5"]);
    expect(readAriaLabel(html, { match: "^Overall score" })).toEqual([
      { modelLabel: "Fable 5.2", value: 82.2 }, { modelLabel: "GPT-6 Astra", value: 80.8 }, { modelLabel: "Acme Agent", value: 77.9 }, { modelLabel: "Opus 5.5", value: 79.2 },
    ]);
    expect(() => readAriaLabel(html, { match: /^Nothing/ })).toThrow(/no aria-label matches/);
  });
  it("reads \"Name: 71.5%\" items after a heading, and never takes a token price for a cost", () => {
    expect(readAriaLabel(html, { match: /^Pass rate/ })).toEqual([{ modelLabel: "Gemini 4 Argon", value: 71.5 }, { modelLabel: "GLM-5.3", value: 40 }, { modelLabel: "Kimi K3.1 Pro", value: 38.25 }]);
    expect(parseAriaText("Token price: Grok 4.7 at $3.00 per million tokens")).toEqual([]);
    expect(parseAriaText("Scores: Grok 4.7 61.0% at $0.12 per run")).toEqual([{ modelLabel: "Grok 4.7", value: 61, costUsd: 0.12 }]);
  });
});

describe("paths", () => {
  const data = { a: { list: [{ k: "x", v: 1 }, { k: "y.z", v: 2, deep: { n: [5, 6] } }] }, byName: { m1: { s: 1 }, m2: { s: 2 } } };
  it("reads keys, indexes, [key=value] finds (dots in the value allowed) and objects as entries", () => {
    expect(getPath(data, "a.list[1].v")).toBe(2);
    expect(getPath(data, "a.list[k=y.z].deep.n[1]")).toBe(6);
    expect(getPath(data, "a.list[k=nope].v")).toBeUndefined();
    expect(getPath(data, "byName[$key=m2].s")).toBe(2);
    expect(getPath(data, "missing.path")).toBeUndefined();
  });
});

describe("nextData and json readers", () => {
  it("selects rows by path with keyed sub-arrays, intervals, efforts and details", () => {
    const rows = readNextData(fixture("boards-next.html"), {
      rows: "props.pageProps.boards[key=widget-v1].rows", label: "model.name", value: "scores[metric=mean].value", ciHalf: "scores[metric=mean].err", effort: "model.effort",
      details: { id: "model.id", best: "scores[metric=best].value" },
    });
    expect(rows).toEqual([
      { modelLabel: "GPT-6 Astra", value: 71.5, effort: "high", ci: [69, 74], details: { id: "gpt-6-astra", best: 80 } },
      { modelLabel: "Fable 5.2", value: 75, effort: "max", ci: [72, 78], details: { id: "fable-5-2", best: 85 } },
      { modelLabel: "Gemini 4 Argon", value: 64.25, ci: [62.5, 66], details: { id: "gemini-4-argon", best: 70 } },
    ]);
  });
  it("reads another JSON script by id, rows keyed by model as $key", () => {
    expect(readNextData(fixture("boards-next.html"), { script: "board-data", rows: "entries", label: "$key", value: "accuracy" }).map((r) => [r.modelLabel, r.value])).toEqual([["GLM-5.3", 0.41], ["Kimi K3.1 Pro", 0.385], ["Grok 4.7", 0.333]]);
  });
  it("throws when the script or the array is gone", () => {
    expect(() => readNextData("<html></html>", { rows: "a", label: "b", value: "c" })).toThrow(/__NEXT_DATA__/);
    expect(() => readNextData(fixture("boards-next.html"), { rows: "props.pageProps.boards[key=widget-v9].rows", label: "b", value: "c" })).toThrow(/no array at/);
  });
  it("reads a JSON endpoint with low and high interval fields and a cost per task", () => {
    const rows = readJson(fixture("boards.json"), { rows: "leaderboard", label: "model_name", value: "accuracy", effort: "reasoning_effort", ciLow: "ci_low", ciHigh: "ci_high", cost: "cost_per_task" });
    expect(rows).toHaveLength(4);
    expect(rows[0]).toEqual({ modelLabel: "GPT-6.1 Sol", value: 0.612, effort: "medium", ci: [0.58, 0.64], costUsd: 0.21 });
    expect(rows[2].effort).toBeUndefined();
    expect(rows[3]).toEqual({ modelLabel: "Human expert", value: 0.9 });
  });
});

describe("table reader", () => {
  const html = fixture("boards-table.html");
  it("takes the last header row, so group headers with colspans name no column", () => {
    const t = htmlTables(html);
    expect(t).toHaveLength(3);
    expect(t[1].headers).toEqual(["#", "Model", "Score", "95% CI", "Cost", "Effort"]);
    expect(t[1].rows).toHaveLength(5);
    expect(t[2].headers).toEqual(["Rank", "System", "Win rate (%)"]);
  });
  it("reads value, interval (± or bracket column, or ± in the value), effort and cost; skips non-numeric cells", () => {
    const rows = readTable(html, { table: "Score", label: "Model", value: "Score", ci: "95% CI", cost: "Cost", effort: "Effort" });
    expect(rows.map((r) => r.modelLabel)).toEqual(["GPT-6 Astra (max) New", "Claude Opus 5.5 & tools", "Human baseline", "GLM-5.3"]);
    expect(rows[0]).toMatchObject({ value: 43.2, effort: "max", costUsd: 0.56 });
    expect(rows[0].ci![1]).toBeCloseTo(45.3);
    expect(rows[1]).toMatchObject({ value: 35, ci: [31.5, 38.9], effort: "high", costUsd: 1.11 });
    expect(rows[2]).toEqual({ modelLabel: "Human baseline", value: 88 });
    expect(rows[3]).toMatchObject({ value: 12.5, ci: [11, 14], costUsd: 0.04 });
  });
  it("picks a table by index and a column by part of its name, and names what is missing", () => {
    expect(readTable(html, { table: 2, label: "System", value: "Win rate" }).map((r) => r.value)).toEqual([61, 55.5, 52]);
    expect(() => readTable(html, { table: 2, label: "Model", value: "Win rate" })).toThrow(/no column "Model" in \[Rank \| System/);
    expect(() => readTable(html, { table: 7, label: "a", value: "b" })).toThrow(/table 7 not found/);
  });
  it("reads footnote-marked numbers but never a cell with words", () => {
    expect(cellNum("43.2●")).toBe(43.2);
    expect(cellNum("$1.11")).toBe(1.11);
    expect(cellNum("GPT-6 Astra")).toBeUndefined();
    expect(cellNum("n/a")).toBeUndefined();
  });
});
