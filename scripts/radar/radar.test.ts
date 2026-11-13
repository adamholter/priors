import { describe, expect, it } from "vitest";
import { classify, dedupe, extractModelNames, lastRunAnnouncements, matchBenchmarks, plainText, statusParts } from "./classify";
import { checkName, describeCheck } from "./name-check";

// Post texts as the radar read them from X on 13 November 2026.
const HYDROGEN = "Google's new Gemini 4 Hydrogen has Intelligence just below Claude Sonnet 5.5 and GPT-6.1 Sol, at a third of Sonnet’s cost but ~2.5x that of GPT-6.1 Sol\n\n\n@GoogleDeepMind\n has released their third new model in six weeks. Gemini 4 Hydrogen introduces an xhigh reasoning level and";
const HY4 = "Tencent's Hy4 ranks #3 on the Artificial Analysis Cyber Index and #1 on CWE-Bench-AA\n\n\n@TencentHunyuan\n's Hy4 scores 58% on the Artificial Analysis Cyber Index, 1 point ahead of DeepSeek V4.1 Flash 1017 (max).";
const BUSINESS = { text: "Now in beta: Businesses in ChatGPT.\n\nClaim your business, manage your information, and get insights on how people engage with you.\n\n\nhttps://\nopenai.com/index/introduc\ning-businesses-chatgpt/\n…", links: [{ href: "https://t.co/N2GEZX0mFT", text: "https://\nopenai.com/index/introduc\ning-businesses-chatgpt/\n…" }] };
const kindOf = (text: string, images = 0) => { const t = plainText(text); return classify(t, extractModelNames(t), images).kind; };

describe("what a post is about", () => {
  it("reads a board result as a benchmark item", () => {
    expect(kindOf(HY4)).toBe("benchmark");
    expect(kindOf("Take away its tools, and Claude Fable 5.2 scores below Claude Haiku 5.5 with tools on VIALS-AA. VIALS-AA is our implementation of the VIALS benchmark")).toBe("benchmark");
  });
  it("reads a new board as a benchmark item even when it names models", () => {
    expect(classify("Introducing SpireClimb, a new benchmark: GPT-6 Sol leads", ["GPT-6 Sol"]).kind).toBe("benchmark");
  });
  it("reads a launch with a model name as a model item", () => {
    expect(kindOf(HYDROGEN)).toBe("model");
    expect(kindOf("Introducing Claude Opus 6, our most capable model")).toBe("model");
  });
  it("needs a model name for a launch, and two signals for a chart-only result", () => {
    const business = plainText(BUSINESS.text, BUSINESS.links);
    expect(business).not.toContain("index");
    expect(classify(business, extractModelNames(business)).kind).toBe("other");
    expect(kindOf("We are launching a new office in London")).toBe("other");
    expect(kindOf("Up 12% this week", 1)).toBe("benchmark");
    expect(kindOf("Our team at the offsite", 1)).toBe("other");
  });
  it("reads a post naming a Priors board as a benchmark item", () => {
    const t = "Gemini 4 Hydrogen is the leading Google model on AA-Robotics v0.1, sitting fourth overall";
    expect(classify(t, extractModelNames(t))).toEqual({ kind: "other", reasons: [] });
    expect(classify(t, extractModelNames(t), 0, ["AA-Robotics v0.1"])).toEqual({ kind: "benchmark", reasons: ["names a Priors board: AA-Robotics v0.1"] });
  });
  it("says why", () => {
    expect(classify(plainText(HY4), []).reasons).toEqual(['board word "Index"']);
  });
});

describe("model names in a post", () => {
  it("reads names with versions, codenames and tiers, and stops at sentence words", () => {
    expect(extractModelNames(HYDROGEN)).toEqual(["Gemini 4 Hydrogen", "Claude Sonnet 5.5", "GPT-6.1 Sol"]);
    expect(extractModelNames("GPT-6.2 Nova is here, beating Claude Opus 6 and o4-mini")).toEqual(["GPT-6.2 Nova", "Claude Opus 6", "o4-mini"]);
    expect(extractModelNames(HY4)).toEqual(["Hy4", "DeepSeek V4.1 Flash"]);
    expect(extractModelNames("Kimi K3.1 Pro (64%) and Qwen3.5-Max lead")).toEqual(["Kimi K3.1 Pro", "Qwen3.5-Max"]);
    expect(extractModelNames("Inkling 2 Small by @thinkymachines is now the #1 US open model, ahead of Mercury 2")).toEqual(["Inkling 2 Small", "Mercury 2"]);
  });
  it("does not run a name into the next line, or read everyday words as families", () => {
    expect(extractModelNames("Meet Gemini 4 Hydrogen\nGoogle built it")).toEqual(["Gemini 4 Hydrogen"]);
    expect(extractModelNames("step 2 of the process uses seed 42")).toEqual([]);
  });
});

describe("a launch name filed under an existing model", () => {
  const models = [{ id: "gemini-4", name: "Gemini 4 Argon" }, { id: "gpt-6.1-sol", name: "GPT-6.1 Sol" }, { id: "claude-opus-5.5", name: "Opus 5.5" }];
  it("flags a codename the existing model's name lacks: the Gemini 4 Hydrogen bug, with a name no rule knows yet", () => {
    const c = checkName("Gemini 4 Boron", models);
    expect(c).toEqual({ name: "Gemini 4 Boron", status: "swallowed", modelId: "gemini-4", existingName: "Gemini 4 Argon", extra: ["boron"] });
    expect(describeCheck(c)).toContain("WARNING");
  });
  it("leaves the model's own name, its other spellings and effort words alone", () => {
    expect(checkName("Gemini 4", models).status).toBe("existing");
    expect(checkName("GPT-6.1 Sol (xhigh)", models).status).toBe("existing");
    expect(checkName("GPT-6.1 Sol High", models).status).toBe("existing");
    expect(checkName("Claude Opus 5.5 Thinking", models).status).toBe("existing");
  });
  it("flags a new id that drops a word of the name, since a later plain model would share it", () => {
    expect(checkName("GPT-6.2 Nova", models)).toEqual({ name: "GPT-6.2 Nova", status: "dropped", modelId: "gpt-6.2", extra: ["nova"] });
  });
  it("counts a version the existing model lacks, but not a size or a name written without a space", () => {
    const more = [...models, { id: "gemini-4", name: "Gemini 4 Argon" }, { id: "claude-mythos-preview", name: "Mythos Preview" }, { id: "qwen-3-32b", name: "Qwen 3 32B" }];
    expect(checkName("Gemini 4 Argon 2", more)).toMatchObject({ status: "swallowed", modelId: "gemini-4", extra: ["2"] });
    // The radar's first find (2026-11-13): a numbered Mythos now has its own rule.
    expect(checkName("Claude Mythos 5.2", more)).toMatchObject({ status: "new", modelId: "claude-mythos-5.2" });
    expect(checkName("Qwen 3 32B", more).status).toBe("existing");
    expect(checkName("Qwen4", more).status).toBe("new");
  });
  it("tells a new id and an unknown family apart", () => {
    expect(checkName("Gemini 4 Hydrogen", models)).toEqual({ name: "Gemini 4 Hydrogen", status: "new", modelId: "gemini-4-hydrogen" });
    expect(checkName("Zorblax 9", models).status).toBe("unknown");
  });
});

describe("Priors benchmarks a post touches", () => {
  const benchmarks = [
    { id: "aa-cyber-index", name: "Artificial Analysis Cyber Index", url: "https://artificialanalysis.ai/evaluations/cyber-index" },
    { id: "aa-3d", name: "AA-3D", url: "https://artificialanalysis.ai/evaluations/aa-3d" },
    { id: "vals-legal", name: "LegalBench", url: "https://www.vals.ai/benchmarks/legal_bench" },
    { id: "aa-price-blended", name: "Blended Price (USD per 1M tokens, 3:1)", shortName: "Price", url: "https://artificialanalysis.ai/models" },
  ];
  it("matches by page or name, and names a site Priors already reads", () => {
    expect(matchBenchmarks(HY4, ["https://artificialanalysis.ai/evaluations/cyber-index/"], benchmarks)).toEqual({
      matches: [{ id: "aa-cyber-index", name: "Artificial Analysis Cyber Index", by: "url" }], site: { host: "artificialanalysis.ai", benchmarks: 3 },
    });
    expect(matchBenchmarks(HY4, [], benchmarks)).toEqual({ matches: [{ id: "aa-cyber-index", name: "Artificial Analysis Cyber Index", by: "name" }] });
    expect(matchBenchmarks("AA evaluation page", ["https://artificialanalysis.ai/evaluations/healthbench"], benchmarks)).toEqual({ matches: [], site: { host: "artificialanalysis.ai", benchmarks: 3 } });
  });
  it("does not take an everyday word for a board name", () => {
    expect(matchBenchmarks("at 38% of Carbon's list price", [], benchmarks).matches).toEqual([]);
    expect(matchBenchmarks("tops LegalBench", [], benchmarks).matches).toEqual([{ id: "vals-legal", name: "LegalBench", by: "name" }]);
  });
  it("finds nothing for a board Priors does not have, and ignores links to X", () => {
    expect(matchBenchmarks("New: SpireClimb results", ["https://x.com/foo/status/1", "https://spireclimb.dev"], benchmarks)).toEqual({ matches: [] });
  });
});

describe("each item once", () => {
  const now = new Date("2026-11-13T12:00:00Z");
  it("passes new ids, holds seen ones, and forgets ids past the window", () => {
    const first = dedupe([{ id: "x:1" }, { id: "x:2" }, { id: "x:1" }], {}, now);
    expect(first.fresh.map((i) => i.id)).toEqual(["x:1", "x:2"]);
    const second = dedupe([{ id: "x:1" }, { id: "x:3" }], first.seen, now);
    expect(second.fresh.map((i) => i.id)).toEqual(["x:3"]);
    expect(Object.keys(dedupe([], { "x:old": "2026-09-01T00:00:00Z", "x:1": now.toISOString() }, now).seen)).toEqual(["x:1"]);
  });
  it("reads post ids and authors from status paths", () => {
    expect(statusParts("/ArtificialAnlys/status/2121137661180256653")).toEqual({ author: "ArtificialAnlys", id: "2121137661180256653" });
    expect(statusParts("/home")).toBeUndefined();
  });
});

describe("the scrape log's announcements", () => {
  it("takes the last finished run only, once each", () => {
    const log = [
      "== 2026-11-13T07:18:10-05:00 scrape 2026-11-13", "NEW_BENCHMARK aa: old item", "== done 2026-11-13T07:18:40-05:00",
      "== 2026-11-13T07:33:40-05:00 scrape 2026-11-13", "NEW_BENCHMARK aa: AA evaluation page https://artificialanalysis.ai/evaluations/mka", "noise", "NEW_BENCHMARK epoch-tasks: SpireClimb", "NEW_BENCHMARK epoch-tasks: SpireClimb", "== done 2026-11-13T07:34:30-05:00",
      "== 2026-11-13T07:48:40-05:00 scrape 2026-11-13", "NEW_BENCHMARK aa: still running",
    ].join("\n");
    expect(lastRunAnnouncements(log)).toEqual(["aa: AA evaluation page https://artificialanalysis.ai/evaluations/mka", "epoch-tasks: SpireClimb"]);
    expect(lastRunAnnouncements("NEW_BENCHMARK aa: x")).toEqual([]);
  });
});
