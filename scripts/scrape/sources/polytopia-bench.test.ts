import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { normalizeLabel } from "../../../src/data/normalize";
import { indexExtensions, parsePolytopia, POLYTOPIA_ID, type PolytopiaFiles } from "./polytopia-bench";

const dir = path.resolve("scripts/scrape/fixtures/polytopia-bench");
const files: PolytopiaFiles = {
  index: readFileSync(path.join(dir, "INDEX.md"), "utf8"),
  campaign: JSON.parse(readFileSync(path.join(dir, "article-data.json"), "utf8")),
  extensions: { "fable52-20261110": JSON.parse(readFileSync(path.join(dir, "fable52-article-model.json"), "utf8")) },
};

describe("Polytopia Bench", () => {
  const { rows, benchmark } = parsePolytopia(files);
  it("reads all 13 models from the campaign and the Fable 5.2 follow-up, matching the authors' index", () => {
    expect(indexExtensions(files.index)).toEqual([{ label: "Claude Fable 5.2", dir: "fable52-20261110", date: "2026-11-10" }]);
    expect(rows.map((r) => [r.modelLabel, r.value])).toEqual([
      ["GPT-6 Astra", 74.94], ["GPT-6.1 Sol", 74.39], ["Gemini 4 Argon", 64.36], ["Claude Fable 5.2", 54.33], ["Claude Opus 5.5", 43.42], ["Claude Fable 5.1", 31.89],
      ["Kimi K3.1 Pro", 31.06], ["GLM 5.3", 30.53], ["Qwen 3.8 Max", 26.56], ["GPT-6 Luna", 19.58], ["DeepSeek V4.1 Flash", 18.36], ["DeepSeek V4 Pro", 15.19], ["MiniMax M3.1 Flash", 13.08],
    ]);
    expect(rows.every((r) => r.effort === "high" && r.benchmarkId === POLYTOPIA_ID)).toBe(true);
    expect(benchmark).toMatchObject({ id: POLYTOPIA_ID, higherIsBetter: true, category: "games" });
  });
  it("keeps attempts, the ±1 SE interval and wins against the RL champion (the index's column)", () => {
    const astra = rows[0], d = astra.details as { attempts: number; championWins: number; championGames: number; evaluated: string };
    expect(d).toMatchObject({ attempts: 5, championWins: 8, championGames: 300, evaluated: "2026-10-31" });
    expect(astra.ci![0]).toBeCloseTo(74.94 - 6.02 / Math.sqrt(5), 1);
    expect((rows.find((r) => r.modelLabel === "Claude Fable 5.2")!.details as { championWins: number; evaluated: string })).toMatchObject({ championWins: 4, evaluated: "2026-11-10" });
  });
  it("names every model so Priors can file it", () => {
    for (const r of rows) expect(normalizeLabel(r.modelLabel).ok, r.modelLabel).toBe(true);
  });
  it("fails loudly when the index lists a model no data file has", () => {
    const index = files.index.replace("| [GLM 5.3]", "| [GLM 9]");
    expect(() => parsePolytopia({ ...files, index })).toThrow(/GLM 9/);
  });
});
