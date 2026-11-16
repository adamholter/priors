import { describe, expect, it } from "vitest";
import { lisanLabel, parseLisanBench } from "./sources/lisanbench";

const model = (id: string, label: string, thinking: boolean, company = "anthropic") => ({ id, label, company, thinking });
const agg = (id: string, v: number, words = 50) => ({ model: id, sum_chain_avg: v, sum_chain_avg_ci: [v - 1, v + 1], sum_sparse_chain_avg: v / 3, estimated_cost_usd: 1, coverage: { words, trials: 150 } });

describe("LisanBench", () => {
  it("spells labels the Priors way and keeps budgets out of the effort", () => {
    expect(lisanLabel("Opus 5.5 (xhigh)")).toEqual({ label: "Claude Opus 5.5", effort: "xhigh", budget: undefined });
    expect(lisanLabel("Claude Fable 5.1 (high)")).toMatchObject({ label: "Claude Fable 5.1", effort: "high" });
    expect(lisanLabel("GPT 6.1 Sol (low)")).toMatchObject({ label: "GPT-6.1 Sol", effort: "low" });
    expect(lisanLabel("O3 (medium)")).toMatchObject({ label: "o3", effort: "medium" });
    expect(lisanLabel("Sonnet 4.6 (16k)")).toEqual({ label: "Claude Sonnet 4.6", effort: undefined, budget: "16k" });
    expect(lisanLabel("GLM 5 (thinking)")).toEqual({ label: "GLM 5", effort: undefined, budget: "thinking" });
  });

  it("reads Path Length, files a model's no-thinking run under none, and drops runs missing a starting word", () => {
    const models = [model("a", "Opus 4.6", false), model("b", "Opus 4.6 (16k)", true), model("c", "Opus 5.5 (xhigh)", true), model("d", "Muse Wonder Full (max)", true, "meta")];
    const pad = Array.from({ length: 20 }, (_, i) => model(`p${i}`, `Pad ${i}`, false, "other"));
    const json = JSON.stringify({
      metadata: { num_words: 50 }, models: [...models, ...pad], release_dates: { c: "2026-09-22" },
      aggregated: [agg("a", 364), agg("b", 14206.33), agg("c", 24029), agg("d", 37152, 49), ...pad.map((p) => agg(p.id, 10))],
    });
    const rows = parseLisanBench(json), by = (n: string) => rows.find((r) => r.note?.startsWith(n));
    expect(by("Opus 4.6;")).toBeUndefined();
    expect(rows.find((r) => r.note === "Opus 4.6")).toMatchObject({ modelLabel: "Claude Opus 4.6", effort: "none", value: 364 });
    expect(by("Opus 4.6 (16k)")).toMatchObject({ modelLabel: "Claude Opus 4.6", effort: undefined, effortUnstated: true, value: 14206.33 });
    expect(by("Opus 5.5")).toMatchObject({ effort: "xhigh", ci: [24028, 24030], labHint: "Anthropic", releaseDateHint: "2026-09-22" });
    expect(by("Opus 5.5")?.costUsd).toBeUndefined();
    expect(by("Muse Wonder Full")).toBeUndefined();
    // A model with no thinking run anywhere keeps an unstated effort.
    expect(by("Pad 0")).toMatchObject({ effort: undefined, effortUnstated: true });
  });
});
