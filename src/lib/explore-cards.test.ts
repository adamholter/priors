import { describe, expect, it } from "vitest";
import { loadSnapshot } from "@/data/load";
import { aaComponentWeights, latestAAIndex } from "@/data/aa-index";
import type { IndexConfig } from "@/engine";
import { AA_INDEX_SETTINGS } from "@/onboarding/defaults";
import { ago, bucketOf, buildCards, featuredCards, isDefaultMix, plain, profileDistance, xHandle, type PublishedPage } from "./explore-cards";

const NOW = Date.UTC(2026, 10, 28, 12);
const H = 3_600_000;
const index = (name: string, weights: Record<string, number>, over: Partial<IndexConfig> = {}): IndexConfig => ({ ...AA_INDEX_SETTINGS, id: "page", name, weights, strictness: 60, ...over });
const page = (handle: string, i: IndexConfig, over: Partial<PublishedPage> = {}): PublishedPage => ({ handle, displayName: handle, updatedAt: NOW - H, indices: [i], others: [], more: 0, ...over });

describe("small helpers", () => {
  it("says when", () => {
    expect(ago(NOW - H, NOW)).toBe("today");
    expect(ago(NOW - 30 * H, NOW)).toBe("yesterday");
    expect(ago(NOW - 5 * 86_400_000, NOW)).toBe("5 days ago");
    expect(ago(Date.UTC(2026, 8, 1), NOW)).toBe("2026-09-01");
  });
  it("reads an X handle from x.com or twitter.com links only", () => {
    expect(xHandle([{ url: "https://github.com/ada" }, { url: "https://x.com/ada_ml" }])).toBe("ada_ml");
    expect(xHandle([{ url: "https://www.twitter.com/@ada?ref=1" }])).toBe("ada");
    expect(xHandle([{ url: "https://x.com/way_too_long_handle_here" }])).toBeUndefined();
    expect(xHandle(undefined)).toBeUndefined();
  });
  it("draws benchmark names with hyphens, never dashes", () => {
    expect(plain("FM Tiers 1–3")).toBe("FM Tiers 1-3");
    expect(plain("Context Arena — MRCR")).toBe("Context Arena - MRCR");
  });
  it("buckets categories and measures the distance between two shapes", () => {
    expect(bucketOf("coding")).toBe(0);
    expect(bucketOf("math")).toBe(bucketOf("science"));
    expect(bucketOf("anything else")).toBe(5);
    expect(profileDistance([100, 0, 0, 0, 0, 0], [100, 0, 0, 0, 0, 0])).toBe(0);
    expect(profileDistance([100, 0, 0, 0, 0, 0], [0, 100, 0, 0, 0, 0])).toBe(100);
    expect(profileDistance([50, 50, 0, 0, 0, 0], [100, 0, 0, 0, 0, 0])).toBe(50);
  });
});

describe("pages on today's snapshot", async () => {
  const snapshot = (await loadSnapshot())!;
  const latest = latestAAIndex(snapshot)!, parts = aaComponentWeights(snapshot)!;
  const coding = { "aa-frontiercode-2-0": 40, "vals-programbench-v1": 30, bughunt: 30 };
  const pages = [
    page("copy", index("@AA", { [latest.id]: 100 })),
    page("parts", index("My priors", parts)),
    page("coder", index("Coding agents", coding), { others: ["Writing", "Docs"], more: 4, createdAt: NOW - 90 * H, socials: [{ label: "X", url: "https://x.com/coder_x" }] }),
    page("coder2", index("Coding again", coding)),
    page("nothing", index("Old mix", { "bg-arena-hard-auto": 50, "bg-bbh": 50 })),
    { ...page("notab", index("x", {})), indices: [] },
  ];
  const cards = buildCards(snapshot, pages, NOW), by = (h: string) => cards.find((c) => c.handle === h)!;

  it("has the AA index to compare with", () => { expect(latest).toBeDefined(); expect(parts).toBeDefined(); });
  it("drops a page with no index and keeps the rest in order", () => {
    expect(cards.map((c) => c.handle)).toEqual(["copy", "parts", "coder", "coder2", "nothing"]);
  });
  it("calls AA's composite and AA's evaluations at AA's weights default copies", () => {
    expect(by("copy").kind).toBe("default");
    expect(by("parts").kind).toBe("default");
    expect(isDefaultMix(snapshot, index("x", { [latest.id]: 100 }))).toBe(true);
    expect(isDefaultMix(snapshot, index("x", Object.fromEntries(Object.entries(parts).map(([id, w]) => [id, w * 2]))))).toBe(true);
    expect(isDefaultMix(snapshot, index("x", { ...parts, "arena-text": 20 }))).toBe(false);
    expect(isDefaultMix(snapshot, index("x", coding))).toBe(false);
  });
  it("shows three distinct models, each at one effort, best first", () => {
    for (const c of cards.filter((x) => x.kind !== "dead")) {
      expect(c.podium).toHaveLength(3);
      expect(new Set(c.podium.map((m) => m.id)).size).toBe(3);
      expect(c.podium.every((m, i) => i === 0 || m.score <= c.podium[i - 1].score)).toBe(true);
      expect(c.podium.every((m) => m.effort && m.labName && m.base)).toBe(true);
    }
  });
  it("lists the whole mix, heaviest first, summing to 100", () => {
    const m = by("coder").mix;
    expect(m).toHaveLength(3);
    expect(m.every((p, i) => i === 0 || p.share <= m[i - 1].share)).toBe(true);
    expect(m.reduce((t, p) => t + p.share, 0)).toBeCloseTo(100, 5);
    expect(by("copy").mix).toHaveLength(1);
  });
  it("marks a page that ranks nothing dead, with nothing to draw", () => {
    expect(by("nothing")).toMatchObject({ kind: "dead", podium: [], mix: [], dist: 0 });
  });
  it("measures distance from the default: none for copies, plenty for a coding mix", () => {
    expect(by("copy").dist).toBe(0);
    expect(by("parts").dist).toBeLessThan(5);
    expect(by("coder").dist).toBeGreaterThan(30);
  });
  it("carries the page's own facts", () => {
    expect(by("coder")).toMatchObject({ index: "Coding agents", others: ["Writing", "Docs"], more: 4, x: "coder_x", when: "today", pageHref: "/coder", compareHref: "/compare?a=me&b=@coder", createdAt: NOW - 90 * H, updatedAt: NOW - H });
    expect(by("coder").remixHref).toContain("From+%2540coder");
  });
  it("falls back to the last edit when the query sends no creation time", () => {
    expect(by("copy").createdAt).toBe(NOW - H);
  });
  it("ranks pages that share an index once", () => {
    expect(by("coder2").podium).toBe(by("coder").podium);
    expect(by("coder2").mix).toBe(by("coder").mix);
  });
  it("a different setting on the same weights is its own ranking", () => {
    const [a, b] = buildCards(snapshot, [page("a", index("a", coding, { strictness: 100 })), page("b", index("b", coding, { strictness: 10, releasedAfter: "" }))], NOW);
    expect(a.podium).not.toBe(b.podium);
  });
  it("without a snapshot every page reads as nothing ranked, and nothing throws", () => {
    const none = buildCards(null, pages, NOW);
    expect(none).toHaveLength(5);
    expect(none.every((c) => c.kind === "dead" && !c.podium.length && c.dist === 0)).toBe(true);
  });
});

describe("featured starting points", async () => {
  const snapshot = (await loadSnapshot())!;
  const f = featuredCards(snapshot);
  it("lists the Intelligence Index first, each with three models and its mix", () => {
    expect(f.length).toBeGreaterThanOrEqual(2);
    expect(f[0].name).toBe("Intelligence Index");
    for (const c of f) {
      expect(c.podium).toHaveLength(3);
      expect(new Set(c.podium.map((m) => m.id)).size).toBe(3);
      expect(c.mix.length).toBeGreaterThan(1);
      expect(c.href.startsWith("/builder?")).toBe(true);
    }
  });
  it("names the models without an effort", () => {
    expect(f.every((c) => c.podium.every((m) => m.effort === "default"))).toBe(true);
  });
  it("is empty without a snapshot", () => { expect(featuredCards(null)).toEqual([]); });
});
