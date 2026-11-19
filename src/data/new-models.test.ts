import { describe, expect, it } from "vitest";
import { FAST_DAYS, newModelStats, NOTABLE_BENCHMARKS, SLOW_DAYS, withToday } from "./new-models";
import type { Snapshot } from "./types";

/** `models`: id, release date. Every model is scored by enough benchmarks ("pad-N") to be notable unless `quiet`. */
function snapshot(date: string, models: [id: string, released: string, quiet?: boolean][], rows: [benchmark: string, model: string][]): Snapshot {
  const pad = models.flatMap(([id, , quiet]) => quiet ? [] : Array.from({ length: NOTABLE_BENCHMARKS }, (_, i) => [`pad-${i}`, id] as [string, string]));
  const all = [...rows, ...pad], benchmarks = [...new Set(all.map(([b]) => b))];
  return {
    version: 1, date, generatedAt: "", labs: [], series: [], sources: [],
    models: models.map(([id, releaseDate]) => ({ id, name: id, labId: "x", kind: "llm", releaseDate })),
    variants: models.map(([id]) => ({ id: `${id}@high`, modelId: id, effort: "high" })),
    benchmarks: benchmarks.map((id) => ({ id })),
    observations: all.map(([benchmarkId, model]) => ({ benchmarkId, variantId: `${model}@high`, value: 50, observedAt: "" })),
  } as unknown as Snapshot;
}
const seen = (entries: Record<string, Record<string, string>>) => new Map(Object.entries(entries).map(([b, m]) => [b, new Map(Object.entries(m))]));

describe("how quickly a benchmark adds new models", () => {
  const models: [string, string, boolean?][] = [["old", "2026-08-01"], ["a", "2026-10-01"], ["b", "2026-10-10"], ["c", "2026-10-20"]];
  const snap = snapshot("2026-11-19", models, [["fast", "old"], ["fast", "a"], ["fast", "b"], ["fast", "c"], ["slow", "old"], ["slow", "a"]]);
  it("gives full credit for models scored within a week of release and reports the median wait", () => {
    const stats = newModelStats(snap, seen({ fast: { old: "2026-09-05", a: "2026-10-03", b: "2026-10-10", c: "2026-10-26" } }), "2026-09-05").get("fast")!;
    expect(stats).toMatchObject({ of: 3, added: 3, medianDays: 2, score: 100 });
  });
  it("gives nothing for a model it never scored and partial credit for a late one", () => {
    const late = Math.round((FAST_DAYS + SLOW_DAYS) / 2), at = new Date(Date.parse("2026-10-01") + late * 86_400_000).toISOString().slice(0, 10);
    const stats = newModelStats(snap, seen({ slow: { old: "2026-09-05", a: at } }), "2026-09-05").get("slow")!;
    expect(stats).toMatchObject({ of: 3, added: 1, medianDays: late });
    // One of three equally tested models at half credit.
    expect(stats.score).toBe(17);
  });
  it("ignores models released before the benchmark was first seen, brand-new models it has not reached yet, and models few benchmarks test", () => {
    const more: [string, string, boolean?][] = [...models, ["d", "2026-10-25"], ["fresh", "2026-11-15"], ["obscure", "2026-10-05", true]];
    const s = snapshot("2026-11-19", more, [["fast", "old"]]);
    const stats = newModelStats(s, seen({ fast: { old: "2026-10-05", b: "2026-10-11", c: "2026-10-21", d: "2026-10-27" } }), "2026-09-05").get("fast")!;
    // `a` (Oct 1) predates the first sighting (Oct 5); `fresh` is 4 days old and unscored; `obscure` is not notable.
    expect(stats).toMatchObject({ of: 3, added: 3, medianDays: 1, score: 100 });
  });
  it("says nothing with fewer than three new models to judge by", () => {
    const s = snapshot("2026-11-19", [["old", "2026-08-01"], ["a", "2026-10-01"]], [["few", "old"], ["few", "a"]]);
    expect(newModelStats(s, seen({ few: { old: "2026-09-05", a: "2026-10-02" } }), "2026-09-05").has("few")).toBe(false);
  });
  it("counts a score that appears today as first seen today, and skips estimated rows", () => {
    const first = withToday(seen({ fast: { old: "2026-09-05" } }), snap, (o) => o.variantId.startsWith("c@"));
    expect(first.get("fast")!.get("a")).toBe("2026-11-19");
    expect(first.get("fast")!.get("old")).toBe("2026-09-05");
    expect(first.get("fast")!.has("c")).toBe(false);
  });
});
