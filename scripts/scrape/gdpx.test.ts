import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { normalizeLabel } from "../../src/data/normalize";
import { GDPX_DOMAINS, GDPX_ID, GDPX_PARTIAL_ID, gdpxBenchmarks, gdpxDomainId, parseGdpx, readBoard, readData, readPartners } from "./sources/gdpx";

const chunk = readFileSync(new URL("./fixtures/gdpx-chunk.js", import.meta.url), "utf8");
const html = readFileSync(new URL("./fixtures/gdpx-leaderboard.html", import.meta.url), "utf8");
// The 25 November 2026 release: 29 models, and the leaderboard's name span gained classes ("min-w-0 ... leading-snug").
const chunk2 = readFileSync(new URL("./fixtures/gdpx-chunk-2026-11-25.js", import.meta.url), "utf8");
const html2 = readFileSync(new URL("./fixtures/gdpx-leaderboard-2026-11-25.html", import.meta.url), "utf8");
const headline = <T extends { benchmarkId: string }>(rows: T[]) => rows.filter((r) => r.benchmarkId === GDPX_ID);

describe("GDPx", () => {
  it("reads the data module, the partners and the page's leaderboard", () => {
    expect(readData(chunk)?.models).toHaveLength(20);
    expect(readPartners(chunk).get("aria")).toBe("chip-design");
    expect(readPartners(chunk).size).toBe(14);
    expect(readBoard(html).get("Claude Opus 5.5")).toBe(12);
    expect(readBoard(html).size).toBe(13);
  });

  it("computes the headline as the site does, for all 20 models including those the page hides", () => {
    const { rows: all, tasks } = parseGdpx(chunk, html), rows = headline(all);
    expect(tasks).toBe(206);
    expect(rows).toHaveLength(20);
    expect(rows[0]).toMatchObject({ benchmarkId: GDPX_ID, modelLabel: "Claude Opus 5.5", effort: "Max", rank: 1, harness: "Claude Code", costUsd: 51.41, outputTokens: 548088 });
    expect(rows[0].value).toBeCloseTo(12, 0);
    expect(rows.map((r) => r.value)).toEqual([...rows.map((r) => r.value)].sort((a, b) => b - a));
    expect(Object.keys(rows[0].details!.domains as object)).toHaveLength(11);
    for (const hidden of ["Kimi K3", "Inkling", "Claude Haiku 5.5", "Muse Spark Open"]) expect(rows.some((r) => r.modelLabel === hidden)).toBe(true);
  });

  it("has no cost for a model with no public price, and no effort for Highest", () => {
    const muse = headline(parseGdpx(chunk, html).rows).find((r) => r.modelLabel === "Muse Wonder Full")!;
    expect(muse.costUsd).toBeUndefined();
    expect(muse.effort).toBeUndefined();
    expect(muse.note).toContain("Reasoning Highest");
  });

  it("every label resolves to a known model, and names that carry words like Max and Flash keep them", () => {
    const ids = new Map(headline(parseGdpx(chunk, html).rows).map((r) => { const n = normalizeLabel(r.modelLabel, r.effort); return [r.modelLabel, n.ok ? `${n.modelId}@${n.effort ?? ""}` : "unknown"]; }));
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

  it("reads the release with the new leaderboard markup and every model in it", () => {
    expect(readBoard(html2).get("Claude Opus 5.5")).toBe(11.9);
    const { rows, updated } = parseGdpx(chunk2, html2), top = headline(rows);
    expect(updated).toBe("2026-11-25");
    expect(top).toHaveLength(26);
    // Cybersecurity specialists ran that domain only: on its view, never on the headline.
    expect(top.some((r) => r.modelLabel === "HO1")).toBe(false);
    expect(rows.filter((r) => r.modelLabel === "HO1").map((r) => r.benchmarkId)).toEqual([gdpxDomainId("cybersecurity")]);
    // Abliterated weights are not the provider's model, and their names would land on it.
    expect(rows.some((r) => /Abliterated/.test(r.modelLabel))).toBe(false);
    expect(top[0]).toMatchObject({ modelLabel: "GPT 6.2 Astra", rank: 1 });
    expect(top[0].value).toBeCloseTo(19.26, 2);
  });

  it("offers partial credit and each domain as views of GDPx, one row per model in each", () => {
    const { rows } = parseGdpx(chunk2, html2), n = headline(rows).length;
    const views = gdpxBenchmarks("gdpx", "2026-11-25", 206);
    expect(views.filter((b) => b.variantOf === GDPX_ID)).toHaveLength(1 + Object.keys(GDPX_DOMAINS).length);
    expect(views.every((b) => b.id === GDPX_ID || (b.variantOf === GDPX_ID && b.variantLabel && b.eligibleForDefault === false))).toBe(true);
    for (const b of views) expect(rows.filter((r) => r.benchmarkId === b.id && r.modelLabel !== "HO1"), b.id).toHaveLength(n);
    const astra = (id: string) => rows.find((r) => r.benchmarkId === id && r.modelLabel === "GPT 6.2 Astra")!;
    expect(astra(GDPX_PARTIAL_ID).value).toBeCloseTo((astra(GDPX_ID).details as { partial: number }).partial, 1);
    // The headline is the mean of the domains, so the views add back up to it.
    const domains = Object.keys(GDPX_DOMAINS).map((d) => astra(gdpxDomainId(d)).value);
    expect(domains.reduce((a, b) => a + b, 0) / domains.length).toBeCloseTo(astra(GDPX_ID).value, 1);
  });

  it("fails visibly on a domain it has no name for", () => {
    expect(() => parseGdpx(chunk2.replace(/"aria","Aria","chip-design"/, '"aria","Aria","space-law"'), html2)).toThrow(/domain space-law/);
  });
});
