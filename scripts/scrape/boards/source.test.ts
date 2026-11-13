import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import type { ScrapeContext } from "../../../src/data/types";
import { catalogEntry } from "../../../src/data/catalog";
import { BOARDS } from "./configs";
import { boardBenchmark, boardSource, fixLabel, parseBoard, type BoardConfig } from "./run";
import boards, { sources } from "../sources/boards";

const fixture = (f: string) => readFileSync(new URL(`../fixtures/${f}`, import.meta.url), "utf8");
const ctxServing = (pages: Record<string, string>): ScrapeContext => ({
  now: "2026-11-13T00:00:00.000Z", log: () => {},
  fetchText: async (url) => { if (url in pages) return pages[url]; throw new Error(`404 ${url}`); },
  fetchJson: async (url) => JSON.parse(pages[url]),
  withPage: async () => { throw new Error("no browser in tests"); },
});

const json: BoardConfig = {
  id: "widget-json", name: "Widget JSON", url: "https://widget.test", fetch: "https://widget.test/api/board.json", reader: "json",
  rows: "leaderboard", label: "model_name", value: "accuracy", effort: "reasoning_effort", ciLow: "ci_low", ciHigh: "ci_high", cost: "cost_per_task",
  unit: "percent", higherIsBetter: true, category: "reasoning", description: "Widget test.", minRows: 3, scale: 100, skip: /^Human\b/,
};
const table: BoardConfig = {
  id: "widget-table", name: "Widget Table", url: "https://widget.test/table", reader: "table", table: 2, label: "System", value: "Win rate",
  unit: "percent", higherIsBetter: true, category: "preference", description: "Widget test.", minRows: 3, note: "win rate against the pool",
};

describe("config boards", () => {
  it("keep their published ids, each unique, each with a catalog entry", () => {
    const ids = BOARDS.map((b) => b.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).toEqual(expect.arrayContaining(["company-agent-bench", "owe-bench"]));
    // A board without an entry would show its source's words and miss its categories: write one in src/data/catalog/.
    for (const b of BOARDS) expect(catalogEntry(boardBenchmark(b)), `catalog entry for ${b.id}`).toBeTruthy();
    expect(sources.map((s) => s.id)).toEqual(BOARDS.map((b) => b.sourceId ?? b.id));
  });
  it("scale values and intervals, skip labels, link the public page for a JSON endpoint, and set default-off weights", () => {
    const { benchmark, rows } = parseBoard(json, fixture("boards.json"));
    expect(benchmark).toMatchObject({ id: "widget-json", sourceId: "widget-json", url: "https://widget.test", eligibleForDefault: false, defaultWeight: 0 });
    expect(rows).toHaveLength(3);
    expect(rows[0].value).toBeCloseTo(61.2);
    expect(rows[0].ci![1]).toBeCloseTo(64);
    expect(rows[0]).toMatchObject({ benchmarkId: "widget-json", modelLabel: "GPT-6.1 Sol", effort: "medium", costUsd: 0.21, sourceUrl: "https://widget.test" });
    expect(rows.some((r) => /Human/.test(r.modelLabel))).toBe(false);
  });
  it("fail one board when it parses fewer than minRows", () => {
    expect(() => parseBoard({ ...table, minRows: 4 }, fixture("boards-table.html"))).toThrow(/widget-table: parsed only 3 rows \(min 4\)/);
  });
  it("fix labels: map first, then a prefix where it matches and is not already there", () => {
    const c = { labelMap: { Beam: "Beam 1.0" }, labelPrefix: { prefix: "Claude ", when: /^(Fable|Opus)\b/ } };
    expect(["Fable 5.2", "Claude Opus 5.5", "Beam", "GPT-6 Astra"].map((l) => fixLabel(c, l))).toEqual(["Claude Fable 5.2", "Claude Opus 5.5", "Beam 1.0", "GPT-6 Astra"]);
    expect(fixLabel({ labelPrefix: { prefix: "Acme " } }, "One")).toBe("Acme One");
  });
  it("run as their own Source, keeping the fetched body as raw", async () => {
    const r = await boardSource(table).scrape(ctxServing({ "https://widget.test/table": fixture("boards-table.html") }));
    expect(r.benchmarks.map((b) => b.id)).toEqual(["widget-table"]);
    expect(r.rows.every((x) => x.note === "win rate against the pool")).toBe(true);
    expect(Object.keys(r.raw)).toEqual(["page.html"]);
  });
  it("one broken page does not blank the others when every board runs as one source", async () => {
    const pages = { "https://companyagentbench.com": fixture("company-agent-bench.html") };
    const r = await boards.scrape(ctxServing(pages));
    expect(r.benchmarks.map((b) => b.id)).toEqual(["company-agent-bench"]);
    expect(r.rows.every((x) => x.benchmarkId === "company-agent-bench")).toBe(true);
    expect(r.notes?.some((n) => /^mercor-apex FAILED: 404/.test(n))).toBe(true);
    await expect(boards.scrape(ctxServing({}))).rejects.toThrow(/every board failed/);
  });
});
