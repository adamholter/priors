import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { normalizeLabel } from "../../../src/data/normalize";
import { hfeEffort, parseHfe } from "./hfe";

const json = JSON.parse(readFileSync(path.resolve("scripts/scrape/fixtures/hfe/leaderboard.json"), "utf8"));

describe("Humanity's First Exam", () => {
  const rows = parseHfe(json);
  it("reads every Kaggle row's family pass^4, its interval and the effort it ran at", () => {
    expect(rows).toHaveLength(16);
    expect(rows[0]).toMatchObject({ modelLabel: "GPT-6.2 Astra", effort: "xhigh", value: 90.69 });
    expect(rows[0].ci![0]).toBeCloseTo(90.69 - 4.66, 1);
    expect(rows.find((r) => r.modelLabel === "Gemini 4 Hydrogen")).toMatchObject({ effort: "high", value: 70.52 });
    expect(rows.find((r) => r.modelLabel === "Claude Opus 5.5")).toMatchObject({ effort: "max" });
  });
  it("reads the effort word from the config name", () => {
    expect(hfeEffort("GPT-6.2 Astra Xhigh Reasoning")).toBe("xhigh");
    expect(hfeEffort("Hydrogen High Reasoning")).toBe("high");
    expect(hfeEffort("Some model")).toBeUndefined();
  });
  it("names every model so Priors can file it", () => {
    for (const r of rows) expect(normalizeLabel(r.modelLabel).ok, r.modelLabel).toBe(true);
  });
});
