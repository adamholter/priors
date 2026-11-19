import { describe, expect, it } from "vitest";
import { normalizeLabel } from "../../src/data/normalize";
import { SKIP } from "./sources/benchmarkheaven";
import { CURSORBENCH_ID, parseCursorBench } from "./sources/cursorbench";
import { loadFrozen } from "./version-splits";

const head = `<tr><th></th><th><span>Model</span></th><th><button>Score</button></th><th>Cost<span>Cost / task</span></th><th>Tokens<span>Tokens / task</span></th><th>Steps<span>Steps / task</span></th></tr>`;
const row = (rank: number, name: string, score: string, cost: string, tokens: string, steps: string) => `<tr role="button"><td>${rank}</td><td><span class="flex"><span class="truncate">${name}</span><span style="x"></span></span></td><td>${score}<!-- -->%</td><td>$<!-- -->${cost}</td><td>${tokens}</td><td>${steps}</td></tr>`;
const page = (rows: string, title = "CursorBench 4.1") => `<title>Cursor · CursorBench</title><h1 class="type-lg">${title}</h1><table><thead>${head}</thead><tbody>${rows}</tbody></table><table></table><h2>Changelog</h2><time>Nov 18, 2026</time><p>CursorBench 4.1</p><time>Oct 7, 2026</time>`;
const html = page([row(1, "Gemini 4 Neon Extra High", "65.4", "10.67", "136,273", "73"), row(2, "Fable 5.2 Max", "61.3", "48.11", "541,003", "295"), row(3, "GPT-5.6 Sol Medium", "28.7", "1.97", "10,554", "34"), row(4, "Gemini 4 Argon Low", "47.9", "7.96", "40,541", "121"), row(5, "Muse Spark 1.3 Minimal", "21.3", "0.69", "12,789", "42"), row(6, "Haiku 5.5 High", "37.5", "0.31", "77,196", "61")].join(""));

describe("CursorBench", () => {
  const { benchmark, rows } = parseCursorBench(html);
  it("reads the version and the changelog date", () => {
    expect(benchmark).toMatchObject({ id: CURSORBENCH_ID, name: "CursorBench v4.1", version: "4.1", unit: "percent", higherIsBetter: true, lastUpdated: "2026-11-18", versionPolicy: { kind: "fresh", supersedes: "bh-cursorbench-4.0" } });
  });
  it("splits the effort from the name and keeps cost, steps and tokens", () => {
    expect(rows[0]).toMatchObject({ modelLabel: "Gemini 4 Neon", effort: "xhigh", value: 65.4, costUsd: 10.67, steps: 73, rank: 1, details: { tokensPerTask: 136273 } });
    expect(rows.map((r) => r.effort)).toEqual(["xhigh", "max", "medium", "low", "minimal", "high"]);
  });
  it("resolves the names the page uses", () => {
    for (const r of rows) expect(normalizeLabel(r.modelLabel).ok, r.modelLabel).toBe(true);
  });
  it("fails loudly when the page changes", () => {
    expect(() => parseCursorBench(page("", "Benchmarks"))).toThrow(/no version/);
    expect(() => parseCursorBench(html.replace("Score", "Rating"))).toThrow(/columns changed/);
    expect(() => parseCursorBench(page(row(1, "Fable 5.2 Max", "161.3", "1", "1", "1")))).toThrow(/bad row/);
  });
  it("leaves every CursorBench version out of Benchmark Heaven and keeps 4.0's final scores", async () => {
    expect(SKIP.test("cursorbench::4.0") && SKIP.test("cursorbench::4.1") && SKIP.test("cursorbench-cost::4.0")).toBe(true);
    const old = (await loadFrozen()).get("bh-cursorbench-4.0")!;
    expect(old).toMatchObject({ version: "4.0", benchmark: { sourceId: CURSORBENCH_ID, name: "CursorBench v4.0", unit: "percent" } });
    expect(old.rows.length).toBeGreaterThan(80);
    for (const r of old.rows) { expect(normalizeLabel(r.modelLabel, r.labHint).ok, r.modelLabel).toBe(true); expect(r.note).toBe("frozen at v4.0"); }
  });
});
