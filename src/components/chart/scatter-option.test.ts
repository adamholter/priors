import { describe, expect, it } from "vitest";
import type { RankedVariant } from "../../engine";
import { DEFAULT_VIEW, frontierOf, guidePoints, restoreScatterView, scatterOption, type ScatterPoint } from "./scatter-option";
import { LIGHT_PALETTE } from "./theme";

const point = (id: string, month: number, score: number): ScatterPoint => ({
  x: Date.UTC(2026, month - 1, 1),
  r: { model: { id, name: id, labId: "lab" }, variant: { id: `${id}@high`, effort: "high" }, score } as RankedVariant,
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
