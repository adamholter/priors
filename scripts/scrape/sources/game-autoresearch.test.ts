import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { GAME_AUTORESEARCH_FILES, GAME_AUTORESEARCH_ID, parseGameAutoresearch, readScale } from "./game-autoresearch";
import { normalizeLabel } from "../../../src/data/normalize";
import { factsOf } from "../../../src/data/benchmark-facts";
import { sizeOf } from "../../../src/data/benchmark-size";

const dir = path.resolve("scripts/scrape/fixtures/game-autoresearch");
const files = Object.fromEntries(GAME_AUTORESEARCH_FILES.map((f) => [f, readFileSync(path.join(dir, f.endsWith(".tsx") ? `${f}.txt` : f), "utf8")])) as Parameters<typeof parseGameAutoresearch>[0];
const id = (label: string) => { const n = normalizeLabel(label); return n.ok ? n.modelId : null; };

describe("Game Autoresearch Bench", () => {
  const { rows, benchmark } = parseGameAutoresearch(files);
  const row = (m: string) => rows.find((r) => r.modelLabel === m)!;
  it("reproduces the article's overall score (Figure 1, 2026-11-25) from the repo's data", () => {
    expect(rows.map((r) => [r.modelLabel, r.value])).toEqual([
      ["Gemini 4 Neon", 59.3], ["Claude Fable 5.2", 56.5], ["GPT-6.2 Astra", 52.6], ["GPT-6.2 Sol", 51.8], ["Gemini 4 Carbon", 51.2],
      ["GPT-6 Astra", 48.8], ["Claude Opus 5.5", 48.2], ["GPT-6.1 Sol", 47.1], ["DeepSeek V4.1 Flash", 42.6], ["Kimi K3.1 Pro", 38.1],
    ]);
    expect(row("Gemini 4 Neon")).toMatchObject({ benchmarkId: GAME_AUTORESEARCH_ID, rank: 1, harness: "Terminus-2", ci: [58.1, 60.6] });
    const tasks = row("Claude Fable 5.2").details!.tasks as Record<string, { raw: number; score: number }>;
    expect(Object.keys(tasks)).toHaveLength(6);
    expect(tasks["Generals tournament"]).toEqual({ raw: 1384.6, score: 61.3 });
    expect(benchmark).toMatchObject({ unit: "score", defaultWeight: 0, category: "science" });
  });
  it("reads the frozen scale from the page's source and fails loudly when it moves", () => {
    const scale = readScale(files["TopScore.tsx"], files["CostMultiplier.tsx"]);
    expect(scale.norms.poly_empty.mean).toBe(62.48);
    expect(scale.cells["8h"]["$8.70, 4 h limit"]).toBeCloseTo(-0.2929, 4);
    expect(scale.cells["1h"].$23).toBeCloseTo(-0.00918, 5);
    expect(scale.crash).toBe(0.5);
    expect(() => readScale(files["TopScore.tsx"].replace("const NORMS", "const SCALE"), files["CostMultiplier.tsx"])).toThrow(/no NORMS/);
    expect(() => readScale(files["TopScore.tsx"].replace('"recipe8"];', '"recipe8", "clash"];'), files["CostMultiplier.tsx"])).toThrow(/task list/);
  });
  it("matches every model", () => {
    expect(rows.map((r) => [r.modelLabel, id(r.modelLabel)]).filter(([, m]) => !m)).toEqual([]);
  });
  it("carries its facts: private grading panels, released 2026-11-25, six tasks", () => {
    expect(factsOf({ id: GAME_AUTORESEARCH_ID })).toMatchObject({ test: "partial", released: "2026-11-25", grading: "automatic" });
    expect(sizeOf({ id: GAME_AUTORESEARCH_ID })).toMatchObject({ tasks: 6, runs: 1 });
  });
});
