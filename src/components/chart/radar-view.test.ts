import { describe, expect, it } from "vitest";
import { DEFAULT_RADAR, RADAR_PALETTES, radarParams, radarSvg, readRadarParams } from "./radar-view";
import type { RadarAxis } from "./radar-data";
import { textWidth } from "./radar-labels";

describe("radar view", () => {
  it("round-trips non-default settings through link params and omits defaults", () => {
    expect(Object.values(radarParams(DEFAULT_RADAR)).filter(Boolean)).toEqual([]);
    const s = { norm: "rank" as const, compare: "median" as const, colors: "distinct" as const, median: false, view: "bars" as const, models: ["a", "b"] };
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

  it("writes every benchmark name in full, inside the canvas and clear of the legend", () => {
    // The AA-II card on X: two names were cut at the left edge, two ran under the legend, three ended in an ellipsis.
    const names = ["FrontierCode 2.0-AA", "Terminal-Bench v4-AA", "AA-Briefcase v1.1", "AutomationBench-AA", "Terminal-Bench-Science-AA", "CritPt v2 Hard Subset", "HLE-Diamond", "AA-Omniscience v1.1 Accuracy", "AA-Omniscience v1.1 Non-hallucination", "GDP.pdf"];
    const axes = names.map((name, i) => ({ id: `b${i}`, name, label: name, share: 10, unit: "percent", category: "coding", description: `${name}: what it measures.`, min: 0, max: 100, median: 50 })) as RadarAxis[];
    const series = ["Fable 5.2", "Opus 5.5", "GPT-6.1 Terra"].map((name, i) => ({ id: `m${i}`, name, color: "#123456", points: names.map(() => ({ r: 0.6, value: 60, estimated: false })) }));
    const svg = radarSvg({ axes, norm: "field", pal: RADAR_PALETTES.light, series, ghost: names.map(() => ({ r: 0.4, value: 40, estimated: false })), meta: new Map(series.map((s, i) => [s.id, { rank: i + 1, score: 60 }])), size: 440 });
    const width = Number(svg.match(/width="([\d.]+)"/)![1]), height = Number(svg.match(/height="([\d.]+)"/)![1]);
    const legendX = Math.min(...[...svg.matchAll(/<line x1="([\d.]+)"[^>]*stroke-width="2.5"/g)].map((m) => Number(m[1])));
    const labels = [...svg.matchAll(/<text x="([\d.-]+)" y="([\d.-]+)" text-anchor="(\w+)" font-size="12"[^>]*><title>([^<]*)<\/title>(.*?)<\/text>/g)];
    expect(labels).toHaveLength(names.length);
    labels.forEach((m, i) => {
      const lines = [...m[5].matchAll(/<tspan[^>]*>([^<]*)<\/tspan>/g)].map((t) => t[1]);
      expect(lines.join(" ").replace(/- /g, "-")).toBe(names[i]);
      expect(m[4]).toContain("What it measures.");
      const x = Number(m[1]), w = Math.max(...lines.map((l) => textWidth(l, 12)));
      const left = m[3] === "start" ? x : m[3] === "end" ? x - w : x - w / 2;
      expect(left, names[i]).toBeGreaterThanOrEqual(0);
      expect(left + w, names[i]).toBeLessThan(legendX);
      expect(Number(m[2]) - 12).toBeGreaterThanOrEqual(0);
      expect(Number(m[2]) + (lines.length - 1) * 14.6).toBeLessThanOrEqual(height);
    });
    expect(legendX).toBeLessThan(width);
    expect(svg).not.toContain("…");
  });
});
