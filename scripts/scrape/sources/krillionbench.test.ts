import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { normalizeLabel } from "../../../src/data/normalize";
import { KRILLION_ID, parseKrillion, type KrillionData } from "./krillionbench";

const data: KrillionData = JSON.parse(readFileSync(path.resolve("scripts/scrape/fixtures/krillionbench/data.json"), "utf8"));

describe("KrillionBench", () => {
  const { rows, benchmark } = parseKrillion(data);
  it("reads all 15 models in the order of the announcement chart (x.com/internetphysics/status/2126378656528543755)", () => {
    expect(rows.map((r) => [r.modelLabel, Math.round(r.value * 10) / 10])).toEqual([
      ["GPT-6.2 Astra", 552.7], ["GPT-6.2 Sol", 543.4], ["Kimi K3.1 Pro", 532.2], ["Gemini 4 Neon", 523.3], ["Grok 4.7", 521.7], ["Muse Wonder", 503.9],
      ["Claude Fable 5.2", 501.6], ["Qwen3.8 2.4T", 484.7], ["Claude Opus 5.5", 463.6], ["GLM-5.3", 454.7], ["Claude Haiku 5.5", 447.4], ["DeepSeek V4 Pro", 441.1],
      ["Inkling 2 Small", 440.6], ["Claude Sonnet 5.5", 334.1], ["MiniMax M3", 215.7],
    ]);
    expect(rows.every((r) => r.effort === "high" && r.benchmarkId === KRILLION_ID && r.ci![0] < r.value && r.ci![1] > r.value)).toBe(true);
    expect(rows[0].details).toMatchObject({ games: 76, median: 560, min: 435, max: 625, humanMean: 248 });
    expect(benchmark).toMatchObject({ id: KRILLION_ID, higherIsBetter: true, category: "knowledge", normalization: { max: 700 } });
  });
  it("names every model so Priors can file it", () => {
    for (const r of rows) expect(normalizeLabel(r.modelLabel).ok, r.modelLabel).toBe(true);
  });
  it("fails loudly on a partial run or a mean that does not match the scores", () => {
    const partial = structuredClone(data);
    partial.runs.high.models[2].scores.pop();
    expect(() => parseKrillion(partial)).toThrow(/Kimi K3.1 Pro/);
    const off = structuredClone(data);
    off.runs.high.models[0].mean += 5;
    expect(() => parseKrillion(off)).toThrow(/GPT-6.2 Astra/);
  });
});
