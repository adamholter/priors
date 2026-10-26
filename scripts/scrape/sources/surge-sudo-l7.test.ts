import { describe, expect, it } from "vitest";
import { normalizeLabel } from "../../../src/data/normalize";
import type { ScrapeContext } from "../../../src/data/types";
import source, { parseSudoL7, SUDO_L7_PAGE } from "./surge-sudo-l7";
import { buildBoggs } from "./boggs";

function row(brand: string, name: string, score: string) {
  return `<div data-leaderboard-row=""><div class="head-rank-table-brand"><div>${brand}</div></div><div class="head-rank-table-name"><div>${name}</div></div><div data-score="" fs-list-field="foundational-score">${score}</div><div data-score="">%</div></div>`;
}

describe("Surge sudo L7", () => {
  it("keeps the existing id and excludes the secondary dashboard copy", () => {
    const data = buildBoggs({ benchmarks: [{ id: "sudo-l7", name: "sudo L7" }],
      results: Array.from({ length: 5 }, (_, i) => ({ benchmark_id: "sudo-l7", model: `model-${i}`, raw_score: 45 })) });
    expect(data.benchmarks).toEqual([]);
    expect(data.rows).toEqual([]);
    expect(parseSudoL7(row("Claude", "Opus 5.5 (Adaptive/Max) [Claude Code]", "41.7"))[0].benchmarkId).toBe("bg-sudo-l7");
  });
  it("keeps source scores, effort and harness, excluding the related benchmark cards", () => {
    const rows = parseSudoL7([
      row("Claude", "Opus 5.5 (Adaptive/Max) [Claude Code]", "41.7"),
      row("GPT", "6.1 Sol (Max reasoning) [Codex]", "28.9"),
      row("Qwen", "3.8 Max (xHigh reasoning) [Qwen Code]", "20.6"),
      row("Gemini", "4 Argon (High reasoning) [Antigravity]", "0"),
      row("Grok", "4.7 (xHigh reasoning) [Grok Build]", "15.6"),
      row("Muse", "Wonder (Max reasoning) [Muse Code]", "15.6"),
      '<div class="related"><div data-score="">99</div></div>',
    ].join(""));
    expect(rows.map((r) => [r.value, r.effort, r.harness])).toEqual([
      [41.7, "max", "Claude Code"], [28.9, "max", "Codex"], [20.6, "xhigh", "Qwen Code"], [0, "high", "Antigravity"],
      [15.6, "xhigh", "Grok Build"], [15.6, "max", "Muse Code"],
    ]);
    expect(rows.map((r) => normalizeLabel(r.modelLabel, r.effort))).toMatchObject([
      { ok: true, modelId: "claude-opus-5.5", effort: "max" },
      { ok: true, modelId: "gpt-6.1-sol", effort: "max" },
      { ok: true, modelId: "qwen-3.8-max", effort: "xhigh" },
      { ok: true, modelId: "gemini-4", effort: "high" },
      { ok: true, modelId: "grok-4.7", effort: "xhigh" },
      { ok: true, modelId: "aa-muse-wonder", effort: "max" },
    ]);
    expect(rows.every((r) => r.rank === undefined && r.costUsd === undefined)).toBe(true);
  });

  it("fetches updated scores and newly published models on each scrape, retaining the raw HTML", async () => {
    let html = row("Claude", "Opus 5.5 (Adaptive/Max) [Claude Code]", "41.7");
    const fetched: string[] = [];
    const ctx = { fetchText: async (url: string) => { fetched.push(url); return html; } } as ScrapeContext;
    expect((await source.scrape(ctx)).rows).toHaveLength(1);
    html = row("Claude", "Opus 5.5 (Adaptive/Max) [Claude Code]", "42.2") + row("GLM", "5.3 (Max reasoning) [OpenCode]", "14.4");
    const result = await source.scrape(ctx);
    expect(fetched).toEqual([SUDO_L7_PAGE, SUDO_L7_PAGE]);
    expect(result.rows.map((r) => r.value)).toEqual([42.2, 14.4]);
    expect(result.raw["sudo-l7.html"]).toBe(html);
  });

  it("fails on missing or malformed rows so a failed refresh retains the prior snapshot", () => {
    expect(() => parseSudoL7("<html>Unavailable</html>")).toThrow(/no leaderboard/);
    for (const score of ["", "NaN", "-1", "101", "41.7%"])
      expect(() => parseSudoL7(row("Claude", "Opus 5.5 (Adaptive/Max) [Claude Code]", score))).toThrow(/schema changed/);
    expect(() => parseSudoL7(row("Claude", "Opus 5.5 [Claude Code]", "41.7"))).toThrow(/schema changed/);
  });
});
