import { describe, expect, it } from "vitest";
import { budgetIdentity } from "./sources/arcagi";

const flash = new Set(["gemini-2.5-flash"]), claude = new Set(["claude-sonnet-4.5"]), pro = new Set(["gemini-2.5-pro"]);

describe("ARC thinking budgets", () => {
  it("gives a Gemini 2.5 budget Google's own effort word", () => {
    expect(budgetIdentity("Gemini 2.5 Flash (Preview) (Thinking 1K)", "a", flash)).toEqual({ effort: "low" });
    expect(budgetIdentity("Gemini 2.5 Flash (Preview) (Thinking 8K)", "a", flash)).toEqual({ effort: "medium" });
    expect(budgetIdentity("Gemini 2.5 Flash (Preview) (Thinking 24K)", "a", flash)).toEqual({ effort: "high" });
  });
  it("keeps the no-budget row as the model's default, so 24K's score can't pass for it", () => {
    expect(budgetIdentity("Gemini 2.5 Flash (Preview)", "gemini-2-5-flash-preview-05-20", flash).identity).toMatchObject({ modelId: "gemini-2.5-flash", effort: "default", variantId: "gemini-2.5-flash@default" });
  });
  it("names a budget with no published word instead of guessing an effort", () => {
    expect(budgetIdentity("Gemini 2.5 Flash (Preview) (Thinking 16K)", "a", flash).identity).toMatchObject({ variantId: "gemini-2.5-flash@default~arc-thinking-16k", configuration: "arc-thinking-16k" });
    expect(budgetIdentity("Gemini 2.5 Pro (Thinking 32K)", "a", pro).identity?.configuration).toBe("arc-thinking-32k");
    expect(budgetIdentity("Claude Sonnet 4.5 (Thinking 32K)", "a", claude).identity?.configuration).toBe("arc-thinking-32k");
    expect(budgetIdentity("Opus 4.5 (Thinking, 64K)", "a", new Set(["claude-opus-4.5"])).identity?.configuration).toBe("arc-thinking-64k");
  });
  it("reads a Claude no-budget row as thinking off", () => {
    expect(budgetIdentity("Claude Sonnet 4.5", "a", claude)).toEqual({ effort: "none" });
  });
  it("leaves every other model to its label", () => {
    expect(budgetIdentity("GPT-6 Astra (Max)", "a", flash)).toEqual({});
    expect(budgetIdentity("Opus 4.5 (None)", "a", new Set(["claude-opus-4.5"]))).toEqual({});
  });
});
