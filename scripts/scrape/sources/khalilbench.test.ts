import { describe, expect, it } from "vitest";
import { normalizeLabel } from "../../../src/data/normalize";
import { benchmarkQuality } from "../../../src/onboarding/quality";
import type { Snapshot } from "../../../src/data/types";
import { KHALIL_ID, parseKhalilBench } from "./khalilbench";

const board = [
  { model: "Claude Fable 5.2", n: 2, score: 88, mean_severity: 1.5, worst: 1.5, best: 1.5 },
  { model: "Claude Opus 5.5", n: 4, score: 63, mean_severity: 0.5, worst: -1, best: 1 },
  { model: "Gemini 4 Hydrogen", n: 6, score: 46, mean_severity: -0.17, worst: -1, best: 1 },
  { model: "GPT-6 Luna", n: 4, score: 47, mean_severity: -0.12, worst: -1, best: 1 },
  { model: "Grok 4.7", n: 1, score: 0, mean_severity: -2, worst: -2, best: -2 },
  { model: "Broken", n: 1 },
];

describe("Khalil Bench", () => {
  it("reads one row per model at its default effort, and stays out of default mixes", () => {
    const { rows, benchmarks } = parseKhalilBench({ meta: { built_at_et: "2026-11-13 12:02 ET", counts: { all_posts: 517 } }, board });
    expect(rows.map((r) => [r.modelLabel, r.value, r.effortUnstated])).toEqual([["Claude Fable 5.2", 88, true], ["Claude Opus 5.5", 63, true], ["Gemini 4 Hydrogen", 46, true], ["GPT-6 Luna", 47, true], ["Grok 4.7", 0, true]]);
    expect(rows[4].note).toBe("1 verdict, from -2 to -2 on the -2 (yuck) to +2 (really cool) scale");
    expect(benchmarks[0]).toMatchObject({ id: KHALIL_ID, eligibleForDefault: false, defaultWeight: 0, lastUpdated: "2026-11-13", category: "preference" });
    expect(rows.slice(0, 4).map((r) => normalizeLabel(r.modelLabel).ok)).toEqual([true, true, true, true]);
  });
  it("has no quality score", () => {
    const { rows, benchmarks } = parseKhalilBench({ board });
    const snap = { date: "2026-11-13", models: [], labs: [], variants: [], series: [], sources: [], benchmarks,
      observations: rows.map((r, i) => ({ benchmarkId: r.benchmarkId, variantId: `m${i}@default`, value: r.value, observedAt: "t", sourceUrl: "u" })) } as unknown as Snapshot;
    const q = benchmarkQuality(snap, [])[0];
    expect(q.score).toBe(0);
    expect(q.reason).toMatch(/^Not a serious benchmark/);
  });
});
