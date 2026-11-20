import { describe, expect, it } from "vitest";
import { normalizeLabel } from "../../src/data/normalize";
import { SKIP } from "./sources/benchmarkheaven";
import { BENCHCAD_ID, BENCHCAD_STANDARD_ID, parseBenchCAD } from "./sources/benchcad";

const row = (cells: string[]) => `<tr>${cells.map((c) => `<td>${c}</td>`).join("")}</tr>`;
const own = [row(["1", "<b>OpenAI internal model (unreleased)</b><small>credit to OpenAI · 2.0 scorer</small>", "<b>Codex</b>", "<span>0.875</span>", "—", "≈$38 (est.)"]), row(["2", "<b>Claude Fable 5.2 (max)</b><small>credit to Anthropic</small>", "<b>Claude Code</b>", "<span>0.835</span>", "—", "≈$51 (est.)"]), row(["3", "<b>GPT-6.2 Astra (xhigh)</b><small>credit to OpenAI</small>", "<b>Codex</b>", "<span>0.776</span>", "—", "$3.4"]), row(["4", "<b>Claude Opus 5.5 (max)</b><small>credit to Anthropic</small>", "<b>Claude Code</b>", "<span>0.653</span>", "0.014", "$20"])];
const standard = [row(["1", "<b>Claude Fable 5.2 (xhigh)</b><small>2.1 harness</small>", "<span>≈0.702</span>", "—", "≈$17 (est.)"]), row(["2", "<b>Claude Haiku 5.5 (low)</b><small>2.1 harness</small>", "<span>0.049</span>", "0.004", "$0.008"])];
const table = (key: string, harness: boolean, rows: string[]) => `<div class="lbt21" data-lb21="${key}"><table><thead><tr><th>Rank</th><th>Model</th>${harness ? "<th>Harness</th>" : ""}<th>Score</th><th>±95%</th><th>Cost / case</th></tr></thead><tbody>${rows.join("")}</tbody></table></div>`;
const page = (title = "BenchCAD 2.1 Core") => `<h1 class="lb-title">${title}</h1>${table("harness", false, standard)}${table("own", true, own)}`;

describe("BenchCAD", () => {
  const { benchmarks, rows } = parseBenchCAD(page()), of = (id: string) => rows.filter((r) => r.benchmarkId === id);
  it("reads both boards as versioned benchmarks", () => {
    expect(benchmarks.map((b) => [b.id, b.name, b.version, b.versionPolicy?.kind])).toEqual([[BENCHCAD_ID, "BenchCAD v2.1", "2.1", "fresh"], [BENCHCAD_STANDARD_ID, "BenchCAD v2.1 (standard harness)", "2.1", "fresh"]]);
  });
  it("splits effort, keeps the harness, interval and measured cost", () => {
    expect(of(BENCHCAD_ID).map((r) => [r.modelLabel, r.effort, r.value, r.harness, r.costUsd, r.ci])).toEqual([["Claude Fable 5.2", "max", 83.5, "Claude Code", undefined, undefined], ["GPT-6.2 Astra", "xhigh", 77.6, "Codex", 3.4, undefined], ["Claude Opus 5.5", "max", 65.3, "Claude Code", 20, [63.9, 66.7]]]);
    expect(of(BENCHCAD_STANDARD_ID).map((r) => [r.modelLabel, r.effort, r.value, r.costUsd, r.harness])).toEqual([["Claude Haiku 5.5", "low", 4.9, 0.008, "BenchCAD 2.1 harness"]]);
  });
  it("leaves out scores read off a chart and rows on another scorer", () => {
    expect(rows.some((r) => r.modelLabel.startsWith("OpenAI internal") || r.value === 70.2)).toBe(false);
  });
  it("fails loudly when the page changes", () => {
    expect(() => parseBenchCAD(page("Leaderboard"))).toThrow(/no version/);
    expect(() => parseBenchCAD(page().replace("<th>Harness</th>", ""))).toThrow(/columns changed/);
  });
  it("resolves the site's names and keeps Benchmark Heaven's copy out", () => {
    for (const r of rows) expect(normalizeLabel(r.modelLabel).ok, r.modelLabel).toBe(true);
    expect(SKIP.test("benchcad-2.1")).toBe(true);
  });
});
