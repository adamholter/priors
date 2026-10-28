import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { normalizeLabel } from "../../src/data/normalize";
import { PRINZBENCH_ID, parsePrinzbench } from "./sources/prinzbench";

const md = readFileSync(new URL("./fixtures/prinzbench-readme.md", import.meta.url), "utf8");

describe("prinzbench README leaderboard", () => {
  it("reads the full score out of the header's maximum, sub-scores in details, and the update date", () => {
    const r = parsePrinzbench(md);
    expect(r.outOf).toBe(99);
    expect(r.updated).toBe("2026-07-18");
    expect(r.rows).toHaveLength(10);
    expect(r.rows[0]).toMatchObject({ benchmarkId: PRINZBENCH_ID, modelLabel: "gpt-5.6-sol-pro", value: 91, details: { legalResearch: 67, legalResearchOutOf: 75, search: 24, searchOutOf: 24, earlyAccess: true } });
    expect(r.rows[0].note).toContain("early testing");
    expect(r.rows.map((x) => x.value)).toEqual([...r.rows.map((x) => x.value)].sort((a, b) => b - a));
  });

  it("splits API efforts, keeps ChatGPT thinking settings in the label, drops the early-access asterisk", () => {
    const by = new Map(parsePrinzbench(md).rows.map((x) => [x.modelLabel, x]));
    expect(by.get("fable-5")).toMatchObject({ effort: "max", value: 56 });
    expect(by.get("gpt-5.4")).toMatchObject({ effort: "xhigh", value: 69 });
    expect(by.get("gpt-5.4-thinking (heavy)")).toMatchObject({ effort: undefined, value: 68 });
    expect(by.get("gpt-5.5-pro (extended)")).toMatchObject({ effort: undefined, details: { earlyAccess: true } });
    expect(by.get("sonnet-4.6")!.details).toMatchObject({ earlyAccess: false, search: 0 });
  });

  it("every fixture label resolves to a known model", () => {
    const ids = parsePrinzbench(md).rows.map((x) => { const n = normalizeLabel(x.modelLabel, x.effort); return n.ok ? `${n.modelId}@${n.effort ?? ""}` : `unknown:${x.modelLabel}`; });
    expect(ids).toEqual([
      "gpt-5.6-sol-pro@", "gpt-5.5-pro@", "gpt-5.4@xhigh", "gpt-5.4@", "gpt-5.4@", "claude-fable-5@max",
      "gpt-5.3-codex@high", "aa-muse-spark@", "qwen-3-max@", "claude-sonnet-4.6@",
    ]);
  });

  it("fails visibly when the block or columns change", () => {
    expect(() => parsePrinzbench(md.replace("<!-- LEADERBOARD_START -->", ""))).toThrow(/LEADERBOARD/);
    expect(() => parsePrinzbench(md.replace("prinzbench (full) score (x/99)", "score"))).toThrow(/columns changed/);
  });
});
