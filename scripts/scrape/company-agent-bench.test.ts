import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { BOARDS } from "./boards/configs";
import { parseBoard } from "./boards/run";
import { normalizeLabel } from "../../src/data/normalize";

const html = readFileSync(new URL("./fixtures/company-agent-bench.html", import.meta.url), "utf8");
const config = BOARDS.find((b) => b.id === "company-agent-bench")!;

describe("Company Agent Bench (config board)", () => {
  it("reads every API model at each effort with its cost per question, and no agent products", () => {
    const { benchmark, rows } = parseBoard(config, html);
    expect(benchmark).toMatchObject({ id: "company-agent-bench", sourceId: "company-agent-bench", unit: "percent" });
    expect(benchmark.description).toMatch(/^205 questions/);
    expect(rows).toHaveLength(18);
    expect(rows.find((r) => r.modelLabel === "Claude Fable 5.2" && r.effort === "high")).toMatchObject({ value: 82.2, costUsd: 1.345 });
    expect(rows.find((r) => r.modelLabel === "GPT-6 Astra" && r.effort === "medium")).toMatchObject({ value: 81.1, costUsd: 0.318 });
    expect(rows.some((r) => /Dots|Devin|Grok Bot|Tag/.test(r.modelLabel))).toBe(false);
    for (const r of rows) expect(normalizeLabel(r.modelLabel).ok).toBe(true);
  });
  it("throws on a changed page", () => {
    expect(() => parseBoard(config, "<html></html>")).toThrow(/no aria-label matches/);
  });
});
