import { describe, expect, it } from "vitest";
import { decodeIndices, decodeIndex, encodeIndex } from "./url";
import { chartLinkUrl, linkedHighlights, setHighlightParams } from "./highlight-link";

const first = decodeIndex("First|swe:50", "first")!;
const second = { ...decodeIndex("Second|term:50", "second")!, highlight: ["gpt-6.1-sol@xhigh", "claude-opus-5.5@max~vals"] };

describe("highlighted chart links", () => {
  it("copies the active builder mix and current selection before the URL debounce", () => {
    const url = chartLinkUrl(`https://mypriors.com/builder?i=${encodeURIComponent(encodeIndex(first))}&date=2026-10-03`, "cost", { cv: "bars" }, { items: second.highlight, linkIndices: [second, first] });
    const decoded = decodeIndices(url.searchParams);
    expect(decoded[0].name).toBe("Second");
    expect(decoded[0].highlight).toEqual(second.highlight);
    expect(decoded[1].name).toBe("First");
    expect(url.searchParams.get("cv")).toBe("bars");
    expect(url.searchParams.get("date")).toBe("2026-10-03");
    expect(url.hash).toBe("#cost");
  });
  it("restores profile selections to the correct index without modifying its weights", () => {
    const url = chartLinkUrl("https://mypriors.com/adamholter?date=2026-10-03", "custom-cost", undefined, { items: second.highlight, indexId: "second" });
    const restored = linkedHighlights([first, { ...second, highlight: undefined }], url.searchParams);
    expect(restored[0]).toEqual(first);
    expect(restored[1]).toEqual(second);
    expect(url.pathname).toBe("/adamholter");
  });
  it("preserves clearing a saved selection and leaves other indices alone", () => {
    const url = setHighlightParams(new URL("https://mypriors.com/adamholter"), second.id, []);
    expect(url.searchParams.has("hl")).toBe(true);
    expect(linkedHighlights([first, second], url.searchParams)[1].highlight).toBeUndefined();
    expect(linkedHighlights([first, second], new URLSearchParams())).toEqual([first, second]);
    expect(linkedHighlights([first, second], new URLSearchParams("hi=missing&hl=other"))).toEqual([first, second]);
  });
  it("round trips exact source-qualified efforts in the normal index codec", () => {
    expect(decodeIndex(encodeIndex(second), second.id)?.highlight).toEqual(second.highlight);
  });
});
