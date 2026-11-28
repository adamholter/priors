import { describe, expect, it } from "vitest";
import type { RankedVariant } from "../../engine";
import type { HighlightModel } from "./highlight";
import type { ScatterPoint } from "./scatter-option";
import { STAR_CAP, STAR_DENSE, addStars, allStarred, effortsFor, fitNames, hotPick, labGroups, labTitle, matches, nameWidth, pickable, quickPicks, removeStars, rowsThatFit, starDelta, starGuides, starTags, stripDots } from "./star-menu";

const model = (id: string, lab: string, labId = lab.toLowerCase()): HighlightModel => ({ id, name: id.toUpperCase(), lab, labId });
const mark = (id: string, effort: string, x: number, score: number, labId = "a", releaseDate?: string): ScatterPoint => ({
  x, r: { model: { id, name: id, labId, releaseDate }, variant: { id: `${id}@${effort}`, modelId: id, effort }, score } as unknown as RankedVariant,
});

describe("lab rows", () => {
  const models = [model("a1", "Alpha"), model("b1", "Beta"), model("a2", "Alpha"), model("c1", "baidu")];
  it("groups models by lab in the order each lab's best model ranks, keeping each model's rank", () => {
    const groups = labGroups(models);
    expect(groups.map((g) => g.name)).toEqual(["Alpha", "Beta", "Baidu"]);
    expect(groups[0].rows.map((r) => [r.m.id, r.rank])).toEqual([["a1", 1], ["a2", 3]]);
    expect(groups[2].labId).toBe("baidu");
  });
  it("capitalizes lab names the data has in lower case and leaves the rest alone", () => {
    expect(labTitle("baidu")).toBe("Baidu");
    expect(labTitle("xAI")).toBe("xAI");
    expect(labTitle("OpenAI")).toBe("OpenAI");
  });
  it("lists the ranked models plus anything starred beyond them, and everything when no count is known", () => {
    const all = ["m1", "m2", "m3", "m4", "m5"].map((id) => model(id, "L"));
    expect(pickable(all, 3, []).map((m) => m.id)).toEqual(["m1", "m2", "m3"]);
    expect(pickable(all, 3, ["m5@high"]).map((m) => m.id)).toEqual(["m1", "m2", "m3", "m5"]);
    expect(pickable(all, undefined, []).length).toBe(5);
    expect(pickable(all, 9, []).length).toBe(5);
  });
  it("searches model and lab names together", () => {
    expect(matches(model("g4", "Google"), "goo")).toBe(true);
    expect(matches(model("g4", "Google"), "  G4 ")).toBe(true);
    expect(matches(model("g4", "Google"), "zzz")).toBe(false);
    expect(matches(model("g4", "Google"), "  ")).toBe(true);
  });
  it("reads the efforts a model is starred at, skipping the default and a tier suffix", () => {
    expect(effortsFor(["a@high", "b@low", "a@xhigh~fast", "a", "a@default"], "a")).toEqual(["high", "xhigh"]);
  });
});

describe("the dot strip", () => {
  const rows = (ranks: number[]) => ranks.map((rank) => ({ m: model(`m${rank}`, "L"), rank }));
  it("spreads dots over the strip by rank", () => {
    const dots = stripDots(rows([1, 50, 100]), 100, 200);
    expect(dots[0].x).toBe(5);
    expect(dots[1].x).toBeCloseTo(99, 0);
    expect(dots[2].x).toBe(195);
  });
  it("steps dots that would touch into other lanes, so none overlap within a lane", () => {
    const dots = stripDots(rows([1, 2, 3, 4, 5]), 100, 200);
    expect(new Set(dots.slice(0, 3).map((d) => d.y)).size).toBe(3);
    for (const lane of new Set(dots.map((d) => d.y))) {
      const xs = dots.filter((d) => d.y === lane).map((d) => d.x);
      xs.slice(1).forEach((x, i) => expect(x - xs[i]).toBeGreaterThanOrEqual(0));
    }
  });
  it("puts a lone model at the left and handles a list of one", () => {
    expect(stripDots(rows([1]), 1, 200)[0]).toMatchObject({ x: 5, y: 0 });
  });
});

describe("quick picks", () => {
  const models = ["a", "b", "c", "d", "e", "f"].map((id, i) => model(id, i % 2 ? "Beta" : "Alpha", i % 2 ? "beta" : "alpha"));
  const pts = [mark("a", "high", 1, 50, "alpha", "2026-01-01"), mark("b", "high", 2, 70, "beta", "2026-03-01"), mark("c", "high", 3, 60, "alpha", "2026-05-01"), mark("d", "high", 4, 90, "beta", "2026-02-01"), mark("f", "low", 5, 40, "beta")];
  it("offers the top five, the cost frontier and the newest model of each lab", () => {
    const q = quickPicks(models, pts, "lower", labGroups(models));
    expect(q.map((k) => k.id)).toEqual(["top", "frontier", "newest"]);
    expect(q[0].ids).toEqual(["a", "b", "c", "d", "e"]);
    expect(q[1].ids).toEqual(["a@high", "b@high", "d@high"]);
    expect(q[2].ids).toEqual(["c", "b"]);
  });
  it("offers only the top five when the chart has no marks, and skips a newest model that is not listed", () => {
    expect(quickPicks(models, undefined, undefined, labGroups(models)).map((k) => k.id)).toEqual(["top"]);
    const narrow = models.filter((m) => m.id !== "c");
    expect(quickPicks(narrow, pts, "lower", labGroups(narrow)).find((k) => k.id === "newest")?.ids).toEqual(["b"]);
  });
  it("knows when a pick is already starred, by model or by exact effort", () => {
    expect(allStarred(["a", "b@high"], ["a", "b"])).toBe(true);
    expect(allStarred(["a@high"], ["a@high", "b@high"])).toBe(false);
    expect(allStarred(["a"], ["a@high"])).toBe(true);
    expect(allStarred([], [])).toBe(false);
  });
});

describe("starring", () => {
  it("adds new ids once, up to the cap (an exact effort of a starred model is a new star)", () => {
    expect(addStars(["a"], ["a", "b", "b", "c"])).toEqual(["a", "b", "c"]);
    expect(addStars(["a"], ["a@high", "a@high"])).toEqual(["a", "a@high"]);
    const full = Array.from({ length: STAR_CAP - 1 }, (_, i) => `m${i}`);
    expect(addStars(full, ["x", "y"])).toEqual([...full, "x"]);
  });
  it("removes whole models and exact variants", () => {
    expect(removeStars(["a", "b@high", "c@low", "c@high"], ["a", "b@high", "c"])).toEqual([]);
    expect(removeStars(["a@high", "a@low"], ["a@low"])).toEqual(["a@high"]);
  });
  it("thins guides and effort tags past a few stars, and nothing before", () => {
    const few = { items: Array.from({ length: STAR_DENSE }, (_, i) => `m${i}`), guides: true };
    const many = { items: [...few.items, "x"], guides: true };
    expect(starGuides(few)).toBe(few);
    expect(starGuides(many)).toEqual({ ...many, guides: false });
    expect(starGuides(undefined)).toBeUndefined();
    expect(starTags(few)).toBe(few);
    expect(starTags(many).tags).toBe(false);
  });
  it("finds the mark of the starred name under the pointer", () => {
    const pts = [mark("a", "high", 1, 50), mark("a", "low", 2, 30), mark("b", "high", 3, 60)];
    expect(hotPick(pts, "a@low")?.r.variant.id).toBe("a@low");
    expect(hotPick(pts, "a")?.r.variant.id).toBe("a@high");
    expect(hotPick(pts, "zzz")).toBeNull();
    expect(hotPick(pts, null)).toBeNull();
  });
});

describe("the names line", () => {
  const w = nameWidth(80);
  it("shows every name up to the cap when the line is not measured yet", () => {
    expect(fitNames([w, w, w, 0], 3, 0)).toMatchObject({ fit: 3 });
    expect(fitNames([w, w], 3, 0)).toMatchObject({ fit: 2 });
  });
  it("keeps whole names that fit with room for +N, and folds the rest", () => {
    expect(fitNames([w, w, w, 0], 3, w * 2 + 40).fit).toBe(2);
    expect(fitNames([w, w, w], 3, w * 3).fit).toBe(3);
    expect(fitNames([w, w, w, 0], 3, w * 3).fit).toBe(2);
  });
  it("shuts the line when not even one name fits, unless the room is 120px or more", () => {
    expect(fitNames([w], 3, 100).fit).toBe(0);
    expect(fitNames([w + 400], 3, 130)).toEqual({ fit: 1, used: 130 });
  });
  it("caps a name's text so one long name cannot take the line", () => {
    expect(nameWidth(1000)).toBe(nameWidth(180));
  });
});

describe("two stars", () => {
  const pts = [mark("fast", "high", 2, 60), mark("best", "high", 4, 75)];
  const label = (it: string) => it.split("@")[0];
  it("compares the leader's score and cost against the other", () => {
    const d = starDelta(["fast", "best"], pts, "Cost per task ($)", label)!;
    expect(d.lead).toBe("best");
    expect(d.d).toBe(15);
    expect(d.x).toBe(2);
    expect(d.word).toBe("cost");
    expect(d.text).toBe("best scores 15.0 higher at 2.0 times the cost");
  });
  it("names the axis for time and for anything else, and rounds large multiples", () => {
    expect(starDelta(["fast", "best"], pts, "Time per task (s)", label)?.word).toBe("time");
    expect(starDelta(["fast", "best"], pts, "Release date", label)?.word).toBe("release date");
    expect(starDelta(["fast", "best"], [mark("fast", "high", 0.3, 60), mark("best", "high", 4, 75)], "Cost", label)?.times).toBe("13");
  });
  it("says nothing for other counts, a mark that is not drawn, or no axis", () => {
    expect(starDelta(["fast"], pts, "Cost", label)).toBeNull();
    expect(starDelta(["fast", "best", "x"], pts, "Cost", label)).toBeNull();
    expect(starDelta(["fast", "gone"], pts, "Cost", label)).toBeNull();
    expect(starDelta(["fast", "best"], undefined, "Cost", label)).toBeNull();
    expect(starDelta(["fast", "best"], pts, undefined, label)).toBeNull();
  });
  it("drops the multiple when the other star has no cost to divide by", () => {
    const d = starDelta(["free", "best"], [mark("free", "high", 0, 60), mark("best", "high", 4, 75)], "Cost", label)!;
    expect(d.x).toBeNull();
    expect(d.text).toBe("best scores 15.0 higher");
  });
});

describe("rows that fit", () => {
  it("counts whole rows under the fixed parts and never fewer than four", () => {
    expect(rowsThatFit(560, 100, 40)).toBe(11);
    expect(rowsThatFit(200, 150, 40)).toBe(4);
  });
});
