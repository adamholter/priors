import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { normalizeLabel } from "../../../src/data/normalize";
import { parseSpectro, SPECTRO_ID, type SpectroData } from "./spectrobench";

const data: SpectroData = JSON.parse(readFileSync(path.resolve("scripts/scrape/fixtures/spectrobench/data.json"), "utf8"));

describe("SpectroBench", () => {
  const { rows, benchmark } = parseSpectro(data);
  it("matches the leaderboard in the announcement image (x.com/SSHCodes/status/2126402828272902355)", () => {
    expect(rows.map((r) => [r.modelLabel, Math.round(r.value * 10) / 10])).toEqual([
      ["Claude Fable 5.2", 71.4], ["Gemini 4 Carbon", 67.6], ["Gemini 4 Neon", 65.9], ["Claude Opus 5.5", 63], ["Gemini 4 Hydrogen", 62], ["GPT-6.2 Astra", 61.9],
      ["GPT-6.2 Sol", 56.6], ["SWE-2.1", 50.2], ["Grok 4.7", 48.9], ["Muse Wonder Full 1.0", 47.6], ["Muse Wonder 1.0", 44.8], ["GPT-6.1 Terra", 43.1],
    ]);
    expect(rows[0].details).toMatchObject({ prompts: 12, accuracy: 89.9, voiceQuality: 35.8, physics: 91.5, utmos22: 1.75, auditPassed: true });
    expect(rows.every((r) => r.benchmarkId === SPECTRO_ID && r.ci![0] < r.value && r.ci![1] > r.value)).toBe(true);
    expect(benchmark).toMatchObject({ id: SPECTRO_ID, higherIsBetter: true, category: "creative" });
  });
  it("names every model so Priors can file it", () => {
    for (const r of rows) expect(normalizeLabel(r.modelLabel).ok, r.modelLabel).toBe(true);
  });
  it("fails loudly on a partial run", () => {
    const broken = structuredClone(data);
    delete broken.models[3].clips[broken.prompts[0].id];
    expect(() => parseSpectro(broken)).toThrow(/Claude Opus 5.5|Gemini/);
  });
});
