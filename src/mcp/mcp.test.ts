import { describe, expect, it } from "vitest";
import { handle } from "./protocol";
import { TOOLS, callTool } from "./tools";

const env = { origin: "https://mypriors.com" };
const rpc = (method: string, params?: Record<string, unknown>) => handle({ jsonrpc: "2.0", id: 1, method, params }, env);

describe("MCP server", () => {
  it("initializes, echoing a protocol version it supports", async () => {
    const r = await rpc("initialize", { protocolVersion: "2025-06-18" });
    expect(r?.result).toMatchObject({ protocolVersion: "2025-06-18", serverInfo: { name: "priors" }, capabilities: { tools: {} } });
    expect((await rpc("initialize", { protocolVersion: "1999-01-01" }))?.result).toMatchObject({ protocolVersion: "2025-03-26" });
  });
  it("answers notifications with nothing and unknown methods with an error", async () => {
    expect(await handle({ jsonrpc: "2.0", method: "notifications/initialized" }, env)).toBeNull();
    expect((await rpc("nope"))?.error?.code).toBe(-32601);
  });
  it("lists every tool with a schema, and marks the ones that change a page", async () => {
    const { tools } = (await rpc("tools/list"))!.result as { tools: { name: string; inputSchema: { type: string; properties: Record<string, unknown> }; annotations: { readOnlyHint: boolean } }[] };
    expect(tools.length).toBe(TOOLS.length);
    expect(new Set(tools.map((t) => t.name)).size).toBe(tools.length);
    for (const t of tools) expect(t.inputSchema.type).toBe("object");
    const write = TOOLS.filter((t) => t.write).map((t) => t.name);
    expect(write).toEqual(expect.arrayContaining(["whoami", "update_page", "upsert_index", "delete_index", "upsert_section", "remove_section", "set_theme", "import_benchmark"]));
    for (const t of tools) expect(t.annotations.readOnlyHint).toBe(!write.includes(t.name));
    // Every tool that ranks under an index takes one.
    for (const n of ["rank_models", "get_mix", "explain_model", "compare_models", "try_mix", "solve_edit", "fit_ranking", "query_data", "make_chart", "get_model", "index_history", "index_link"]) expect(tools.find((t) => t.name === n)!.inputSchema.properties).toHaveProperty("index");
  });
  it("reports a failing tool as a result the model can read, not a protocol error", async () => {
    const bad = (await rpc("tools/call", { name: "get_benchmark", arguments: { benchmark: "no such benchmark xyz" } }))!;
    expect(bad.error).toBeUndefined();
    expect(bad.result).toMatchObject({ isError: true });
    expect(JSON.stringify(bad.result)).toContain("Unknown benchmark");
    expect(JSON.stringify((await rpc("tools/call", { name: "whoami", arguments: {} }))!.result)).toContain("agent token");
    expect(JSON.stringify((await rpc("tools/call", { name: "nope" }))!.result)).toContain("Unknown tool");
  });
});

describe("tools over the real snapshot", () => {
  it("ranks under the default index, then under a custom one", async () => {
    const a = await callTool("rank_models", { top: 5 }, env);
    expect(a.ok && (a.result as { rows: unknown[] }).rows.length).toBe(5);
    const r = await callTool("rank_models", { top: 3, index: { weights: { simplebench: 1 } } }, env);
    if (!r.ok) throw new Error(r.error);
    const res = r.result as { benchmarks: { id: string; sharePct: number }[]; rows: { score: number; rank: number }[] };
    expect(res.benchmarks).toEqual([{ id: "simplebench", name: "SimpleBench", sharePct: 100 }]);
    expect(res.rows[0].rank).toBe(1);
    expect(res.rows[0].score).toBeGreaterThanOrEqual(res.rows[1].score);
  });
  it("rejects an index with no positive weight", async () => {
    const r = await callTool("rank_models", { index: { weights: { simplebench: 0 } } }, env);
    expect(r.ok).toBe(false);
  });
  it("reads a benchmark's leaderboard best first, and reuses the assistant's tools", async () => {
    const b = await callTool("get_benchmark", { benchmark: "simplebench", limit: 5 }, env);
    if (!b.ok) throw new Error(b.error);
    const rows = (b.result as { rows: { value: number }[] }).rows;
    expect(rows.length).toBe(5);
    expect(rows[0].value).toBeGreaterThanOrEqual(rows[4].value);
    const m = await callTool("try_mix", { weights: { simplebench: 50, "arc-agi-3": 50 } }, env);
    expect(m.ok).toBe(true);
    const c = await callTool("make_chart", { type: "bar", metric: "index", top: 3 }, env);
    expect(c.ok && (c.result as { chartData?: unknown }).chartData).toBeTruthy();
  });
  it("turns an index into links and back", async () => {
    const l = await callTool("index_link", { index: { name: "Mine", weights: { simplebench: 2, "arc-agi-3": 1 } } }, env);
    if (!l.ok) throw new Error(l.error);
    const { builder, encoded } = l.result as { builder: string; encoded: string };
    expect(builder.startsWith("https://mypriors.com/builder?i=")).toBe(true);
    const back = await callTool("decode_index_link", { link: builder }, env);
    if (!back.ok) throw new Error(back.error);
    expect((back.result as { index: { weights: Record<string, number> } }).index.weights).toEqual({ simplebench: 2, "arc-agi-3": 1 });
    expect(encoded).toContain("simplebench:2");
  });
});
