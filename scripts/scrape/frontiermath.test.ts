import { describe, expect, it } from "vitest";
import { parseFrontierMath } from "./sources/frontiermath";

const headers = ["id_runs", "task", "model", "Display name", "mean_score", "stderr", "Status", "started_at", "comments", "task version", "billable_output_tokens"];
const row = (task: string, score: string, model = "gpt-6-astra_max", name = "GPT-6 Astra (max)", status = "Success", date = "2026-09-07") => ["run", task, model, name, score, "0.02", status, date, "comma, quote \" and\nnewline", "2.0.0", "12345"];
const csv = (rows: string[][]) => [headers, ...rows].map((r) => r.map((s) => `"${s.replaceAll('"', '""')}"`).join(",")).join("\r\n");
const t4 = "FrontierMath-Tier-4-v2-Private", t123 = "FrontierMath-Tiers-1-3-v2-Private";

describe("FrontierMath live export parser", () => {
  it("does not merge an unspecified effort run with an explicit no-reasoning run", () => {
    const result = parseFrontierMath(csv([row(t123, "0.2", "qwen3.6-27b_none", "Qwen3.6 27B"), row(t123, "0.3", "qwen3.6-27b", "Qwen3.6 27B")]));
    expect(result.rows.map((r) => r.effort)).toEqual(["none", "max"]);
    expect(result.rows[1].note).toContain("assumed maximum");
  });
  it("keeps versioned tier sets separate, scales scores and preserves explicit zero scores", () => {
    const result = parseFrontierMath(csv([row(t4, "0.75"), row(t123, "0.9"), row("FrontierMath-Erdos", "0")]));
    expect(result.benchmarks.map((b) => b.id)).toEqual(expect.arrayContaining(["frontiermath-tier-4-v2", "frontiermath-tiers-1-3-v2", "frontiermath-erdos"]));
    expect(result.rows.map((r) => r.value)).toEqual(expect.arrayContaining([75, 90, 0]));
    expect(result.rows[0].costUsd).toBeUndefined();
    expect(result.rows[0].outputTokens).toBeUndefined();
    expect(result.benchmarks.every((b) => b.versionPolicy?.kind === "fresh")).toBe(true);
  });
  it("discovers new model rows, keeps effort metadata not visible in display names, and handles multiline CSV", () => {
    const result = parseFrontierMath(csv([row(t4, "0.3", "gemini-3.1-flash-lite_low", "Gemini 3.1 Flash-Lite"), row(t4, "0.4", "gemini-3.1-flash-lite_high", "Gemini 3.1 Flash-Lite"), row(t4, "0.6", "future-model_max", "Future Model")]));
    expect(result.rows).toHaveLength(3);
    expect(result.rows.map((r) => r.effort)).toEqual(["low", "high", "max"]);
    expect(result.rows[0].note).toContain('comma, quote " and\nnewline');
  });
  it("does not mix public sample questions, obsolete v1, failed runs, or invalid values into v2", () => {
    const result = parseFrontierMath(csv([row(t4, "0.5"), row("FrontierMath-Tier-4-2025-07-01-Public", "1"), row("FrontierMath-2025-02-28-Private", "0.9"), row(t4, "1", "failed_max", "Failed", "Failed"), row(t4, "Infinity"), row(t4, ""), row(t4, "1.2")]));
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0].value).toBe(50);
  });
  it("uses the latest successful repeat, not the largest score, without collapsing efforts", () => {
    const result = parseFrontierMath(csv([row(t4, "0.9", undefined, undefined, undefined, "2026-08-01"), row(t4, "0.7", undefined, undefined, undefined, "2026-09-01"), row(t4, "0.5", "gpt-6-astra_low", "GPT-6 Astra (low)")]));
    expect(result.rows).toHaveLength(2);
    expect(result.rows[0].value).toBe(70);
  });
  it("fails visibly if the export format changes or contains no usable FrontierMath data", () => {
    expect(() => parseFrontierMath("html")).toThrow();
    expect(() => parseFrontierMath(csv([row("GPQA", "0.9")]))).toThrow();
  });
});
