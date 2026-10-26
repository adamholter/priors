import { expect, it } from "vitest";
import { renderAnswerChartPng, cardPalette } from "./og-chart";
import type { AnswerChart } from "./answer-chart";
const m = { name: "WebDev Index", unit: "", better: "higher" as const };
const mk = (label: string, labId: string, color: string) => ({ label, modelId: label, labId, color });
const bar: AnswerChart = { kind: "bar", title: "GPT-5.6 Sol max vs Opus 5.5 low", metric: m, items: [{ ...mk("Opus 5.5 low", "anthropic", "#D4967A"), value: 55.2 }, { ...mk("GPT-5.6 Sol max", "openai", "#10A37F"), value: 50.9 }] };
const grouped: AnswerChart = { kind: "grouped", title: "Effort compare", metric: m, series: ["low", "max"], groups: [{ ...mk("GPT-5.6 Sol", "openai", "#10A37F"), values: [36.6, 51.4] }, { ...mk("Opus 5.5", "anthropic", "#D4967A"), values: [50, 67.4] }] };
it("draws bar and grouped answer charts as PNG cards in either scheme", () => {
  const png = (c: AnswerChart, scheme: "light" | "dark") => renderAnswerChartPng(c, cardPalette(undefined, scheme));
  for (const c of [bar, grouped]) {
    const light = png(c, "light"), dark = png(c, "dark");
    expect(light.subarray(1, 4).toString()).toBe("PNG");
    expect(dark.equals(light)).toBe(false);
  }
});
