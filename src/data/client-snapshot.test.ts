import { expect, test } from "vitest";
import { computeIndex, defaultConfig } from "../engine";
import { DEFAULT_PRIORS_MIX } from "../onboarding/defaults";
import { clientSnapshot, coreSnapshot, onboardingSnapshot, slimObservation } from "./client-snapshot";
import { loadSnapshot } from "./load";
import type { Snapshot } from "./types";

const result2 = (a: Snapshot, b: Snapshot) => { const ranked = (s: Snapshot) => JSON.stringify(computeIndex(s, defaultConfig(b)).ranked.map((r) => [r.variant.id, r.score, r.costUsd, r.speed, r.values])); return ranked(a) === ranked(b); };

test("client snapshot preserves rankings and calculation details", async () => {
  const full = await loadSnapshot();
  expect(full).not.toBeNull();
  if (!full) return;
  const compact = clientSnapshot(full);
  for (const config of [defaultConfig(full), DEFAULT_PRIORS_MIX, { ...defaultConfig(full), strictness: 100, effortMatching: "strict" as const }]) {
    const result = (snapshot: typeof full) => computeIndex(snapshot, config).ranked.map((row) => ({
      variantId: row.variant.id, score: row.score, costUsd: row.costUsd, speed: row.speed, values: row.values,
    }));
    expect(result(compact)).toEqual(result(full));
  }
  const lineup = full.models.slice(0, 3).map((m) => m.id);
  expect(onboardingSnapshot(full, lineup).models.map((m) => m.id)).toEqual(lineup);
  expect(result2(coreSnapshot(full), full)).toBe(true);
  expect(JSON.stringify(compact).length).toBeLessThan(JSON.stringify(full).length);
});

test("slimming keeps what the engine reads", () => {
  const base = { benchmarkId: "b", variantId: "m@max", value: 1, observedAt: "2026-10-16T00:00:00Z", sourceUrl: "u" };
  expect(slimObservation({ ...base, note: "carried from 2026-10-15", sourceModelId: "x" })).toEqual({ ...base, observedAt: "" });
  expect(slimObservation({ ...base, note: "effort estimated from peers" }).note).toBe("effort estimated from peers");
  expect(slimObservation({ ...base, costUsd: 0.5, sourceModelId: "x" }).sourceModelId).toBe("x");
});

test("T3 Code real-use rows keep the users and turns behind them, for the hover and the minimum-users filter", () => {
  const o = (benchmarkId: string) => ({ benchmarkId, variantId: "m@high", value: 1, observedAt: "", sourceUrl: "u", details: { users: 40, turns: 300, perTurn: { fresh: 1, cached: 2, written: 0, output: 3 }, medianSec: 9 } });
  const snap = { observations: [o("t3-turn-time"), o("t3-cost-per-turn"), o("other")], variants: [], series: [] } as unknown as Snapshot;
  const [time, cost, other] = clientSnapshot(snap).observations;
  expect(time.details).toEqual({ users: 40, turns: 300 });
  expect(cost.details).toEqual({ users: 40, turns: 300 });
  expect(other.details).toBeUndefined();
});
