import { Script } from "node:vm";
import { describe, expect, it } from "vitest";
import { barsHtml, scatterHtml, type BarSpec, type ScatterSpec } from "./embed";

const scatter: ScatterSpec = {
  title: "Cost",
  xName: "Cost per task",
  scale: "linear",
  unit: { prefix: "$", suffix: "" },
  yMin: 70,
  yMax: 100,
  highlight: ["gpt-6.1-sol@xhigh", "claude-opus-5.5"],
  guides: false,
  points: [{
    v: [0.5, 94], c: "#2F4FB0", d: "#9AABF5", dc: "#B8B8D0", dd: "#8B8B8F",
    m: "gpt-6.1-sol", id: "gpt-6.1-sol@xhigh", e: "xhigh", h: true, a: true, g: false, gx: "$0.50",
    n: "GPT-6.1 Sol xhigh", s: true, f: true, t: "<b>GPT-6.1 Sol xhigh</b>",
  }, {
    v: [0.7, 91], c: "#EA8A73", d: "#EA8A73", dc: "#D7ACA2", dd: "#A77872",
    m: "claude-opus-5.5", id: "claude-opus-5.5@default", e: "default", h: true, a: true, g: false,
    n: "Claude Opus 5.5", s: true, f: false, t: "<b>Claude Opus 5.5</b>",
  }, {
    v: [1.1, 82], c: "#2F4FB0", d: "#9AABF5", dc: "#B8B8D0", dd: "#8B8B8F",
    m: "other-model", id: "other-model@default", e: "default", h: false, a: false, g: false,
    n: "Other model", s: true, f: false, t: "<b>Other model</b>",
  }],
  frontier: [[0.5, 94]],
  links: [{ m: "gpt-6.1-sol", h: true, c: "#2F4FB0", d: "#9AABF5", dc: "#B8B8D0", dd: "#8B8B8F", p: [[0.5, 94]] }],
};

const bars: BarSpec = {
  title: "Latency",
  yName: "Seconds",
  unit: { prefix: "", suffix: "s" },
  highlight: ["claude-opus-5.5@high"],
  bars: [{
    n: "Claude Opus 5.5 high", v: 2.4, c: "#EA8A73", d: "#EA8A73", dc: "#D7ACA2", dd: "#A77872",
    m: "claude-opus-5.5", id: "claude-opus-5.5@high", e: "high", h: true, a: true, t: "<b>Claude Opus 5.5 high</b>",
  }],
};

type EmbedOption = {
  series: { z?: number; data?: { id?: string; label?: Record<string, unknown>; itemStyle?: Record<string, unknown> }[] }[];
  graphic?: { children: { type: string }[] }[];
  xAxis?: { data: (string | { value: string; textStyle?: Record<string, unknown> })[] };
};

function inlineScript(html: string) {
  const source = html.match(/<script>\n([\s\S]*?)\n<\/script>/)?.[1];
  expect(source).toBeDefined();
  return source!;
}

function runEmbed(source: string) {
  const calls: { option: Record<string, unknown>; merge?: unknown }[] = [];
  const listeners: Record<string, () => void> = {};
  const chart = {
    on: (event: string, fn: () => void) => { listeners[event] = fn; },
    setOption: (option: Record<string, unknown>, merge?: unknown) => { calls.push({ option, merge }); },
    getWidth: () => 600,
    getModel: () => ({ getComponent: () => ({ coordinateSystem: { getRect: () => ({ x: 48, y: 24, width: 440, height: 300 }) } }) }),
    convertToPixel: (_: unknown, value: number[]) => [value[0] * 100 + 30, value[1] * 3 + 24],
    resize: () => listeners.finished?.(),
  };
  new Script(source).runInNewContext({
    echarts: { init: () => chart },
    document: { getElementById: () => ({}), documentElement: { style: { setProperty() {} } } },
    location: { search: "?theme=light", hash: "" },
    URLSearchParams,
    matchMedia: () => ({ matches: false, addEventListener() {} }),
    addEventListener() {},
  });
  return calls;
}

describe("standalone chart exports", () => {
  it("keeps scatter highlight and guide state in executable HTML", () => {
    const make = (guides: boolean) => runEmbed(inlineScript(scatterHtml({
      ...scatter,
      guides,
      points: scatter.points.map((p) => ({ ...p, g: guides && p.h })),
    })));
    const withoutGuides = make(false), withGuides = make(true);
    const option = withoutGuides[0].option as unknown as EmbedOption, series = option.series.at(-1)!;
    const point = (id: string) => series.data!.find((item) => item.id === id)!;
    const featured = point("gpt-6.1-sol@xhigh"), modelHighlight = point("claude-opus-5.5@default"), dimmed = point("other-model@default");
    expect(series.z).toBe(5);
    expect(featured.label).toMatchObject({ show: true, formatter: "GPT-6.1 Sol xhigh", fontWeight: 600 });
    expect(modelHighlight.label).toMatchObject({ show: true, formatter: "Claude Opus 5.5", fontWeight: 600 });
    expect(dimmed.label?.show).toBe(false);
    expect(dimmed.itemStyle).toMatchObject({ color: "#B8B8D0", opacity: 0.6 });
    const withoutGuideGraphic = withoutGuides.at(-1)?.option as unknown as EmbedOption;
    const guideGraphic = withGuides.at(-1)?.option as unknown as EmbedOption;
    expect(withoutGuideGraphic.graphic?.[0].children).toHaveLength(0);
    const children = guideGraphic.graphic?.[0].children ?? [];
    expect(children.filter((child: { type: string }) => child.type === "line")).toHaveLength(4);
    expect(children.filter((child: { type: string }) => child.type === "text")).toHaveLength(4);
  });

  it("keeps exact effort highlighting in executable bar exports", () => {
    const calls = runEmbed(inlineScript(barsHtml({
      ...bars,
      highlight: ["claude-opus-5.5@high"],
      bars: [...bars.bars, { ...bars.bars[0], n: "Other model", m: "other", id: "other@default", h: false, a: false, c: "#2F4FB0", d: "#9AABF5", dc: "#B8B8D0", dd: "#8B8B8F" }],
    })));
    const option = calls[0].option as unknown as EmbedOption, [selected, dimmed] = option.series[0].data!;
    expect(option.xAxis?.data[0]).toMatchObject({ value: "Claude Opus 5.5 high", textStyle: { fontWeight: 600 } });
    expect(selected.itemStyle?.color).toBe("#EA8A73");
    expect(dimmed.itemStyle).toMatchObject({ color: "#B8B8D0", opacity: 0.6 });
  });
});
