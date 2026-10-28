import { describe, expect, it } from "vitest";
import { svgFamilies } from "./embed-fonts";

describe("svgFamilies", () => {
  it("reads attributes, style properties and font shorthands", () => {
    const svg = `<svg><text font-family="Newsreader, Georgia, serif">a</text><text style="font: bold 12px Excalifont, &quot;Comic Sans MS&quot;, cursive;">b</text><text style="font-family:'Comic Shanns', monospace">c</text></svg>`;
    expect(svgFamilies(svg)).toEqual(expect.arrayContaining(["Newsreader", "Excalifont", "Comic Sans MS", "Comic Shanns"]));
  });
});
