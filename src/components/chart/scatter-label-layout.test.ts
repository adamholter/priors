import { describe, expect, it } from "vitest";
import { scatterLabelLayout } from "./scatter-label-layout";

const mark = (dataIndex: number, x: number, y = 100) => ({ dataIndex, rect: { x, y, width: 9, height: 9 }, labelRect: { x: x + 16, y, width: 90, height: 18 } });

describe("scatter label placement", () => {
  it("uses the other side of a crowded mark and stays inside the canvas", () => {
    const layout = scatterLabelLayout(() => 320, () => 420, [true, true]);
    const first = layout(mark(0, 160));
    const second = layout(mark(1, 165));
    expect(first.align).toBe("left");
    expect(second.align).toBe("right");
    expect(second.x).toBe(158);
  });

  it("resets occupied slots on resize and ignores unlabeled efforts", () => {
    const layout = scatterLabelLayout(() => 320, () => 420, [false, true]);
    layout(mark(0, 160));
    const first = layout(mark(1, 160));
    layout(mark(0, 160));
    expect(layout(mark(1, 160))).toEqual(first);
    expect(first.align).toBe("left");
  });

  it("uses nearby vertical space when neither side is free", () => {
    const layout = scatterLabelLayout(() => 220, () => 420, [true, true, true]);
    layout(mark(0, 100));
    layout(mark(1, 100));
    expect(layout(mark(2, 100)).y).toBe(136.5);
  });

  it("keeps occupied slots when reused marks arrive out of index order", () => {
    const layout = scatterLabelLayout(() => 320, () => 420, [true, true, true]);
    expect(layout(mark(2, 160)).align).toBe("left");
    expect(layout(mark(0, 165)).align).toBe("right");
    expect(layout(mark(1, 160)).y).not.toBe(104.5);
    expect(layout(mark(2, 160)).y).toBe(104.5);
  });
});
