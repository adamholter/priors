import { describe, expect, it } from "vitest";
import type { Lab } from "@/data/types";
import type { RankedVariant } from "@/engine";
import type { BenchMetric, MetricGroup } from "./benchmark-metrics";
import { dotPath, flatSlices, groupSet, matches, measureSet, measureStat, sentence, shadeOf, sliceGroups, titled, type Peer } from "./benchmark-slices";

const rel = (labels: string[]) => labels.map((label, i) => ({ id: `arena-${i}`, label }));
const metric = (key: string, group: string, values: Record<string, number>, better: "lower" | "higher" = "higher"): BenchMetric => ({ id: `d:${group ? `${group}.` : ""}${key}`, label: key, group, key, kind: "percent", better, values: new Map(Object.entries(values)) });
const row = (variant: string, model: string, score: number) => ({ variant: { id: variant }, model: { id: model, labId: "lab", name: model }, score }) as unknown as RankedVariant;
const labs = [{ id: "lab", color: "#123456" }] as Lab[];

describe("sliceGroups", () => {
  it("splits Arena's text board into its five families and keeps the order a person reads", () => {
    const labels = ["Overall", "Coding", "Math", "Hard Prompts", "Longer queries", "English", "German", "Industry: life, physical", "Industry: software"];
    const groups = sliceGroups(rel(labels));
    expect(groups.map((g) => g.label)).toEqual(["Overall", "Task", "Prompt", "Language", "Industry"]);
    expect(groups[4].items.map((x) => x.short)).toEqual(["Life, physical", "Software"]);
    expect(flatSlices(groups).map((x) => x.label)).toEqual(["Overall", "Coding", "Math", "Hard Prompts", "Longer queries", "English", "German", "Industry: life, physical", "Industry: software"]);
  });

  it("leaves a short or unrecognised list flat", () => {
    expect(sliceGroups(rel(["Overall", "Coding", "Math"]))).toEqual([expect.objectContaining({ key: "other", label: "" })]);
    expect(sliceGroups(rel(["a", "b", "c", "d", "e", "f", "g", "h"]))).toHaveLength(1);
  });

  it("attaches each slice's leader", () => {
    const peer: Peer = { n: 3, top: [{ id: "m", name: "M", labId: "lab", text: "1500", raw: 1500 }] };
    expect(sliceGroups(rel(["Overall", "Coding"]), { "arena-1": peer })[0].items[1].peer).toBe(peer);
  });
});

describe("measureSet", () => {
  it("places measures in sections and entities, with plain names", () => {
    const set = measureSet([
      metric("llm_turn_count", "", { a: 1 }),
      metric("completion", "byApp.gmail", { a: 1 }),
      metric("completion", "byApp.google_sheets", { a: 1 }),
      metric("violationsTotal", "", { a: 1 }, "lower"),
    ]);
    expect(set.sections.map((s) => s.label)).toEqual(["Measures", "By app"]);
    expect(set.rows[0]).toMatchObject({ name: "LLM turn count", label: "LLM turn count" });
    expect(set.sections[1].entities.map((e) => e.label)).toEqual(["Gmail", "Google Sheets"]);
    expect(set.rows[1].label).toBe("Gmail · Completion");
    expect(set.byId.get("d:violationsTotal")?.lower).toBe(true);
  });
});

describe("groupSet", () => {
  it("names breakdown groups by their entity and kind, and counts columns", () => {
    const g = (id: string, label: string, n: number): MetricGroup => ({ id, label, metrics: Array.from({ length: n }, (_, i) => metric(`c${i}`, id, {})) });
    const set = groupSet([g("byApp.gmail|percent", "Gmail (percent)", 3), g("breakdown", "Breakdown", 2)]);
    expect(set.byId.get("byApp.gmail|percent")).toMatchObject({ label: "Gmail · percent", count: 3 });
    expect(set.byId.get("breakdown")).toMatchObject({ label: "Breakdown", count: 2 });
    expect(set.sections.map((s) => s.label)).toEqual(["By app", "Breakdown"]);
  });
});

describe("matches", () => {
  const r = { id: "x", label: "Gmail · Completion", name: "Completion", section: "byApp", entity: "Gmail" };
  it("wants every word, in any order, in the section or the label", () => {
    expect(matches(r, "")).toBe(true);
    expect(matches(r, "comp gma")).toBe(true);
    expect(matches(r, "byapp")).toBe(true);
    expect(matches(r, "gmail sheets")).toBe(false);
  });
});

describe("measureStat", () => {
  const ranked = [row("a@h", "a", 90), row("b@h", "b", 70), row("c@h", "c", 50), row("c@l", "c", 40)];
  it("finds the leader by the measure's direction and scales marks along its range", () => {
    const high = measureStat(metric("x", "", { "a@h": 10, "b@h": 20, "c@h": 30, "c@l": 15 }), ranked, labs);
    expect(high.leader).toMatchObject({ name: "c", text: "30.0%" });
    expect(high).toMatchObject({ n: 4, min: 10, max: 30 });
    expect(high.top.map((m) => m.t)).toEqual([1, 0.5, 0]);
    const low = measureStat(metric("x", "", { "a@h": 10, "b@h": 20, "c@h": 30, "c@l": 15 }, "lower"), ranked, labs);
    expect(low.leader?.name).toBe("a");
  });

  it("counts a model once however many efforts it ran, and ignores rows without a value", () => {
    const s = measureStat(metric("x", "", { "a@h": 10, "c@h": 30, "c@l": 25 }), ranked, labs);
    expect(s.n).toBe(3);
    expect(s.top).toHaveLength(2);
    expect(s.hot).toHaveLength(2);
    expect(s.pts.every((p) => p.x >= 0 && p.x <= 1 && p.y >= 0 && p.y <= 1)).toBe(true);
  });

  it("copes with no values and with one value", () => {
    const none = measureStat(metric("x", "", {}), ranked, labs);
    expect(none).toMatchObject({ n: 0, top: [] });
    expect(none.leader).toBeUndefined();
    expect(measureStat(metric("x", "", { "a@h": 5 }), ranked, labs).top[0].t).toBe(0);
  });
});

describe("small helpers", () => {
  it("writes names the way a person says them", () => {
    expect(sentence("llm_turn_count")).toBe("LLM turn count");
    expect(titled("google_sheets")).toBe("Google Sheets");
    expect(sentence("byApp")).toBe("By app");
    expect(sentence("fashion_mnist")).toBe("Fashion MNIST");
    expect(titled("cifar_10")).toBe("CIFAR 10");
  });
  it("shades darker for better, flipped when lower is better", () => {
    expect(shadeOf(1, false)).toContain("50%");
    expect(shadeOf(1, true)).toContain("6%");
    expect(shadeOf(0, true)).toContain("50%");
  });
  it("draws one zero-length segment per dot", () => {
    expect(dotPath([{ x: 0, y: 0 }, { x: 1, y: 1 }], 100, 50, 5)).toBe("M5.0 45.0h0M95.0 5.0h0");
  });
});
