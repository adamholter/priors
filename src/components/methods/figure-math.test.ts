import { describe, expect, it } from "vitest";
import { curveAt, frame, mixAt, pickThree, spaced, ticks, type FigCurve } from "./figure-math";

const curve = (id: string, difficulty: number, slope: number, share = 0.25, floor = 0): FigCurve => ({ id, name: id, difficulty, slope, share, floor });

describe("figure math", () => {
  it("a curve reads halfway at its difficulty, above its floor, and the mix is the weighted mean", () => {
    expect(curveAt(curve("a", 1, 2), 1)).toBeCloseTo(50);
    expect(curveAt(curve("a", 1, 2, 0.25, 0.25), 1)).toBeCloseTo(62.5);
    expect(curveAt(curve("a", 1, 2, 0.25, 0.25), -50)).toBeCloseTo(25);
    expect(mixAt([curve("a", 0, 1, 0.5), curve("b", 0, 3, 0.5)], 0)).toBeCloseTo(50);
  });
  it("picks an easy curve that is not flat, the steepest of the rest, and the hardest, in order of difficulty", () => {
    const curves = [curve("flat-easy", -1, 0.2), curve("easy", 0, 2), curve("mid", 0.5, 1.5), curve("steep", 0.6, 6), curve("hard", 2, 1)];
    expect(pickThree(curves).map((c) => c.id)).toEqual(["easy", "steep", "hard"]);
    expect(pickThree(curves.slice(0, 2)).map((c) => c.id)).toEqual(["flat-easy", "easy"]);
    expect(pickThree([])).toEqual([]);
  });
  it("makes round ticks inside the range", () => {
    expect(ticks(-2.2, 1.6, 8)).toEqual([-2, -1.5, -1, -0.5, 0, 0.5, 1, 1.5]);
    expect(ticks(110, 190, 8)).toEqual([110, 120, 130, 140, 150, 160, 170, 180, 190]);
  });
  it("names the first point and then only points far enough from every named one", () => {
    expect(spaced([0, 10, 50, 55, 120], (v) => [v, 0], 40)).toEqual([0, 50, 120]);
  });
  it("maps the ends of both ranges to the plot's corners", () => {
    const f = frame(680, 330, [-2, 2], [0, 100]);
    expect([f.sx(-2), f.sx(2), f.sy(0), f.sy(100)]).toEqual([f.l, f.w - f.r, f.h - f.b, f.t]);
    expect(f.line((x) => x * 25 + 50).startsWith(`M${f.l.toFixed(1)} ${f.sy(0).toFixed(1)}`)).toBe(true);
  });
});
