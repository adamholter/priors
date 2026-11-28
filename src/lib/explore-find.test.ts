import { describe, expect, it } from "vitest";
import type { ExploreCardData, ExploreKind } from "./explore-cards";
import { arrange, EXPLORE_SORTS, find, fold, hiddenMatches, isExploreSort, mixSegments, pct, plural, prepare } from "./explore-find";

const lead = (name: string) => ({ id: name.toLowerCase(), name, effort: "high", score: 80, lab: "x", labName: "X", base: "#000000" });
let n = 0;
const card = (o: Partial<ExploreCardData> & { handle: string }): ExploreCardData => ({
  name: o.handle, updatedAt: 1000 + n++, createdAt: 1000, when: "today", index: "My priors", others: [], more: 0, kind: "custom" as ExploreKind,
  podium: [lead("GPT-6.2 Astra")], mix: [{ name: "Terminal-Bench", share: 60 }, { name: "FrontierCode", share: 40 }], dist: 10,
  pageHref: `/${o.handle}`, remixHref: "/builder", compareHref: "/compare", ...o,
});
const handles = (list: { item: { card: ExploreCardData } }[]) => list.map((x) => x.item.card.handle);

describe("explore search", () => {
  const cards = [
    card({ handle: "ada", name: "Ada Ekström", index: "Coding agents" }),
    card({ handle: "bo", name: "Bo", index: "Daily driver", others: ["Writing"], more: 1, podium: [lead("Fable 5.2")] }),
    card({ handle: "cy", name: "Cy", index: "Science", mix: [{ name: "Humanity's Last Exam", share: 100 }] }),
  ];
  const items = prepare(cards);
  it("folds accents and case", () => {
    expect(fold("Ekström")).toBe("ekstrom");
    expect(handles(find(items, "EKSTROM"))).toEqual(["ada"]);
  });
  it("needs every word to match somewhere", () => {
    expect(handles(find(items, "ada coding"))).toEqual(["ada"]);
    expect(find(items, "ada writing")).toEqual([]);
  });
  it("matches the page's other tabs, the top three and the mix", () => {
    expect(handles(find(items, "writing"))).toEqual(["bo"]);
    expect(handles(find(items, "fable"))).toEqual(["bo"]);
    expect(handles(find(items, "last exam"))).toEqual(["cy"]);
  });
  it("names the benchmark that matched only through the mix", () => {
    expect(find(items, "last exam")[0].via?.name).toBe("Humanity's Last Exam");
    expect(find(items, "coding")[0].via).toBeUndefined();
  });
  it("returns everything for an empty search", () => {
    expect(find(items, "  ")).toHaveLength(3);
  });
  it("ranks identity above index name above model above benchmark", () => {
    const set = prepare([
      card({ handle: "m", name: "M", index: "Plain", podium: [lead("Astra")], mix: [{ name: "Astra Bench", share: 100 }] }),
      card({ handle: "b", name: "B", index: "Plain", podium: [lead("Other")], mix: [{ name: "Astra Bench", share: 100 }] }),
      card({ handle: "i", name: "B", index: "Astra picks", podium: [lead("Other")], mix: [] }),
      card({ handle: "astra", name: "Z", index: "Plain", podium: [lead("Other")], mix: [] }),
    ]);
    expect(handles(arrange(set, { q: "astra", sort: "updated", custom: false }))).toEqual(["astra", "i", "m", "b"]);
  });
});

describe("explore order", () => {
  const cards = [
    card({ handle: "old", name: "Zed", updatedAt: 100, createdAt: 900, dist: 5, mix: [{ name: "A", share: 100 }] }),
    card({ handle: "mid", name: "émile", updatedAt: 200, createdAt: 100, dist: 40, mix: [{ name: "A", share: 50 }, { name: "B", share: 50 }, { name: "C", share: 1 }] }),
    card({ handle: "new", name: "Abe", updatedAt: 300, createdAt: 500, dist: 20, mix: [{ name: "A", share: 50 }, { name: "B", share: 50 }] }),
    card({ handle: "copy", name: "Copy", updatedAt: 400, kind: "default", dist: 0, mix: [{ name: "AA", share: 100 }] }),
    card({ handle: "dead", name: "Dead", updatedAt: 500, kind: "dead", podium: [], mix: [], dist: 0 }),
  ];
  const items = prepare(cards);
  const order = (sort: Parameters<typeof arrange>[1]["sort"], custom = false, q = "") => handles(arrange(items, { q, sort, custom }));
  it("recently updated is newest edit first", () => expect(order("updated")).toEqual(["copy", "new", "mid", "old", "dead"]));
  it("newest is newest page first", () => expect(order("newest", true)).toEqual(["old", "new", "mid"]));
  it("most benchmarks, then recency", () => expect(order("benchmarks", true)).toEqual(["mid", "new", "old"]));
  it("furthest from default", () => expect(order("dist", true)).toEqual(["mid", "new", "old"]));
  it("name A to Z ignores accents and case", () => expect(order("name", true)).toEqual(["new", "mid", "old"]));
  it("custom only hides default copies and dead pages", () => expect(order("updated", true)).toEqual(["new", "mid", "old"]));
  it("puts pages that rank nothing last whatever the sort", () => {
    for (const s of EXPLORE_SORTS) expect(order(s.id).at(-1)).toBe("dead");
  });
  it("counts what the custom switch hides for a search", () => {
    expect(hiddenMatches(items, "copy")).toBe(1);
    expect(hiddenMatches(items, "abe")).toBe(0);
  });
  it("breaks ties between equal matches with the chosen sort", () => {
    expect(order("updated", true, "a")).toEqual(["new", "mid", "old"]);
  });
  it("validates the sort in the address", () => {
    expect(isExploreSort("dist")).toBe(true);
    expect(isExploreSort("bogus")).toBe(false);
    expect(isExploreSort(undefined)).toBe(false);
  });
});

describe("weight bar", () => {
  const parts = (...shares: number[]) => shares.map((share, i) => ({ name: `B${i}`, share }));
  it("draws up to five benchmarks, fading by rank", () => {
    const segs = mixSegments(parts(40, 30, 20, 10));
    expect(segs.map((s) => s.label)).toEqual(["B0 40%", "B1 30%", "B2 20%", "B3 10%"]);
    expect(segs[0].tone).toBe(1);
    expect(segs.every((s, i) => i === 0 || s.tone < segs[i - 1].tone)).toBe(true);
    expect(segs.at(-1)!.tone).toBeCloseTo(0.22);
  });
  it("folds the rest into one grey piece", () => {
    const segs = mixSegments(parts(30, 20, 15, 10, 10, 8, 7));
    expect(segs).toHaveLength(6);
    expect(segs.at(-1)).toMatchObject({ label: "2 more 15%", share: 15, tone: -1 });
  });
  it("a single benchmark is one full-tone piece", () => {
    expect(mixSegments(parts(100))).toEqual([{ label: "B0 100%", share: 100, tone: 1 }]);
  });
  it("formats", () => {
    expect(pct(0.4)).toBe("<1%");
    expect(pct(12.6)).toBe("13%");
    expect(plural(1, "page")).toBe("1 page");
    expect(plural(1234, "page")).toBe("1,234 pages");
    expect(plural(2, "match", "matches")).toBe("2 matches");
  });
});
