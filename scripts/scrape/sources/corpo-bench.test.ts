import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { normalizeLabel } from "../../../src/data/normalize";
import { CORPO_ID, corpoResult, parseCorpoHome, parseCorpoModel } from "./corpo-bench";

const fixture = (name: string) => readFileSync(path.join(__dirname, "../fixtures/corpo-bench", name), "utf8");
const home = parseCorpoHome(fixture("index.html"));
const models = home.slugs.map((slug) => parseCorpoModel(fixture(`${slug}.html`), slug));
const { benchmarks, rows, skipped } = corpoResult(models, home.date);
const of = (id: string) => rows.filter((r) => r.benchmarkId === id);

describe("Corpo-Bench", () => {
  it("lists the Corpo Index board's models in order, including highlighted rows, and the data date", () => {
    expect(home.slugs).toEqual(["opus-5-5-claude-code", "gemini-4-carbon-antigravity", "opus-4-6-max-effort-claude-code", "ricursiveai-ripple-65b-preview-omp", "qwen3-8-27b-omp"]);
    expect(home.date).toBe("2026-11-19");
  });

  it("reads a model page: lab, harness, effort, the index with its range, and each role", () => {
    expect(models[0]).toMatchObject({
      name: "Opus 5.5", lab: "Anthropic", harness: "Claude Code v2.1.284", effort: "xhigh", local: false, index: 70.6, ci: [65.5, 75.7], cost: 1.8, minutes: 9.1,
      roles: { Solo: { value: 72.5, ci: [68, 77], cost: 2.09 }, Orchestrator: { value: 68.8, cost: 1.52, partnerCost: 0.01, attempts: 29, tasks: 14 }, Worker: { value: 71.8, partnerCost: 2.27 } },
    });
  });

  it("takes the effort from the name when the line leaves it out, and drops it from the name", () => {
    expect(models[2]).toMatchObject({ name: "Opus 4.6", effort: "max" });
  });

  it("keeps the index first, three role variants after it, out of default mixes", () => {
    expect(benchmarks.map((b) => [b.id, b.variantOf])).toEqual([[CORPO_ID, undefined], [`${CORPO_ID}-solo`, CORPO_ID], [`${CORPO_ID}-orchestrator`, CORPO_ID], [`${CORPO_ID}-worker`, CORPO_ID]]);
    expect(benchmarks.every((b) => b.defaultWeight === 0 && !b.eligibleForDefault && b.lastUpdated === "2026-11-19")).toBe(true);
    expect(of(CORPO_ID).map((r) => r.value)).toEqual([70.6, 63, 49.1, 45.6]);
  });

  it("leaves out local quantized runs, and a cost that is only a lower bound", () => {
    expect(skipped).toEqual(["Qwen3.8-27B (local, omp v18.2.11)"]);
    const ripple = of(CORPO_ID).find((r) => r.modelLabel.includes("Ripple"));
    expect(ripple?.costUsd).toBeUndefined();
    expect(ripple?.details).toMatchObject({ costAtLeastUsd: 0.18 });
  });

  it("resolves the names the site uses, keeping Hy4 Flash apart from Hy4", () => {
    for (const r of of(CORPO_ID).filter((r) => !r.modelLabel.includes("Ripple"))) expect(normalizeLabel(r.modelLabel, r.labHint).ok, r.modelLabel).toBe(true);
    expect(normalizeLabel("Gemini 4 Carbon Latest", "Google")).toMatchObject({ modelId: "gemini-4-carbon" });
    expect(normalizeLabel("Tencent Hy4 Flash", "Tencent")).toMatchObject({ modelId: "hy-4-flash", labId: "tencent" });
    expect(normalizeLabel("Tencent Hy4", "Tencent")).toMatchObject({ modelId: "hy-4" });
  });

  it("leaves out a role the site still marks as an estimate, and keeps the index roles", () => {
    const m = parseCorpoModel(fixture("glm-5-4-zcode.html"), "z-ai-glm-5-4-zcode");
    expect(m.roles.Solo?.value).toBe(66);
    expect(m.roles.Orchestrator?.value).toBe(59.5);
    expect(m.roles.Worker).toBeUndefined();
  });
});
