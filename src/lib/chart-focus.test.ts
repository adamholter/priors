import { describe, expect, it } from "vitest";
import { currentFlagships, focusModelIds } from "./chart-focus";
import type { ScatterPoint } from "@/components/chart/scatter-option";

const m = (id: string, name: string, labId: string, releaseDate: string) => ({ id, name, labId, releaseDate });
const MODELS = [
  m("opus-5.5", "Opus 5.5", "anthropic", "2026-09-22"), m("opus-5", "Opus 5", "anthropic", "2026-06-01"), m("opus-4.8", "Opus 4.8", "anthropic", "2026-04-01"),
  m("sonnet-5.5", "Sonnet 5.5", "anthropic", "2026-09-28"), m("haiku-5.5", "Haiku 5.5", "anthropic", "2026-10-07"), m("fable-5.1", "Fable 5.1", "anthropic", "2026-08-01"),
  m("gpt-6.1-sol", "GPT-6.1 Sol", "openai", "2026-09-29"), m("gpt-6-sol", "GPT-6 Sol", "openai", "2026-08-01"), m("gpt-5.6-sol", "GPT-5.6 Sol", "openai", "2026-06-01"),
  m("gpt-6-astra", "GPT-6 Astra", "openai", "2026-09-03"), m("gpt-6-luna", "GPT-6 Luna", "openai", "2026-08-15"), m("gpt-6.1-terra", "GPT-6.1 Terra", "openai", "2026-10-26"),
  m("gpt-5.5", "GPT-5.5", "openai", "2026-05-01"), m("gpt-5.5-instant", "GPT-5.5 Instant", "openai", "2026-05-01"),
  m("gemini-4", "Gemini 4", "google", "2026-09-30"), m("gemini-3.8-flash", "Gemini 3.8 Flash", "google", "2026-08-20"), m("gemma-4-31b", "Gemma 4 31B", "google", "2026-09-01"),
  m("grok-4.7", "Grok 4.7", "xai", "2026-09-10"), m("grok-4.1-fast", "Grok 4.1 Fast", "xai", "2025-11-19"),
  m("muse-wonder", "Muse Wonder (Max)", "meta", "2026-10-12"), m("muse-spark", "Muse Spark", "meta", "2026-04-01"), m("muse-spark-1.3", "Muse Spark 1.3", "meta", "2026-09-02"), m("llama-4", "Llama 4 Maverick", "meta", "2025-04-05"),
  m("mistral-large-4", "Mistral Large 4", "mistral", "2026-09-01"), m("glm-5.3", "GLM 5.3", "zhipu", "2026-09-01"),
];

describe("Pareto chart focus", () => {
  it("keeps the current model of each flagship-lab line and drops older versions, older generations and other labs", () => {
    expect([...currentFlagships(MODELS)].sort()).toEqual(["fable-5.1", "gemini-4", "gpt-6-astra", "gpt-6-luna", "gpt-6.1-sol", "gpt-6.1-terra", "grok-4.7", "haiku-5.5", "muse-spark-1.3", "muse-wonder", "opus-5.5", "sonnet-5.5"]);
  });
  it("keeps any model on the chart's frontier and anything highlighted", () => {
    const at = (id: string, x: number, score: number): ScatterPoint => { const model = MODELS.find((q) => q.id === id)!; return { x, r: { model: { ...model, kind: "llm", reasoning: true, aliases: [] }, variant: { id: `${id}@max`, modelId: id, effort: "max" }, score } } as unknown as ScatterPoint; };
    const pts = [at("opus-5.5", 1, 50), at("glm-5.3", 0.01, 30), at("mistral-large-4", 2, 20), at("opus-5", 3, 40), at("gpt-5.5", 4, 35)];
    const ids = focusModelIds(pts, "lower", ["gpt-5.5@max"]);
    expect(ids.has("glm-5.3")).toBe(true); // cheapest: on the frontier
    expect(ids.has("opus-5.5")).toBe(true);
    expect(ids.has("gpt-5.5")).toBe(true); // highlighted
    expect(ids.has("mistral-large-4")).toBe(false);
    expect(ids.has("opus-5")).toBe(false);
  });
});
