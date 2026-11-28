import { describe, expect, it } from "vitest";
import { cornerStyle, emptiestCorner, placeGhostNames, textWidth, type GhostAt } from "./chart-key-geometry";

const grid = { x: 50, y: 20, width: 600, height: 400 };
describe("chart key corners", () => {
  it("takes the corner with the fewest marks, top left first on a tie", () => {
    expect(emptiestCorner([], grid, 132, 100)).toBe("tl");
    expect(emptiestCorner([{ x: 100, y: 60 }], grid, 132, 100)).toBe("br");
    expect(emptiestCorner([{ x: 100, y: 60 }, { x: 600, y: 380 }, { x: 600, y: 60 }], grid, 132, 100)).toBe("bl");
  });
  it("counts the label strip to the right of a mark", () => {
    // A mark just left of the corner box still covers it with its name.
    expect(emptiestCorner([{ x: 62 + 132 + 40, y: 40 }], grid, 132, 100)).toBe("br");
  });
  it("skips a corner it was told to avoid, and falls back to top left with no grid", () => {
    expect(emptiestCorner([{ x: 100, y: 60 }], grid, 132, 100, ["br"])).toBe("tr");
    expect(emptiestCorner([], undefined, 132, 100)).toBe("tl");
  });
  it("anchors a corner box to the plot rectangle, not the canvas", () => {
    expect(cornerStyle(grid, 700, 460, "tl")).toEqual({ left: 62, top: 32 });
    expect(cornerStyle(grid, 700, 460, "br")).toEqual({ right: 700 - 650 + 12, bottom: 460 - 420 + 12 });
    expect(cornerStyle(undefined, 700, 460, "br")).toEqual({ left: 12, top: 12 });
  });
});

const ghost = (id: string, x: number, y: number, score: number, name = id): GhostAt => ({ id, name, score, x, y });
describe("ghost names", () => {
  it("always names a ghost that is previewed alone", () => {
    const out = placeGhostNames([ghost("a", 300, 200, 50)], [{ x: 290, y: 190, w: 400, h: 40 }], grid, 700, 11.5, true);
    expect(out.get("a")).toBeDefined();
  });
  it("puts the name on the side that is clear", () => {
    const right = placeGhostNames([ghost("a", 300, 200, 50)], [], grid, 700, 11.5, false).get("a");
    expect(right).toEqual({ x: 309, y: 200, flip: false });
    const blocked = placeGhostNames([ghost("a", 300, 200, 50)], [{ x: 310, y: 190, w: 80, h: 20 }], grid, 700, 11.5, false).get("a");
    expect(blocked).toMatchObject({ flip: true, x: 291 });
  });
  it("leaves a name off when it would cover something, unless it is the only one", () => {
    const wall = [{ x: 0, y: 0, w: 700, h: 460 }];
    expect(placeGhostNames([ghost("a", 300, 200, 50)], wall, grid, 700, 11.5, false).size).toBe(0);
    expect(placeGhostNames([ghost("a", 300, 200, 50)], wall, grid, 700, 11.5, true).size).toBe(1);
  });
  it("names the best score first and keeps names off each other", () => {
    const near = [ghost("lo", 300, 204, 10), ghost("hi", 300, 200, 90)];
    const out = placeGhostNames(near, [], grid, 700, 11.5, false);
    expect(out.get("hi")).toMatchObject({ flip: false });
    // The weaker ghost's name would land on the stronger one's, so it goes to the other side.
    expect(out.get("lo")).toMatchObject({ flip: true });
    // With no other side left (the plot's left edge is a wall) it stays a plain ring.
    const walled = placeGhostNames(near, [{ x: 0, y: 0, w: 305, h: 460 }], grid, 700, 11.5, false);
    expect(walled.has("hi")).toBe(true);
    expect(walled.has("lo")).toBe(false);
  });
  it("estimates a wider name as wider", () => {
    expect(textWidth("Gemini 3.8 Flash", 11.5)).toBeGreaterThan(textWidth("GLM", 11.5));
  });
});
