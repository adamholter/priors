import { describe, expect, it } from "vitest";
import { defaultConfig } from "@/engine";
import { loadSnapshot } from "@/data/load";
import { describeRanking, pct, unrankedLine } from "./model-rank-text";
import { ownRanking, sizeOf, standingIn, summarize, whyUnranked } from "./model-ranks";
import { defaultPreset, modelView, presetConfig } from "./model-view";

const mix = (weights: Record<string, number>, extra: object = {}) => ({ ...defaultConfig(undefined as never), weights, ...extra });

describe("why a ranking leaves a model out", () => {
  const w = { a: 1, b: 1, c: 2 };
  it("counts the share of the mix's weight the model has results on", () => {
    const u = whyUnranked(mix(w, { strictness: 50 }), ["a", "c"], undefined, "2026-11-01");
    expect(u).toMatchObject({ reason: "coverage", floor: 0.5 });
    expect(u.share).toBeCloseTo(0.75);
    expect(whyUnranked(mix(w), ["x"], undefined, "2026-11-01").share).toBe(0);
  });
  it("blames the release date only when the floor is met", () => {
    const m = mix(w, { strictness: 50, releasedAfter: "2026-05-01" });
    expect(whyUnranked(m, ["a", "c"], "2023-05-10", "2026-11-01")).toMatchObject({ reason: "release", cutoff: "2026-05-01" });
    expect(whyUnranked(m, ["a"], "2023-05-10", "2026-11-01").reason).toBe("coverage");
    expect(whyUnranked(m, ["a", "c"], "2026-06-01", "2026-11-01").reason).toBe("coverage");
  });
  it("starts the default ranking six months before the snapshot, and no cutoff where the mix has none", () => {
    expect(whyUnranked(mix(w), ["a"], "2020-01-01", "2026-11-01").cutoff).toBe("2026-05-01");
    expect(whyUnranked(mix(w, { releasedAfter: "" }), ["a", "c", "b"], "2020-01-01", "2026-11-01").reason).toBe("coverage");
  });
  it("says it in a line", () => {
    expect(unrankedLine({ reason: "release", share: 1, floor: 0.5, cutoff: "2026-05-01" })).toBe("Released before 2026-05-01");
    expect(unrankedLine({ reason: "coverage", share: 0.45, floor: 0.5, cutoff: "" })).toBe("45% of the mix measured, 50% needed");
    expect(unrankedLine({ reason: "coverage", share: 0, floor: 0.5, cutoff: "" })).toBe("Needs 50% of the mix measured");
    expect(pct(0.3449)).toBe("34%");
  });
});

describe("the picker's rows", () => {
  it("describes a ranking by its size and what it requires", () => {
    const place = { rank: 1, of: 2, loose: false };
    expect(describeRanking({ benchmarks: 10, allRequired: false, standing: place }, false)).toBe("10 benchmarks");
    expect(describeRanking({ benchmarks: 10, allRequired: true, standing: null }, false)).toBe("10 benchmarks, all required");
    expect(describeRanking({ benchmarks: 8, allRequired: false, standing: place }, true)).toBe("8 benchmarks, equal weights");
    expect(describeRanking(undefined, false)).toBe("");
    expect(describeRanking({ benchmarks: 0, allRequired: false, standing: null }, false)).toBe("");
  });
});

describe("where a model stands, on the committed snapshot", async () => {
  const snap = (await loadSnapshot())!;
  const config = defaultConfig(snap);
  const first = modelView(snap, snap.models[0].id, config, config);
  const ids = snap.models.map((m) => m.id);
  const placed = (id: string) => standingIn(snap, presetConfig(snap, defaultPreset(snap, id)), id);
  const unplaced = ids.filter((id) => !placed(id));

  it("agrees with the model page's own view", () => {
    for (const id of ids.slice(0, 40)) {
      const key = defaultPreset(snap, id), view = modelView(snap, id, presetConfig(snap, key), config), st = standingIn(snap, presetConfig(snap, key), id);
      expect(st ? { rank: st.rank, of: st.of, loose: st.loose } : null).toEqual(view.mine.length ? { rank: view.place + 1, of: view.models, loose: view.loose } : null);
    }
    expect(first.models).toBeGreaterThan(0);
  });
  it("sizes a ranking and sums it up", () => {
    const g = presetConfig(snap, "preset:general");
    expect(sizeOf(g)).toEqual({ benchmarks: Object.values(g.weights).filter((x) => x > 0).length, allRequired: false });
    expect(summarize(snap, g, ids[0]).benchmarks).toBe(sizeOf(g).benchmarks);
  });
  it("finds models no standard ranking places, and says why in the view", () => {
    expect(unplaced.length).toBeGreaterThan(0);
    const id = unplaced[0], view = modelView(snap, id, presetConfig(snap, "preset:general"), config);
    expect(view.mine).toEqual([]);
    expect(view.unranked).toBeDefined();
    expect(modelView(snap, ids.find((x) => placed(x))!, config, config).unranked).toBeUndefined();
  });
  it("marks a score on an open-ended scale", () => {
    expect(modelView(snap, ids[0], config, config).outOf100).toBe(true);
    expect(modelView(snap, ids[0], { ...config, scoring: "eci" }, config).outOf100).toBe(false);
  });

  describe("the ranking made from a model's own benchmarks", () => {
    const withOwn = unplaced.filter((id) => ownRanking(snap, id));
    it("is eight or fewer current benchmarks at equal weight, the most shared first", () => {
      expect(withOwn.length).toBeGreaterThan(0);
      const own = ownRanking(snap, withOwn[0])!;
      expect(own.benchmarks.length).toBeGreaterThanOrEqual(3);
      expect(own.benchmarks.length).toBeLessThanOrEqual(8);
      expect(own.benchmarks.map((b) => b.models)).toEqual([...own.benchmarks.map((b) => b.models)].sort((a, b) => b - a));
      expect(Object.keys(own.config.weights).sort()).toEqual(own.benchmarks.map((b) => b.id).sort());
      expect(Object.values(own.config.weights).every((x) => x === 1)).toBe(true);
      expect(own.config).toMatchObject({ releasedAfter: "", strictness: 50, variants: "all" });
      expect(ownRanking(snap, withOwn[0])).toBe(own);
    });
    it("never lists two benchmarks under one name", () => {
      for (const id of withOwn) { const names = ownRanking(snap, id)!.benchmarks.map((b) => b.name.toLowerCase()); expect(new Set(names).size).toBe(names.length); }
    });
    it("places a model the standard rankings do not", () => {
      for (const id of withOwn.slice(0, 5)) {
        const st = standingIn(snap, ownRanking(snap, id)!.config, id);
        expect(st).not.toBeNull();
        expect(st!.rank).toBeGreaterThan(0);
        expect(st!.rank).toBeLessThanOrEqual(st!.of);
      }
    });
    it("is none for a model with fewer than three such benchmarks", () => {
      const none = unplaced.find((id) => !ownRanking(snap, id));
      expect(none).toBeDefined();
      expect(ownRanking(snap, none!)).toBeNull();
    });
  });
});
