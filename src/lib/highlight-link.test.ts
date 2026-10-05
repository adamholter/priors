import { describe, expect, it } from "vitest";
import { decodeIndices, decodeIndex, encodeIndex } from "./url";
import { chartLinkUrl, linkedHighlights, setHighlightParams } from "./highlight-link";
import { readChartHidden, setChartHidden } from "../components/chart/chart-visibility";

const first = decodeIndex("First|swe:50", "first")!;
const second = { ...decodeIndex("Second|term:50", "second")!, highlight: ["gpt-6.1-sol@xhigh", "claude-opus-5.5@max~vals"] };

describe("highlighted chart links", () => {
  it("copies current chart removals alongside highlights and keeps other chart removals", () => {
    const hidden = { models: ["alpha"], efforts: ["beta@high"] };
    const current = setChartHidden(new URL("https://mypriors.com/adamholter"), "time-per-task", { models: ["gamma"], efforts: [] });
    const url = chartLinkUrl(current.toString(), "custom-cost", { hidden }, { items: second.highlight, indexId: "second" });
    expect(readChartHidden(url.searchParams, "custom-cost")).toEqual(hidden);
    expect(readChartHidden(url.searchParams, "time-per-task").models).toEqual(["gamma"]);
    expect(linkedHighlights([first, second], url.searchParams)[1].highlight).toEqual(second.highlight);
    expect(readChartHidden(chartLinkUrl(url.toString(), "custom-cost", { hidden: { models: [], efforts: [] } }).searchParams, "custom-cost").models).toEqual([]);
  });
  it("copies scale with highlights and clears it when copying another chart", () => {
    const url = chartLinkUrl("https://mypriors.com/builder?cs=log", "cost", { cs: "linear" }, { items: second.highlight, linkIndices: [second] });
    expect(url.searchParams.get("cs")).toBe("linear");
    expect(decodeIndices(url.searchParams)[0].highlight).toEqual(second.highlight);
    expect(chartLinkUrl(url.toString(), "release-date", {}).searchParams.has("cs")).toBe(false);
  });
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

it("copies label size alongside removals and clears the old size for a different chart", () => {
  const hidden = { models: ["alpha"], efforts: ["beta@high"] };
  const url = chartLinkUrl("https://mypriors.com/AdamHolter", "cost", { ls: 150, hidden }, { items: second.highlight, indexId: "second" });
  expect(url.searchParams.get("ls")).toBe("150");
  expect(readChartHidden(url.searchParams, "cost")).toEqual(hidden);
  expect(linkedHighlights([first, second], url.searchParams)[1].highlight).toEqual(second.highlight);
  expect(chartLinkUrl(url.toString(), "time-per-task", {}).searchParams.has("ls")).toBe(false);
});
