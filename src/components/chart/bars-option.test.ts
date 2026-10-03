import { describe, expect, it } from "vitest";
import type { ScatterPoint } from "./scatter-option";
import { selectBars } from "./bars-option";

const point = (model: string, effort: string, score: number, metric: number): ScatterPoint => ({
  x: metric,
  r: { model: { id: model }, variant: { id: `${model}@${effort}`, effort }, score } as ScatterPoint["r"],
});

describe("selectBars highlights", () => {
  const points = [
    point("top", "default", 98, 10),
    point("next", "default", 90, 20),
    point("pinned", "low", 50, 30),
    point("pinned", "high", 70, 40),
  ];

  it("keeps a highlighted model's best effort inside the cap", () => {
    const selected = selectBars(points, "higher", 2, ["pinned"]);
    expect(selected.map((p) => p.r.variant.id)).toEqual(["pinned@high", "top@default"]);
  });

  it("keeps exact effort highlights even when selections exceed the cap", () => {
    const selected = selectBars(points, "lower", 1, ["pinned@low", "next"]);
    expect(selected.map((p) => p.r.variant.id)).toEqual(["next@default", "pinned@low"]);
  });

  it("keeps the ordinary cap when there are no highlights", () => {
    expect(selectBars(points, "higher", 2).map((p) => p.r.variant.id)).toEqual(["next@default", "top@default"]);
  });
});
