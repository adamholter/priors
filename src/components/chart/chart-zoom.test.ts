import { describe, expect, it } from "vitest";
import { inBox, lerpBox, linearTicks, logTicks, padBox, pixelBoxToDomain, pixelToValue, unionBox } from "./chart-zoom";

// A 400x200 plot whose top-left corner is at (50, 20): x runs 50..450, y pixels 20 (top) to 220 (bottom).
const grid = { x: 50, y: 20, width: 400, height: 200 };

describe("drag-to-zoom math", () => {
  it("maps pixels to values linearly, and in log space on a log axis", () => {
    expect(pixelToValue(250, 50, 450, [0, 100])).toBe(50);
    // Halfway across 0.01..100 on a log axis is 1, not 50.
    expect(pixelToValue(250, 50, 450, [0.01, 100], "log")).toBeCloseTo(1, 10);
    expect(pixelToValue(150, 50, 450, [0.01, 100], "log")).toBeCloseTo(0.1, 10);
  });

  it("turns a dragged box into a data window, whichever corner the drag started from", () => {
    const a = pixelBoxToDomain({ x: 150, y: 70 }, { x: 350, y: 170 }, grid, [0, 100], [40, 80]);
    const b = pixelBoxToDomain({ x: 350, y: 170 }, { x: 150, y: 70 }, grid, [0, 100], [40, 80]);
    expect(a).toEqual(b);
    expect(a!.x[0]).toBeCloseTo(25); expect(a!.x[1]).toBeCloseTo(75);
    // Pixel 170 is three quarters down (score 50), pixel 70 a quarter down (score 70).
    expect(a!.y[0]).toBeCloseTo(50); expect(a!.y[1]).toBeCloseTo(70);
  });

  it("zooms a log cost axis in log space", () => {
    const box = pixelBoxToDomain({ x: 150, y: 20 }, { x: 350, y: 220 }, grid, [0.01, 100], [0, 100], "log");
    expect(box!.x[0]).toBeCloseTo(0.1, 10); expect(box!.x[1]).toBeCloseTo(10, 10);
  });

  it("treats a tiny drag as a click", () => {
    expect(pixelBoxToDomain({ x: 200, y: 100 }, { x: 204, y: 103 }, grid, [0, 100], [0, 100])).toBeNull();
    expect(pixelBoxToDomain({ x: 200, y: 100 }, { x: 206, y: 100 }, grid, [0, 100], [0, 100])).not.toBeNull();
  });

  it("keeps the other axis's range for a flat sweep, and clamps to the plot", () => {
    const flat = pixelBoxToDomain({ x: 150, y: 100 }, { x: 350, y: 102 }, grid, [0, 100], [40, 80]);
    expect(flat!.y).toEqual([40, 80]);
    const past = pixelBoxToDomain({ x: 0, y: 0 }, { x: 900, y: 900 }, grid, [0, 100], [40, 80]);
    expect(past!.x[0]).toBeCloseTo(0); expect(past!.x[1]).toBeCloseTo(100); expect(past!.y[0]).toBeCloseTo(40); expect(past!.y[1]).toBeCloseTo(80);
  });

  it("pads, tests membership, unions and steps windows, in log space on a log axis", () => {
    const padded = padBox({ x: [1, 100], y: [50, 60] }, "log", 0.05);
    expect(Math.log10(padded.x[0])).toBeCloseTo(-0.1); expect(Math.log10(padded.x[1])).toBeCloseTo(2.1);
    expect(padded.y[0]).toBeCloseTo(49.5); expect(padded.y[1]).toBeCloseTo(60.5);
    expect(padBox({ x: [1, 2], y: [0, 50] }).y[0]).toBe(0);
    expect(inBox(10, 55, { x: [1, 100], y: [50, 60] })).toBe(true);
    expect(inBox(10, 61, { x: [1, 100], y: [50, 60] })).toBe(false);
    expect(unionBox({ x: [1, 2], y: [5, 6] }, { x: [0.5, 1.5], y: [5.5, 9] })).toEqual({ x: [0.5, 2], y: [5, 9] });
    const mid = lerpBox({ x: [1, 100], y: [0, 100] }, { x: [10, 1000], y: [50, 60] }, 0.5, "log");
    expect(mid.x[0]).toBeCloseTo(Math.sqrt(10)); expect(mid.y).toEqual([25, 80]);
  });

  it("re-ticks a zoomed axis with round values inside the window", () => {
    expect(linearTicks(52.3, 67.9)).toEqual([55, 60, 65]);
    // Inside one decade a log axis would show at most one power of ten; zoomed it gets 1-2-5 or finer steps.
    expect(logTicks(0.3, 4)).toEqual([0.5, 1, 2]);
    expect(logTicks(0.001, 100)).toEqual([0.001, 0.01, 0.1, 1, 10, 100]);
    for (const [lo, hi] of [[0.42, 0.61], [1.2, 1.3], [0.02, 0.9]]) {
      const t = logTicks(lo, hi);
      expect(t.length).toBeGreaterThanOrEqual(2);
      expect(t.every((v) => v >= lo && v <= hi)).toBe(true);
    }
  });
});
