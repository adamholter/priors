import { describe, expect, it } from "vitest";
import { decodeEditor, encodeEditor, clampSize, ratioOf, readViewParam, sizeForRatio, viewParam } from "./export-editor";
import { FRAME_H, FRAME_W, previewCanvas } from "../components/chart/export-frame";

describe("plain link view", () => {
  const view = { frontier: true, links: false, density: 0.45 };
  it("carries the background grid only when told, and still reads older links", () => {
    expect(viewParam(view)).toBe("101-45");
    expect(readViewParam("101-45")).toEqual({ ...view, guides: true });
    expect(readViewParam(viewParam({ ...view, grid: false }))).toEqual({ ...view, guides: true, grid: false });
    // "Only Pareto-optimal models" rides on the end, with or without the grid part, and older links read as off.
    expect(readViewParam(viewParam({ ...view, grid: true, paretoOnly: true }))).toEqual({ ...view, guides: true, grid: true, paretoOnly: true });
    expect(readViewParam(viewParam({ ...view, paretoOnly: true }))).toEqual({ ...view, guides: true, paretoOnly: true });
    expect(decodeEditor(encodeEditor({ w: 800, h: 500, view: { paretoOnly: true } }))?.view?.paretoOnly).toBe(true);
    expect(readViewParam(viewParam({ ...view, grid: true }))?.grid).toBe(true);
  });
});

describe("screenshot link", () => {
  it("round-trips size, theme, title and chart settings", () => {
    const s = { w: 1200, h: 623, ratio: "16:9", theme: "night", title: "Speed vs score — é", view: { scale: "linear" as const, frontier: false, links: true, guides: false, density: 0.4, labelScale: 1.25 } };
    // The heading as drawn defaults to the title.
    expect(decodeEditor(encodeEditor(s))).toEqual({ ...s, heading: s.title });
    const named = { ...s, title: undefined, heading: "Score vs cost", view: { ...s.view, allModels: true } };
    expect(decodeEditor(encodeEditor(named))).toEqual({ ...named, title: undefined });
  });
  it("ignores mangled links and clamps absurd sizes", () => {
    expect(decodeEditor("%%%")).toBeNull();
    expect(decodeEditor(null)).toBeNull();
    expect(decodeEditor(encodeEditor({ w: 99999, h: 1 }))).toMatchObject(clampSize(99999, 1));
  });
});

describe("image shape", () => {
  it("gives the finished image the picked ratio, even when the plot is at its minimum height", () => {
    for (const id of ["16:9", "3:2", "4:3", "1:1", "4:5", "9:16"]) for (const width of [320, 360, 800, 1200, 2400]) {
      const r = ratioOf(id)!, { w, h } = sizeForRatio(width, r);
      expect(Math.abs((w + FRAME_W) / (h + FRAME_H) / r - 1)).toBeLessThan(0.005);
      expect(h).toBeGreaterThanOrEqual(220);
      expect(h).toBeLessThanOrEqual(2400);
    }
  });

  it("reads a phone-made 16:9 link at 16:9", () => {
    const { w, h } = decodeEditor(encodeEditor({ w: 360, h: 220, ratio: "16:9" }))!;
    expect((w + FRAME_W) / (h + FRAME_H)).toBeCloseTo(16 / 9, 1);
  });

  it("fits any image whole on a card-shaped canvas, clear of the title X prints over the bottom", () => {
    for (const [w, h] of [[548, 308], [424, 308], [1264, 711], [2464, 880], [424, 754], [2400, 2400]]) {
      const c = previewCanvas(w, h);
      expect(c.width / c.height).toBeCloseTo(1200 / 630, 2);
      expect(c.width).toBeGreaterThanOrEqual(w);
      expect(c.y).toBeGreaterThanOrEqual(0);
      expect(c.height - c.y - h).toBeGreaterThanOrEqual(c.height * 0.12 - 1);
    }
  });
});
