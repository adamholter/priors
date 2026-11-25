import { describe, expect, it } from "vitest";
import { loadSnapshot } from "@/data/load";
import { modelDirectory, searchModels, sortModels, type ModelItem } from "./model-directory";

const item = (id: string, extra: Partial<ModelItem> = {}): ModelItem => ({ id, name: id, labId: "lab", labName: "Lab", labColor: "#000", reasoning: false, benchmarks: 1, aliases: [], ...extra });

describe("model directory", () => {
  it("sorts by a column with missing values last either way", () => {
    const xs = [item("a", { rank: 2 }), item("b"), item("c", { rank: 1 })];
    expect(sortModels(xs, "rank", "asc").map((x) => x.id)).toEqual(["c", "a", "b"]);
    expect(sortModels(xs, "rank", "desc").map((x) => x.id)).toEqual(["a", "c", "b"]);
    expect(sortModels([item("old", { releaseDate: "2025-01-01" }), item("new", { releaseDate: "2026-11-01" })], "released", "desc")[0].id).toBe("new");
  });
  it("finds a model by name words, lab or alias, name matches first", () => {
    const xs = [item("x", { name: "Claude Opus 5.5", labName: "Anthropic" }), item("y", { name: "Gemini 4 Neon", labName: "Google", aliases: ["neon"] }), item("z", { name: "Opus-like", labName: "Other" })];
    expect(searchModels(xs, "opus 5").map((x) => x.id)).toEqual(["x"]);
    expect(searchModels(xs, "google").map((x) => x.id)).toEqual(["y"]);
    expect(searchModels(xs, "anthropic opus").map((x) => x.id)).toEqual(["x"]);
    expect(searchModels(xs, "nothing")).toEqual([]);
  });
  it("on today's snapshot: ranked models in index order, counts and prices for known models", async () => {
    const snapshot = (await loadSnapshot())!;
    const { items, indexName } = modelDirectory(snapshot);
    expect(indexName).toBeTruthy();
    expect(items.length).toBeGreaterThan(100);
    const ranked = sortModels(items, "rank", "asc").filter((x) => x.rank != null);
    expect(ranked[0].rank).toBe(1);
    expect(ranked.slice(0, 20).every((x, i) => i === 0 || x.score! <= ranked[i - 1].score!)).toBe(true);
    const opus = items.find((x) => x.id === "claude-opus-5.5")!;
    expect(opus).toMatchObject({ labName: "Anthropic" });
    expect(opus.benchmarks).toBeGreaterThan(20);
    expect(opus.priceUsd).toBeGreaterThan(0);
    expect(items.some((x) => x.superseded)).toBe(true);
    expect(items.every((x) => snapshot.models.find((m) => m.id === x.id)?.kind === "llm")).toBe(true);
  });
});
