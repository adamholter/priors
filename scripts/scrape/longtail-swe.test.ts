import { describe, expect, it } from "vitest";
import { normalizeLabel } from "../../src/data/normalize";
import { LONGTAIL_SWE_ID, parseLongTail } from "./sources/longtail-swe";

const page = (overall = "82.0") => `<p>Qwen 3.6 27B was also used for difficulty selection. Scores are for release v1.2, graded.</p>
<section id="leaderboard"><table class="lb"><thead><tr><th>#</th><th>Model</th></tr></thead><tbody>
<tr data-p1="82.01" data-p3="89.6" data-a3="74.26" data-tok="4.48" data-st="53.2" class="top"><td class="l rk">1</td><td class="l m">Opus 5.5<small>high</small></td><td class="mono">1M</td><td class="sc">82.0<span class="pm"> ±1.2</span></td></tr>
<tr data-p1="16.5" data-p3="23.8" data-a3="9.4" data-tok="7.2" data-st="113"><td class="l rk">2</td><td class="l m">Qwen 3.6 27B<small>thinking</small></td><td class="mono">262K</td><td class="sc">16.5<span class="pm"> ±0.7</span></td></tr>
</tbody></table></section><section id="languages"><table class="bl"><thead><tr><th class="l">Language</th><th>N</th><th>Opus 5.5<small>high</small></th><th>Qwen 3.6 27B<small>thinking</small></th></tr></thead><tbody>
<tr><td class="l m">F#</td><td class="n">16</td><td class="best">66.7</td><td>6.2</td></tr><tr class="all"><td class="l m">Overall</td><td class="n">202</td><td class="best">${overall}</td><td>16.5</td></tr></tbody></table></section>`;

describe("LongTail-SWE", () => {
  const { rows, benchmarks, version } = parseLongTail(page()), of = (id: string) => rows.filter((r) => r.benchmarkId === id);
  it("reads exact Pass@1 scores, efforts and run details", () => {
    expect(of(LONGTAIL_SWE_ID).map((r) => [r.modelLabel, r.effort, r.value, r.steps])).toEqual([["Opus 5.5", "high", 82.01, 53.2], ["Qwen 3.6 27B", undefined, 16.5, 113]]);
    expect(of(LONGTAIL_SWE_ID)[0].details).toMatchObject({ passAt3: 89.6, allThree: 74.26, sem: 1.2, context: "1M", tokensPerAttempt: 4480000, release: "v1.2" });
    expect(version).toBe("v1.2");
  });
  it("notes the model that helped select the tasks", () => {
    expect(of(LONGTAIL_SWE_ID)[1].note).toContain("select tasks by difficulty");
    expect(of(LONGTAIL_SWE_ID)[0].note).not.toContain("select tasks");
  });
  it("makes each language a variant", () => {
    expect(of("longtail-swe-fsharp").map((r) => r.value)).toEqual([66.7, 6.2]);
    expect(benchmarks.find((b) => b.id === "longtail-swe-fsharp")).toMatchObject({ variantOf: LONGTAIL_SWE_ID, variantLabel: "F#" });
  });
  it("refuses a language table that does not line up with the leaderboard", () => {
    expect(() => parseLongTail(page("70.0"))).toThrow(/does not line up/);
  });
  it("resolves the site's model names", () => {
    for (const r of of(LONGTAIL_SWE_ID)) expect(normalizeLabel(r.modelLabel).ok, r.modelLabel).toBe(true);
  });
});
