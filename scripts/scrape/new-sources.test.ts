import { describe, expect, it } from "vitest";
import { parseEci } from "./sources/epoch-eci";
import { metrLabel, parseMetr } from "./sources/metr";
import { parseEpochTasks } from "./sources/epoch-tasks";
import { buildBenchmarkHeaven } from "./sources/benchmarkheaven";
import { parseArenaDataset } from "./sources/arena";
import { buildBoggs } from "./sources/boggs";
import { applyOpenWeights, familyOpenWeights } from "../../src/data/open-weights";
import type { Snapshot } from "../../src/data/types";

describe("Epoch Capabilities Index", () => {
  const csv = `Model,Display name,eci,eci_ci_low,eci_ci_high,date,Organization,Country (of organization),Model accessibility,Accessibility group,model_versions
Claude Opus 5.5,Claude Opus 5.5,166.82,163.54,170.99,2026-09-22,Anthropic,United States of America,API access,Closed weights,
Kimi K3,Kimi K3,150.1,148,152,2026-08-01,Moonshot,China,Open weights (unrestricted),Open weights,
Mystery,Mystery,140,,,2026-01-01,Someone,,Limited access,Other,`;
  it("reads scores, intervals and the open-weights group", () => {
    const r = parseEci(csv);
    expect(r.rows.map((x) => [x.modelLabel, x.value])).toEqual([["Claude Opus 5.5", 166.82], ["Kimi K3", 150.1], ["Mystery", 140]]);
    expect(r.rows[0].ci).toEqual([163.54, 170.99]);
    expect(r.rows[2].ci).toBeUndefined();
    expect(r.modelFlags).toEqual([{ modelLabel: "Claude Opus 5.5", labHint: "Anthropic", openWeights: false }, { modelLabel: "Kimi K3", labHint: "Moonshot", openWeights: true }]);
  });
});

describe("METR time horizon", () => {
  const yaml = `benchmark_name: METR-Horizon-v1.1
doubling_time_in_days: # excludes points
  all_time_stitched:
    point_estimate: 187.778
results:
  claude_3_7_sonnet_inspect:
    benchmark_name: METR-Horizon-v1.1
    metrics:
      average_score:
        estimate: 0.55
      is_sota: true
      p50_horizon_length:
        ci_high: 104.2
        ci_low: 30.1
        estimate: 55.5
    release_date: 2025-02-24
    scaffolds:
    - metr_agents/react
  gpt_6_astra_inspect:
    metrics:
      p50_horizon_length:
        estimate: 600
    release_date: 2026-09-03
other_key:
  x: 1
`;
  it("flattens each model block and stops at the next top-level key", () => {
    const r = parseMetr(yaml);
    expect(r.rows.map((x) => [x.modelLabel, x.value, x.releaseDateHint])).toEqual([["claude 3.7 sonnet", 55.5, "2025-02-24"], ["gpt 6 astra", 600, "2026-09-03"]]);
    expect(r.rows[0].ci).toEqual([30.1, 104.2]);
  });
  it("turns an alias into a label", () => { expect(metrLabel("claude_mythos_preview_early_inspect")).toBe("claude mythos preview"); });
});

describe("Epoch benchmark tasks", () => {
  const header = "id_runs,task,model,Best score (across scorers),started_at,Status,Display name,Organization,Version release date,stderr,comments";
  const csv = [header,
    "1,Chess Puzzles,gpt-6_high,0.5,2026-09-01,Success,GPT-6,OpenAI,2026-09-03,0.02,",
    "2,Chess Puzzles,gpt-6_high,0.6,2026-09-10,Success,GPT-6,OpenAI,2026-09-03,0.02,",
    "3,Chess Puzzles,gpt-6_low,0.3,2026-09-10,Failure,GPT-6,OpenAI,2026-09-03,,",
    "4,Brand New Task,gpt-6_high,0.9,2026-09-10,Success,GPT-6,OpenAI,,,"].join("\n");
  it("keeps the latest successful run per model and effort", () => {
    const r = parseEpochTasks(csv);
    expect(r.benchmarks.map((b) => b.id)).toEqual(["epoch-chess-puzzles"]);
    expect(r.rows).toHaveLength(1);
    expect(r.rows[0]).toMatchObject({ value: 60, effort: "high", modelLabel: "GPT-6" });
  });
});

describe("Benchmark Heaven", () => {
  const reg = (id: string, over: Record<string, unknown> = {}) => ({ id, name: id, version_status: "published", category: "Coding", one_sentence_description: "Does a thing.", maintainer: "Some Lab", primary_url: `https://lab.example/${id}`, scoring: { unit: "fraction", range: [0, 1], higher_better: true }, ...over });
  const obs = (benchmark_id: string, name: string, value: number, basis = "measured") => ({ benchmark_id, value, unit: "fraction", basis, subject: { name, model_id: name }, source: { url: "https://benchmarkheaven.com/x" } });
  const many = (id: string, n: number, basis = "measured") => Array.from({ length: n }, (_, i) => obs(id, `m${i}`, 0.1 + i / 100, basis));
  const data = { benchmark_results: { observations: [
    ...many("good::1", 6), ...many("aa-thing::snapshot-2026-09-10", 6), ...many("few::1", 3), ...many("vendor::1", 6, "self_reported"), ...many("board::1", 9, "self_reported"),
    ...many("snap::snapshot-2026-09-10", 5), ...many("snap::snapshot-2026-10-01", 6), ...many("cost::1", 6),
  ] }, models: [{ family_name: "Kimi K3", org: "Moonshot", open_weights: true }, { family_name: "Unknown", open_weights: null }] };
  const registry = [reg("good::1"), reg("aa-thing::snapshot-2026-09-10"), reg("few::1"), reg("vendor::1"), reg("board::1"), reg("snap::snapshot-2026-09-10"), reg("snap::snapshot-2026-10-01"), reg("cost::1", { category: "Efficiency" })];
  const r = buildBenchmarkHeaven(registry as never, data as never);
  it("reads independent boards, converts fractions to percent and links the maintainer", () => {
    const good = r.benchmarks.find((b) => b.id === "bh-good-1")!;
    expect(good).toMatchObject({ unit: "percent", category: "coding", url: "https://lab.example/good::1", defaultWeight: 0 });
    expect(r.rows.find((x) => x.benchmarkId === "bh-good-1" && x.modelLabel === "m0")!.value).toBeCloseTo(10);
    expect(r.rows.find((x) => x.benchmarkId === "bh-good-1")!.sourceUrl).toBe("https://lab.example/good::1");
  });
  it("skips what Priors reads itself, thin boards, cost, and a lone vendor's claims", () => {
    const ids = r.benchmarks.map((b) => b.id);
    expect(ids).not.toContain("bh-aa-thing"); expect(ids).not.toContain("bh-few-1"); expect(ids).not.toContain("bh-vendor-1"); expect(ids).not.toContain("bh-cost-1");
    expect(ids).toContain("bh-board-1");
  });
  it("gives a re-collected leaderboard one stable id, from its newest snapshot", () => {
    expect(r.benchmarks.filter((b) => b.id === "bh-snap")).toHaveLength(1);
    expect(r.rows.filter((x) => x.benchmarkId === "bh-snap")).toHaveLength(6);
  });
  it("passes on the weight flags that exist", () => { expect(r.modelFlags).toEqual([{ modelLabel: "Kimi K3", labHint: "Moonshot", openWeights: true }]); });
});

describe("open weights", () => {
  const model = (id: string) => ({ id, name: id, labId: "x", kind: "llm" as const, reasoning: false, aliases: [] });
  const snap = (over: Partial<Snapshot>) => ({ models: [], variants: [], ...over }) as unknown as Snapshot;
  it("prefers AA's flag, then other sources, then family rules, else leaves it unknown", () => {
    const s = snap({
      models: [model("aa-says-open"), model("glm-9"), model("claude-9"), model("zz-unknown"), model("qwen-9-plus"), model("signalled")],
      variants: [{ id: "aa-says-open@max", modelId: "aa-says-open", effort: "max", sourceModel: { id: "1", slug: "a", name: "A", url: "u", metadata: { isOpenWeights: true, parameters: 692, activeParams: 33 } } }] as never,
    });
    const r = applyOpenWeights(s, new Map([["signalled", false]]));
    const by = Object.fromEntries(r.models.map((m) => [m.id, m]));
    expect(by["aa-says-open"]).toMatchObject({ openWeights: true, paramsB: 692, activeParamsB: 33 });
    expect(by["glm-9"].openWeights).toBe(true);
    expect(by["claude-9"].openWeights).toBe(false);
    expect(by["qwen-9-plus"].openWeights).toBe(false);
    expect(by["signalled"].openWeights).toBe(false);
    expect(by["zz-unknown"].openWeights).toBeUndefined();
    expect(r.unknown).toEqual(["zz-unknown"]);
  });
  it("treats hosted-only variants of open families as closed", () => { expect(familyOpenWeights("qwen-3.5-flash")).toBe(false); expect(familyOpenWeights("qwen-3.5-27b")).toBe(true); });
});

describe("Arena from the Hugging Face dataset", () => {
  const r = parseArenaDataset({
    "arena-agent": [{ model_name: "Claude Opus 5.5 (Max)", organization: "anthropic", score: 0.17, score_ci_lower: 0.14, score_ci_upper: 0.2, session_count: 6796, rank: 1, leaderboard_publish_date: "2026-10-14" }],
    "arena-text": [{ model_name: "Gemini 4 Argon (High)", organization: "google", rating: 1523.9, rating_lower: 1515, rating_upper: 1532, vote_count: 4900, rank: 1, leaderboard_publish_date: "2026-10-15" }, { model_name: "no rating", rating: Number.NaN }],
    "arena-webdev": [{ model_name: "gpt-6-astra-max (codex-harness)", rating: 1780, rank: 2 }],
  });
  it("rebuilds the same benchmarks the site pages gave", () => {
    expect(r.benchmarks.map((b) => b.id).sort()).toEqual(["arena-agent", "arena-text", "arena-webdev"]);
    expect(r.benchmarks.find((b) => b.id === "arena-agent")).toMatchObject({ unit: "percent", category: "agentic" });
    expect(r.benchmarks.find((b) => b.id === "arena-text")).toMatchObject({ unit: "elo", url: "https://arena.ai/leaderboard/text" });
  });
  it("scales the agent score to percent, keeps intervals and splits a harness suffix", () => {
    const a = r.rows.find((x) => x.benchmarkId === "arena-agent")!;
    expect(a.value).toBeCloseTo(17); expect(a.ci![0]).toBeCloseTo(14); expect(a.ci![1]).toBeCloseTo(20); expect(a.modelLabel).toBe("Claude Opus 5.5 (Max)");
    expect(r.rows.find((x) => x.benchmarkId === "arena-webdev")).toMatchObject({ modelLabel: "gpt-6-astra-max", harness: "codex-harness" });
    expect(r.rows.filter((x) => x.benchmarkId === "arena-text")).toHaveLength(1);
  });
});

describe("Arena categories and agent signals", () => {
  const many = (n: number, category: string, base = 1500) => Array.from({ length: n }, (_, i) => ({ model_name: `Model ${i}`, organization: "x", rating: base - i, rank: i + 1, category }));
  const r = parseArenaDataset({
    "arena-text": [...many(10, "overall"), ...many(9, "coding", 1600), ...many(3, "math")],
    "arena-agent-success": Array.from({ length: 9 }, (_, i) => ({ model_name: `Model ${i}`, score: 0.2 - i * 0.01, rank: i + 1, category: "overall" })),
  });
  it("keeps the overall board as the main benchmark and each full category as a variant of it", () => {
    expect(r.benchmarks.find((b) => b.id === "arena-text")?.variantOf).toBeUndefined();
    expect(r.benchmarks.find((b) => b.id === "arena-text-coding")).toMatchObject({ variantOf: "arena-text", variantLabel: "Coding", defaultWeight: 0, eligibleForDefault: false });
    expect(r.rows.filter((x) => x.benchmarkId === "arena-text")).toHaveLength(10);
    expect(r.rows.filter((x) => x.benchmarkId === "arena-text-coding")).toHaveLength(9);
  });
  it("skips a category too thin to rank", () => { expect(r.benchmarks.some((b) => b.id === "arena-text-math")).toBe(false); });
  it("reads an agent signal as percentage points, a variant of Agent Arena", () => {
    expect(r.benchmarks.find((b) => b.id === "arena-agent-success")).toMatchObject({ variantOf: "arena-agent", unit: "percent", higherIsBetter: true });
    expect(r.rows.find((x) => x.benchmarkId === "arena-agent-success")!.value).toBeCloseTo(20);
  });
});

describe("boggs.tech dashboard", () => {
  const res = (benchmark_id: string, n: number, over: Record<string, unknown> = {}) => Array.from({ length: n }, (_, i) => ({ benchmark_id, model: `m${i}`, raw_score: 10 + i, reported_score: (10 + i) / 100, score_direction: "higher", metric: "accuracy", source_url: `https://x.example/${benchmark_id}`, ...over }));
  const data = {
    benchmarks: [{ id: "clockbench", name: "ClockBench", category: "vision", url: "https://clockbench.ai/", notes: "Reading analog clocks." }, { id: "mmlu-pro", name: "MMLU-Pro" }, { id: "thin", name: "Thin" }, { id: "elo-thing", name: "Elo Thing", category: "reasoning" }, { id: "cheat", name: "Cheat", category: "safety" }],
    results: [...res("clockbench", 6), ...res("mmlu-pro", 6), ...res("thin", 3), ...res("elo-thing", 6, { raw_score: 1500, reported_score: 1500, metric: "Elo rating" }), ...res("cheat", 6, { score_direction: "lower", metric: "cheating rate", open_weights: false })],
  };
  const r = buildBoggs(data as never);
  it("reads uncovered boards with enough models and links each to its own site", () => {
    expect(r.benchmarks.map((b) => b.id).sort()).toEqual(["bg-cheat", "bg-clockbench", "bg-elo-thing"]);
    expect(r.benchmarks.find((b) => b.id === "bg-clockbench")).toMatchObject({ url: "https://clockbench.ai/", unit: "percent", category: "reasoning", defaultWeight: 0 });
  });
  it("keeps shares as percent, ratings in their own scale, and direction", () => {
    expect(r.rows.find((x) => x.benchmarkId === "bg-clockbench" && x.modelLabel === "m0")!.value).toBeCloseTo(10);
    expect(r.benchmarks.find((b) => b.id === "bg-elo-thing")).toMatchObject({ unit: "elo" });
    expect(r.rows.find((x) => x.benchmarkId === "bg-elo-thing")!.value).toBe(1500);
    expect(r.benchmarks.find((b) => b.id === "bg-cheat")!.higherIsBetter).toBe(false);
  });
  it("passes on open-weights flags", () => { expect(r.modelFlags![0]).toMatchObject({ openWeights: false }); });
});
