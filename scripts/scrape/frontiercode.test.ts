import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import type { ScrapeContext } from "../../src/data/types";
import source from "./sources/frontiercode";

const fixture = (name: string) => readFileSync(fileURLToPath(new URL("./fixtures/" + name, import.meta.url)), "utf8");

const ctx = {
  now: "2026-10-27T00:00:00.000Z", log: () => undefined,
  fetchText: async (url: string) => {
    if (url.endsWith("/frontier-code-2.0/data.json")) return fixture("frontiercode-2.0.json");
    if (url.endsWith("/frontiercode-leaderboard/data.json")) return fixture("frontiercode-1.1.json");
    return "<html></html>";
  },
} as unknown as ScrapeContext;

describe("FrontierCode source", () => {
  it("reads 2.0 as the primary board and keeps 1.1 as history it supersedes", async () => {
    const r = await source.scrape(ctx);
    const v2 = r.benchmarks.find((b) => b.id === "frontiercode-2.0-main")!;
    expect(v2).toMatchObject({ eligibleForDefault: true, versionPolicy: { kind: "fresh", supersedes: "frontiercode-1.1-main" } });
    expect(r.benchmarks.find((b) => b.id === "frontiercode-1.1-main")?.eligibleForDefault).toBe(false);
    const fable = r.rows.filter((x) => x.benchmarkId === "frontiercode-2.0-main" && x.modelLabel === "Claude Fable 5.1");
    expect(fable.map((x) => x.effort)).toEqual(["low", "medium", "high", "xhigh", "max"]);
    const xhigh = fable.find((x) => x.effort === "xhigh")!;
    expect(xhigh.value).toBeCloseTo(32.44, 6);
    expect(xhigh.costUsd).toBe(8.68);
    expect(r.rows.some((x) => x.benchmarkId === "frontiercode-1.1-main" && x.modelLabel === "Claude Opus 5.5")).toBe(true);
  });
});
