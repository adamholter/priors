import { describe, expect, it } from "vitest";
import { parseDeepFinance } from "./sources/julius-deepfinance";

/** Wraps flight text the way Next.js inlines it, so the test goes through the same RSC decoding as the scrape. */
const page = (flight: string) => `<html><script>self.__next_f.push([1,${JSON.stringify(flight)}])</script></html>`;
const stats = `["$","div","tasks",{"className":"x","children":[["$","dt",null,{"children":"tasks"}],["$","dd",null,{"className":"y","children":"21"}]]}],["$","div","average human time",{"className":"x","children":[["$","dt",null,{"children":"average human time"}],["$","dd",null,{"className":"y","children":"27.1 hours per task"}]]}],["$","div","rubric criteria per task",{"className":"x","children":[["$","dt",null,{"children":"rubric criteria per task"}],["$","dd",null,{"className":"y","children":"84"}]]}]`;
const caption = `["$","figcaption",null,{"children":["Mean rubric score by model configuration on DeepFinance (",21," tasks, ",10," attempts per task)."]}]`;
const updated = `["$","span",null,{"children":["Updated ",["$","time",null,{"dateTime":"2026-11-05","children":"Nov 5, 2026"}]]}]`;
const results = `["$","$L1a",null,{"results":[{"rank":1,"model":"Claude Opus 5.5","lab":"anthropic","reasoning":"max","score":54.8,"ciLow":46.2,"ciHigh":64.4,"ci":9.1,"attempts":210,"costPerTask":8.6307,"tokensPerTask":10494721},{"rank":4,"model":"GPT-6.1 Sol","lab":"openai","reasoning":"xhigh","score":52.9,"ciLow":45.4,"ciHigh":61,"ci":7.8,"attempts":210,"costPerTask":0.8113,"tokensPerTask":1904823},{"rank":9,"model":"Broken"}]}]`;

describe("DeepFinance parser", () => {
  it("reads the RSC results: score, CI, effort, cost per task and tokens", () => {
    const r = parseDeepFinance(page(`${stats}${caption}${updated}${results}`));
    expect(r.rows).toHaveLength(2);
    expect(r.rows[0]).toMatchObject({ modelLabel: "Claude Opus 5.5", effort: "max", value: 54.8, ci: [46.2, 64.4], costUsd: 8.6307, labHint: "anthropic", rank: 1 });
    expect(r.rows[1]).toMatchObject({ modelLabel: "GPT-6.1 Sol", effort: "xhigh", value: 52.9, costUsd: 0.8113 });
    expect(r.rows[0].details).toMatchObject({ attempts: 210, tokensPerTask: 10494721 });
    expect(r.rows[0].outputTokens, "total tokens are not output tokens").toBeUndefined();
    expect(r.benchmarks[0]).toMatchObject({ id: "julius-deepfinance", unit: "percent", defaultWeight: 0, lastUpdated: "2026-11-05" });
    expect(r.benchmarks[0].description).toMatch(/21 tasks that take a professional about 27\.1 hours each, scored against 84 rubric criteria per task, 10 attempts/);
  });
  it("fails visibly when the payload shape changes", () => {
    expect(() => parseDeepFinance(page(`${stats}`))).toThrow(/results array not found/);
    expect(() => parseDeepFinance(page(`"results":[{"model":"A"}]`))).toThrow(/no usable rows/);
  });
});
