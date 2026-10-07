import { describe, expect, it } from "vitest";
import { normalizeLabel } from "../../../src/data/normalize";
import source, { HSS_ID, HSS_PAGE, parseHssEntries } from "./scale-hss";
import type { ScrapeContext } from "../../../src/data/types";

function page(entries: unknown[]) {
  const payload = `1b:["$","div",null,${JSON.stringify({ entries })}]`;
  // Real pages can split their RSC payload across script chunks.
  const split = Math.floor(payload.length / 2);
  return [payload.slice(0, split), payload.slice(split)]
    .map((chunk) => `<script>self.__next_f.push([1,${JSON.stringify(chunk)}])</script>`).join("");
}

describe("Scale Humanity's Sixth Sense", () => {
  it("preserves pass@1, bootstrap intervals, rank and each published effort", () => {
    const rows = parseHssEntries(page([
      { model: "GPT-6-Astra (max)", score: 53.6, confidenceInterval_upper: 4.1, rank: 1, company: "OpenAI" },
      { model: "GPT-6-Astra (high)", score: 49.2 },
      { model: "Claude-Opus-5.5 (xhigh)", score: 44.6 },
      { model: "Claude-Fable-5.1", score: 40.8 },
      { model: "Qwen3.8-Max (max)", score: 33 },
    ]));
    expect(rows[0]).toMatchObject({ benchmarkId: HSS_ID, modelLabel: "GPT-6-Astra (max)", effort: "max", value: 53.6, rank: 1, sourceUrl: HSS_PAGE });
    expect(rows[0].ci).toEqual([53.6 - 4.1, 53.6 + 4.1]);
    expect(rows.map((r) => normalizeLabel(r.modelLabel, r.effort))).toMatchObject([
      { modelId: "gpt-6-astra", effort: "max" }, { modelId: "gpt-6-astra", effort: "high" },
      { modelId: "claude-opus-5.5", effort: "xhigh" }, { modelId: "claude-fable-5.1" },
      { modelId: "qwen-3.8-max", effort: "max" },
    ]);
    expect(rows[3].effort).toBeUndefined();
    expect(rows[1].ci).toBeUndefined();
    expect(rows.every((r) => r.harness === undefined)).toBe(true);
  });

  it("fetches the page on every run and includes newly added models and changed scores", async () => {
    let html = page([{ model: "GPT-6-Astra (max)", score: 53.6 }]);
    const fetched: string[] = [];
    const ctx = { fetchText: async (url: string) => { fetched.push(url); return html; } } as ScrapeContext;
    expect((await source.scrape(ctx)).rows).toHaveLength(1);
    html = page([{ model: "GPT-6-Astra (max)", score: 54.2 }, { model: "Gemini-3.8-Flash (high)", score: 41.6 }]);
    const result = await source.scrape(ctx);
    expect(fetched).toEqual([HSS_PAGE, HSS_PAGE]);
    expect(result.rows.map((r) => r.value)).toEqual([54.2, 41.6]);
    expect(result.raw["hss.html"]).toBe(html);
  });

  it("excludes deprecated results and the human baseline, but retains zero scores", () => {
    const rows = parseHssEntries(page([
      { model: "Human baseline", score: 93.1 }, { model: "GPT-6-Sol (max)", score: 31.2, deprecated: true },
      { model: "GPT-6-Luna (none)", score: 0 },
    ]));
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ effort: "none", value: 0 });
  });

  it("fails on missing or malformed results so the pipeline retains its previous snapshot", () => {
    expect(() => parseHssEntries("<html>Unavailable</html>")).toThrow(/no leaderboard/);
    expect(() => parseHssEntries(page([]))).toThrow();
    for (const score of [null, "53.6", -1, 101]) {
      expect(() => parseHssEntries(page([{ model: "GPT-6-Astra (max)", score }]))).toThrow(/schema changed/);
    }
    expect(() => parseHssEntries(page([{ model: "GPT-6-Astra (max)", score: 53.6, confidenceInterval_upper: -1 }]))).toThrow(/interval schema/);
  });
});
