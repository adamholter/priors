import { describe, expect, it } from "vitest";
import type Anthropic from "@anthropic-ai/sdk";
import { loadSnapshot } from "../data/load";
import { aaIndexMix } from "../onboarding/defaults";
import { agentRoutes, runAgent, type AgentEvent, type Budget } from "./agent";
import { anthropicUsd, envKeys, fromAnthropic, ModelError, openaiUsd, toAnthropic, worstCase, type CallModel, type Msg, type Route } from "./providers";

describe("assistant routes", () => {
  it("defaults to GPT-6 Luna on OpenAI, then OpenRouter; Claude only when turned on, never by default", () => {
    const all = { anthropic: "a", openai: "o", openrouter: "r" };
    expect(agentRoutes(all).map((r) => `${r.provider}:${r.model}`)).toEqual(["openai:gpt-6-luna", "openrouter:openai/gpt-6-luna"]);
    expect(agentRoutes(all, { AGENT_CLAUDE: "on" }).map((r) => `${r.provider}:${r.pool}`)).toEqual(["anthropic:premium", "openai:base", "openrouter:base"]);
    expect(agentRoutes({ anthropic: "a" })).toEqual([]);
    expect(agentRoutes({ openrouter: "r" }).map((r) => r.provider)).toEqual(["openrouter"]);
  });
  it("reads keys by name and trims them, without ever needing their values elsewhere", () => {
    expect(envKeys({ OPENAI_API_KEY: " sk-x\n", OPENROUTER_API_KEY: "", ANTHROPIC_API_KEY: undefined })).toEqual({ openai: "sk-x" });
  });
});

describe("pricing", () => {
  it("prices Claude's fresh input, cache writes, cache reads and output at their own rates", () => {
    expect(anthropicUsd("claude-sonnet-5-5", { input_tokens: 1e6, cache_creation_input_tokens: 1e6, cache_read_input_tokens: 1e6, output_tokens: 1e6 })).toBeCloseTo(2 + 2.5 + 0.1 + 10, 9);
    expect(openaiUsd("gpt-6-luna", { prompt_tokens: 2e6, completion_tokens: 1e6, prompt_tokens_details: { cached_tokens: 1e6 } })).toBeCloseTo(0.1 + 0.01 + 0.5, 9);
    expect(worstCase("claude-sonnet-5-5", 3e6, 1000)).toBeCloseTo((1e6 * 2 + 1000 * 10) / 1e6, 9);
  });
});

describe("Claude's message shape", () => {
  const messages: Msg[] = [
    { role: "system", content: "rules" }, { role: "system", content: "state" }, { role: "user", content: "hi" },
    { role: "assistant", content: "Looking.", tool_calls: [{ id: "t1", type: "function", function: { name: "get_mix", arguments: "{}" } }, { id: "t2", type: "function", function: { name: "query_data", arguments: "{\"top\":5}" } }] },
    { role: "tool", tool_call_id: "t1", content: "{\"a\":1}" }, { role: "tool", tool_call_id: "t2", content: "{\"b\":2}" },
  ];
  it("sends system turns as the system prompt and every tool result of a turn in one user message", () => {
    const out = toAnthropic(messages, [{ name: "get_mix", description: "d", parameters: { type: "object", properties: {} } }]);
    expect(out.system.map((b) => b.text)).toEqual(["rules", "state"]);
    expect(out.messages.map((m) => m.role)).toEqual(["user", "assistant", "user"]);
    expect(out.messages[1].content).toEqual([{ type: "text", text: "Looking." }, { type: "tool_use", id: "t1", name: "get_mix", input: {} }, { type: "tool_use", id: "t2", name: "query_data", input: { top: 5 } }]);
    expect((out.messages[2].content as Anthropic.ToolResultBlockParam[]).map((b) => b.tool_use_id)).toEqual(["t1", "t2"]);
    expect(out.tools[0]).toEqual({ name: "get_mix", description: "d", input_schema: { type: "object", properties: {} } });
  });
  it("keeps Claude's own blocks, thinking included, and sends them back unchanged", () => {
    const raw = [{ type: "thinking", thinking: "", signature: "sig" }, { type: "text", text: "Sure.", citations: null }, { type: "tool_use", id: "u1", name: "get_mix", input: {}, caller: undefined }] as unknown as Anthropic.ContentBlock[];
    const reply = fromAnthropic(raw);
    expect(reply).toMatchObject({ content: "Sure.", tool_calls: [{ id: "u1", function: { name: "get_mix", arguments: "{}" } }] });
    const back = toAnthropic([{ role: "user", content: "x" }, { role: "assistant", content: reply.content, tool_calls: reply.tool_calls, raw: reply.raw }, { role: "tool", tool_call_id: "u1", content: "{}" }], []);
    expect(back.messages[1].content).toBe(raw);
  });
});

describe("falling back between routes", async () => {
  const snapshot = (await loadSnapshot())!, config = aaIndexMix(snapshot);
  const claude: Route = { provider: "anthropic", model: "claude-sonnet-5-5", effort: "medium", pool: "premium" };
  const luna: Route = { provider: "openai", model: "gpt-6-luna", effort: "low", pool: "base" };
  const backup: Route = { provider: "openrouter", model: "openai/gpt-6-luna", effort: "low", pool: "base" };
  const run = async (routes: Route[], answer: (route: Route, n: number) => Awaited<ReturnType<CallModel>>, caps: Record<string, number> = { base: 1, premium: 1 }) => {
    const calls: string[] = [], settled: Record<string, number> = { base: 0, premium: 0 }, events: AgentEvent[] = [];
    const budget: Budget = {
      reserve: async (est, pool) => { if (caps[pool] < est) return false; caps[pool] -= est; return true; },
      settle: async (est, actual, pool) => { caps[pool] += est - actual; settled[pool] += actual; },
    };
    let n = 0;
    const call: CallModel = async (route) => { calls.push(route.provider); return answer(route, n++); };
    await runAgent({ snapshot, config, history: [{ role: "user", content: "What leads?" }], routes, call, budget, emit: (e) => events.push(e) });
    return { calls, settled, done: events.find((e) => e.type === "done"), error: events.find((e) => e.type === "error") };
  };
  const plainAnswer = { content: "Fable leads.", usd: 0.001 };

  it("answers on the first route and spends only its pool", async () => {
    const r = await run([luna, backup], () => plainAnswer);
    expect(r.calls).toEqual(["openai"]);
    expect(r.done).toMatchObject({ reply: "Fable leads." });
    expect(r.settled).toEqual({ base: 0.001, premium: 0 });
  });
  it("moves to the next route when a provider fails, billing a refused call nothing and an unexplained one its whole reservation", async () => {
    const r = await run([luna, backup], (route) => { if (route.provider === "openai") throw new ModelError("no credits", 0); return plainAnswer; });
    expect(r.calls).toEqual(["openai", "openrouter"]);
    expect(r.done).toMatchObject({ reply: "Fable leads." });
    expect(r.settled.base).toBeCloseTo(0.001, 9);
    // A timeout or dropped connection may still have billed: the pool keeps the worst case, so the cap can't be slipped past.
    const unknown = await run([claude, luna], (route) => { if (route.provider === "anthropic") throw new ModelError("timeout"); return plainAnswer; });
    expect(unknown.calls).toEqual(["anthropic", "openai"]);
    expect(unknown.settled.premium).toBeGreaterThan(0.1);
  });
  it("moves on when a model refuses, and when a pool is spent", async () => {
    const refused = await run([claude, luna], (route) => (route.provider === "anthropic" ? { content: null, usd: 0.002, refused: true } : plainAnswer));
    expect(refused.calls).toEqual(["anthropic", "openai"]);
    expect(refused.settled.premium).toBeCloseTo(0.002, 9);
    const spent = await run([claude, luna], () => plainAnswer, { base: 1, premium: 0 });
    expect(spent.calls).toEqual(["openai"]);
  });
  it("keeps the rest of the request on the route it moved to, carrying tool results across", async () => {
    const r = await run([claude, luna], (route, n) => {
      if (route.provider === "anthropic" && n === 0) return { content: null, tool_calls: [{ id: "c1", type: "function", function: { name: "get_mix", arguments: "{}" } }], raw: [], usd: 0.01 };
      if (route.provider === "anthropic") throw new ModelError("overloaded");
      return plainAnswer;
    });
    expect(r.calls).toEqual(["anthropic", "anthropic", "openai"]);
    expect(r.done).toMatchObject({ reply: "Fable leads." });
  });
  it("says so when every route is out", async () => {
    const r = await run([luna], () => { throw new ModelError("down"); });
    expect(r.error).toMatchObject({ message: expect.stringMatching(/couldn't reach/) });
    const capped = await run([luna], () => plainAnswer, { base: 0, premium: 0 });
    expect(capped.error).toMatchObject({ message: expect.stringMatching(/usage limit/) });
  });
});
