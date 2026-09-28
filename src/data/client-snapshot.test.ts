import { expect, test } from "vitest";
import { computeIndex, defaultConfig } from "../engine";
import { DEFAULT_PRIORS_MIX } from "../onboarding/defaults";
import { clientSnapshot, onboardingSnapshot } from "./client-snapshot";
import { loadSnapshot } from "./load";

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
  expect(onboardingSnapshot(full).observations).toEqual([]);
  expect(JSON.stringify(compact).length).toBeLessThan(JSON.stringify(full).length);
});
