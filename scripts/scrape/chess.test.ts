import { describe, expect, it } from "vitest";
import { parseDubesorChess } from "./sources/dubesor-chess";
import { parseChessBench } from "./sources/chessbench";
import { parseLlmChess } from "./sources/llm-chess";
import { parseChessLlmBenchmark } from "./sources/chess-llm-benchmark";

const dubesor = `# AI Chess Leaderboard (dubesor.de): plain-text data snapshot
Last updated: 2026-10-31 13:55 CET

## Detailed Player Statistics: 5+ games, Mixed Modes (306 models)

| # | Model | Elo | Cost | Games | W-D-L | Acc | Blunder | WR | Mat | Turns | Tok | Spd | Legal |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 2 | gemini-3-pro-preview ˟ | 1834 ±100 | ~$1.65 | 75 | 64-7-4 | 90.7% | 2.2% | 90% | +12.1 | 40.2 | 3319 | 40s | 100% / 98.7% |
| 12 | claude-opus-5.5 | 1570 ±94 | $0.70 | 38 | 16-6-16 | 85.3% | 2.8% | 50% | +0.4 | 51.4 | 515 | 8.1s | 100% / 98.3% |
| 14 | maia5-1500 | 1548 ±86 | - | 48 | 24-7-17 | 83.7% | 3.2% | 57.3% | +5.4 | 38.1 | - | - | 100% / 100% |
| 200 | tiny-model | 900 ±250 | $0.01 | 6 | 1-0-5 | 40% | 20% | 17% | -9 | 30 | 100 | 1s | 90% / 90% |
| 302 | random-mover | 419 | - | 200 | 15-170-15 | 28.6% | 30.5% | 50% | 0 | 174.2 | - | - | 100% / 100% |

## Puzzle Rating: 100+ puzzles, Lichess set v1 (500 puzzles in set, 53 models)

| # | Model | Puzzle Elo | Puzzles | 1st Try | Recover | Failed | Partial | Legal | Tok | Cost | Spd |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | gemini-4-argon-high | 2150 ±74 | 250/500 | 76% | 68.3% | 7.6% | 92.9% | 100% | 2679 | 7.44¢ | 43s |
| 17 | maia5-1500 | 1391 ±51 | 500 | 39.2% | 30.9% | 42% | 59.6% | 100% | - | - | - |

## Detailed Player Statistics: 5+ games, Reasoning (305 models)

| # | Model | Elo | Cost | Games |
| --- | --- | --- | --- | --- |
| 1 | other-pool | 2000 ±50 | $1 | 50 |
`;

describe("Dubesor AI Chess", () => {
  it("reads Mixed-modes game Elo and puzzle Elo, splitting ±, deprecated marks and baselines, 10+ games only", () => {
    const { rows, lastUpdated } = parseDubesorChess(dubesor);
    expect(lastUpdated).toBe("2026-10-31");
    expect(rows.map((r) => [r.benchmarkId, r.modelLabel, r.value])).toEqual([
      ["dubesor-chess", "gemini-3-pro-preview", 1834], ["dubesor-chess", "claude-opus-5.5", 1570], ["dubesor-chess-puzzles", "gemini-4-argon-high", 2150],
    ]);
    expect(rows[0]).toMatchObject({ ci: [1734, 1934], rank: 2, details: { games: 75, deprecated: true, costPerGameUsd: 1.65, costReconstructed: true } });
    expect(rows[2].details).toMatchObject({ puzzles: 250 });
    expect(rows[2].details!.costPerPuzzleUsd).toBeCloseTo(0.0744);
  });
});

describe("ChessBench", () => {
  it("keeps qualified setups with effort and the Glicko deviation", () => {
    const { rows, lastUpdated } = parseChessBench({ updatedAt: "2026-10-26T23:44:16.023Z", models: [
      { slug: "gemini-4-argon", name: "Gemini 4 Argon", url: "https://chessbench.org/models/gemini-4-argon", setups: [
        { name: "Gemini 4 Argon", model: "gemini-4-argon", effort: "medium", rating: 2170.4, deviation: 89.5, games: 70, qualified: true, rank: 1 },
        { name: "Gemini 4 Argon", model: "gemini-4-argon", effort: "low", rating: 1500, deviation: 300, games: 4, qualified: false },
      ] },
    ] });
    expect(lastUpdated).toBe("2026-10-26");
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ benchmarkId: "chessbench", modelLabel: "Gemini 4 Argon", effort: "medium", value: 2170.4, rank: 1, details: { ratingDeviation: 89.5, games: 70 } });
  });
});

describe("LLM Chess", () => {
  it("parses the CSV inside data.js, skipping empty Elo, combos and wide margins", () => {
    const js = "const data = `\nPlayer,min_game_date,total_games,elo,elo_moe_95\ngpt-6-astra-high,2026-09-09,67,1613.842,109.730\nclaude-opus-5-5-high,2026-09-24,64,1575.252,112.698\nno-elo,2026-10-01,10,,\nnon-gemini-25pro-t03_mini41,2025-05-01,40,1200,90\nnoisy,2026-10-21,10,900,400\n`;\n";
    const { rows, lastUpdated } = parseLlmChess(js);
    expect(rows.map((r) => [r.modelLabel, r.value])).toEqual([["gpt-6-astra-high", 1613.842], ["claude-opus-5-5-high", 1575.252]]);
    expect(rows[0].ci![0]).toBeCloseTo(1504.112);
    expect(lastUpdated).toBe("2026-09-24");
  });
});

describe("Chess LLM Benchmark", () => {
  it("drops anchors, engines, retired and low-game players", () => {
    const rows = parseChessLlmBenchmark([
      { player_id: "eubos", rating: 2357, games_played: 61, is_anchor: true, is_engine: true },
      { player_id: "gemini-4-argon (high)", rating: 1990, rating_deviation: 60, confidence_low: 1872, confidence_high: 2108, fide_estimate: 1850, games_played: 40 },
      { player_id: "old-model", rating: 1500, games_played: 40, retired: true },
      { player_id: "new-model (high)", rating: 1800, games_played: 6 },
    ]);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ benchmarkId: "chess-llm-benchmark", modelLabel: "gemini-4-argon (high)", value: 1990, ci: [1872, 2108], details: { fideEstimate: 1850, games: 40 } });
  });
});
