import { describe, expect, it } from "vitest";
import { parseWeirdmlV3 } from "./sources/weirdml";

const model = (o: Record<string, unknown>) => ({ id: "x", name: "GPT-6 Astra (xhigh)", slug: "openai/gpt-6-astra", reasoning_effort: "xhigh", score: 0.42, interval: [0.4, 0.44], mean_api_cost_usd: 27.8, mean_output_tokens: 153241.4, runs: 76, harnesses: [{ name: "codex_cli", version: "0.154.0" }], ...o });

describe("WeirdML v3 live data parser", () => {
  it("scales scores, keeps intervals, cost, tokens and effort, and strips the parenthetical from names", () => {
    const [r] = parseWeirdmlV3({ schema_version: 1, mode: "real", models: [model({})] } as never);
    expect(r).toMatchObject({ benchmarkId: "weirdml-v3", modelLabel: "GPT-6 Astra", effort: "xhigh", value: 42, costUsd: 27.8, outputTokens: 153241, labHint: "openai", harness: "codex_cli 0.154.0" });
    expect(r.ci?.map((x) => Math.round(x))).toEqual([40, 44]);
    expect(parseWeirdmlV3({ schema_version: 1, models: [model({ name: "Kimi K3 (high, Fireworks)", reasoning_effort: "high" })] } as never)[0].modelLabel).toBe("Kimi K3");
  });
  it("keeps the best harness per model/effort and skips excluded or synthetic models", () => {
    const rows = parseWeirdmlV3({ schema_version: 1, models: [model({ id: "a", name: "DeepSeek V4.1 Flash (high, Novita)", reasoning_effort: "high", score: 0.062 }), model({ id: "b", name: "DeepSeek V4.1 Flash (high, Novita)", reasoning_effort: "high", score: 0.059 }), model({ id: "c", name: "GLM 5.3 Flash" }), model({ id: "d", name: "Fake", synthetic: true })], excluded_models: [{ id: "c" }] } as never);
    expect(rows).toHaveLength(1);
    expect(rows[0].value).toBeCloseTo(6.2);
  });
  it("fails visibly when the format or mode changes", () => {
    expect(() => parseWeirdmlV3({ schema_version: 2, models: [] } as never)).toThrow();
    expect(() => parseWeirdmlV3({ schema_version: 1, mode: "synthetic", models: [] } as never)).toThrow();
  });
});
