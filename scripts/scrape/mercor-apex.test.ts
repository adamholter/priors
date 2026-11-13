import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { BOARDS } from "./boards/configs";
import { parseBoard } from "./boards/run";
import { normalizeLabel } from "../../src/data/normalize";

const board = readFileSync(new URL("./fixtures/mercor-apex-owe.json", import.meta.url), "utf8");
const page = (benchmarks: unknown[]) => `<html><script id="__NEXT_DATA__" type="application/json">${JSON.stringify({ props: { pageProps: { benchmarks } } })}</script></html>`;
const config = BOARDS.find((b) => b.id === "owe-bench")!;

describe("Mercor APEX OWE-Bench (config board)", () => {
  it("reads OWE-Bench's Mean@8 with its 95% interval", () => {
    const { benchmark, rows } = parseBoard(config, page([{ leaderboardKey: "apex-agents-leaderboard", globalLeaderboard: [] }, JSON.parse(board)]));
    expect(benchmark).toMatchObject({ id: "owe-bench", sourceId: "mercor-apex" });
    const fable = rows.find((r) => r.modelLabel === "Claude Fable 5.2")!;
    expect(fable).toMatchObject({ value: 54.6, effort: "max", ci: [46.2, 63], sourceUrl: "https://www.mercor.com/apex/" });
    expect(fable.ci![1]).toBeCloseTo(63);
    expect(rows.find((r) => r.modelLabel === "Gemini 4 Argon")?.effort).toBe("high");
    expect(normalizeLabel(fable.modelLabel)).toMatchObject({ ok: true, modelId: "claude-fable-5.2" });
    expect(rows.length).toBeGreaterThanOrEqual(13);
  });
  it("throws when the board is gone, so the last scores stand", () => {
    expect(() => parseBoard(config, page([]))).toThrow(/no array at props\.pageProps\.benchmarks/);
    expect(() => parseBoard(config, "<html></html>")).toThrow(/__NEXT_DATA__/);
  });
});
