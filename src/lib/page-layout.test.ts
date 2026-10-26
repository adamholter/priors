import { describe, expect, it } from "vitest";
import type { Section } from "../../convex/validators";
import { findTab, pageLayout, removeIndex, saveToPage, sectionTab, tabKey, tabSections, tabSlug } from "./page-layout";

type Idx = { id: string; name: string; weights: Record<string, number> };
const A: Idx = { id: "i0", name: "Capabilities", weights: { a: 1 } }, B: Idx = { id: "i1", name: "3D", weights: { b: 1 } };
const sec = (id: string, kind: Section["kind"], indexId?: string, more: Partial<Section> = {}): Section => ({ id, kind, indexId, ...more });
const ids = (list: Section[]) => list.map((s) => s.id);

describe("saveToPage", () => {
  it("adds a new index as a new tab and keeps what the page had", () => {
    const built: Idx[] = [{ id: "i0", name: "3D", weights: { b: 1 } }, { id: "i1", name: "Capabilities", weights: { a: 2 } }];
    const r = saveToPage([A], built, { newId: () => "new" });
    expect(r.indices).toEqual([{ id: "i0", name: "Capabilities", weights: { a: 2 } }, { id: "new", name: "3D", weights: { b: 1 } }]);
    expect(r.added).toEqual(["3D"]);
  });
  it("updates the index of the same name in place, whatever id the builder gave it", () => {
    const r = saveToPage([A, B], [{ id: "i0", name: " 3d ", weights: { b: 9 } }]);
    expect(r.indices).toEqual([A, { id: "i1", name: " 3d ", weights: { b: 9 } }]);
    expect(r.added).toEqual([]);
  });
  it("never reuses an id on the page, and matches each page index once", () => {
    const made = ["i0", "i1", "fresh"];
    const r = saveToPage([A], [{ ...A, id: "x" }, { ...A, id: "y" }], { newId: () => made.shift()! });
    expect(r.indices.map((i) => i.id)).toEqual(["i0", "i1"]);
    expect(new Set(saveToPage([A, B], [{ id: "i0", name: "New", weights: {} }]).indices.map((i) => i.id)).size).toBe(3);
  });
  it("updates the index it was opened from, even after a rename", () => {
    const r = saveToPage([A, B], [{ id: "i0", name: "3D v2", weights: { b: 5 } }, { id: "i1", name: "Capabilities", weights: { a: 3 } }], { from: ["i1", "i0"] });
    expect(r.indices).toEqual([{ id: "i0", name: "Capabilities", weights: { a: 3 } }, { id: "i1", name: "3D v2", weights: { b: 5 } }]);
    expect(r.added).toEqual([]);
  });
  it("lets the source id win over a name another index now carries", () => {
    // B was renamed to A's name in the builder, and A to something new: each still lands on its own tab.
    const r = saveToPage([A, B], [{ id: "i0", name: "Capabilities", weights: { b: 7 } }, { id: "i1", name: "Old capabilities", weights: { a: 7 } }], { from: ["i1", "i0"] });
    expect(r.indices.map((i) => [i.id, i.name])).toEqual([["i0", "Old capabilities"], ["i1", "Capabilities"]]);
  });
  it("falls back to the name when the index it came from has left the page", () => {
    const r = saveToPage([A, B], [{ id: "i0", name: "3D", weights: { b: 4 } }], { from: ["gone"] });
    expect(r.indices).toEqual([A, { id: "i1", name: "3D", weights: { b: 4 } }]);
  });
  it("adds a duplicate made in the builder as a new tab", () => {
    const r = saveToPage([A], [{ id: "i0", name: "Capabilities", weights: { a: 2 } }, { id: "i1", name: "Copy", weights: {} }], { from: ["i0", "i0"], newId: () => "new" });
    expect(r.indices.map((i) => [i.id, i.name])).toEqual([["i0", "Capabilities"], ["new", "Copy"]]);
    expect(r.added).toEqual(["Copy"]);
  });
});

describe("tab links", () => {
  const C = { id: "i-9f2c", name: "Adam’s Capabilities Index" }, D = { id: "i0", name: "3D Understanding Index" };
  it("names a tab by its slug", () => {
    expect(tabSlug("Adam's Capabilities Index")).toBe("adams-capabilities-index");
    expect(tabKey([D, C], C)).toBe("adams-capabilities-index");
    expect(findTab([D, C], "adams-capabilities-index")).toBe(C);
  });
  it("still opens links that carry an id, and ids win over slugs", () => {
    expect(findTab([D, C], "i-9f2c")).toBe(C);
    expect(findTab([{ id: "a", name: "i0" }, D], "i0")).toBe(D);
    expect(findTab([D, C], "nope")).toBeUndefined();
    expect(findTab([D, C], undefined)).toBeUndefined();
  });
  it("uses the id when a slug is empty or shared", () => {
    const twin = { id: "i7", name: "3d understanding index!" };
    expect(tabKey([D, twin], twin)).toBe("i7");
    expect(tabKey([D, { id: "i8", name: "???" }], { id: "i8", name: "???" })).toBe("i8");
    const blank = { id: "i9", name: "" };
    expect(tabKey([D, blank], blank)).toBe("i9");
  });
});

describe("page layout", () => {
  it("leaves a one-index page as it was, with its automatic More metrics section", () => {
    const sections = [sec("rank", "rankings", "i0"), sec("note", "text")];
    expect(ids(pageLayout([A], sections))).toEqual(["rank", "note", "gallery-auto"]);
    expect(ids(tabSections(pageLayout([A], sections), [A], "i0"))).toEqual(["rank", "note", "gallery-auto"]);
  });
  it("gives an index with no sections the first tab's layout, without its custom titles", () => {
    const layout = pageLayout([B, A], [sec("rank-i1", "rankings", "i1", { title: "Mine" }), sec("pareto-i1", "pareto", "i1", { hidden: true })]);
    expect(tabSections(layout, [B, A], "i0")).toEqual([
      { id: "rank-i1~i0", kind: "rankings", indexId: "i0", title: undefined },
      { id: "pareto-i1~i0", kind: "pareto", indexId: "i0", hidden: true, title: undefined },
      { id: "gallery-auto-i0", kind: "gallery", indexId: "i0" },
    ]);
    expect(ids(tabSections(layout, [B, A], "i1"))).toEqual(["rank-i1", "pareto-i1", "gallery-auto"]);
  });
  it("shows text on every tab unless it names an index, and sends unbound charts to the first tab", () => {
    const list = [A, B];
    const layout = pageLayout(list, [sec("intro", "text"), sec("rank", "rankings"), sec("b-note", "text", "i1"), sec("b-rank", "rankings", "i1"), sec("gone", "pareto", "deleted")]);
    expect(ids(tabSections(layout, list, "i0"))).toEqual(["intro", "rank", "gone", "gallery-auto"]);
    expect(ids(tabSections(layout, list, "i1"))).toEqual(["intro", "b-note", "b-rank", "gallery-auto-i1"]);
    expect(sectionTab(sec("x", "links"), list)).toBeUndefined();
  });
  it("gives a page with no chart sections at all a leaderboard, a cost chart and More metrics per index", () => {
    expect(ids(pageLayout([A, B], [sec("note", "text")]))).toEqual(["note", "rank-i0", "pareto-i0", "gallery-auto", "rank-i1", "pareto-i1", "gallery-auto-i1"]);
  });
  it("does not add More metrics where one is saved, even hidden", () => {
    expect(ids(pageLayout([A], [sec("g", "gallery", undefined, { hidden: true })]))).toEqual(["g"]);
  });
  it("removes an index with its sections", () => {
    const r = removeIndex([A, B], [sec("a", "rankings", "i0"), sec("b", "rankings", "i1"), sec("t", "text")], "i1");
    expect(r.indices).toEqual([A]);
    expect(ids(r.sections)).toEqual(["a", "t"]);
  });
});
