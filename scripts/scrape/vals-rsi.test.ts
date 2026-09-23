import { describe, expect, it } from "vitest";
import { parseRsiData } from "./sources/vals-rsi";

const dataJs = `const e={benchmark:"Vals RSI Index",slug:"rsi_index",description:"Autonomous model development research.",version:"1.1",updated:"2026-09-21",total_models:2,models:["anthropic/claude-opus-5-5","openai/gpt-6-luna"],tasks:{overall:"Overall",compression:"Pre-training: Compression"}},t={overall:{"anthropic/claude-opus-5-5":{accuracy:37.13,latency:367200,cost_per_test:4,provider:"Anthropic"},"openai/gpt-6-luna":{accuracy:0,latency:367200,cost_per_test:0,provider:"OpenAI"}},compression:{"anthropic/claude-opus-5-5":{accuracy:46.49,latency:86400,stderr:0},"openai/gpt-6-luna":{accuracy:0,latency:86400,stderr:0}}},r={metadata:e,tasks:t};export{r as b};`;
const catalogJs = `const p={"anthropic/claude-opus-5-5":{company:"Anthropic",label:"Claude Opus 5.5",release_date:"2026-09-21"},"openai/gpt-6-luna":{company:"OpenAI",label:"GPT-6 Luna",release_date:"2026-09-22"}};export{p as r};`;
const pageHtml = "<p>Updated 9/21/2026</p>";

describe("Vals RSI Index parser", () => {
  it("emits all task metrics, exact labels, source IDs, ranks, and the publisher update date", () => {
    const result = parseRsiData(dataJs, catalogJs, pageHtml);
    expect(result.benchmarks.map((b) => b.id)).toEqual(["vals-rsi-index-v1.1", "vals-rsi-index-v1.1-compression"]);
    expect(result.benchmarks.every((b) => b.lastUpdated === "2026-09-21")).toBe(true);
    expect(result.rows).toHaveLength(4);
    expect(result.rows[0]).toMatchObject({ modelLabel: "Claude Opus 5.5", sourceModelId: "anthropic/claude-opus-5-5", value: 37.13, rank: 1, labHint: "Anthropic" });
    expect(result.rows[1]).toMatchObject({ modelLabel: "GPT-6 Luna", sourceModelId: "openai/gpt-6-luna", value: 0, rank: 2 });
    expect(result.rows[2].details).toMatchObject({ taskKey: "compression", taskLabel: "Pre-training: Compression", latency: 86400 });
    expect(result.rows.every((row) => row.sourceUrl === "https://www.vals.ai/benchmarks/rsi_index")).toBe(true);
    expect(result.benchmarks[0]).toMatchObject({ unit: "percent", category: "composite", defaultWeight: 0, eligibleForDefault: false });
  });
  it("rejects page/data date drift, unknown model IDs, invalid scores, and stale date formats", () => {
    expect(() => parseRsiData(dataJs, catalogJs, "<p>Updated 9/20/2026</p>")).toThrow(/dates differ/);
    expect(() => parseRsiData(dataJs.replace("openai/gpt-6-luna", "openai/future"), catalogJs, pageHtml)).toThrow(/uncatalogued model/);
    expect(() => parseRsiData(dataJs.replace("accuracy:37.13", "accuracy:137"), catalogJs, pageHtml)).toThrow(/invalid score/);
    expect(() => parseRsiData(dataJs.replace("updated:\"2026-09-21\"", "updated:\"yesterday\""), catalogJs, pageHtml)).toThrow(/update date/);
  });
  it("reads JS booleans as data without executing the module", () => {
    const compact = dataJs.replace("total_models:2", "total_models:2,visible:!1");
    expect(parseRsiData(compact, catalogJs, pageHtml).rows).toHaveLength(4);
  });
});

