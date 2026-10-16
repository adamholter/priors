import { describe, expect, it } from "vitest";
import { decodeIndices, decodeIndex, encodeIndex } from "./url";
import { chartLinkUrl, linkedHighlights, linkedViews, setHighlightParams, viewParam } from "./highlight-link";
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

describe("display settings in profile links", () => {
  const saved = decodeIndex("WebDev|arena:60,swe:40|pareto=best", "webdev")!;
  const curated = { ...saved, excludeModels: ["gpt-5.5", "grok-4.3"], releasedAfter: "2026-06-01", paretoVariants: "all" as const };
  it("names only what differs from the saved page", () => {
    expect(viewParam(saved, saved)).toBe("");
    expect(viewParam(curated, saved)).toBe("ex=gpt-5.5,grok-4.3|after=2026-06-01|pareto=all");
  });
  it("opens a linked page the way it was copied, without touching the other tabs", () => {
    const url = chartLinkUrl("https://mypriors.com/adamholter", "webdev-cost", { cs: "log" }, { items: [], indexId: "second", view: viewParam(curated, saved) });
    expect(url.searchParams.get("hv")).toBe("ex=gpt-5.5,grok-4.3|after=2026-06-01|pareto=all");
    const other = { ...second, id: "second-saved" };
    const opened = linkedViews([first, { ...saved, id: "second" }, other], new URLSearchParams(`hi=second&hv=${encodeURIComponent(url.searchParams.get("hv")!)}`));
    expect(opened[1]).toMatchObject({ excludeModels: ["gpt-5.5", "grok-4.3"], releasedAfter: "2026-06-01", paretoVariants: "all", weights: saved.weights });
    expect(opened[0]).toBe(first);
    expect(opened[2]).toBe(other);
  });
  it("can say a hide list was cleared, and drops hv when nothing differs", () => {
    const hiding = { ...saved, excludeModels: ["gpt-5.5"] };
    expect(viewParam(saved, hiding)).toBe("ex=");
    expect(linkedViews([hiding], new URLSearchParams("hv=ex="))[0].excludeModels).toEqual([]);
    expect(chartLinkUrl("https://mypriors.com/adamholter?hv=ex%3Dx", "webdev-cost", {}, { items: [], indexId: "webdev", view: "" }).searchParams.has("hv")).toBe(false);
  });
  it("ignores anything but display settings, and a link naming no index", () => {
    expect(linkedViews([saved], new URLSearchParams("hv=weights%3Dx|strict=5|ex=a"))[0]).toMatchObject({ weights: saved.weights, excludeModels: ["a"] });
    expect(linkedViews([saved], new URLSearchParams("hi=gone&hv=ex=a"))).toEqual([saved]);
  });
});
