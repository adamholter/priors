import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import type { ScrapeContext } from "../../src/data/types";
import source from "./sources/frontiercode";
import { normalizeLabel } from "../../src/data/normalize";

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

describe("a launch on the board", () => {
  it("keeps every row of SWE-2 Flash on its own model, beside SWE-2", async () => {
    const cell = (score: number, cost: number) => ({ main: { correct: null, new_score: score, tokens: null, cost, duration_min: null, tool_calls: null, ote: null, flagged_rate: null } });
    const v2 = { models: ["SWE-2", "SWE-2 Flash"], harness: { "SWE-2": "devin", "SWE-2 Flash": "devin" }, efforts: { "SWE-2": ["max"], "SWE-2 Flash": ["low", "max"] }, subsets: { main: 132 }, data: { "SWE-2": { max: cell(0.2378, 1.261) }, "SWE-2 Flash": { low: cell(0.2317, 0.203), max: cell(0.24, 0.2024) } } };
    const launch = { ...ctx, fetchText: async (url: string) => url.endsWith("/frontier-code-2.0/data.json") ? JSON.stringify(v2) : ctx.fetchText(url) } as unknown as ScrapeContext;
    const rows = (await source.scrape(launch)).rows.filter((r) => r.benchmarkId === "frontiercode-2.0-main");
    const onto = (id: string) => rows.filter((r) => { const n = normalizeLabel(r.modelLabel, r.effort); return n.ok && n.modelId === id; }).map((r) => [r.effort, +r.value.toFixed(2), r.costUsd]);
    expect(onto("swe-2")).toEqual([["max", 23.78, 1.261]]);
    expect(onto("swe-2-flash")).toEqual([["low", 23.17, 0.203], ["max", 24, 0.2024]]);
  });
});
