import { describe, expect, it } from "vitest";
import type { CompareOption } from "@/lib/model-view";
import { bestOf, fmtCost, fmtMonth, labsOf, otherNames, searchOptions, secs, sortOptions, windowStart } from "./compare-chooser";

const o = (id: string, rest: Partial<CompareOption> = {}): CompareOption => ({ id, name: id, labId: "lab", labName: "Lab", ...rest });

describe("formatting", () => {
  it("writes time per task in seconds or minutes", () => {
    expect(secs(8.4)).toBe("8.4s");
    expect(secs(42)).toBe("42s");
    expect(secs(372)).toBe("6.2 min");
    expect(secs(624.6)).toBe("10 min");
  });
  it("calls a zero cost free and keeps a month", () => {
    expect(fmtCost(0)).toBe("free");
    expect(fmtMonth("2026-11-09")).toBe("2026-11");
    expect(fmtMonth(undefined)).toBe("");
  });
});

describe("ordering", () => {
  it("sorts a column both ways and leaves missing values last", () => {
    const rows = [o("a", { rank: 1, cost: 0.5 }), o("b", { rank: 2 }), o("c", { rank: 3, cost: 0.1 })];
    expect(sortOptions(rows, "cost", "asc").map((x) => x.id)).toEqual(["c", "a", "b"]);
    expect(sortOptions(rows, "cost", "desc").map((x) => x.id)).toEqual(["a", "c", "b"]);
    expect(sortOptions(rows, "name", "desc").map((x) => x.id)).toEqual(["c", "b", "a"]);
    expect(rows.map((x) => x.id)).toEqual(["a", "b", "c"]);
  });
  it("keeps a window of rows inside the list", () => {
    expect(windowStart(0, 84, 11)).toBe(0);
    expect(windowStart(40, 84, 11)).toBe(35);
    expect(windowStart(84, 84, 11)).toBe(73);
    expect(windowStart(3, 5, 11)).toBe(0);
  });
});

describe("the best number of each column", () => {
  const anchor = o("me", { score: 60, cost: 1, tpt: 600 });
  it("marks one model per column and only for a clear win", () => {
    const list = [o("a", { score: 61, cost: 0.9, tpt: 590 }), o("b", { score: 63, cost: 0.5, tpt: 300 }), o("c", { score: 64, cost: 0.3, tpt: 200 }), o("d", { score: 70, cost: 2, tpt: 900 })];
    expect(bestOf(list, anchor)).toEqual({ score: "d", cost: "c", tpt: "c" });
  });
  it("marks nothing for near ties, missing numbers or no model to keep", () => {
    expect(bestOf([o("a", { score: 61, cost: 0.9, tpt: 590 }), o("b", {})], anchor)).toEqual({});
    expect(bestOf([o("a", { score: 99 })], undefined)).toEqual({});
    expect(bestOf([o("a", { score: 99, cost: 0, tpt: 1 })], o("me", { score: 60 }))).toEqual({ score: "a" });
  });
  it("does not call free a win over free", () => {
    expect(bestOf([o("a", { cost: 0 })], o("me", { cost: 0 }))).toEqual({});
  });
});

describe("search", () => {
  const list = [o("gpt-6.2-astra", { name: "GPT-6.2 Astra", labName: "OpenAI", rank: 2 }), o("gpt-6.2-sol", { name: "GPT-6.2 Sol", labName: "OpenAI", rank: 6 }), o("gem", { name: "Gemini 4 Neon", labName: "Google", rank: 3 }), o("mix", { name: "Mixtral 8x22B Instruct", labName: "Mistral", aka: ["mixtral"] })];
  it("needs every typed word to start a word of the name or lab", () => {
    expect(searchOptions(list, "gem neon").map((x) => x.id)).toEqual(["gem"]);
    expect(searchOptions(list, "openai").map((x) => x.id)).toEqual(["gpt-6.2-astra", "gpt-6.2-sol"]);
    expect(searchOptions(list, "zzzq")).toEqual([]);
  });
  it("finds a name typed without its punctuation", () => {
    expect(searchOptions(list, "gpt62").map((x) => x.id)).toEqual(["gpt-6.2-astra", "gpt-6.2-sol"]);
    expect(searchOptions(list, "gpt62 sol").map((x) => x.id)).toEqual(["gpt-6.2-sol"]);
  });
  it("finds another name a model goes by and keeps the order given", () => {
    expect(searchOptions(list, "mixtral").map((x) => x.id)).toEqual(["mix"]);
    expect(searchOptions(list, "g").map((x) => x.id)).toEqual(["gpt-6.2-astra", "gpt-6.2-sol", "gem"]);
  });
  it("returns nothing for a blank query", () => {
    expect(searchOptions(list, "  ")).toEqual([]);
  });
});

describe("labs and other names", () => {
  it("lists labs with a ranked model, best first, with their counts", () => {
    const list = [o("a", { labId: "x", labName: "X", rank: 3 }), o("b", { labId: "y", labName: "Y", rank: 1 }), o("c", { labId: "x", labName: "X", rank: 2 }), o("d", { labId: "z", labName: "Z" })];
    expect(labsOf(list)).toEqual([{ id: "y", name: "Y", best: 1, n: 1 }, { id: "x", name: "X", best: 2, n: 2 }]);
  });
  it("keeps only names search could not find from the model's own name", () => {
    expect(otherNames("Gemini 4 Neon", ["gemini 4 neon", "google: gemini 4 neon", "gemini 4 neon (xhigh)", "gemini 4 neon xhigh", "openai gemini 4 neon", "gemini neon"])).toEqual(["gemini neon"]);
    expect(otherNames("Mixtral 8x22B Instruct", ["mixtral", "mixtral 8x22b", "mistralai mixtral 8x22b instruct v0.1"])).toEqual([]);
    expect(otherNames("Joy", ["joyvl2 v27"])).toEqual(["joyvl2 v27"]);
    expect(otherNames("A", ["zz", "yy", "xx", "ww"], 2)).toEqual(["zz", "yy"]);
  });
});
