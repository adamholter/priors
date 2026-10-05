import { describe, expect, it } from "vitest";
import { DEFAULT_RADAR, RADAR_PALETTES, radarParams, radarSvg, readRadarParams } from "./radar-view";
import type { RadarAxis } from "./radar-data";

describe("radar view", () => {
  it("round-trips non-default settings through link params and omits defaults", () => {
    expect(Object.values(radarParams(DEFAULT_RADAR)).filter(Boolean)).toEqual([]);
    const s = { norm: "rank" as const, compare: "median" as const, colors: "distinct" as const, median: false, models: ["a", "b"] };
    const url = new URLSearchParams(Object.entries(radarParams(s)).filter(([, v]) => v) as [string, string][]);
    expect(readRadarParams(url)).toEqual(s);
    expect(readRadarParams(new URLSearchParams("rs=bogus"))).toEqual({ ...DEFAULT_RADAR, models: undefined });
  });

  it("draws a self-contained SVG with hover titles and skips missing values", () => {
    const axes = ["a", "b", "c"].map((id) => ({ id, name: id.toUpperCase(), label: id, share: 33, unit: "percent", category: "coding", description: "", min: 0, max: 100, median: 50 })) as RadarAxis[];
    const svg = radarSvg({ axes, norm: "score", pal: RADAR_PALETTES.light, series: [{ id: "m", name: "Model <1>", color: "#123456", points: [{ r: 0.5, value: 50, estimated: false }, { r: null, estimated: false }, { r: 0.9, value: 90, estimated: true }] }] });
    expect(svg.startsWith("<svg xmlns=")).toBe(true);
    expect(svg).not.toMatch(/var\(--/);
    expect(svg).toContain("Model &lt;1&gt; · C: 90.0% (estimated)");
    expect(svg.match(/<circle[^>]*r="3.4"/g)).toHaveLength(2);
  });
});
