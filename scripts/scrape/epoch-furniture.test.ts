import { describe, expect, it } from "vitest";
import { parseFurniture } from "./sources/epoch-furniture";

const headers = ["id_runs", "task", "model", "Display name", "mean_score", "stderr", "Status", "started_at", "comments", "task version", "Organization"];
const row = (score: string, model = "gpt-6-astra_max", name = "GPT-6 Astra (max)", status = "Success", date = "2026-09-10", task = "Furniture Assembly") => ["run", task, model, name, score, "0.05", status, date, "", "1.0.0", "OpenAI"];
const csv = (rows: string[][]) => [headers, ...rows].map((r) => r.map((s) => `"${s.replaceAll('"', '""')}"`).join(",")).join("\r\n");

describe("Epoch Furniture Assembly parser", () => {
  it("scales mean scores to percent and keeps efforts from the model id", () => {
    const r = parseFurniture(csv([row("0.8"), row("0.2", "qwen3.8-max-0902_xhigh", "Qwen3.8 Max (0902) (xhigh)"), row("0.5", "other", "Other", "Success", "2026-09-10", "FrontierMath-Erdos")]));
    expect(r.rows.map((x) => [x.value, x.effort])).toEqual([[80, "max"], [20, "xhigh"]]);
    expect(r.benchmarks[0]).toMatchObject({ id: "epoch-furniture-assembly", category: "reasoning", defaultWeight: 0 });
    expect(r.rows[0].note).toContain("standard error 5 percentage points");
  });
  it("uses the latest successful run, skips failures and invalid values", () => {
    const r = parseFurniture(csv([row("0.9", undefined, undefined, undefined, "2026-08-01"), row("0.7"), row("1", "x_max", "X", "Failed"), row("1.5", "y_max", "Y")]));
    expect(r.rows).toHaveLength(1);
    expect(r.rows[0].value).toBeCloseTo(70);
  });
  it("fails visibly without usable data", () => {
    expect(() => parseFurniture("html")).toThrow();
    expect(() => parseFurniture(csv([row("0.5", "a", "A", "Success", "2026-09-10", "Other task")]))).toThrow();
  });
});
