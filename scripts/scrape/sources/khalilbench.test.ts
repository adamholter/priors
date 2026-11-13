import { describe, expect, it } from "vitest";
import { normalizeLabel } from "../../../src/data/normalize";
import { benchmarkQuality } from "../../../src/onboarding/quality";
import type { Snapshot } from "../../../src/data/types";
import { KHALIL_ID, parseKhalilBench } from "./khalilbench";
import { withCatalog } from "../../../src/data/catalog";

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
  it("lists products Khalil rated, like Intersects, in the description, unranked, never as model rows", () => {
    const scale = [{ severity: 2, word: "really cool" }, { severity: 1, word: "kinda cool" }, { severity: 0, word: "meh" }];
    const { rows, benchmarks, notes } = parseKhalilBench({ meta: { scale }, board, rows: [{ product: "Intersects", s: 1 }, { product: null, s: 1 }] });
    expect(rows.some((r) => r.modelLabel === "Intersects")).toBe(false);
    expect(benchmarks[0].description).toContain("Also rated, not models, so unranked as on the Khalil Bench site: Intersects (kinda cool, 75 points).");
    expect(notes?.[0]).toContain("1 unranked product (Intersects)");
    // The catalog's description replaces the source's, but the live note survives it.
    const once = withCatalog(benchmarks[0]).description;
    expect(once.replace("\u2063", "")).toMatch(/Never in a default mix and given no quality score\. Also rated, not models, .*Intersects \(kinda cool, 75 points\)\.$/);
    // The site applies the catalog again to the built snapshot: the note must survive that too.
    expect(withCatalog({ ...benchmarks[0], description: once }).description).toBe(once);
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
