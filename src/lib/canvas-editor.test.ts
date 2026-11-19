import { describe, expect, it } from "vitest";
import { PLACE_DEFAULT, cleanPlace, dragSize, fitCamera, imageSize, nearRatio, rubber, settleSize, snapTo, stepSpring } from "./canvas-editor";
import { frameSvg, placeGeometry } from "../components/chart/export-frame";
import { EDITOR_MAX, EDITOR_MIN, decodeEditor, encodeEditor, sizeForRatio } from "./export-editor";

const ratio = (s: { w: number; h: number }) => { const i = imageSize(s); return i.w / i.h; };

describe("canvas editor drags", () => {
  it("pulls a free drag onto a nearby preset and leaves other shapes alone", () => {
    const near = sizeForRatio(1000, 16 / 9), { size, ratio: id } = dragSize({ w: near.w, h: near.h + 6 }, "se");
    expect(id).toBe("16:9"); expect(ratio(size)).toBeCloseTo(16 / 9, 5);
    expect(dragSize({ w: 1000, h: 300 }, "se")).toEqual({ size: { w: 1000, h: 300 }, ratio: "free" });
    expect(dragSize({ w: near.w, h: near.h + 6 }, "se", { free: true }).ratio).toBe("free");
  });
  it("snaps an edge along the axis being dragged", () => {
    const near = sizeForRatio(1000, 1), side = dragSize({ w: near.w + 5, h: near.h }, "e"), top = dragSize({ w: near.w, h: near.h + 5 }, "s");
    expect(side.size.h).toBeCloseTo(near.h + (5), 0); expect(top.size.h).toBe(near.h + 5); expect(top.size.w).toBeCloseTo(near.w + 5, 0);
  });
  it("keeps a chosen ratio on corners, frees it on edges, and keeps the starting shape with Shift", () => {
    expect(ratio(dragSize({ w: 900, h: 200 }, "se", { ratio: "4:3" }).size)).toBeCloseTo(4 / 3, 5);
    expect(dragSize({ w: 900, h: 333 }, "e", { ratio: "4:3" }).ratio).toBe("free");
    expect(ratio(dragSize({ w: 700, h: 700 }, "n", { keep: 2 }).size)).toBeCloseTo(2, 5);
  });
  it("gives way past the limits and settles inside them, on the ratio", () => {
    expect(rubber(EDITOR_MIN.w - 500, EDITOR_MIN.w, EDITOR_MAX)).toBeLessThan(EDITOR_MIN.w); expect(rubber(EDITOR_MIN.w - 500, EDITOR_MIN.w, EDITOR_MAX)).toBeGreaterThan(EDITOR_MIN.w - 90); expect(rubber(900, EDITOR_MIN.w, EDITOR_MAX)).toBe(900);
    expect(settleSize({ w: 10, h: 99999 })).toEqual({ w: EDITOR_MIN.w, h: EDITOR_MAX }); expect(ratio(settleSize({ w: 800, h: 1 }, "1:1"))).toBeCloseTo(1, 2);
  });
  it("names the preset an image already has", () => { expect(nearRatio(sizeForRatio(800, 4 / 5))).toBe("4:5"); });
});

describe("canvas editor camera", () => {
  const inset = { top: 60, right: 20, bottom: 20, left: 20 };
  it("centers in the free area and never enlarges", () => {
    expect(fitCamera({ w: 400, h: 200 }, { w: 1040, h: 720 }, inset)).toEqual({ s: 1, x: 320, y: 280 });
    const big = fitCamera({ w: 2000, h: 1000 }, { w: 1040, h: 720 }, inset); expect(big.s).toBe(0.5); expect(big.x).toBe(20);
  });
  it("brings a spring to rest on its target", () => { const p = { x: 0, v: 0 }; let done = false; for (let i = 0; i < 400 && !done; i++) done = stepSpring(p, 10, 1 / 60, 240, 26); expect(done).toBe(true); expect(p.x).toBe(10); });
});

describe("moved image parts", () => {
  const raw = `<svg width="700" height="400" viewBox="0 0 700 400"><path d="M0 0"/></svg>`;
  it("leaves an untouched image exactly as it was", () => {
    expect(cleanPlace(PLACE_DEFAULT)).toBeUndefined(); expect(frameSvg(raw, "T", undefined, undefined, { place: {} })).toBe(frameSvg(raw, "T"));
    expect(frameSvg(raw, "T")).toContain(`<text x="32" y="46"`); expect(frameSvg(raw, "T")).toContain(`width="764" height="488"`);
  });
  it("draws moved parts where they were put, in an image of the same size", () => {
    const place = { tx: 100, ty: 20, ts: 48, px: 10, py: 30, pw: -50, ph: -40, fx: 200, fy: -8, fs: 16 }, svg = frameSvg(`<svg width="650" height="360" viewBox="0 0 650 360"></svg>`, "T", undefined, undefined, { place });
    expect(svg).toContain(`width="764" height="488"`); expect(svg).toContain(`<svg x="42" y="84"`); expect(svg).toContain(`font-size="48"`); expect(svg).toContain(`<text x="232" y="464"`); expect(placeGeometry(650, 360, place).title.y).toBe(80);
  });
  it("survives the link and ignores nonsense", () => {
    const place = { tx: 12.5, ts: 40, pw: -30, fs: 14 }; expect(decodeEditor(encodeEditor({ w: 800, h: 500, place }))?.place).toEqual(place); expect(decodeEditor(encodeEditor({ w: 800, h: 500 }))?.place).toBeUndefined();
    expect(decodeEditor(encodeEditor({ w: 800, h: 500, place: { ts: 9999 } }))?.place?.ts).toBe(120);
  });
  it("pulls an edge onto a nearby guide only", () => { expect(snapTo([100, 150], [153, 400], 6)).toEqual({ shift: 3, line: 153 }); expect(snapTo([100], [200], 6)).toEqual({ shift: 0, line: undefined }); });
});
