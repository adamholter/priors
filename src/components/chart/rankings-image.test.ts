import { describe, expect, it } from "vitest";
import { rankingHeightFor, rankingRowsFit, rankingsImageSvg, type RankingImageRow } from "./rankings-image";

const rows: RankingImageRow[] = Array.from({ length: 30 }, (_, i) => ({ rank: i + 1, label: i === 2 ? "A model with a very long name that cannot fit in the name column <b>" : `Model ${i + 1}`, effort: i % 2 ? "high" : undefined, value: (90 - i).toFixed(1), share: (90 - i) / 90, fill: "#2F4FB0" }));
const look = { bg: "#FBFBF9", ink: "#1A1A1A", grey: "#8A8A80", track: "#ECEAE3", sans: "Inter", mono: "JetBrains Mono" };
const names = (svg: string) => [...svg.matchAll(/font-family="Inter"[^>]*>([^<]*)</g)].map((m) => m[1]);

describe("the leaderboard as an image", () => {
  it("holds as many rows as its height, so a taller screenshot shows more models", () => {
    expect(rankingRowsFit(rankingHeightFor(10))).toBe(10);
    expect(rankingRowsFit(rankingHeightFor(10) - 1)).toBe(9);
    expect(rankingRowsFit(40)).toBe(1);
    expect(names(rankingsImageSvg(rows, { ...look, width: 800, height: rankingHeightFor(10) }))).toHaveLength(10);
    expect(names(rankingsImageSvg(rows, { ...look, width: 800, height: rankingHeightFor(25) }))).toHaveLength(25);
    expect(names(rankingsImageSvg(rows, { ...look, width: 800, height: 2000 }))).toHaveLength(30);
  });
  it("is exactly the size asked for, and bigger labels mean fewer rows", () => {
    const svg = rankingsImageSvg(rows, { ...look, width: 640, height: 300, scale: 1.5 });
    expect(svg).toMatch(/^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg" width="640" height="300"/);
    expect(names(svg)).toHaveLength(rankingRowsFit(300, 1.5));
    expect(rankingRowsFit(300, 1.5)).toBeLessThan(rankingRowsFit(300));
  });
  it("cuts a name that would run into the bars, and escapes it", () => {
    const long = names(rankingsImageSvg(rows, { ...look, width: 480, height: 400 }))[2];
    expect(long.endsWith("…")).toBe(true);
    expect(long.length).toBeLessThan(30);
    expect(rankingsImageSvg(rows, { ...look, width: 2400, height: 400, scale: 0.75 })).not.toContain("<b>");
  });
  it("draws each bar inside its track", () => {
    const svg = rankingsImageSvg([{ ...rows[0], share: 1.4 }, { ...rows[1], share: -1 }], { ...look, width: 800, height: 100 });
    const widths = [...svg.matchAll(/<rect x="([\d.]+)" y="[\d.]+" width="([\d.]+)" height="12" rx="2" fill="(#[0-9A-F]+)"/gi)].map((m) => [m[3], Number(m[2])] as const);
    const track = widths.find(([c]) => c === "#ECEAE3")![1];
    expect(widths.filter(([c]) => c === "#2F4FB0").map(([, w]) => w)).toEqual([track, 0]);
  });
});
