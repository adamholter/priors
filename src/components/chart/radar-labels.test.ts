import { describe, expect, it } from "vitest";
import { radarLabels, textWidth, wrapText } from "./radar-labels";

/** The ten spokes of the AA-II index, whose share card clipped two names and ran two under the legend. */
const NAMES = ["FrontierCode 2.0-AA", "Terminal-Bench v4-AA", "AA-Briefcase v1.1", "AutomationBench-AA", "Terminal-Bench-Science-AA", "CritPt v2 Hard Subset", "HLE-Diamond", "AA-Omniscience v1.1 Accuracy", "AA-Omniscience v1.1 Non-hallucination", "GDP.pdf"];

describe("radar labels", () => {
  it("wraps a name onto lines without dropping any of it", () => {
    for (const name of NAMES) {
      const lines = wrapText(name, 12, 132);
      expect(lines.join(" ").replace(/- /g, "-")).toBe(name);
      expect(lines.join("")).not.toContain("…");
    }
    expect(wrapText("AA-Omniscience v1.1 Non-hallucination", 12, 132)).toEqual(["AA-Omniscience v1.1", "Non-hallucination"]);
  });

  it("breaks a long hyphenated word after a hyphen, but never strands a short piece", () => {
    expect(wrapText("Terminal-Bench-Science-AA", 12, 132)).toEqual(["Terminal-Bench-", "Science-AA"]);
    // "v4-" and "AA" are too short to stand alone, so the word moves down whole.
    expect(wrapText("Terminal-Bench v4-AA", 12, 110)).toEqual(["Terminal-Bench", "v4-AA"]);
    // One word with nowhere to break stays whole; the layout makes room for it instead.
    expect(wrapText("Supercalifragilisticexpialidocious", 12, 60)).toEqual(["Supercalifragilisticexpialidocious"]);
  });

  it("gives every label room: inside the box, clear of the circle's far side and of each other", () => {
    for (const [R, px, maxW] of [[220, 12, 132], [190, 11.5, 118], [150, 11.5, 118]]) {
      const lay = radarLabels(NAMES, { R, px, maxW });
      const boxes = lay.labels.map((l) => ({ x0: l.left, x1: l.left + l.w, y0: l.y - px, y1: l.y - px + l.h }));
      for (const b of boxes) {
        expect(b.x0).toBeGreaterThanOrEqual(lay.minX);
        expect(b.x1).toBeLessThanOrEqual(lay.maxX);
        expect(b.y0).toBeGreaterThanOrEqual(lay.minY);
        expect(b.y1).toBeLessThanOrEqual(lay.maxY);
      }
      for (let i = 0; i < boxes.length; i++) for (let j = i + 1; j < boxes.length; j++) {
        const a = boxes[i], b = boxes[j];
        expect(a.x0 < b.x1 && b.x0 < a.x1 && a.y0 < b.y1 && b.y0 < a.y1, `${NAMES[i]} over ${NAMES[j]} at R=${R}`).toBe(false);
      }
      // A label beside the circle starts outside it.
      lay.labels.forEach((l) => { if (l.anchor === "start") expect(l.left).toBeGreaterThan(0); if (l.anchor === "end") expect(l.left + l.w).toBeLessThan(0); });
    }
  });

  it("estimates wide rather than narrow, so a measured label is never laid out too small", () => {
    // Inter's real advance for this string at 12px is about 113px.
    expect(textWidth("AutomationBench-AA", 12)).toBeGreaterThan(113);
    expect(textWidth("AutomationBench-AA", 12)).toBeLessThan(140);
  });
});
