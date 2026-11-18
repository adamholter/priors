import { describe, expect, it } from "vitest";
import { normalizeLabel } from "../../src/data/normalize";
import { RAMP_SWEBENCH_ID, parseRampSweBench } from "./sources/ramp-swebench";

const head = "instance_id,model,harness,resolved,timestamp,agent_cost_usd,agent_elapsed,agent_completion_tokens,note";
const line = (task: number, model: string, resolved: string, cost = "1", at = "2026-11-17T01:00:00Z") => `ramp__task-${task},${model},codex,${resolved},${at},${cost},600,1000,"a, ""quoted""\nnote"`;

describe("Ramp SWE-Bench", () => {
  it("scores tasks resolved over tasks run, with the effort, cost, time and confidence interval", () => {
    const csv = [head, line(1, "openai/gpt-6.2-astra-high", "True", "2"), line(2, "openai/gpt-6.2-astra-high", "False", "4", "2026-11-18T01:00:00Z"), line(1, "openai/gpt-6.2-sol-high", "True"), line(2, "openai/gpt-6.2-sol-high", "True")].join("\n");
    const { rows, tasks, updated } = parseRampSweBench(csv, RAMP_SWEBENCH_ID);
    expect(tasks).toBe(2); expect(updated).toBe("2026-11-18");
    expect(rows.map((r) => [r.modelLabel, r.effort, r.value, r.costUsd, r.durationSec, r.harness])).toEqual([["gpt-6.2-sol", "high", 100, 1, 600, "codex"], ["gpt-6.2-astra", "high", 50, 3, 600, "codex"]]);
    expect(rows[1].ci).toEqual([0, 100]);
  });
  it("leaves out a model that has not run every task", () => {
    const r = parseRampSweBench([head, line(1, "a/full-high", "True"), line(2, "a/full-high", "True"), line(1, "a/partial-high", "True")].join("\n"), RAMP_SWEBENCH_ID);
    expect(r.rows.map((x) => x.modelLabel)).toEqual(["full"]); expect(r.skipped).toEqual(["a/partial-high"]);
  });
  it("fails visibly when a column disappears", () => expect(() => parseRampSweBench("model,resolved\n", RAMP_SWEBENCH_ID)).toThrow(/instance_id/));
  it("uses labels Priors can match", () => {
    for (const label of ["gpt-6.2-astra", "gemini-4-carbon", "claude-fable-5-2", "grok-4.7", "deepseek-v4.1-flash-1017", "muse-wonder-1.0", "muse-ember-1.0", "beam-1.0", "kimi-k3.1-pro"]) expect(normalizeLabel(label).ok, label).toBe(true);
    expect(normalizeLabel("claude-fable-5-2")).toMatchObject({ modelId: "claude-fable-5.2" });
    expect(normalizeLabel("muse-ember-1.0")).toMatchObject({ modelId: "aa-muse-ember" });
  });
});
