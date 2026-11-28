import { describe, expect, it } from "vitest";
import { age, dateText, effortsText, labsOf, lowerEfforts, modelView, nextOrder, NO_FILTERS, paramsHint, reasonText, reasonWord, RANK_ORDER, searchModels, sortModels, usd, type Filters, type ModelItem } from "./model-list";

const item = (id: string, extra: Partial<ModelItem> = {}): ModelItem => ({ id, name: id, labId: "lab", labName: "Lab", labColor: "#000", reasoning: false, benchmarks: 1, aliases: [], ...extra });
const NOW = Date.parse("2026-11-28");
const view = (items: ModelItem[], f: Partial<Filters> = {}, order = RANK_ORDER) => modelView(items, { ...NO_FILTERS, ...f }, order, NOW);

describe("sorting", () => {
  it("sorts by a column; a worst-first rank list starts with the unranked", () => {
    const xs = [item("a", { rank: 2 }), item("b"), item("c", { rank: 1 })];
    expect(sortModels(xs, "rank", "asc").map((x) => x.id)).toEqual(["c", "a", "b"]);
    expect(sortModels(xs, "rank", "desc").map((x) => x.id)).toEqual(["b", "a", "c"]);
    expect(sortModels([item("old", { releaseDate: "2025-01-01" }), item("new", { releaseDate: "2026-11-01" })], "released", "desc")[0].id).toBe("new");
  });
  it("puts older versions after the ranked by score, then the rest by how much is measured", () => {
    const xs = [item("thin", { benchmarks: 2 }), item("old-lo", { score: 30, superseded: true }), item("r1", { rank: 1, score: 50 }), item("old-hi", { score: 40, superseded: true }), item("wide", { benchmarks: 9 })];
    expect(sortModels(xs, "rank", "asc").map((x) => x.id)).toEqual(["r1", "old-hi", "old-lo", "wide", "thin"]);
  });
  it("sorts by cost per task, cheapest first, models with none last", () => {
    const xs = [item("a", { costUsd: 2 }), item("b"), item("c", { costUsd: 0.5 })];
    expect(sortModels(xs, "cost", "asc").map((x) => x.id)).toEqual(["c", "a", "b"]);
    expect(sortModels(xs, "cost", "desc").map((x) => x.id)).toEqual(["a", "c", "b"]);
  });
  it("a column click takes its natural direction, a second click flips it", () => {
    expect(nextOrder(RANK_ORDER, "released")).toEqual({ sort: "released", dir: "desc" });
    expect(nextOrder({ sort: "released", dir: "desc" }, "released")).toEqual({ sort: "released", dir: "asc" });
    expect(nextOrder({ sort: "released", dir: "asc" }, "name")).toEqual({ sort: "name", dir: "asc" });
  });
});

describe("search", () => {
  it("finds a model by name words, lab or alias, name matches first", () => {
    const xs = [item("x", { name: "Claude Opus 5.5", labName: "Anthropic" }), item("y", { name: "Gemini 4 Neon", labName: "Google", aliases: ["neon"] }), item("z", { name: "Opus-like", labName: "Other" })];
    expect(searchModels(xs, "opus 5").map((x) => x.id)).toEqual(["x"]);
    expect(searchModels(xs, "google").map((x) => x.id)).toEqual(["y"]);
    expect(searchModels(xs, "anthropic opus").map((x) => x.id)).toEqual(["x"]);
    expect(searchModels(xs, "nothing")).toEqual([]);
  });
});

describe("labs and the view", () => {
  const items = [
    item("a1", { labId: "a", labName: "A", rank: 1, score: 60 }), item("a2", { labId: "a", labName: "A", rank: 3, score: 50, openWeights: true, releaseDate: "2026-11-10" }), item("a3", { labId: "a", labName: "A", superseded: true, score: 40 }),
    item("b1", { labId: "b", labName: "B", rank: 2, score: 55, releaseDate: "2026-07-01" }), item("b2", { labId: "b", labName: "B", benchmarks: 7 }),
    item("o1", { labId: "other", labName: "Other", rank: 4, score: 45 }), item("c1", { labId: "c", labName: "C" }),
  ];
  it("orders labs by ranked models, then best rank, Other last", () => {
    expect(labsOf(items).map((l) => l.id)).toEqual(["a", "b", "c", "other"]);
  });
  it("lists ranked models by default and counts ranked over total per lab, older versions left out", () => {
    const v = view(items);
    expect(v.rows.map((x) => x.id)).toEqual(["a1", "b1", "a2", "o1"]);
    expect(v.counts.get("a")).toEqual({ ranked: 2, total: 2 });
    expect(v.counts.get("b")).toEqual({ ranked: 1, total: 2 });
    expect(v.total).toEqual({ ranked: 4, total: 6 });
    expect(v.rankedN).toBe(4);
    expect(v.allN).toBe(6);
  });
  it("All adds unranked models; Older versions adds the older ones with their scores", () => {
    expect(view(items, { tier: "all" }).rows.map((x) => x.id)).toEqual(["a1", "b1", "a2", "o1", "b2", "c1"]);
    const v = view(items, { older: true });
    expect(v.rows.map((x) => x.id)).toEqual(["a1", "b1", "a2", "o1", "a3"]);
    expect(v.counts.get("a")).toEqual({ ranked: 2, total: 3 });
  });
  it("a lab filter narrows the rows but not the counts", () => {
    const v = view(items, { lab: "b", tier: "all" });
    expect(v.rows.map((x) => x.id)).toEqual(["b1", "b2"]);
    expect(v.total.total).toBe(6);
    expect(v.rankedN).toBe(1);
    expect(v.allN).toBe(2);
  });
  it("open weights and a release window filter both rows and counts", () => {
    expect(view(items, { open: true }).rows.map((x) => x.id)).toEqual(["a2"]);
    expect(view(items, { since: 30 }).rows.map((x) => x.id)).toEqual(["a2"]);
    expect(view(items, { since: 183, tier: "all" }).counts.get("b")).toEqual({ ranked: 1, total: 1 });
    expect(view(items, { since: 30 }).total).toEqual({ ranked: 1, total: 1 });
  });
  it("searching looks at every model, older versions included, and the counts follow it", () => {
    const xs = [item("n1", { name: "Nemo One", labId: "a", labName: "A", rank: 1, score: 9 }), item("n2", { name: "Nemo Two", labId: "a", labName: "A", superseded: true, score: 5 }), item("n3", { name: "Nemo Three", labId: "b", labName: "B" }), item("z", { name: "Zed", labId: "b", labName: "B", rank: 2 })];
    const v = view(xs, { q: "nemo" });
    expect(v.searching).toBe(true);
    expect(v.rows.map((x) => x.id)).toEqual(["n1", "n2", "n3"]);
    expect(v.counts.get("a")).toEqual({ ranked: 1, total: 2 });
    expect(v.counts.get("b")).toEqual({ ranked: 0, total: 1 });
    expect(view(xs, { q: "nemo" }, { sort: "name", dir: "desc" }).rows.map((x) => x.id)).toEqual(["n2", "n3", "n1"]);
    expect(view(xs, { q: "nothing" }).rows).toEqual([]);
  });
});

describe("plain words", () => {
  it("writes ages and dates short", () => {
    expect(age("2026-11-16", NOW)).toBe("12d");
    expect(age("2026-08-28", NOW)).toBe("3mo");
    expect(age("2024-10-28", NOW)).toBe("2.1y");
    expect(age(undefined, NOW)).toBe("");
    expect(dateText("2026-11-16", new Date(NOW))).toBe("Nov 16");
    expect(dateText("2025-03-02", new Date(NOW))).toBe("Mar 2, 2025");
    expect(dateText(undefined)).toBe("No release date");
  });
  it("writes a cost per task at the precision it needs", () => {
    expect([usd(23.4), usd(1.5), usd(1), usd(0.123), usd(0.034), usd(0.0042), usd(0)]).toEqual(["$23", "$1.5", "$1", "$0.12", "$0.034", "$0.0042", "free"]);
  });
  it("names the reason a model has no rank, short and in full", () => {
    expect(reasonWord(item("a", { superseded: true }))).toBe("Older version");
    expect(reasonWord(item("a", { why: "estimated" }))).toBe("Estimated");
    expect(reasonWord(item("a", { why: "window", releaseDate: "2025-01-01" }))).toBe("Too old");
    expect(reasonWord(item("a", { why: "window" }))).toBe("No date");
    expect(reasonWord(item("a", { why: "coverage", share: 0.4 }))).toBe("Too few benchmarks");
    expect(reasonText(item("a", { why: "coverage", share: 0.4 }))).toBe("Not ranked: 40% of the index is measured");
    expect(reasonText(item("a", { why: "thin", benchmarks: 1 }))).toBe("Not ranked: measured on 1 benchmark");
    expect(reasonText(item("a", { superseded: true }))).toMatch(/Older version/);
  });
  it("leaves the parameter count out when the name already says it", () => {
    expect(paramsHint(item("a", { name: "Gemma 4 12B", paramsB: 12 }))).toBe("");
    expect(paramsHint(item("a", { name: "Kimi K3.1", paramsB: 2800 }))).toBe("2.8T");
    expect(paramsHint(item("a"))).toBe("");
  });
  it("lists efforts highest first and marks only the ones below the best", () => {
    const e = [{ effort: "low", score: 50 }, { effort: "max", score: 60 }, { effort: "high", score: 58 }];
    expect(effortsText(e)).toBe("max 60.0, high 58.0, low 50.0");
    expect(lowerEfforts(e, 60).map((x) => x.effort)).toEqual(["low", "high"]);
    expect(lowerEfforts(undefined, 60)).toEqual([]);
  });
});
