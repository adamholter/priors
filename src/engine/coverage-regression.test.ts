import { describe, expect, it } from "vitest";
import { loadSnapshot } from "../data/load";
import { computeIndex, selectVariants } from "./index";
import { decodeIndex } from "../lib/url";

// Guards the measured-coverage floor on real data: models that show up in only
// one or two benchmarks of a six-benchmark mix must not ride peer estimates
// into the ranking.
describe("coverage floor on the real snapshot", () => {
  it("drops variants whose measured data covers under half the index", async () => {
    const snapshot = (await loadSnapshot())!;
    const config = decodeIndex("My priors|aa-gdp-pdf:63.4,aa-omniscience:40.7,arc-agi-3:100,deepswe-1.1:85,frontiermath-tier-4-v2:28.1,terminalbench-4:85|strict=50|bars=best|var=best|effort=calibrated", "x")!;
    const result = computeIndex(snapshot, config);
    for (const r of result.ranked) expect(r.measuredShare).toBeGreaterThanOrEqual(0.5 - 1e-9);
    const ids = new Set(selectVariants(result.ranked, "best").map((r) => r.model.id));
    expect(ids).not.toContain("aa-g9v3-39a5b");
    expect(ids).not.toContain("aa-motif-3");
    expect(ids).not.toContain("gpt-5.5-instant");
    expect(ids).toContain("gpt-6-astra");
    // Fable 5.1 has no live DeepSWE 1.1 or ARC-AGI-3 result, so in this mix it's below the floor.
    expect(ids).not.toContain("claude-fable-5.1");
    expect(ids).toContain("claude-opus-5");
  });
});
