import { describe, expect, it } from "vitest";
import type { RankedVariant } from "../../engine";
import { DEFAULT_VIEW, frontierOf, guidePoints, pickLabels, restoreScatterView, scatterOption, type ScatterPoint } from "./scatter-option";
import { LIGHT_PALETTE } from "./theme";

const point = (id: string, month: number, score: number): ScatterPoint => ({
  x: Date.UTC(2026, month - 1, 1),
  r: { model: { id, name: id, labId: "lab" }, variant: { id: `${id}@high`, effort: "high" }, score } as RankedVariant,
});

describe("label priorities", () => {
  const effort = (model: string, mode: string, x: number, score: number) => ({ ...point(model, 1, score), x, r: { ...point(model, 1, score).r, variant: { id: `${model}@${mode}`, modelId: model, effort: mode } } }) as ScatterPoint;

  it("labels an uncovered nearby model before repeating another model's dominated efforts", () => {
    const pts = [effort("best", "high", 1, 80), effort("muse", "high", 2, 72), effort("muse", "medium", 2.1, 71), effort("grok", "high", 2.2, 70), effort("weak", "high", 3, 20)];
    const labels = pickLabels(pts, "lower", 0.8);
    expect(labels.has("grok@high")).toBe(true);
    expect(labels.has("muse@medium")).toBe(false);
    expect(labels.has("weak@high")).toBe(true);
  });

  it("prioritizes another frontier effort over a distant weaker model, without starving that model at high density", () => {
    const pts = [effort("front", "low", 1, 50), effort("front", "high", 2, 80), effort("near", "high", 2.1, 78), effort("weak", "high", 3, 20), effort("weak", "low", 4, 10)];
    expect([...pickLabels(pts, "lower", 0.6)]).toEqual(["front@high", "near@high"]);
    expect([...pickLabels(pts, "lower", 0.75)]).toEqual(["front@high", "near@high", "front@low"]);
    expect(pickLabels(pts, "lower", 0.9).has("weak@high")).toBe(true);
  });

  it("adds labels monotonically, remains independent of input order, and treats equal x values together", () => {
    const pts = [effort("a", "high", 1, 40), effort("b", "high", 1, 60), effort("c", "high", 2, 55), effort("a", "low", 3, 30)];
    let previous = new Set<string>();
    for (let d = 0; d <= 100; d += 5) {
      const labels = pickLabels(pts, "lower", d / 100);
      expect([...labels]).toEqual([...pickLabels([...pts].reverse(), "lower", d / 100)]);
      for (const id of previous) expect(labels.has(id)).toBe(true);
      previous = labels;
    }
    expect([...pickLabels(pts, "lower", 0)]).toEqual(["b@high"]);
    expect(previous.size).toBe(pts.length);
  });

  it("keeps All labels available on narrow charts too", () => {
    const pts = [effort("a", "high", 1, 80), effort("a", "low", 2, 70), effort("b", "high", 3, 20)];
    const option = scatterOption({ pts, labs: [], better: "lower", xName: "Cost", formatX: String, view: { ...DEFAULT_VIEW, density: 1 }, pal: LIGHT_PALETTE, narrow: true });
    const marks = (option.series as { id: string; data: { label: { show: boolean } }[] }[]).find(s => s.id === "marks")!;
    expect(marks.data.every(p => p.label.show)).toBe(true);
  });
});

describe("release chronology", () => {
  const points = [point("newer-weaker", 5, 55), point("oldest", 1, 50), point("improved", 2, 60), point("dominated", 3, 58), point("best", 4, 70), point("same-date-weaker", 4, 65)];

  it("keeps score records from oldest to newest without rewarding a later release", () => {
    expect(frontierOf(points, "lower").map(p => p.r.model.id)).toEqual(["oldest", "improved", "best"]);
    expect(frontierOf(points, "higher").map(p => p.r.model.id)).toEqual(["best", "newer-weaker"]);
  });

  it("draws the chronology frontier only when enabled", () => {
    const option = (frontier: boolean) => scatterOption({ pts: points, labs: [], better: "lower", xName: "Release date", scale: "time", formatX: String, view: { ...DEFAULT_VIEW, frontier }, pal: LIGHT_PALETTE, narrow: false });
    const series = (frontier: boolean) => option(frontier).series as { id: string; data: { value: number[] }[] }[];
    expect(series(false).some(s => s.id === "frontier")).toBe(false);
    expect(series(true).find(s => s.id === "frontier")?.data.map(p => p.value[1])).toEqual([50, 60, 70]);
  });

  it("migrates the old date default without discarding density or effort links", () => {
    const saved = { ...DEFAULT_VIEW, density: 0.8, links: false };
    expect(restoreScatterView("scatter", false, saved)).toMatchObject({ frontier: false, density: 0.8, links: false });
    expect(restoreScatterView("scatter", false, { ...saved, frontierChosen: true })).toMatchObject({ frontier: true });
    expect(restoreScatterView("scatter", true, { ...saved, frontier: false }).frontier).toBe(false);
  });

  it("has no guides without highlights and clears them when selection is removed", () => {
    expect(guidePoints(points, { items: [], guides: true })).toEqual([]);
    expect(guidePoints(points, { items: ["best"], guides: true }).map(p => p.r.model.id)).toEqual(["best"]);
    expect(guidePoints(points, { items: ["best"], guides: false })).toEqual([]);
  });
});
