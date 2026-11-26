import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { normalizeLabel } from "../../src/data/normalize";
import { ANTIGRAVITY_ALIAS_EFFORT, MIN_USERS, T3_PAYLOAD_VERSION, T3_TURN_TIME_ID, TOKEN_DAYS, t3Sql, tokenStart, mergeWatched, parseT3Telemetry, type T3Payload } from "./sources/t3-telemetry";

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
  it("files Antigravity's plain Gemini Neon id under the effort Antigravity runs it at, not as unstated", () => {
    // Newer T3 Code versions send `gemini-4-neon` with no effort; Antigravity resolves that alias to gemini-4-neon-high.
    expect(ANTIGRAVITY_ALIAS_EFFORT).toEqual({ "gemini-4-neon": "high" });
    expect(t3Sql("2026-11-25 00:00:00")).toContain("if(provider = 'antigravity' AND effort = '', transform(m2, ['gemini-4-neon'], ['high'], ''), effort)");
    expect(T3_PAYLOAD_VERSION).toBeGreaterThanOrEqual(6);
  });
  it("prices tokens from the last week (no earlier than the November 25 cache jump), falling back to the full window when the week is thin", () => {
    expect(TOKEN_DAYS).toBe(7);
    expect(tokenStart(Date.parse("2026-11-26T15:00:00Z")).toISOString()).toBe("2026-11-25T00:00:00.000Z");
    expect(tokenStart(Date.parse("2026-12-10T00:00:00Z")).toISOString()).toBe("2026-12-03T00:00:00.000Z");
    expect(t3Sql("2026-11-25 00:00:00")).toContain("timestamp >= toDateTime('2026-11-25 00:00:00', 'UTC') AS rtok");
    const full = [480, 1200, 2_400_000, 40_000, 7100, 35];
    const efforts = (recent: number[]) => [["high", 500, 40, 200, 30, 400, 7000, ...full, ...recent]];
    const p: T3Payload = { ...payload, tokenStart: "2026-11-25", rows: [...payload.rows.slice(0, 10), ["kimi-k3", 500, efforts([90, 600, 2_500_000, 30_000, 7000, 12])], ["glm-5.3-flash", 500, efforts([20, 1, 2, 3, 4, 9])]] as T3Payload["rows"] };
    const at = (label: string) => parseT3Telemetry(p).rows.find((r) => r.modelLabel === label)?.details as Record<string, unknown>;
    expect(at("kimi-k3")).toMatchObject({ perTurn: { fresh: 600, cached: 2_500_000, written: 30_000, output: 7000 }, tokenTurns: 90, tokenUsers: 12, tokenWindow: `2026-11-25 to ${payload.end}` });
    expect(at("glm-5.3-flash")).toMatchObject({ perTurn: { fresh: 1200, output: 7100 }, tokenTurns: 480, tokenWindow: `${payload.start} to ${payload.end}` });
  });
  it("carries the average turn's tokens by kind where enough turns have token counts, and none from an older payload", () => {
    const efforts = (tokens: number[] | []) => [["high", 500, 40, 200, 30, 400, 7000, ...tokens]];
    const p: T3Payload = { ...payload, rows: [...payload.rows.slice(0, 10), ["kimi-k3", 500, efforts([480, 1200, 2_400_000, 40_000, 7100, 35])], ["glm-5.3-flash", 500, efforts([12, 1, 2, 3, 4, 9])], ["gemini-4-hydrogen", 500, efforts([42, 1, 2, 3, 4, 2])]] as T3Payload["rows"] };
    const at = (label: string) => parseT3Telemetry(p).rows.find((r) => r.modelLabel === label)?.details as { perTurn?: unknown; tokenTurns?: number };
    expect(at("kimi-k3")).toMatchObject({ perTurn: { fresh: 1200, cached: 2_400_000, written: 40_000, output: 7100 }, tokenTurns: 480, tokenUsers: 35 });
    // Too few turns with token counts, or too few users behind them (most of the turns came from a harness that sends none).
    expect(at("glm-5.3-flash").perTurn).toBeUndefined();
    expect(at("gemini-4-hydrogen").perTurn).toBeUndefined();
    // The fixture predates the token columns.
    expect(rows.some((r) => (r.details as { perTurn?: unknown }).perTurn)).toBe(false);
  });
  it("skips provider-prefixed, fast-mode and versionless ids instead of folding them into the plain model", () => {
    expect(rows.some((r) => /us\.anthropic|-fast$|^opus$/.test(r.modelLabel))).toBe(false);
    expect(of("glm-5.3").length).toBeGreaterThan(0);
    expect(rows.filter((r) => !normalizeLabel(r.modelLabel, r.effort).ok).map((r) => r.modelLabel)).toEqual([]);
  });
});

describe("checking for models the site does not show yet", () => {
  type Row = T3Payload["rows"][number];
  const effort = (eff: string, n: number) => [eff, n, 20, 60, 50, 90, 100] as Row[2][number];
  const row = (base: string, ...e: [string, number][]): Row => [base, e.reduce((a, [, n]) => a + n, 0), e.map(([eff, n]) => effort(eff, n))];
  const day = (...rows: Row[]): T3Payload => ({ version: 4, fetchedAt: "2026-11-18T00:00:00Z", start: "2026-10-19", end: "2026-11-18", rows });
  const enough: [string, number][] = [["low", 400], ["high", 400], ["max", 400]];
  it("adds a model that is missing, and refreshes one still held", () => {
    const held = row("held-1", ["low", 100], ["high", 100], ["max", 100]);
    const { payload, added } = mergeWatched(day(held), [row("new-1", ...enough), row("held-1", ...enough)], () => false);
    expect(added).toEqual(["new-1", "held-1"]);
    expect(payload.rows.find((r) => r[0] === "held-1")?.[1]).toBe(1200);
  });
  it("leaves published models that have not grown fast, and anything with turns older than the week, alone", () => {
    const old = row("old-1", ["low", 5000], ["high", 5000], ["max", 5000]), shown = row("shown-1", ["low", 350], ["high", 350], ["max", 350]);
    const start = day(old, shown);
    const { payload, added } = mergeWatched(start, [row("old-1", ...enough), row("shown-1", ...enough)], (b) => b === "shown-1");
    expect(added).toEqual([]);
    expect(payload).toBe(start);
  });
  it("waits for enough turns at enough efforts", () => {
    // A published model days old: refreshed once the week holds a quarter more turns than the day's query, not before.
    const young = day(row("young-1", ...enough));
    expect(mergeWatched(young, [row("young-1", ["low", 450], ["high", 450], ["max", 450])], () => true).added).toEqual([]);
    const grown = mergeWatched(young, [row("young-1", ["low", 600], ["high", 600], ["max", 600])], () => true);
    expect(grown.added).toEqual(["young-1"]);
    expect(grown.payload.rows.find((r) => r[0] === "young-1")?.[1]).toBe(1800);
    expect(mergeWatched(day(), [row("thin-1", ["low", 100], ["high", 100], ["max", 100])], () => false).added).toEqual([]);
    expect(mergeWatched(day(), [row("two-1", ["low", 800], ["high", 800])], () => false).added).toEqual([]);
    expect(mergeWatched(day(), [row("unstated-1", ["", 5000], ["low", 400], ["high", 400])], () => false).added).toEqual([]);
  });
});
