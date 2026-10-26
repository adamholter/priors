import { describe, expect, it } from "vitest";
import { parseBoardBench } from "./sources/boardbench";

const points = [
  { slug: "gemini-4-argon-high", className: "Gemini 4 Argon", effort: "high", lab: "google", label: "Gemini 4 Argon High", costUsd: 0.278, qualityPct: 66.317 },
  { slug: "claude-opus-5.5-high", className: "Claude Opus 5.5", effort: "high", lab: "anthropic", label: "Claude Opus 5.5 High", costUsd: 0.0773, qualityPct: 37.6 },
  { slug: "broken", className: "No score", effort: "high" },
];
// Next.js inlines the page's RSC payload as escaped string chunks.
const payload = `37:["$","section",null,{"heading":"Quality vs cost","points":${JSON.stringify(points)}}]`;
const html = `<script>self.__next_f.push([1,${JSON.stringify(payload)}])</script>`;

describe("BoardBench", () => {
  it("reads quality and effort per model from the chart points, with the answer cost in details", () => {
    const rows = parseBoardBench(html);
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({ benchmarkId: "boardbench", modelLabel: "Gemini 4 Argon", effort: "high", value: 66.317, details: { costPerAnswerUsd: 0.278 } });
    expect(rows[1].costUsd).toBeUndefined();
  });
  it("returns nothing when the payload has no scored points", () => {
    expect(parseBoardBench("<html></html>")).toEqual([]);
  });
});
