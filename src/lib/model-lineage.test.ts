import { describe, expect, it } from "vitest";
import type { RankedVariant } from "@/engine";
import { generationChange, isPlaced, lineageFinder, lineKey, predecessors } from "./model-lineage";

const row = (id: string, name: string, effort: string, score: number, releaseDate = "2026-01-01", labId = "openai", measuredShare = 1) =>
  ({ score, measuredShare, model: { id, name, labId, releaseDate }, variant: { id: `${id}@${effort}`, effort } }) as unknown as RankedVariant;
const model = (id: string, name: string, releaseDate: string, labId = "lab") => ({ id, name, labId, releaseDate });

describe("model lines", () => {
  it("drops the version, its prefix, build dates and settings", () => {
    expect(lineKey({ name: "GPT-6.1 Sol", labId: "o" }).key).toBe(lineKey({ name: "GPT-5.6 Sol", labId: "o" }).key);
    expect(lineKey({ name: "Kimi K3.1", labId: "m" }).key).toBe(lineKey({ name: "Kimi K2.6", labId: "m" }).key);
    expect(lineKey({ name: "DeepSeek V4.1 Flash 1017", labId: "d" }).key).toBe(lineKey({ name: "DeepSeek V4 Flash", labId: "d" }).key);
    expect(lineKey({ name: "Muse Spark", labId: "m" }).key).toBe(lineKey({ name: "Muse Spark 1.3", labId: "m" }).key);
    expect(lineKey({ name: "GPT-6 Sol", labId: "o" }).key).not.toBe(lineKey({ name: "GPT-6 Sol Pro", labId: "o" }).key);
    expect(lineKey({ name: "Qwen 3.8 27B", labId: "q" }).key).not.toBe(lineKey({ name: "Qwen 3.8 Max", labId: "q" }).key);
  });
  it("orders a line by release date, so Grok 4.20 comes before Grok 4.3", () => {
    const p = predecessors([model("a", "Grok 4.3", "2026-04-30"), model("b", "Grok 4.20", "2026-02-17"), model("c", "Grok 4.5", "2026-07-08")]);
    expect([p.get("c"), p.get("a"), p.get("b")]).toEqual(["a", "b", undefined]);
  });
  it("follows renames across lines", () => {
    const p = predecessors([model("gemini-3.1-pro", "Gemini 3.1 Pro", "2026-02-19"), model("gemini-3.8-flash", "Gemini 3.8 Flash", "2026-09-02"), model("gemini-4", "Gemini 4 Argon", "2026-09-30"), model("gemini-4-carbon", "Gemini 4 Carbon", "2026-10-28"), model("gemini-4-hydrogen", "Gemini 4 Hydrogen", "2026-11-12")]);
    expect(p.get("gemini-4-carbon")).toBe("gemini-4");
    expect(p.get("gemini-4")).toBe("gemini-3.1-pro");
    expect(p.get("gemini-4-hydrogen")).toBe("gemini-3.8-flash");
  });
});

describe("model lineage", () => {
  const rows = [row("g6", "GPT-6 Sol", "low", 40, "2026-01-01"), row("g6", "GPT-6 Sol", "high", 45, "2026-01-01"), row("g61", "GPT-6.1 Sol", "high", 50, "2026-02-01"), row("g61", "GPT-6.1 Sol", "max", 52, "2026-02-01"), row("g62", "GPT-6.2 Sol", "high", 58, "2026-03-01")];
  const x: Record<string, number> = { "g6@low": 2, "g61@high": 3, "g61@max": 5, "g62@high": 2 };
  const place = (list: RankedVariant[]) => list.filter((r) => x[r.variant.id]).map((r) => ({ x: x[r.variant.id], r }));
  const find = lineageFinder(rows, place), focus = place(rows).at(-1)!;
  it("walks back oldest first, preferring points the chart can place", () => expect(find(focus).map((p) => p.r.variant.id)).toEqual(["g6@low", "g61@high"]));
  it("keeps a version with no chart value in the history", () => {
    const steps = lineageFinder(rows, (list) => place(list).filter((p) => !p.r.variant.id.startsWith("g6@")))(focus);
    expect(steps.map((p) => [p.r.variant.id, isPlaced(p)])).toEqual([["g6@high", false], ["g61@high", true]]);
  });
  it("measures the change, leaving cost out when the old version has none", () => {
    const [old, previous] = find(focus);
    expect(generationChange(previous, focus).ratio).toBeCloseTo(2 / 3);
    expect(generationChange(previous, focus).score).toBe(8);
    expect(generationChange({ ...old, x: NaN }, focus).ratio).toBeUndefined();
  });
});
