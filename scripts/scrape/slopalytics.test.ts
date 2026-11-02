import { describe, expect, it } from "vitest";
import source, { tokenMixes } from "./sources/slopalytics";

const payload = {
  schemaVersion: 2, fetchedAt: "2026-10-01T11:10:15Z", start: "2026-09-01", endExclusive: "2026-10-01", project: "T3 Code PROD",
  models: [
    { day: "2026-09-01", harness: "codex", model: "GPT-6 Astra", turns: 60 },
    { day: "2026-09-02", harness: "claudeAgent", model: "Opus 5.5", turns: 30 },
    { day: "2026-09-02", harness: "codex", model: "Other models", turns: 10 },
  ],
  metrics: [{ day: "2026-09-01", harness: "codex", model: "GPT-6 Astra", terminal: 100, completed: 90, interrupted: 6, failed: 4, tokenTurns: 100, output: 500_000, input: 1e6, timedTurns: 90, durationMs: 90 * 120_000, pricedTurns: 100, estimatedCost: 300 }],
};
const ctx = { fetchJson: async () => payload } as unknown as Parameters<typeof source.scrape>[0];

describe("Slopalytics T3 Code usage", () => {
  it("publishes each model's share of all turns, never ranking catch-all buckets", async () => {
    const r = await source.scrape(ctx);
    expect(r.rows.map((x) => [x.modelLabel, x.value])).toEqual([["GPT-6 Astra", 60], ["Opus 5.5", 30]]);
    expect(r.benchmarks[0]).toMatchObject({ id: "t3-usage-share", defaultWeight: 0, eligibleForDefault: false, unit: "percent" });
    expect(r.rows[0].details).toMatchObject({ window: "2026-09-01 to 2026-09-30", completionRate: 0.9, interruptRate: 0.06, minutesPerCompletedTurn: 2, outputTokensPerTurn: 5000, estimatedUsdPerTurn: 3 });
  });
  it("keeps each model's turns per day, over every day of the window, for the usage chart", async () => {
    const r = await source.scrape(ctx);
    const astra = r.rows.find((x) => x.modelLabel === "GPT-6 Astra")!.details as { start: string; daily: number[]; dayTotals: number[] };
    expect(astra.start).toBe("2026-09-01");
    expect(astra.daily).toHaveLength(30);
    expect(astra.daily.slice(0, 3)).toEqual([60, 0, 0]);
    expect((r.rows.find((x) => x.modelLabel === "Opus 5.5")!.details as { daily: number[] }).daily.slice(0, 3)).toEqual([0, 30, 0]);
    // The total counts the catch-all buckets too, so shares stay shares of everything.
    expect(astra.dayTotals.slice(0, 3)).toEqual([60, 40, 0]);
  });
  it("keeps reading when the publisher adds fields and bumps schemaVersion (v3 broke an allow-list)", async () => {
    const v3 = { ...payload, schemaVersion: 3, sent: [{ day: "2026-09-01", harness: "codex", turns: 70 }], prices: { rates: {} } };
    const r = await source.scrape({ fetchJson: async () => v3 } as unknown as Parameters<typeof source.scrape>[0]);
    expect(r.rows).toHaveLength(2);
  });
  it("rejects an unexpected payload", async () => {
    await expect(source.scrape({ fetchJson: async () => ({ schemaVersion: 9, models: [] }) } as unknown as Parameters<typeof source.scrape>[0])).rejects.toThrow();
  });
});

describe("tokenMixes", () => {
  const days = ["2026-10-25", "2026-10-26", "2026-10-27", "2026-10-28", "2026-10-29", "2026-10-30", "2026-10-31", "2026-11-01"];
  const row = (day: string, harness: string, model: string, cached: number, fresh: number, written: number, output: number, tokenTurns = 5000) => ({ day, harness, model, cached, fresh, written, output, tokenTurns });
  it("takes shares of all tokens over the last 7 days, on the busiest harness", () => {
    const mixes = tokenMixes([
      row("2026-10-25", "claudeAgent", "Opus 5.5", 1e12, 1e12, 0, 0), // outside the window
      row("2026-10-26", "claudeAgent", "Opus 5.5", 98e9, 0, 1.5e9, 0.5e9), row("2026-11-01", "claudeAgent", "Opus 5.5", 98e9, 0, 1.5e9, 0.5e9),
      row("2026-11-01", "codex", "Opus 5.5", 2e9, 0, 0, 0), row("2026-11-01", "opencode", "Opus 5.5", 1e6, 0, 0, 0),
    ], days);
    expect(mixes.get("Opus 5.5")).toMatchObject({ cache: 0.98, input: 0, cacheWrite: 0.015, output: 0.005, harness: "claudeAgent", tokens: 200e9, start: "2026-10-26", end: "2026-11-01", confidence: "high" });
    expect(Object.keys(mixes.get("Opus 5.5")!.byHarness!)).toEqual(["codex"]);
  });
  it("leaves out thin models and buckets, and marks small samples medium", () => {
    const mixes = tokenMixes([row("2026-11-01", "codex", "Tiny", 1e8, 0, 0, 0), row("2026-11-01", "codex", "Few turns", 5e9, 0, 0, 0, 10), row("2026-11-01", "codex", "Other models", 5e11, 0, 0, 0), row("2026-11-01", "codex", "Small", 5e9, 0, 0, 0)], days);
    expect([...mixes.keys()]).toEqual(["Small"]);
    expect(mixes.get("Small")?.confidence).toBe("medium");
  });
});
