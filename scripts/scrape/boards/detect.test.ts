import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { detectCandidates, discriminator, jsonLinks, leafPaths } from "./detect";
import { readBoard } from "./run";

const fixture = (f: string) => readFileSync(new URL(`../fixtures/${f}`, import.meta.url), "utf8");

describe("board:try candidate detection", () => {
  it("finds aria-label charts with a match that survives a growing count", () => {
    const aria = detectCandidates(fixture("boards-aria.html")).filter((c) => c.reader === "ariaLabel");
    expect(aria.map((c) => c.rows.length)).toEqual([4, 6, 3]);
    expect(String(aria[1].options.match)).toBe(String(/^Accuracy across all \d+ tasks against/));
  });
  it("finds the board array in __NEXT_DATA__ by a stable key, with keyed sub-array fields, and rows keyed by model", () => {
    const html = fixture("boards-next.html"), found = detectCandidates(html);
    const board = found.find((c) => c.options.rows === "props.pageProps.boards[key=widget-v1].rows")!;
    expect(board.options).toMatchObject({ label: "model.name", value: "scores[metric=mean].value", ciHalf: "scores[metric=mean].err", effort: "model.effort" });
    expect(board.rows).toHaveLength(3);
    expect(readBoard({ reader: board.reader, ...board.options }, html)).toEqual(board.rows);
    expect(found.find((c) => c.options.script === "board-data")?.options).toMatchObject({ rows: "entries", label: "$key", value: "accuracy" });
    expect(found.some((c) => String(c.options.rows).includes("nav"))).toBe(false);
  });
  it("reads a JSON body directly and prefers a score over rank, interval or cost fields", () => {
    const [c] = detectCandidates(fixture("boards.json"));
    expect(c).toMatchObject({ reader: "json", options: { rows: "leaderboard", label: "model_name", value: "accuracy", effort: "reasoning_effort" } });
  });
  it("finds tables with a name column and a score column", () => {
    const tables = detectCandidates(fixture("boards-table.html")).filter((c) => c.reader === "table");
    expect(tables.map((c) => c.options)).toEqual([{ table: 1, label: "Model", value: "Score", effort: "Effort" }, { table: 2, label: "System", value: "Win rate (%)" }]);
    expect(tables[0].rows).toHaveLength(4);
  });
  it("names keyed arrays by a readable key, never a hash id when another works", () => {
    expect(discriminator([{ _id: "a1", leaderboardKey: "x", displayName: "X" }, { _id: "b2", leaderboardKey: "y", displayName: "Y" }])).toBe("leaderboardKey");
    expect(leafPaths({ m: { name: "A" }, s: [{ pass: "mean-8", score: 1 }, { pass: "best-8", score: 2 }] }).map((x) => x.path)).toEqual(["m.name", "s[pass=mean-8].pass", "s[pass=mean-8].score", "s[pass=best-8].pass", "s[pass=best-8].score"]);
  });
  it("lists JSON files and fetch targets the page names, resolved, without build manifests", () => {
    const html = `<script src="/_next/static/x/_buildManifest.json"></script><a href="/data/board.json">data</a><script>fetch("/api/leaderboard?v=2")</script><link href="https://cdn.test/results.json?x=1">`;
    expect(jsonLinks(html, "https://bench.test/page")).toEqual(["https://bench.test/data/board.json", "https://cdn.test/results.json?x=1", "https://bench.test/api/leaderboard?v=2"]);
  });
});
