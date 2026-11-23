import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { MAZEBENCH_BENCHMARKS, MAZEBENCH_ID, MAZEBENCH_TOOLS_ID, parseMazeBench, type MazeIndex, type MazePart } from "./mazebench";
import { normalizeLabel } from "../../../src/data/normalize";
import { factsOf } from "../../../src/data/benchmark-facts";
import { sizeOf } from "../../../src/data/benchmark-size";
import { COVERED } from "./boggs";

const dir = path.resolve("scripts/scrape/fixtures/mazebench");
const index = JSON.parse(readFileSync(path.join(dir, "index.json"), "utf8")) as MazeIndex;
const part = JSON.parse(readFileSync(path.join(dir, "part.json"), "utf8")) as MazePart;
const rows = parseMazeBench(index, [part]);
const row = (board: string, model: string) => rows.find((r) => r.benchmarkId === board && r.modelLabel === model);

describe("MazeBench", () => {
  it("reads the board without Python as MazeBench and the one with Python as its sub-board, one gem a point", () => {
    expect(row(MAZEBENCH_ID, "claude-fable-5-2")).toMatchObject({ value: 22, effort: "max", harness: "Claude Code" });
    expect(row(MAZEBENCH_ID, "gpt-6-astra")?.value).toBe(24);
    expect(row(MAZEBENCH_TOOLS_ID, "gpt-6-astra")?.value).toBe(23);
    // The earlier world had fewer gems; the site counts them the same way.
    expect(row(MAZEBENCH_TOOLS_ID, "claude-opus-5")?.value).toBe(12);
    expect(MAZEBENCH_BENCHMARKS.find((b) => b.id === MAZEBENCH_TOOLS_ID)).toMatchObject({ variantOf: MAZEBENCH_ID });
  });
  it("says when a run is still going, and resolves the site's model ids", () => {
    expect(row(MAZEBENCH_ID, "gemini-4-neon-xhigh")?.note).toMatch(/still going/);
    expect(row(MAZEBENCH_ID, "claude-fable-5-2")?.note).not.toMatch(/still going/);
    for (const [label, id] of [["claude-fable-5-2", "claude-fable-5.2"], ["gemini-4-neon-xhigh", "gemini-4-neon"], ["gpt-6.2-sol", "gpt-6.2-sol"]]) {
      const n = normalizeLabel(label);
      expect(n.ok && n.modelId).toBe(id);
    }
  });
  it("is no longer read from Jake Boggs' dashboard, and carries its facts", () => {
    expect(COVERED.has("maze-bench")).toBe(true);
    expect(factsOf({ id: MAZEBENCH_ID })).toMatchObject({ test: "public", released: "2026-07-28", grading: "automatic" });
    expect(sizeOf({ id: MAZEBENCH_TOOLS_ID, variantOf: MAZEBENCH_ID })).toMatchObject({ tasks: 100 });
  });
});
