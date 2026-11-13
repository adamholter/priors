import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { normalizeLabel } from "../../src/data/normalize";
import { WEBSITEBENCH_ID, parseWebsiteBench } from "./sources/websitebench";

const html = readFileSync(path.join(__dirname, "fixtures/websitebench.html"), "utf8");

describe("WebsiteBench", () => {
  const { rows, benchmarks } = parseWebsiteBench(html);
  it("reads the embedded leaderboard: overall pooled pass rate, with mean cost per task", () => {
    expect(benchmarks[0]).toMatchObject({ id: WEBSITEBENCH_ID, higherIsBetter: true, unit: "percent", eligibleForDefault: false });
    expect(rows).toHaveLength(8);
    expect(rows.find((r) => r.modelLabel === "Claude Opus 5.5")).toMatchObject({ value: 26.2, details: { passed: 11812, total: 45091 } });
    expect(rows.find((r) => r.modelLabel === "Claude Opus 5.5")?.costUsd).toBeCloseTo(305.09, 1);
  });
  it("maps every model", () => {
    expect(rows.filter((r) => !normalizeLabel(r.modelLabel, r.effort).ok).map((r) => r.modelLabel)).toEqual([]);
  });
});
