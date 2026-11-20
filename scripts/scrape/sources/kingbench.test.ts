import { describe, expect, it } from "vitest";
import { normalizeLabel } from "../../../src/data/normalize";
import videos from "../fixtures/kingbench/videos.json";
import { KINGBENCH_ID, parseKingBench, scoresIn, type Video } from "./kingbench";

describe("KingBench 4", () => {
  const { rows, benchmarks } = parseKingBench(videos as Video[]);
  const score = (label: string) => rows.find((r) => r.modelLabel === label)?.value;

  it("reads every score the KingBench 4 video descriptions state, as a percent of 60", () => {
    expect(Object.fromEntries(rows.map((r) => [r.modelLabel, r.value]))).toEqual({
      "Claude Fable 5.2": 70, "Gemini 4 Neon": 63.2, "Claude Opus 5.5": 57.8, "GPT 6 Astra": 56.5, "GPT-6.2 Astra": 56, "GPT-6.1 Sol": 55,
      "Gemini 4 Argon": 54.3, "Haiku 5.5": 54.2, "Kimi K3.1 Pro": 53.7, "Gemini 4 Carbon": 53.3, "Muse Wonder Full": 53, "Qwen 4 Max Preview": 51,
      "GPT-6.2 Sol": 49.3, "GLM 5.3": 45.8, "Muse Wonder": 45.8, "Gemini 4 Hydrogen": 41.5,
    });
    expect(rows.every((r) => normalizeLabel(r.modelLabel).ok)).toBe(true);
    expect(rows.every((r) => r.effort === "high" && r.benchmarkId === KINGBENCH_ID)).toBe(true);
  });

  it("files each model under its newest video and says where the figure came from", () => {
    const opus = rows.find((r) => r.modelLabel === "Claude Opus 5.5")!;
    expect(opus.sourceUrl).toBe("https://www.youtube.com/watch?v=eXeJNYojT3A");
    expect(opus.note).toBe('34.7 of 60, from "Thanks Google! I am cancelling my Claude subscription..." (2026-11-18)');
    expect(score("Kimi K3.1 Pro")).toBe(53.7);
  });

  it("reads short names as the longer name in the same description", () => {
    const d = "I review Google's Gemini 4 Neon on KingBench 4.\n\n🎯 Neon finishes with 37.9 out of 60 (63.2%), behind only Claude Fable 5.2 (42.0).";
    expect(parseKingBench([{ id: "x", title: "t", date: "2026-11-18", description: d }, ...(videos as Video[])]).rows.find((r) => r.modelLabel === "Gemini 4 Neon")?.value).toBe(63.2);
  });

  it("leaves out other benchmarks, costs, teams and KingBench 3", () => {
    expect(scoresIn("🏆 Opus 5.5 scores 75 out of 80 on KingBench 3, while GPT-6 Sol scores 66 out of 80.")).toEqual([]);
    const kb4 = "Six KingBench 4 tasks.\n";
    expect(scoresIn(`${kb4}📊 The launch blog claims 65.7% on Terminal-Bench 4.0, right next to Opus 5.5 at 66.4%.`)).toEqual([]);
    expect(scoresIn(`${kb4}🏆 Opus with Sol has the highest comparable total at 44.2 out of 60, with Opus with Sonnet close behind at 43.7.`)).toEqual([]);
    expect(scoresIn(`${kb4}💸 On the same three projects, Haiku's estimated API cost is about 85% lower than Opus's, with an average score of 71.3% versus 78.0%.`)).toEqual([]);
    expect(scoresIn("Carbon scores 32 out of 60 on a test.")).toEqual([]);
  });

  it("is a coding benchmark kept out of default mixes", () => {
    expect(benchmarks[0]).toMatchObject({ id: KINGBENCH_ID, name: "KingBench 4", category: "coding", eligibleForDefault: false, unit: "percent", lastUpdated: "2026-11-18" });
  });

  it("fails loudly when the descriptions stop yielding scores", () => {
    expect(() => parseKingBench([])).toThrow(/KingBench 4: 0 models/);
  });
});
