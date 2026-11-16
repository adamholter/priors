import { describe, expect, it } from "vitest";
import { awaitingNotice, LISANBENCH_ALL_ID, LISANBENCH_ID, lisanLabel, parseLisanBench, usedReasoning } from "./sources/lisanbench";

const model = (id: string, label: string, thinking: boolean, company = "anthropic") => ({ id, label, company, thinking });
const agg = (id: string, v: number, extra: Record<string, unknown> = {}) => ({
  model: id, sum_chain_avg: v, sum_chain_avg_ci: [v - 1, v + 1], sum_sparse_chain_avg: v / 3, estimated_cost_usd: 1, avg_validity: 0.8, output_tokens: v * 30,
  coverage: { words: 50, trials: 150 }, ...extra,
});
const pad = Array.from({ length: 20 }, (_, i) => model(`p${i}`, `Pad ${i}`, false, "other"));
const core = (models: ReturnType<typeof model>[], aggregated: ReturnType<typeof agg>[]) => JSON.stringify({
  metadata: { num_words: 50 }, models: [...models, ...pad], release_dates: { c: "2026-09-22" }, aggregated: [...aggregated, ...pad.map((p) => agg(p.id, 10))],
});

describe("LisanBench", () => {
  it("spells labels the Priors way and keeps budgets out of the effort", () => {
    expect(lisanLabel("Opus 5.5 (xhigh)")).toEqual({ label: "Claude Opus 5.5", effort: "xhigh", budget: undefined });
    expect(lisanLabel("Claude Fable 5.1 (high)")).toMatchObject({ label: "Claude Fable 5.1", effort: "high" });
    expect(lisanLabel("GPT 6.1 Sol (low)")).toMatchObject({ label: "GPT-6.1 Sol", effort: "low" });
    expect(lisanLabel("O3 (medium)")).toMatchObject({ label: "o3", effort: "medium" });
    expect(lisanLabel("Sonnet 4.6 (16k)")).toEqual({ label: "Claude Sonnet 4.6", effort: undefined, budget: "16k" });
    expect(lisanLabel("GLM 5 (thinking)")).toEqual({ label: "GLM 5", effort: undefined, budget: "thinking" });
  });

  it("decides reasoning as the site's Non-thinking filter does: measured tokens first, the thinking flag otherwise", () => {
    expect(usedReasoning({ avg_reasoning_tokens: 0 }, { thinking: true })).toBe(false);
    expect(usedReasoning({ avg_reasoning_tokens: 1200 }, { thinking: false })).toBe(true);
    expect(usedReasoning({ avg_reasoning_tokens: null }, { thinking: true })).toBe(true);
    expect(usedReasoning({}, { thinking: false })).toBe(false);
    // Zero reported, but far more output than writing the chain takes: reasoning the provider did not count (Gemini 4 Argon low).
    expect(usedReasoning({ avg_reasoning_tokens: 0 }, { thinking: true }, 645)).toBe(true);
    expect(usedReasoning({ avg_reasoning_tokens: 0 }, { thinking: true }, 6.5)).toBe(false);
    // A model that cannot think is never moved, however much it writes.
    expect(usedReasoning({ avg_reasoning_tokens: 0 }, { thinking: false }, 5000)).toBe(false);
  });

  it("puts runs without reasoning on the main board and every run on the all-runs board", () => {
    const models = [model("a", "Opus 4.6", false), model("b", "Opus 4.6 (16k)", true), model("c", "Opus 5.5 (xhigh)", true), model("s", "Sonnet 5.5 (low)", true), model("d", "Muse Wonder Full (max)", true, "meta"), model("g", "Gemini 4 Argon (low)", true, "google")];
    const { rows } = parseLisanBench(core(models, [
      agg("a", 364), agg("b", 14206.33, { avg_reasoning_tokens: 9000 }), agg("c", 24029, { avg_reasoning_tokens: 30000 }), agg("s", 1574.7, { avg_reasoning_tokens: 0 }),
      agg("d", 37152, { coverage: { words: 49, trials: 134 } }), agg("g", 2546.67, { avg_reasoning_tokens: 0, output_tokens: 2546.67 * 3 * 645 }),
    ]));
    const main = rows.filter((r) => r.benchmarkId === LISANBENCH_ID), all = rows.filter((r) => r.benchmarkId === LISANBENCH_ALL_ID);
    const on = (list: typeof rows, n: string) => list.find((r) => r.note?.split(";")[0] === n);
    expect(on(main, "Opus 4.6")).toMatchObject({ modelLabel: "Claude Opus 4.6", effort: "none", value: 364 });
    // A low-effort run that spent no reasoning tokens is the slot for the author's planned runs: it lands on the main board.
    expect(on(main, "Sonnet 5.5 (low)")).toMatchObject({ modelLabel: "Claude Sonnet 5.5", effort: "low", value: 1574.7 });
    expect(on(main, "Sonnet 5.5 (low)")?.note).toContain("no reasoning tokens used");
    expect(on(main, "Opus 4.6 (16k)")).toBeUndefined();
    expect(on(main, "Opus 5.5 (xhigh)")).toBeUndefined();
    expect(on(all, "Opus 4.6 (16k)")).toMatchObject({ modelLabel: "Claude Opus 4.6", effort: undefined, effortUnstated: true, value: 14206.33 });
    expect(on(all, "Opus 5.5 (xhigh)")).toMatchObject({ effort: "xhigh", ci: [24028, 24030], labHint: "Anthropic", releaseDateHint: "2026-09-22" });
    expect(on(all, "Opus 5.5 (xhigh)")?.costUsd).toBeUndefined();
    expect(on(all, "Opus 5.5 (xhigh)")?.details).toMatchObject({ avgValidityRatio: 0.8, tokensPerStep: 10, reasoningTokensPerTrial: 30000, usedReasoning: true });
    expect(all).toHaveLength(main.length + 3);
    expect(on(main, "Gemini 4 Argon (low)")).toBeUndefined();
    expect(on(all, "Gemini 4 Argon (low)")?.note).toContain("provider reported no reasoning tokens, but 645 output tokens a step");
    expect(on(all, "Muse Wonder Full (max)")).toBeUndefined();
  });

  it("names the models still waiting for a run without reasoning, best first, and says nothing once none are", () => {
    const models = [model("a", "Opus 4.6", false), model("b", "Opus 4.6 (16k)", true), model("c", "Opus 5.5 (xhigh)", true), model("m", "Muse Wonder (max)", true, "meta")];
    const { awaiting } = parseLisanBench(core(models, [agg("a", 364), agg("b", 14206, { avg_reasoning_tokens: 9000 }), agg("c", 24029, { avg_reasoning_tokens: 30000 }), agg("m", 27973, { avg_reasoning_tokens: 40000 })]));
    expect(awaiting).toEqual(["Muse Wonder", "Claude Opus 5.5"]);
    expect(awaitingNotice(awaiting)).toMatch(/^No run without reasoning yet for Muse Wonder, Claude Opus 5\.5\. .*under All runs\.$/);
    expect(awaitingNotice(["a", "b", "c"], 2)).toContain("for a, b and 1 more.");
    expect(awaitingNotice([])).toBeUndefined();
  });
});
