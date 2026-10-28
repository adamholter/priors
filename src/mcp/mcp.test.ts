import { describe, expect, it } from "vitest";
import { handle } from "./protocol";
import { TOOLS, callTool } from "./tools";
import { decodeSpec } from "@/lib/answer-chart";
import { chartFromLink } from "@/agent/link-chart";

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
    if (!c.ok) throw new Error(c.error);
    // An MCP client cannot place [[chart:N]]: it gets a PNG and a live link instead.
    const chart = c.result as { chartData?: unknown; image: string; link: string; use?: string };
    expect(chart.chartData).toBeTruthy();
    expect(chart.image).toMatch(/^https:\/\/mypriors\.com\/og\?i=.+&chart=/);
    expect(chart.link).toMatch(/^https:\/\/mypriors\.com\/\?i=/);
    expect(JSON.stringify(chart)).not.toContain("[[chart:");
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

/** A fresh agent asked for a time-vs-score Pareto got a different model set from each tool and no reasons for who was missing. */
describe("one ranking, explained", () => {
  const ok = async (name: string, args: object) => { const r = await callTool(name, args, env); if (!r.ok) throw new Error(`${name}: ${r.error}`); return r.result as Record<string, any>; }; // eslint-disable-line @typescript-eslint/no-explicit-any
  it("query_data ranks exactly the models rank_models does, in the same order", async () => {
    const r = await ok("rank_models", { top: 200 }), q = await ok("query_data", { metrics: ["index"], top: 200 });
    expect(q.rows.map((x: { model: string }) => x.model)).toEqual(r.rows.map((x: { model: string }) => x.model));
    expect(r.returned).toBe(r.rows.length);
  });
  it("says what decides who is ranked, and why a model is not", async () => {
    const r = await ok("rank_models", { top: 5 });
    expect(r.settings).toMatchObject({ strictness: 50, costBasis: expect.any(String), releasedAfter: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/) });
    expect(r.excluded).toMatchObject({ count: expect.any(Number), models: expect.any(Array) });
    const older = r.settings.olderVersionsHidden?.[0];
    if (older) {
      expect((await ok("get_model", { model: older })).status).toMatch(/older version/);
      // ...and query_data still gives its score, with no rank and a note saying why.
      const q = await ok("query_data", { metrics: ["index"], models: [older] });
      expect(q.rows[0].rank).toBeNull();
      expect(q.rows[0]["Index score"]).toEqual(expect.any(Number));
      expect(q.note).toMatch(/older versions/);
    }
    const top = r.rows[0].model;
    expect((await ok("get_model", { model: top })).status).toMatch(/^Ranked #1 /);
  });
  it("pareto_frontier matches the site's chart: non-dominated points, every effort, and the chart image", async () => {
    const p = await ok("pareto_frontier", { x: "time" });
    expect(p.x.better).toBe("lower");
    expect(p.efforts).toBe("all");
    expect(p.frontier.length).toBeGreaterThan(1);
    for (const f of p.frontier) expect(p.points.some((q: { model: string; effort: string; onFrontier: boolean }) => q.model === f.model && q.effort === f.effort && q.onFrontier)).toBe(true);
    // Nothing beats a frontier point on both axes.
    for (const f of p.frontier) expect(p.points.some((q: { x: number; score: number }) => q.x < f.x && q.score > f.score)).toBe(false);
    expect(p.image).toMatch(/^https:\/\/mypriors\.com\/og\?i=.+&c=time-per-task/);
    const best = await ok("pareto_frontier", { x: "cost", efforts: "best" });
    expect(new Set(best.points.map((q: { model: string }) => q.model)).size).toBe(best.points.length);
  });
  it("a make_chart link redraws in the view it was drawn in; the in-app assistant keeps older versions", async () => {
    const r = await ok("rank_models", { top: 1 }), older: string | undefined = r.settings.olderVersionsHidden?.[0];
    if (!older) return;
    const c = await ok("make_chart", { type: "bar", metric: "index", models: [older, r.rows[0].model] });
    const q = new URL(c.image).searchParams;
    expect(decodeSpec(q.get("chart")!)).toMatchObject({ view: "page" });
    const redrawn = await chartFromLink(q.get("i")!, q.get("chart")!);
    expect("chart" in redrawn && redrawn.chart.kind === "bar" && redrawn.chart.items.map((i) => i.label)).toEqual(c.chartData.items.map((i: { label: string }) => i.label));
    const top = await ok("query_data", { metrics: ["index"], top: 200 });
    expect(top.rows.some((x: { model: string }) => x.model === older)).toBe(false);
  });
  it("default_index explains itself, and its whole result works as an index", async () => {
    const d = await ok("default_index", {});
    expect(d.index.weights).toBeTruthy();
    expect(d.settings.rule).toMatch(/measured results covering at least 50%/);
    expect((await ok("rank_models", { index: d, top: 1 })).index.name).toBe(d.index.name);
  });
});
