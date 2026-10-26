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

  it("reports where each label landed, and null for hidden ones, so a leader line can join it to its dot", () => {
    const heard = new Map<number, { x: number; y: number; align: string } | null>();
    const layout = scatterLabelLayout(() => 320, () => 420, [true, true, false], undefined, undefined, (i, at) => heard.set(i, at));
    layout(mark(0, 160));
    layout(mark(1, 165));
    layout(mark(2, 40));
    expect(heard.get(0)).toMatchObject({ align: "left", x: 176 });
    expect(heard.get(1)).toMatchObject({ align: "right", x: 158 });
    expect(heard.get(2)).toBeNull();
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
    const layout = scatterLabelLayout(() => 300, () => 420, [true, true, true]);
    layout(mark(0, 100));
    layout(mark(1, 100));
    const third = layout(mark(2, 100));
    expect(third.hideOverlap).toBe(false);
    expect(Math.abs(third.y! - 104.5)).toBeGreaterThanOrEqual(16);
  });

  it("keeps occupied slots when reused marks arrive out of index order", () => {
    const layout = scatterLabelLayout(() => 320, () => 420, [true, true, true]);
    expect(layout(mark(2, 160)).align).toBe("left");
    expect(layout(mark(0, 165)).align).toBe("right");
    expect(layout(mark(1, 160)).y).not.toBe(104.5);
    expect(layout(mark(2, 160)).y).toBe(104.5);
  });
});

describe("scatter label placement around marks", () => {
  const dotsAt = (...pts: [number, number][]) => () => pts.map(([x, y]) => ({ x, y }));
  it("keeps a label off a neighbouring mark when another slot is free", () => {
    // A mark sits right where the label would go (to the right of the mark at x=160, y=104).
    const layout = scatterLabelLayout(() => 600, () => 420, [true], dotsAt([160, 104], [200, 104]));
    const placed = layout(mark(0, 160));
    expect(placed.hideOverlap).toBe(false);
    expect(placed.align === "right" || Math.abs(placed.y! - 104.5) >= 16).toBe(true);
  });
  it("still places the label when every slot touches a mark", () => {
    const wall: [number, number][] = [];
    for (let x = 0; x <= 600; x += 6) for (let y = 24; y <= 380; y += 6) wall.push([x, y]);
    const placed = scatterLabelLayout(() => 600, () => 420, [true], dotsAt(...wall))(mark(0, 160));
    expect(placed.hideOverlap).toBe(false);
  });
  it("keeps a crowded frontier label when a free slot is beyond the old five-step search", () => {
    const layout = scatterLabelLayout(() => 230, () => 420, Array(6).fill(true));
    const placed = Array.from({ length: 6 }, (_, i) => layout(mark(i, 125)));
    expect(placed.every((p) => p.hideOverlap === false)).toBe(true);
    expect(new Set(placed.map((p) => `${p.x},${p.y}`)).size).toBe(6);
  });
  it("reserves room in proportion to the text, so large labels do not run into each other", () => {
    const layout = scatterLabelLayout(() => 800, () => 420, [true, true]);
    const big = (i: number, x: number) => ({ dataIndex: i, rect: { x, y: 100, width: 9, height: 9 }, labelRect: { x: x + 16, y: 100, width: 220, height: 28 } });
    const a = layout(big(0, 100)), b = layout(big(1, 300));
    // The first label spans 113 to roughly 376 with the reserve; the second mark's label cannot also sit to its right on that line.
    expect(a.x).toBe(116);
    expect(b.align === "right" ? b.x! < 300 : Math.abs(b.y! - 104.5) >= 16).toBe(true);
  });
});
