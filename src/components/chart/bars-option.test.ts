import { describe, expect, it } from "vitest";
import type { ScatterPoint } from "./scatter-option";
import { barLayout, defaultBarModels, filterBarModels, selectBars } from "./bars-option";

const point = (model: string, effort: string, score: number, metric: number): ScatterPoint => ({
  x: metric,
  r: { model: { id: model, name: model }, variant: { id: `${model}@${effort}`, effort }, score, rank: 100 - score } as ScatterPoint["r"],
});

describe("default vertical metric visibility", () => {
  it("adds Pareto models and the index top three distinct models", () => {
    const points = [
      point("top-1", "default", 100, 10), point("top-2", "default", 95, 20), point("top-3", "default", 90, 30),
      point("frontier", "low", 80, 1), point("frontier", "high", 70, 40), point("hidden", "default", 60, 50),
    ];
    const visible = defaultBarModels(points, "lower", points.map((p) => p.r));
    expect([...visible].sort()).toEqual(["frontier", "top-1", "top-2", "top-3"]);
    expect(filterBarModels(points, visible).filter((p) => p.r.model.id === "frontier").map((p) => p.r.variant.id)).toEqual(["frontier@low", "frontier@high"]);
  });

  it("keeps the Pareto model if any effort qualifies, including its dominated efforts", () => {
    const points = [
      point("top", "default", 100, 10), point("second", "default", 95, 15), point("third", "default", 90, 20),
      point("multi", "low", 80, 1), point("multi", "high", 60, 30),
    ];
    const visible = defaultBarModels(points, "lower", points.map((p) => p.r));
    const selected = selectBars(filterBarModels(points, visible), "lower", 20);
    expect(selected.filter((p) => p.r.model.id === "multi").map((p) => p.r.variant.id)).toEqual(["multi@low", "multi@high"]);
  });
});

it("creates one model label per group and leaves an axis gap between models", () => {
  const layout = barLayout([
    { modelId: "alpha", modelName: "Alpha", effort: "low", label: "Alpha low" },
    { modelId: "alpha", modelName: "Alpha", effort: "high", label: "Alpha high" },
    { modelId: "beta", modelName: "Beta", effort: "default", label: "Beta" },
  ]);
  expect(layout.effortLabels).toEqual(["L", "H", "", ""]);
  expect(layout.modelLabels).toEqual(["Alpha", "", "", "Beta"]);
  expect(layout.entries.map((entry) => entry?.modelId ?? null)).toEqual(["alpha", "alpha", null, "beta"]);
});

describe("selectBars highlights", () => {
  const points = [
    point("top", "default", 98, 10),
    point("next", "default", 90, 20),
    point("pinned", "low", 50, 30),
    point("pinned", "high", 70, 40),
  ];

  it("keeps every effort of a highlighted model inside the model cap", () => {
    const selected = selectBars(points, "higher", 2, ["pinned"]);
    expect(selected.map((p) => p.r.variant.id)).toEqual(["top@default", "pinned@low", "pinned@high"]);
  });

  it("keeps exact effort highlights even when selections exceed the cap", () => {
    const selected = selectBars(points, "lower", 1, ["pinned@low", "next"]);
    expect(selected.map((p) => p.r.variant.id)).toEqual(["next@default", "pinned@low", "pinned@high"]);
  });

  it("keeps the ordinary cap when there are no highlights", () => {
    expect(selectBars(points, "higher", 2).map((p) => p.r.variant.id)).toEqual(["top@default", "next@default"]);
  });
});

it("sorts model groups by each group's maximum metric and efforts ascending inside each group", () => {
  const points = [point("zeta", "low", 70, 10), point("alpha", "high", 80, 8), point("beta", "default", 90, 5), point("alpha", "low", 60, 3)];
  expect(selectBars(points, "higher", 10).map((p) => p.r.variant.id)).toEqual(["beta@default", "alpha@low", "alpha@high", "zeta@low"]);
});
