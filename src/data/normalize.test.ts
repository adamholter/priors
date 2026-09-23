import { describe, expect, it } from "vitest";
import { normalizeLabel } from "./normalize";

const cases: [string, string, string | undefined][] = [
  ["Opus 4.8 Adaptive Reasoning Max Effort", "claude-opus-4.8", "max"],
  ["Opus 4.8 Max", "claude-opus-4.8", "max"],
  ["Opus 4.8 Thinking Max Effort", "claude-opus-4.8", "max"],
  ["claude-opus-4.8 [xhigh]", "claude-opus-4.8", "xhigh"],
  ["Claude Opus 4.8", "claude-opus-4.8", undefined],
  ["anthropic/claude-sonnet-4.6", "claude-sonnet-4.6", undefined],
  ["gpt-5.5 (high)", "gpt-5.5", "high"],
  ["GPT-5.5 xhigh", "gpt-5.5", "xhigh"],
  ["GPT-5.4 mini [xhigh]", "gpt-5.4-mini", "xhigh"],
  ["Gemini 3.5 Flash (medium)", "gemini-3.5-flash", "medium"],
  ["Gemini 3.1 Pro Preview", "gemini-3.1-pro", undefined],
  ["gemini-3.5-flash-lite", "gemini-3.5-flash-lite", undefined],
  ["kimi-k2.7-code", "kimi-k2.7-code", undefined],
  ["Kimi K2.6", "kimi-k2.6", undefined],
  ["deepseek-v4-pro", "deepseek-v4-pro", undefined],
  ["DeepSeek V4 Pro (Reasoning)", "deepseek-v4-pro", undefined],
  ["qwen3.7-max", "qwen-3.7-max", undefined],
  ["Qwen 3.7 Max", "qwen-3.7-max", undefined],
  ["glm-5.1", "glm-5.1", undefined],
  ["minimax-m3", "minimax-m3", undefined],
  ["mimo-v2.5-pro", "mimo-v2.5-pro", undefined],
  ["grok-build-0.1", "grok-build-0.1", undefined],
  ["Grok 5 (Thinking)", "grok-5", undefined],
  ["claude-fable-5 [max]", "claude-fable-5", "max"],
  ["GPT-5.6 Sol (max)", "gpt-5.6-sol", "max"],
  ["claude-opus-4-6-high", "claude-opus-4.6", "high"],
  ["Muse Spark 1.2", "muse-spark-1.2", undefined],
  ["Inkling Small", "inkling-small", undefined],
  ["gpt-oss-120b", "gpt-oss-120b", undefined],
  ["gpt-5.6-luna", "gpt-5.6-luna", undefined],
  ["GPT-4o mini", "gpt-4o-mini", undefined],
  ["gpt-oss-120b (high)", "gpt-oss-120b", "high"],
];

describe("normalizeLabel", () => {
  it("keeps Epoch's no-reasoning, sized models, Instant and dated releases distinct", () => {
    expect(normalizeLabel("GPT-6 Astra (none)")).toMatchObject({ effort: "none" });
    expect(normalizeLabel("GPT-6 Astra (low)")).toMatchObject({ effort: "low" });
    expect(normalizeLabel("GPT-5 (minimal)")).toMatchObject({ effort: "minimal" });
    expect(normalizeLabel("Qwen3.6 35B-A3B")).toMatchObject({ modelId: "qwen-3.6-35b-a3b" });
    expect(normalizeLabel("Qwen3.6 27B")).toMatchObject({ modelId: "qwen-3.6-27b" });
    expect(normalizeLabel("GPT-5.5 Instant")).toMatchObject({ modelId: "gpt-5.5-instant" });
    expect(normalizeLabel("DeepSeek V4 Pro 0813")).toMatchObject({ modelId: "deepseek-v4-pro-0813" });
    expect(normalizeLabel("DeepSeek V4 Pro")).toMatchObject({ modelId: "deepseek-v4-pro" });
  });
  it("preserves a separate effort on Max and Medium model tiers", () => {
    expect(normalizeLabel("Qwen 3.7 Max", "high")).toMatchObject({ modelId: "qwen-3.7-max", effort: "high" });
    expect(normalizeLabel("Qwen 3.7 Max (low)")).toMatchObject({ modelId: "qwen-3.7-max", effort: "low" });
    expect(normalizeLabel("Mistral Medium 3.5", "high")).toMatchObject({ modelId: "mistral-medium-3.5", effort: "high" });
  });
  for (const [label, id, effort] of cases) {
    it(label, () => {
      const r = normalizeLabel(label);
      expect(r.ok, `unknown: ${label} -> ${r.cleaned}`).toBe(true);
      if (r.ok) {
        expect(r.modelId).toBe(id);
        expect(r.effort).toBe(effort);
      }
    });
  }
  it("distinct models are not merged", () => {
    const a = normalizeLabel("GPT-5.5"), b = normalizeLabel("GPT-5.5 mini"), c = normalizeLabel("GPT-5.4"), d = normalizeLabel("GPT-5.6 Sol"), e = normalizeLabel("GPT-5.6 Terra");
    expect(new Set([a, b, c, d, e].map((x) => (x.ok ? x.modelId : "?"))).size).toBe(5);
  });
  it("recognizes exact VALS catalog labels and keeps their canonical identities", () => {
    const cases: [string, string][] = [
      ["Ling 3.0 Flash", "aa-ling-3-0-flash"],
      ["Ling 3.0 Flash Fin", "aa-ling-3-0-flash-fin"],
      ["Nemotron 3 Ultra", "aa-nvidia-nemotron-3-ultra-550b-a55b"],
      ["Nemotron 3.5 Lightning", "aa-nemotron-3-5-lightning"],
      ["Mercury 2.5", "mercury-2.5"],
      ["Laguna M.1", "laguna-m.1"],
      ["Laguna XS.2", "laguna-xs.2"],
      ["Muse Spark", "aa-muse-spark"],
      ["Claude 3.7 Sonnet (Nonthinking)", "claude-sonnet-3.7"],
      ["Claude 3.5 Haiku Latest", "claude-haiku-3.5"],
      ["Command A", "aa-command-a"],
      ["Command R", "aa-command-r-03-2024"],
      ["Command R+", "aa-command-r-plus-04-2024"],
      ["Jamba 1.5 Large", "aa-jamba-1-5-large"],
      ["Jamba 1.5 Mini", "aa-jamba-1-5-mini"],
      ["Jamba 1.6 Large", "aa-jamba-1-6-large"],
      ["Jamba 1.6 Mini", "aa-jamba-1-6-mini"],
      ["Gemma 2 (9B)", "gemma-2-9b"],
      ["Gemma 2 (27B)", "gemma-2-27b"],
      ["Mixtral (8x7B)", "aa-mixtral-8x7b-instruct"],
      ["AlephProver", "alephprover"],
      ["Aristotle", "aristotle"],
    ];
    for (const [label, id] of cases) {
      const result = normalizeLabel(label);
      expect(result.ok, "unknown VALS label: " + label).toBe(true);
      if (result.ok) expect(result.modelId).toBe(id);
    }
  });
  it("unknown label is flagged not guessed", () => {
    expect(normalizeLabel("Nova Micro 2").ok).toBe(false);
  });
});
