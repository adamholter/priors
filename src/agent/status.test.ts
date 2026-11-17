import { describe, expect, it } from "vitest";
import { assistantStatus } from "./status";

describe("assistant status", () => {
  const checks = { openai: async () => 200, anthropic: async () => 401, openrouter: async () => { throw new Error("down"); } };
  const keys = { openai: "sk-openai-secret", anthropic: "sk-ant-secret", openrouter: "sk-or-secret" };
  it("lists Luna on OpenAI then OpenRouter, Claude off, and each provider's answer", async () => {
    const s = await assistantStatus(keys, {}, checks);
    expect(s.routes.map((r) => `${r.provider}:${r.model}`)).toEqual(["openai:gpt-6-luna", "openrouter:openai/gpt-6-luna"]);
    expect(s).toMatchObject({ keys: { openai: 200, anthropic: 401, openrouter: 0 }, claude: false });
  });
  it("never returns a key", async () => {
    const body = JSON.stringify(await assistantStatus(keys, { AGENT_CLAUDE: "on" }, checks));
    for (const k of Object.values(keys)) expect(body).not.toContain(k);
    expect(JSON.parse(body).routes[0]).toEqual({ provider: "anthropic", model: "claude-sonnet-5-5", pool: "premium" });
  });
});
