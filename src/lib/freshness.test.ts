import { describe, expect, it } from "vitest";
import type { Snapshot, SourceRun } from "@/data/types";
import type { IndexConfig } from "@/engine";
import { ago, DAY, HOUR, MIN, oldestFetch, sourcesFor, STALE_AFTER } from "./freshness";

const run = (sourceId: string, fetchedAt: string, status: SourceRun["status"] = "ok"): SourceRun => ({ sourceId, status, fetchedAt, rowCount: 1, unknownLabels: [], rawPath: "" });
const snapshot = (sources: SourceRun[]) => ({
  generatedAt: "2026-11-01T00:00:00Z", sources,
  benchmarks: [{ id: "a", sourceId: "aa" }, { id: "b", sourceId: "or" }, { id: "c", sourceId: "x" }],
}) as unknown as Snapshot;
const mix = (weights: Record<string, number>) => ({ weights }) as IndexConfig;

describe("ago", () => {
  it("steps from just now to minutes, hours and days", () => {
    expect(ago(30_000, 0)).toBe("just now");
    expect(ago(14 * MIN + 59_000, 0)).toBe("14 min ago");
    expect(ago(HOUR, 0)).toBe("1 h ago");
    expect(ago(23 * HOUR + 59 * MIN, 0)).toBe("23 h ago");
    expect(ago(2 * DAY, 0)).toBe("2 d ago");
  });
  it("never reads as the future when the clock is behind the fetch", () => {
    expect(ago(-5 * MIN, 0)).toBe("just now");
  });
  it("gives the date after a week", () => {
    expect(ago(8 * DAY, Date.parse("2026-01-15T12:00:00Z"))).toBe("Jan 15");
  });
  it("calls three hours stale and no less", () => {
    expect(STALE_AFTER).toBe(3 * HOUR);
  });
});

describe("sourcesFor and oldestFetch", () => {
  const s = snapshot([run("aa", "2026-11-02T10:00:00Z"), run("or", "2026-11-02T08:00:00Z"), run("x", "2026-11-02T07:00:00Z")]);
  it("lists only the sources of benchmarks with weight, oldest first", () => {
    expect(sourcesFor(s, mix({ a: 50, b: 50, c: 0 })).map((r) => r.sourceId)).toEqual(["or", "aa"]);
  });
  it("puts a failed source first, whatever its age", () => {
    const f = snapshot([run("aa", "2026-11-02T10:00:00Z", "failed"), run("or", "2026-11-02T08:00:00Z")]);
    expect(sourcesFor(f, mix({ a: 1, b: 1 })).map((r) => r.sourceId)).toEqual(["aa", "or"]);
  });
  it("takes the oldest scrape as the mix's age", () => {
    expect(oldestFetch(s, mix({ a: 1, b: 1 }))).toBe(Date.parse("2026-11-02T08:00:00Z"));
  });
  it("falls back to the snapshot's build time when no source is known", () => {
    expect(oldestFetch(s, mix({ zzz: 10 }))).toBe(Date.parse("2026-11-01T00:00:00Z"));
  });
});
