import { describe, expect, it } from "vitest";
import type { Section } from "../../convex/validators";
import { pageLayout, removeIndex, saveToPage, sectionTab, tabSections } from "./page-layout";

type Idx = { id: string; name: string; weights: Record<string, number> };
const A: Idx = { id: "i0", name: "Capabilities", weights: { a: 1 } }, B: Idx = { id: "i1", name: "3D", weights: { b: 1 } };
const sec = (id: string, kind: Section["kind"], indexId?: string, more: Partial<Section> = {}): Section => ({ id, kind, indexId, ...more });
const ids = (list: Section[]) => list.map((s) => s.id);

describe("saveToPage", () => {
  it("adds a new index as a new tab and keeps what the page had", () => {
    const built: Idx[] = [{ id: "i0", name: "3D", weights: { b: 1 } }, { id: "i1", name: "Capabilities", weights: { a: 2 } }];
    const r = saveToPage([A], built, () => "new");
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
    const r = saveToPage([A], [{ ...A, id: "x" }, { ...A, id: "y" }], () => made.shift()!);
    expect(r.indices.map((i) => i.id)).toEqual(["i0", "i1"]);
    expect(new Set(saveToPage([A, B], [{ id: "i0", name: "New", weights: {} }]).indices.map((i) => i.id)).size).toBe(3);
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
