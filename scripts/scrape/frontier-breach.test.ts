import { describe, expect, it } from "vitest";
import { normalizeLabel } from "../../src/data/normalize";
import { FRONTIER_BREACH_ID, parseFrontierBreach } from "./sources/frontier-breach";

const item = (label: string) => `<li aria-label="${label}" class="grid"><span>x</span></li>`;
const page = item("Gemini 4 Carbon, Google: 2.4% attack success rate, plus or minus 2.2") + item("Grok 4.5, xAI: 91.4% attack success rate, plus or minus 4") + item("Gemini 4 Carbon, Google: 2.4% attack success rate, plus or minus 2.2");

describe("FrontierBreach", () => {
  const { rows, benchmark } = parseFrontierBreach(page);
  it("reads each model once with its interval, at medium effort", () => {
    expect(rows.map((r) => [r.modelLabel, r.labHint, r.effort, r.value, r.ci, r.rank])).toEqual([["Gemini 4 Carbon", "Google", "medium", 2.4, [0.2, 4.6], 1], ["Grok 4.5", "xAI", "medium", 91.4, [87.4, 95.4], 2]]);
  });
  it("ranks lower attack success as better", () => {
    expect(benchmark).toMatchObject({ id: FRONTIER_BREACH_ID, higherIsBetter: false, unit: "percent", category: "safety", normalization: { min: 0, max: 100 } });
  });
  it("resolves the site's names", () => {
    for (const r of rows) expect(normalizeLabel(r.modelLabel, r.labHint).ok, r.modelLabel).toBe(true);
  });
});
