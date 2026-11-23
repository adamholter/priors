import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { HII_ID, parseHii } from "./designarena-hii";
import { normalizeLabel } from "../../../src/data/normalize";
import { factsOf } from "../../../src/data/benchmark-facts";
import { sizeOf } from "../../../src/data/benchmark-size";

const html = readFileSync(path.resolve("scripts/scrape/fixtures/designarena-hii/leaderboard.html"), "utf8");

describe("Human Intelligence Index", () => {
  const { rows, board } = parseHii(html);
  const row = (id: string) => rows.find((r) => r.modelLabel === id);
  it("reads the board from the streamed page data, even split across pushes", () => {
    expect(board.category).toBe("human-intelligence-index");
    expect(row("claude-fable-5-2")).toMatchObject({ benchmarkId: HII_ID, value: 54, ci: [51.9, 56.1] });
    // Opus 5.5 is the reference at 50, with no error of its own.
    expect(row("claude-opus-5-5")).toMatchObject({ value: 50 });
    expect(row("claude-opus-5-5")?.ci).toBeUndefined();
    expect(row("gpt-6.2-astra")?.note).toMatch(/5,125 votes/);
  });
  it("resolves the site's model ids; codenames in testing match nothing", () => {
    for (const [label, id] of [["claude-fable-5-2", "claude-fable-5.2"], ["gemini-4-carbon", "gemini-4-carbon"], ["kimi-k3.1-pro", "kimi-k3.1"]]) {
      const n = normalizeLabel(label);
      expect(n.ok && n.modelId).toBe(id);
    }
    expect(normalizeLabel("grogu").ok).toBe(false);
  });
  it("carries its facts: votes, no fixed test set, launched 2026-11-23", () => {
    expect(factsOf({ id: HII_ID })).toMatchObject({ test: "private", released: "2026-11-23", grading: "human-votes" });
    expect(sizeOf({ id: HII_ID })).toMatchObject({ votes: true });
  });
});
