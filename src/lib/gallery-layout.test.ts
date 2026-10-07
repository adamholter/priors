import { describe, expect, it } from "vitest";
import { arrangeMetrics } from "./gallery-layout";

const panels = [{ id: "tpt", open: true }, { id: "strengths" }, { id: "speed" }, { id: "latency" }];

describe("arrangeMetrics", () => {
  it("shows every metric in default order without a saved layout", () => {
    expect(arrangeMetrics(panels).map((p) => [p.id, p.hidden, p.open])).toEqual([["tpt", false, true], ["strengths", false, false], ["speed", false, false], ["latency", false, false]]);
  });
  it("follows the owner's order, visibility and open state", () => {
    const out = arrangeMetrics(panels, [{ id: "speed", open: true }, { id: "tpt", hidden: true }, { id: "strengths" }, { id: "latency" }]);
    expect(out.map((p) => [p.id, p.hidden, p.open])).toEqual([["speed", false, true], ["tpt", true, true], ["strengths", false, false], ["latency", false, false]]);
  });
  it("lists metrics added after the layout was saved, hidden, at the end", () => {
    const out = arrangeMetrics(panels, [{ id: "latency" }, { id: "tpt" }]);
    expect(out.map((p) => [p.id, p.hidden])).toEqual([["latency", false], ["tpt", false], ["strengths", true], ["speed", true]]);
  });
  it("drops saved entries for metrics that no longer exist", () => {
    expect(arrangeMetrics(panels, [{ id: "gone" }, { id: "tpt" }]).map((p) => p.id)).toEqual(["tpt", "strengths", "speed", "latency"]);
  });
});
