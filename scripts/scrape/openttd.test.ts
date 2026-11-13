import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { normalizeLabel } from "../../src/data/normalize";
import { OPENTTD_ID, parseOpenTtd } from "./sources/openttd";

const json = JSON.parse(readFileSync(path.join(__dirname, "fixtures/openttd-leaderboard.json"), "utf8"));

describe("OpenTTD-Bench", () => {
  const { rows, benchmarks } = parseOpenTtd(json);
  it("ranks each model arm by its median final-year profit, with the human baseline kept out of the rows", () => {
    expect(benchmarks[0]).toMatchObject({ id: OPENTTD_ID, higherIsBetter: true, category: "games", eligibleForDefault: false });
    expect(benchmarks[0].description).toContain("median £147,616");
    expect(rows.some((r) => r.modelLabel === "Human player")).toBe(false);
    expect(rows.find((r) => r.modelLabel === "Claude Opus 5.5" && r.effort === "xhigh")).toMatchObject({ value: 415300, harness: "Claude Code", details: { games: 5, fleet: expect.any(Number) } });
    expect(rows.map((r) => normalizeLabel(r.modelLabel, r.effort).ok).every(Boolean)).toBe(true);
  });
  it("keeps cost only where the site recorded or estimated it", () => {
    expect(rows.find((r) => r.modelLabel === "Grok 4.7")?.costUsd).toBeUndefined();
    expect(rows.find((r) => r.modelLabel === "GPT-6 Astra")?.note).toContain("cost estimated at list price");
  });
});
