import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { normalizeLabel } from "../../src/data/normalize";
import { MIN_USERS, T3_TURN_TIME_ID, parseT3Telemetry, type T3Payload } from "./sources/t3-telemetry";

const payload = JSON.parse(readFileSync(path.join(__dirname, "fixtures/t3-telemetry.json"), "utf8")) as T3Payload;

describe("T3 Code telemetry by effort", () => {
  const { rows, benchmarks } = parseT3Telemetry(payload);
  const of = (label: string) => rows.filter((r) => r.modelLabel === label);
  it("reads Gemini's effort from its model id, so every Hydrogen effort shows, each with its user count", () => {
    expect(benchmarks[0]).toMatchObject({ id: T3_TURN_TIME_ID, higherIsBetter: false, eligibleForDefault: false });
    expect(of("gemini-4-hydrogen").map((r) => r.effort).sort()).toEqual(["high", "low", "medium", "xhigh"]);
    for (const r of rows) {
      expect((r.details as { users: number }).users).toBeGreaterThanOrEqual(MIN_USERS);
      expect(r.durationSec).toBeCloseTo(r.value * 60, 0);
    }
  });
  it("leaves turns with no recorded effort out where a model has explicit efforts, and keeps them where it has none", () => {
    expect(of("claude-opus-5-5").every((r) => r.effort)).toBe(true);
    expect(of("composer-2.5")).toEqual([expect.objectContaining({ effortUnstated: true })]);
  });
  it("skips provider-prefixed, fast-mode and versionless ids instead of folding them into the plain model", () => {
    expect(rows.some((r) => /us\.anthropic|-fast$|^opus$/.test(r.modelLabel))).toBe(false);
    expect(of("glm-5.3").length).toBeGreaterThan(0);
    expect(rows.filter((r) => !normalizeLabel(r.modelLabel, r.effort).ok).map((r) => r.modelLabel)).toEqual([]);
  });
});
