import { describe, expect, it } from "vitest";
import { dateAt, placeAt, type HistoryData, type HistoryFrame } from "./history-frames";

const row = (id: string, score: number) => ({ id, modelId: id, name: id.toUpperCase(), effort: "max", labId: "x", score });
const frame = (date: string, rows: [string, number][]): HistoryFrame => ({ date, rows: rows.map(([i, s]) => row(i, s)), used: 1, of: 1, models: rows.length });
const data: HistoryData = { name: "t", mode: "fixed", labs: [], domain: [0, 100], frames: [frame("2026-01-01", [["a", 80], ["b", 60]]), frame("2026-01-02", [["b", 90], ["a", 70], ["c", 50]])] };

describe("history frames", () => {
  it("shows each snapshot exactly at its own position", () => {
    expect(placeAt(data, 0).filter((m) => m.opacity === 1).map((m) => [m.id, m.score])).toEqual([["a", 80], ["b", 60]]);
    expect(placeAt(data, 1).map((m) => [m.id, m.score])).toEqual([["b", 90], ["a", 70], ["c", 50]]);
  });
  it("slides ranks and blends scores in between; a model in one frame fades", () => {
    const mid = placeAt(data, 0.5), by = Object.fromEntries(mid.map((m) => [m.id, m]));
    expect(by.a.y).toBeCloseTo(0.5); expect(by.b.y).toBeCloseTo(0.5);
    expect(by.a.score).toBeCloseTo(75); expect(by.b.score).toBeCloseTo(75);
    expect(by.c.opacity).toBeCloseTo(0.5);
    expect(placeAt(data, 0).find((m) => m.id === "c")).toBeUndefined();
  });
  it("names the nearer date and clamps outside the range", () => {
    expect(dateAt(data, 0.4)).toBe("2026-01-01"); expect(dateAt(data, 0.6)).toBe("2026-01-02"); expect(dateAt(data, 9)).toBe("2026-01-02");
    expect(placeAt(data, -3).length).toBe(2);
  });
});

describe("the cut at the top 20", () => {
  it("shows exactly 20 rows at rest on a frame, never a half-faded 21st", () => {
    const rows = Array.from({ length: 25 }, (_, k) => ({ id: `m${k}`, modelId: `m${k}`, name: `M${k}`, effort: "high", labId: "l", score: 90 - k }));
    const data = { name: "x", frames: [{ date: "2026-10-01", rows }, { date: "2026-10-02", rows }], domain: [0, 100] } as never;
    for (const pos of [0, 1]) expect(placeAt(data, pos)).toHaveLength(20);
  });
});
