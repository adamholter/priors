import { describe, expect, it } from "vitest";
import { parsePersonality } from "./sources/aa-personality";

const idx = { expressiveness: 88, organization: 77, informativeness: 91, transparency: 88, warmth: 80, conviction: 74, imagination: 94, slop: 21.4 };
const iv = Object.fromEntries(Object.entries(idx).map(([k, v]) => [k, { lower: v - 2, upper: v + 2 }]));
const record = `{"id":"f0aa413f-e8ae-4fcd-9c48-0e049f4f3128","slug":"claude-opus-5-5","name":"Claude Opus 5.5 (Max)","shortName":"Opus","creator":{"id":"x","slug":"anthropic","name":"Anthropic"},"isReasoning":true,"judged":{"scores":{"slop":1069.39},"cis":{"slop":{"lower":1036,"upper":1101}},"indexScores":${JSON.stringify(idx)},"indexIntervals":${JSON.stringify(iv)}},"means":{"wordCount":570}}`;
const rsc = `a:["$",{"models":[${record}]}]`;

describe("AA-PersonalityBench", () => {
  it("emits one row per index with intervals, and keeps the slop trait and characteristics in details", () => {
    const r = parsePersonality(rsc);
    expect(r.benchmarks).toHaveLength(8);
    expect(r.rows).toHaveLength(8);
    const slop = r.rows.find((x) => x.benchmarkId === "aa-personality-slop")!;
    expect(slop).toMatchObject({ value: 21.4, effort: "max", ci: [19.4, 23.4] });
    expect(slop.details).toMatchObject({ traitElo: { slop: 1069.39 }, characteristics: { wordCount: 570 } });
    expect(r.benchmarks.find((b) => b.id === "aa-personality-slop")!.higherIsBetter).toBe(false);
  });
  it("fails loudly when the payload carries no model records", () => {
    expect(() => parsePersonality("nothing here")).toThrow(/no model records/);
  });
});
