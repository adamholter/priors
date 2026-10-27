import { describe, expect, it } from "vitest";
import { decodeEditor, encodeEditor, clampSize } from "./export-editor";

describe("screenshot link", () => {
  it("round-trips size, theme, title and chart settings", () => {
    const s = { w: 1200, h: 675, ratio: "16:9", theme: "night", title: "Speed vs score — é", view: { scale: "linear" as const, frontier: false, links: true, guides: false, density: 0.4, labelScale: 1.25 } };
    expect(decodeEditor(encodeEditor(s))).toEqual(s);
  });
  it("ignores mangled links and clamps absurd sizes", () => {
    expect(decodeEditor("%%%")).toBeNull();
    expect(decodeEditor(null)).toBeNull();
    expect(decodeEditor(encodeEditor({ w: 99999, h: 1 }))).toMatchObject(clampSize(99999, 1));
  });
});
