import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parseMercorApex } from "./sources/mercor-apex";
import { normalizeLabel } from "../../src/data/normalize";

const board = readFileSync(new URL("./fixtures/mercor-apex-owe.json", import.meta.url), "utf8");
const page = (benchmarks: unknown[]) => `<html><script id="__NEXT_DATA__" type="application/json">${JSON.stringify({ props: { pageProps: { benchmarks } } })}</script></html>`;

describe("Mercor APEX", () => {
  it("reads OWE-Bench's Mean@8 with its 95% interval", () => {
    const { benchmarks, rows } = parseMercorApex(page([{ leaderboardKey: "apex-agents-leaderboard", globalLeaderboard: [] }, JSON.parse(board)]));
    expect(benchmarks.map((b) => b.id)).toEqual(["owe-bench"]);
    const fable = rows.find((r) => r.modelLabel === "Claude Fable 5.2")!;
    expect(fable).toMatchObject({ value: 54.6, effort: "max", ci: [46.2, 63] });
    expect(fable.ci![1]).toBeCloseTo(63);
    expect(rows.find((r) => r.modelLabel === "Gemini 4 Argon")?.effort).toBe("high");
    expect(normalizeLabel(fable.modelLabel)).toMatchObject({ ok: true, modelId: "claude-fable-5.2" });
    expect(rows.length).toBeGreaterThanOrEqual(13);
  });
  it("throws when the board is gone, so the last scores stand", () => {
    expect(() => parseMercorApex(page([]))).toThrow(/open-world-engineer-leaderboard missing/);
    expect(() => parseMercorApex("<html></html>")).toThrow(/__NEXT_DATA__/);
  });
});
