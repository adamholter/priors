import { describe, expect, it } from "vitest";
import { benchmarkBlurb } from "./benchmark-blurb";

describe("benchmark blurb", () => {
  it("drops an opening that only repeats the name", () => {
    expect(benchmarkBlurb("AA-Briefcase v1.1", "AA-Briefcase: agentic office-work tasks over real files; reported as Elo.")).toBe("Agentic office-work tasks over real files; reported as Elo.");
    expect(benchmarkBlurb("GDP.pdf", "GDP.pdf: document-heavy professional tasks over PDFs.")).toBe("Document-heavy professional tasks over PDFs.");
  });

  it("keeps an opening that says more than the name", () => {
    const d = "AA-Omniscience v1.1 Index (-100..100): knowledge accuracy minus a hallucination penalty.";
    expect(benchmarkBlurb("AA-Omniscience v1.1", d)).toBe(d);
    expect(benchmarkBlurb("CritPt v2 Hard Subset", "The private 40-question hard subset of CritPt v2: the 70 challenges minus 30.")).toBe("The private 40-question hard subset of CritPt v2: the 70 challenges minus 30.");
  });

  it("keeps whole sentences up to a length, and marks a cut inside one", () => {
    const d = "AA's run of FrontierCode 2.0 (132 private tasks, three attempts each): would a maintainer merge the change? An attempt failing any blocking check scores 0. Separate from Cognition's own leaderboard, which uses different harnesses.";
    const short = benchmarkBlurb("FrontierCode 2.0-AA", d, 160);
    expect(d.startsWith(short)).toBe(true);
    expect(short.endsWith("scores 0.")).toBe(true);
    const one = benchmarkBlurb("X", `${"word ".repeat(80)}end.`, 100);
    expect(one.length).toBeLessThanOrEqual(101);
    expect(one.endsWith("…")).toBe(true);
    expect(benchmarkBlurb("X", undefined)).toBe("");
  });
});
