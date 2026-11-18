import { describe, expect, it } from "vitest";
import { parseAlibabaTokenPlan, parseAntigravityModels } from "./sources/plan-listings";

const row = (name: string, free: string, pro: string, ultra: string) => `<tr class="x"><td style="text-align: left;">${name}</td><td>${free}</td><td>${pro}</td><td>${ultra}</td><td>✅</td></tr>`;
const table = (rows: string) => `<table class="markdown-table"><thead><tr><th>Model</th><th>Free &amp; Google AI Plus</th><th>Google AI Pro</th><th>Google AI Ultra</th><th>Enterprise</th></tr></thead><tbody>${rows}</tbody></table>`;
const yes = `<span class="model-availability-mark">✅<sup>†</sup></span>`, all = ["Google AI Pro", "Google AI Ultra 5x", "Google AI Ultra 20x"].map((plan) => ({ plan }));

describe("Antigravity's model tables", () => {
  const html = table(row(`<a href="/blog/neon">Gemini 4 Neon</a>`, "❌", yes, "✅") + row("Gemini 4 Carbon", "❌", "❌", "✅") + row("Orchestrator (Neon)", "❌", yes, "✅") + row("Gemini 3.7 Flash", "❌", "❌", "❌")) + table(row("Claude Opus 5.5 (thinking)<sup>**</sup>", "❌", yes, "✅") + row(`Claude Opus 4.6 (thinking)<sup>*</sup>`, "✅", "✅", "❌"));
  it("reads every table, with Ultra at both sizes", () => {
    expect(parseAntigravityModels(html)).toEqual([{ label: "Gemini 4 Neon", plans: all }, { label: "Gemini 4 Carbon", plans: all.slice(1) }, { label: "Claude Opus 5.5", plans: all }]);
  });
  it("throws when the tables change, so the last list stands", () => { expect(() => parseAntigravityModels("<p>moved</p>")).toThrow(/table changed/); });
});

describe("Alibaba's Token Plan", () => {
  const tr = (...c: string[]) => `<tr>${c.map((x) => `<td>${x}</td>`).join("")}</tr>`;
  const html = `<table>${tr("", "Lite plan", "Essential plan", "Standard plan", "Pro plan")}${tr("Pricing", "39 CNY/month Limited-time new-user price 19.5 CNY/month", "79 CNY/month", "139 CNY/month", "312 CNY/month")}</table><table>${tr("qwen4-max", "Reasoning, text generation")}${tr("qwen4-max-preview", "Reasoning, text generation")}${tr("qwen-image-3.0-pro", "Image generation")}${tr("deepseek-v4.1-flash-1017", "Reasoning, text generation")}${tr("deepseek-v4-pro-0813", "Reasoning, text generation")}${tr("glm-5.3", "Reasoning, text generation")}</table>`;
  it("lists current text models on every plan at the regular fee in dollars", () => {
    const out = parseAlibabaTokenPlan(html, 6.5);
    expect(out.map((m) => m.label)).toEqual(["qwen4 max", "deepseek v4.1 flash 1017", "glm 5.3"]);
    expect(out[0].plans).toEqual([{ plan: "Alibaba Token Plan Lite", feeUsd: 6 }, { plan: "Alibaba Token Plan Essential", feeUsd: 12.15 }, { plan: "Alibaba Token Plan Standard", feeUsd: 21.38 }, { plan: "Alibaba Token Plan Pro", feeUsd: 48 }]);
  });
  it("throws when the page changes", () => { expect(() => parseAlibabaTokenPlan("<p>moved</p>", 6.5)).toThrow(/changed/); });
});
