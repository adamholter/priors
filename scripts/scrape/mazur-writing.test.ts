import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { normalizeLabel } from "../../src/data/normalize";
import { MAZUR_WRITING_ID, parseMazurWriting } from "./sources/mazur-writing";

const md = readFileSync(path.join(__dirname, "fixtures/mazur-writing.md"), "utf8");

describe("Lech Mazur creative writing", () => {
  const { rows, benchmarks } = parseMazurWriting(md);
  it("reads every rated writer from the README table, with the interval and the update date", () => {
    expect(rows).toHaveLength(64);
    expect(benchmarks[0]).toMatchObject({ id: MAZUR_WRITING_ID, higherIsBetter: true, lastUpdated: "2026-11-12", eligibleForDefault: false });
    expect(rows[0]).toMatchObject({ modelLabel: "Claude Fable 5.2 (high)", value: 3.687, rank: 1, ci: [3.623, 3.771], details: { winChance: 93 } });
    expect(rows.find((r) => r.modelLabel.startsWith("Step 5 Preview"))?.value).toBe(-0.103);
  });
  it("drops footnote marks from labels, so they resolve", () => {
    expect(rows.some((r) => /[§†]/u.test(r.modelLabel))).toBe(false);
    const n = normalizeLabel("Claude Fable 5 (high)");
    expect(rows.find((r) => r.modelLabel === "Claude Fable 5 (high)")).toBeTruthy();
    expect(n.ok).toBe(true);
  });
});
