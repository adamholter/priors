import { describe, expect, it } from "vitest";
import { normalizeLabel } from "../../../src/data/normalize";
import { GAMEFEEL_ID, parseGameFeel } from "./gamefeel";

const HEAD = "model,effort,lab_key,lab,price_per_task_usd,billing,context,minutes_per_task,context_compression_per_task,tokens_per_second,create,bugfix,gamefeel,ideas,visuals,audio,re,avg,open_weights,size_gb,size_basis,re_test";
const CSV = [HEAD,
  "Opus-5.5,XHigh,anthropic,Anthropic,2.6,sub,1M,90,0,67,65,65,50,41,63,25,21.67,47.2,no,,,",
  "Sonnet-5.5,Medium,anthropic,Anthropic,0.75,sub,1M,30,0,120,62,61,40,35,49,15,9.28,38.8,no,,,",
  "gpt-6-luna,Max,openai,OpenAI,0.34,sub,1M,96,3,200,50,15,0,15,28,15,0.06,17.6,no,,,",
  "gpt-6-auto (astra+luna),High,openai,OpenAI,2.2,sub,1M,90,1,56,62,20,0,30,36,35,1.36,26.3,no,,,",
  "Space Bunny,Max,opencode,OpenCode,0,free,1M,240,0,140,59,52,3,36,45,50,1.74,35.2,,,,",
  "Qwen-4-27B-Early,XHigh,alibaba,Alibaba Qwen,0.16,api,1M,185,5,370,64,63,51,43,48,28,14.88,44.6,yes,35,quantization not stated,",
  "Qwen-3.8-Flash-Next,XHigh,alibaba,Alibaba Qwen,0.02,sub,1M,15,0,140,55,55,50,42,27,40,12.97,40.3,yes,128,quantization not stated,",
  'Gpt-6.1-Sol,High,openai,OpenAI,,,,,,,,,,,,,7.61,,,,,"Semi-private subset of the RE test, 748 tasks"',
].join("\n") + "\n";
const META = '{\n  "updated": "2026-11-09 22:06",\n  "entries": 30,\n  "standard": "v1.4"\n}';

describe("GameFeel Benchmark", () => {
  it("reads the board's overall score per model and effort, with the seven subcategories in details", () => {
    const { rows, benchmarks, notes } = parseGameFeel(CSV, META);
    expect(rows.map((r) => [r.modelLabel, r.effort, r.value])).toEqual([
      ["Opus-5.5", "XHigh", 47.2], ["Sonnet-5.5", "Medium", 38.8], ["gpt-6-luna", "Max", 17.6], ["gpt-6-auto (astra+luna)", "High", 26.3],
      ["Space Bunny", "Max", 35.2], ["Qwen-4-27B-Early", "XHigh", 44.6], ["Qwen-3.8-Flash-Next", "XHigh", 40.3],
    ]);
    expect(rows[0]).toMatchObject({ benchmarkId: GAMEFEEL_ID, labHint: "Anthropic", details: { create: 65, bugfix: 65, gamefeel: 50, ideas: 41, visuals: 63, audio: 25, re: 21.67, pricePerTaskUsd: 2.6, billing: "sub", minutesPerTask: 90 } });
    // The board's price is not a measured run cost, so it never reaches the cost column.
    expect(rows.every((r) => r.costUsd === undefined && r.durationSec === undefined)).toBe(true);
    expect(benchmarks[0]).toMatchObject({ id: "gamefeel", unit: "score", category: "creative", normalization: { min: 0, max: 100 }, eligibleForDefault: false, defaultWeight: 0, lastUpdated: "2026-11-09" });
    expect(notes?.[0]).toBe("7 rows, 1 without an overall score skipped, updated 2026-11-09, standard v1.4");
  });
  it("keeps a published subcategory 0 and skips a row with no overall, which is the board's not run", () => {
    const { rows } = parseGameFeel(CSV);
    expect(rows.find((r) => r.modelLabel === "gpt-6-luna")).toMatchObject({ value: 17.6, details: { gamefeel: 0 } });
    expect(rows.some((r) => r.modelLabel === "Gpt-6.1-Sol")).toBe(false);
  });
  it("leaves the router, the stealth model and the unreleased build unresolved", () => {
    const resolved = parseGameFeel(CSV).rows.map((r) => { const n = normalizeLabel(r.modelLabel, r.effort); return n.ok ? `${n.modelId}@${n.effort}` : "unresolved"; });
    expect(resolved).toEqual(["claude-opus-5.5@xhigh", "claude-sonnet-5.5@medium", "gpt-6-luna@max", "unresolved", "unresolved", "unresolved", "qwen-3.8-flash@xhigh"]);
  });
  it("fails loudly when the CSV changes shape", () => {
    expect(() => parseGameFeel(CSV.replace(",re,avg,", ",re,overall,"))).toThrow(/columns changed: no avg/);
    expect(() => parseGameFeel(`${HEAD}\nOpus-5.5,XHigh,anthropic,Anthropic,2.6,sub,1M,90,0,67,65,65,50,41,63,25,21.67,47.2,no,,,\n`)).toThrow(/schema changed/);
    expect(() => parseGameFeel(CSV.replace("21.67,47.2", "21.67,147.2"))).toThrow(/out of range for Opus-5.5/);
    expect(() => parseGameFeel(CSV.replace("9.28,38.8", "9.28,n/a"))).toThrow(/out of range for Sonnet-5.5/);
  });
});
