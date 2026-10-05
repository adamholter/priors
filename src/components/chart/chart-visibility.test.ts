import { describe, expect, it } from "vitest";
import type { RankedVariant } from "@/engine";
import type { ScatterPoint } from "./scatter-option";
import { EMPTY_HIDDEN, hideChartPoint, visiblePoints } from "./chart-visibility";

const point = (model: string, effort: string, source = ""): ScatterPoint => ({
  x: 5, r: { model: { id: model }, variant: { id: `${model}@${effort}${source}`, effort } } as RankedVariant,
});
const low = point("opus", "low"), high = point("opus", "high"), qualified = point("opus", "high", "~fallback"), other = point("sol", "high");
const points = [low, high, qualified, other];
describe("chart removals", () => {
  it("removes one model/effort combination across provenance variants and keeps the other efforts", () => {
    const hidden = hideChartPoint(EMPTY_HIDDEN, high);
    expect(visiblePoints(points, hidden)).toEqual([low, other]);
    expect(visiblePoints(points, EMPTY_HIDDEN)).toEqual(points);
  });
  it("removes every effort of a model without removing another model", () => {
    const hidden = hideChartPoint(hideChartPoint(EMPTY_HIDDEN, high), low, true);
    expect(visiblePoints(points, hidden)).toEqual([other]);
    expect(EMPTY_HIDDEN).toEqual({ efforts: [], models: [] });
  });
});
