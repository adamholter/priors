import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parseDuelLab } from "./sources/duellab";
import { latestLogic, parseLlm2014 } from "./sources/llm2014";
import { parseEnigmaEval } from "./sources/enigmaeval";

const fx = (n: string) => readFileSync(new URL(`./fixtures/${n}`, import.meta.url), "utf8");

describe("DuelLab GameBench 2", () => {
  it("reads ranked model+reasoning rows from the track export, not per-game rows", () => {
    const r = parseDuelLab(fx("duellab.csv"));
    expect(r.rows).toHaveLength(4);
    expect(r.rows[0]).toMatchObject({ benchmarkId: "duellab-gamebench2", modelLabel: "Claude Opus 5.5", effort: "xhigh", rank: 1 });
    expect(r.rows[0].value).toBeGreaterThan(90);
    expect(r.rows[0].ci![0]).toBeLessThan(r.rows[0].value);
  });
  it("fails visibly without ranked rows", () => { expect(() => parseDuelLab("row_kind,track_id\ngame,x\n")).toThrow(); });
});

describe("LLM2014 logic", () => {
  it("scores the median column, splits effort, flags estimates, drops refuse variants", () => {
    const r = parseLlm2014(fx("llm2014-logic.csv"), "2026-10");
    const by = new Map(r.rows.map((x) => [`${x.modelLabel}|${x.effort}`, x]));
    expect(by.get("GPT-6 Astra|xhigh")!.value).toBeCloseTo(86.53);
    expect(by.get("Opus 5.5|xhigh")!.value).toBeCloseTo(77.69);
    expect(by.get("Opus 5.5|xhigh")!.note).toContain("estimated");
    expect(r.rows.some((x) => /refuse/.test(x.note ?? ""))).toBe(false);
  });
  it("picks the newest logic month", () => {
    const d = [{ category: "code", reportDate: "2026-11", tableIndex: 0, csv: "c" }, { category: "logic", reportDate: "2026-09", tableIndex: 0, csv: "a" }, { category: "logic", reportDate: "2026-10", tableIndex: 0, csv: "b" }];
    expect(latestLogic(d).csv).toBe("b");
  });
});

describe("EnigmaEval", () => {
  it("splits Scale's model-effort slugs", () => {
    const entries = JSON.stringify([{ model: "claude-fable-5-high", score: 39.28, confidenceInterval_upper: 2.8, company: "anthropic" }, { model: "gemini-3.5-flash-high", score: 25.41, deprecated: true }, { model: "gpt-5.6-sol-xhigh", score: 30 }]);
    const html = `<script>self.__next_f.push([1,${JSON.stringify(`x:{"entries":${entries}}`)}])</script>`;
    const rows = parseEnigmaEval(html);
    expect(rows.map((r) => [r.modelLabel, r.effort, r.value])).toEqual([["claude-fable-5", "high", 39.28], ["gpt-5.6-sol", "xhigh", 30]]);
    expect(rows[0].ci![1]).toBeCloseTo(42.08);
  });
});
