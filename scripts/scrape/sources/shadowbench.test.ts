import { describe, expect, it } from "vitest";
import { normalizeLabel } from "../../../src/data/normalize";
import { withCatalog } from "../../../src/data/catalog";
import { parseShadowBench, SHADOWBENCH_ID, type ShadowRow } from "./shadowbench";

// Rows as leaderboard.parquet publishes them (Nov 5 2026), trimmed to the columns read.
const table: ShadowRow[] = [
  { kind: "model", model: "claude-opus-5.5", model_name: "Claude Opus 5.5", effort: "medium", episodes: 20, score: 39.83, ci_low: 36.52, ci_high: 43.51, cost_usd_per_episode: 0.8539, minutes_per_episode: 21.7, calls_per_episode: 85.2, best_episode_score: 63.53 },
  { kind: "model", model: "claude-opus-5.5", model_name: "Claude Opus 5.5", effort: "high", episodes: 20, score: 43.63, ci_low: 40.76, ci_high: 46.5, cost_usd_per_episode: 1.2663, minutes_per_episode: 23.1 },
  { kind: "model", model: "claude-opus-5.5", model_name: "Claude Opus 5.5", effort: "max", episodes: 20, score: 48.82, ci_low: 46.32, ci_high: 51.85, cost_usd_per_episode: 7.1297, minutes_per_episode: 53.8 },
  { kind: "model", model: "claude-sonnet-5.5", model_name: "Claude Sonnet 5.5", effort: "medium", episodes: 20, score: 17.29 },
  { kind: "model", model: "gpt-6.1-sol", model_name: "GPT-6.1 Sol", effort: "high", episodes: 20, score: 41.9 },
  { kind: "model", model: "gpt-6.1-terra", model_name: "GPT-6.1 Terra", effort: "high", episodes: 20, score: 44.38 },
  { kind: "model", model: "claude-haiku-5.5", model_name: "Claude Haiku 5.5", effort: "max", episodes: 20, score: 41.31 },
  { kind: "model", model: "gpt-6-luna", model_name: "GPT-6 Luna", effort: "medium", episodes: 20, score: 31.56 },
  { kind: "reference", model: "blob", model_name: "Featureless blob", effort: null, episodes: 20, score: 56.91, ci_low: 53.39, ci_high: 60.6 },
  { kind: "reference", model: "search", model_name: "Blind search (CMA-ES)", effort: null, episodes: 20, score: 36.19 },
  { kind: "reference", model: "rest", model_name: "Hands at rest", effort: null, episodes: 20, score: 12.11 },
];

describe("ShadowBench", () => {
  it("reads one row per model and effort, with interval, cost and minutes per episode", () => {
    const { rows, benchmarks } = parseShadowBench(table, "2026-11-05");
    expect(rows.map((r) => [r.modelLabel, r.effort, r.value])).toEqual([
      ["Claude Opus 5.5", "medium", 39.83], ["Claude Opus 5.5", "high", 43.63], ["Claude Opus 5.5", "max", 48.82], ["Claude Sonnet 5.5", "medium", 17.29],
      ["GPT-6.1 Sol", "high", 41.9], ["GPT-6.1 Terra", "high", 44.38], ["Claude Haiku 5.5", "max", 41.31], ["GPT-6 Luna", "medium", 31.56],
    ]);
    expect(rows[0]).toMatchObject({ ci: [36.52, 43.51], costUsd: 0.8539, durationSec: 1302, steps: 85.2, note: "20 episodes, one per plate; best episode 63.5" });
    expect(benchmarks[0]).toMatchObject({ id: SHADOWBENCH_ID, unit: "score", higherIsBetter: true, category: "vision", categories: ["vision", "reasoning"], lastUpdated: "2026-11-05", normalization: { kind: "linear", min: 0, max: 100 } });
  });
  it("maps every label to the exact model, never a guess", () => {
    const ids = parseShadowBench(table).rows.map((r) => normalizeLabel(r.modelLabel)).map((n) => (n.ok ? n.modelId : "UNKNOWN"));
    expect([...new Set(ids)]).toEqual(["claude-opus-5.5", "claude-sonnet-5.5", "gpt-6.1-sol", "gpt-6.1-terra", "claude-haiku-5.5", "gpt-6-luna"]);
  });
  it("keeps the reference baselines out of the rows and in the description, through the catalog", () => {
    const { rows, benchmarks } = parseShadowBench(table);
    expect(rows.some((r) => /blob|search|rest/i.test(r.modelLabel))).toBe(false);
    const once = withCatalog(benchmarks[0]).description;
    expect(once).toMatch(/^Hand shadows: shown a plate/);
    expect(once).toContain("Reference scores, not models: Featureless blob 56.9, Blind search (CMA-ES) 36.2, Hands at rest 12.1.");
    expect(withCatalog({ ...benchmarks[0], description: once }).description).toBe(once);
  });
  it("fails loudly when the table loses its models", () => {
    expect(() => parseShadowBench(table.filter((r) => r.kind !== "model"))).toThrow(/0 model rows/);
  });
});
