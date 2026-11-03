import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { normalizeLabel } from "../../src/data/normalize";
import { GDPX_ID, parseGdpx, readBoard, readData, readPartners } from "./sources/gdpx";

const chunk = readFileSync(new URL("./fixtures/gdpx-chunk.js", import.meta.url), "utf8");
const html = readFileSync(new URL("./fixtures/gdpx-leaderboard.html", import.meta.url), "utf8");

describe("GDPx", () => {
  it("reads the data module, the partners and the page's leaderboard", () => {
    expect(readData(chunk)?.models).toHaveLength(20);
    expect(readPartners(chunk).get("aria")).toBe("chip-design");
    expect(readPartners(chunk).size).toBe(14);
    expect(readBoard(html).get("Claude Opus 5.5")).toBe(12);
    expect(readBoard(html).size).toBe(13);
  });

  it("computes the headline as the site does, for all 20 models including those the page hides", () => {
    const { rows, tasks } = parseGdpx(chunk, html);
    expect(tasks).toBe(206);
    expect(rows).toHaveLength(20);
    expect(rows[0]).toMatchObject({ benchmarkId: GDPX_ID, modelLabel: "Claude Opus 5.5", effort: "Max", rank: 1, harness: "Claude Code", costUsd: 51.41, outputTokens: 548088 });
    expect(rows[0].value).toBeCloseTo(12, 0);
    expect(rows.map((r) => r.value)).toEqual([...rows.map((r) => r.value)].sort((a, b) => b - a));
    expect(Object.keys(rows[0].details!.domains as object)).toHaveLength(11);
    for (const hidden of ["Kimi K3", "Inkling", "Claude Haiku 5.5", "Muse Spark Open"]) expect(rows.some((r) => r.modelLabel === hidden)).toBe(true);
  });

  it("has no cost for a model with no public price, and no effort for Highest", () => {
    const muse = parseGdpx(chunk, html).rows.find((r) => r.modelLabel === "Muse Wonder Full")!;
    expect(muse.costUsd).toBeUndefined();
    expect(muse.effort).toBeUndefined();
    expect(muse.note).toContain("Reasoning Highest");
  });

  it("every label resolves to a known model, and names that carry words like Max and Flash keep them", () => {
    const ids = new Map(parseGdpx(chunk, html).rows.map((r) => { const n = normalizeLabel(r.modelLabel, r.effort); return [r.modelLabel, n.ok ? `${n.modelId}@${n.effort ?? ""}` : "unknown"]; }));
    expect([...ids.values()]).not.toContain("unknown");
    expect(ids.get("DeepSeek 4.1 Flash 1017")).toBe("deepseek-v4.1-flash-1017@");
    expect(ids.get("Qwen 3.8 Max")).toBe("qwen-3.8-max@");
    expect(ids.get("Muse Spark Open")).toBe("aa-muse-spark-open@");
    expect(ids.get("GPT 6.1 Sol")).toBe("gpt-6.1-sol@max");
    expect(ids.get("Grok 4.7")).toBe("grok-4.7@xhigh");
  });

  it("fails visibly when its score disagrees with the page, or the data moves", () => {
    expect(() => parseGdpx(chunk, html.replace(">12.0<!-- -->%", ">14.0<!-- -->%"))).toThrow(/computed .* the page shows 14/);
    expect(() => parseGdpx(chunk.replace('{"updatedAt"', '{"updated"'), html)).toThrow(/data module/);
    expect(() => parseGdpx(chunk, "<ol></ol>")).toThrow(/leaderboard rows/);
  });
});
