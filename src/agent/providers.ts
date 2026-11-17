/**
 * Where the assistant's model calls go (server only). Three providers: Anthropic directly (Claude Sonnet 5.5, billed to the API credit that
 * comes with Adam's Claude plan), OpenAI directly (GPT-6 Luna, billed to the Codex plan's API credit) and OpenRouter (the old route, kept
 * as the last fallback and for the eval). The loop keeps its conversation in OpenAI's chat shape; the Anthropic call converts it on the way
 * in and keeps Claude's own content blocks (`raw`) on the assistant turn, so thinking blocks go back unchanged on the next call.
 */
import Anthropic from "@anthropic-ai/sdk";

export type Provider = "anthropic" | "openai" | "openrouter";
export type Effort = "low" | "medium" | "high";
/** One way to run the loop. `pool` is the daily budget it spends from: "premium" (the Claude credit) or "base". */
export type Route = { provider: Provider; model: string; effort: Effort; pool: "premium" | "base" };
export type Keys = Partial<Record<Provider, string>>;

export type ToolCall = { id: string; type: "function"; function: { name: string; arguments: string } };
export type Msg = { role: "system" | "user" | "assistant" | "tool"; content: string | null; tool_calls?: ToolCall[]; tool_call_id?: string; raw?: Anthropic.ContentBlock[] };
export type ToolSpec = { readonly name: string; readonly description: string; readonly parameters: object };
export type ModelReply = { content: string | null; tool_calls?: ToolCall[]; raw?: Anthropic.ContentBlock[]; usd: number; refused?: boolean };
export type CallModel = (route: Route, req: { messages: Msg[]; tools: readonly ToolSpec[]; maxTokens: number; signal?: AbortSignal; referer?: string }) => Promise<ModelReply>;

/** USD per million tokens. `cached` is a cache read, `write` a cache write. Unknown models are priced as the dearest. */
const PRICES: Record<string, { input: number; output: number; cached: number; write: number }> = {
  "gpt-6-luna": { input: 0.1, output: 0.5, cached: 0.01, write: 0.1 },
  "openai/gpt-6-luna": { input: 0.1, output: 0.5, cached: 0.01, write: 0.1 },
  "claude-sonnet-5-5": { input: 2, output: 10, cached: 0.1, write: 2.5 },
  "anthropic/claude-sonnet-5.5": { input: 2, output: 10, cached: 0.1, write: 2.5 },
  "claude-opus-5-5": { input: 4, output: 20, cached: 0.2, write: 5 },
  "anthropic/claude-haiku-5.5": { input: 0.1, output: 0.5, cached: 0.01, write: 0.125 },
  "openai/gpt-6-sol": { input: 2, output: 10, cached: 0.1, write: 2 },
};
export const priceOf = (model: string) => PRICES[model] ?? { input: 5, output: 25, cached: 0.5, write: 6.25 };
/** The most a call can cost: the whole prompt uncached (about 3 characters a token) plus a full answer. Reserved before the call. */
export const worstCase = (model: string, promptChars: number, maxTokens: number) => { const p = priceOf(model); return ((promptChars / 3) * p.input + maxTokens * p.output) / 1e6; };

/** The conversation as Claude's Messages API takes it: system turns as the system prompt, tool results grouped into one user turn. */
export function toAnthropic(messages: Msg[], tools: readonly ToolSpec[]): { system: Anthropic.TextBlockParam[]; messages: Anthropic.MessageParam[]; tools: Anthropic.Tool[] } {
  const system: Anthropic.TextBlockParam[] = messages.filter((m) => m.role === "system").map((m) => ({ type: "text", text: m.content ?? "" }));
  const out: Anthropic.MessageParam[] = [];
  for (const m of messages) {
    if (m.role === "system") continue;
    if (m.role === "user") out.push({ role: "user", content: m.content ?? "" });
    else if (m.role === "assistant") {
      // Claude's own turn goes back exactly as it came (thinking blocks included); another model's turn becomes text and tool_use blocks.
      if (m.raw) { out.push({ role: "assistant", content: m.raw as Anthropic.ContentBlockParam[] }); continue; }
      const blocks: Anthropic.ContentBlockParam[] = [];
      if (m.content) blocks.push({ type: "text", text: m.content });
      for (const c of m.tool_calls ?? []) blocks.push({ type: "tool_use", id: c.id, name: c.function.name, input: parseArgs(c.function.arguments) });
      out.push({ role: "assistant", content: blocks.length ? blocks : "" });
    } else {
      const result: Anthropic.ToolResultBlockParam = { type: "tool_result", tool_use_id: m.tool_call_id ?? "", content: m.content ?? "" };
      const last = out[out.length - 1];
      // Every result for one assistant turn in a single user message.
      if (last?.role === "user" && Array.isArray(last.content) && last.content.every((b) => b.type === "tool_result")) last.content.push(result);
      else out.push({ role: "user", content: [result] });
    }
  }
  return { system, messages: out, tools: tools.map((t) => ({ name: t.name, description: t.description, input_schema: t.parameters as unknown as Anthropic.Tool.InputSchema })) };
}

/** Claude's reply in the loop's shape, with its blocks kept for the next call. */
export function fromAnthropic(content: Anthropic.ContentBlock[]): Pick<ModelReply, "content" | "tool_calls" | "raw"> {
  const text = content.flatMap((b) => (b.type === "text" ? [b.text] : [])).join("\n").trim();
  const calls: ToolCall[] = content.flatMap((b) => (b.type === "tool_use" ? [{ id: b.id, type: "function" as const, function: { name: b.name, arguments: JSON.stringify(b.input ?? {}) } }] : []));
  return { content: text || null, ...(calls.length ? { tool_calls: calls } : {}), raw: content };
}

const parseArgs = (s: string): Record<string, unknown> => { try { const v = JSON.parse(s || "{}"); return v && typeof v === "object" ? v : {}; } catch { return {}; } };

/** Claude's usage in dollars: fresh input, cache writes and cache reads at their own rates. */
export function anthropicUsd(model: string, u: { input_tokens?: number | null; output_tokens?: number | null; cache_creation_input_tokens?: number | null; cache_read_input_tokens?: number | null }) {
  const p = priceOf(model);
  return ((u.input_tokens ?? 0) * p.input + (u.cache_creation_input_tokens ?? 0) * p.write + (u.cache_read_input_tokens ?? 0) * p.cached + (u.output_tokens ?? 0) * p.output) / 1e6;
}

/** OpenAI's usage in dollars; `cached_tokens` are part of `prompt_tokens`. */
export function openaiUsd(model: string, u: { prompt_tokens?: number; completion_tokens?: number; prompt_tokens_details?: { cached_tokens?: number } }) {
  const p = priceOf(model), cached = u.prompt_tokens_details?.cached_tokens ?? 0;
  return ((Math.max(0, (u.prompt_tokens ?? 0) - cached)) * p.input + cached * p.cached + (u.completion_tokens ?? 0) * p.output) / 1e6;
}

/** A failed call. `usd` is set only when the cost is known (reported usage, or a refusal before any generation); otherwise the reservation stands. */
export class ModelError extends Error { constructor(message: string, readonly usd?: number) { super(message); } }
/** Statuses a provider returns before generating anything, so nothing was billed. */
const UNBILLED = new Set([400, 401, 402, 403, 404, 413, 422, 429]);

/** A turn as OpenAI's chat API takes it: Claude's kept blocks stay behind. */
const plain = (m: Msg) => ({ role: m.role, content: m.content, ...(m.tool_calls ? { tool_calls: m.tool_calls } : {}), ...(m.tool_call_id ? { tool_call_id: m.tool_call_id } : {}) });

/** One model call on a route. Throws `ModelError` when the provider fails or returns nothing usable. */
export const callModel: CallModel = async (route, { messages, tools, maxTokens, signal, referer }) => {
  if (route.provider === "anthropic") return callAnthropic(route, messages, tools, maxTokens, signal);
  const openai = route.provider === "openai";
  const res = await fetch(openai ? "https://api.openai.com/v1/chat/completions" : "https://openrouter.ai/api/v1/chat/completions", {
    method: "POST", signal,
    headers: { authorization: `Bearer ${keyOf(route)}`, "content-type": "application/json", ...(openai ? {} : { "x-title": "Priors mix assistant", ...(referer ? { "http-referer": referer } : {}) }) },
    body: JSON.stringify({
      model: route.model, messages: messages.map(plain), tools: tools.map((t) => ({ type: "function", function: t })), tool_choice: "auto",
      ...(openai ? { max_completion_tokens: maxTokens, reasoning_effort: route.effort } : { max_tokens: maxTokens, reasoning: { effort: route.effort }, usage: { include: true } }),
    }),
  });
  const data = await res.json().catch(() => ({})) as { choices?: { message: { content: string | null; tool_calls?: ToolCall[] }; finish_reason?: string }[]; usage?: { cost?: number; prompt_tokens?: number; completion_tokens?: number; prompt_tokens_details?: { cached_tokens?: number } }; error?: { message?: string } };
  const usd = data.usage ? (typeof data.usage.cost === "number" ? data.usage.cost : openaiUsd(route.model, data.usage)) : undefined;
  if (!res.ok || !data.choices?.length) throw new ModelError(data.error?.message ?? `Model call failed (${res.status})`, usd ?? (UNBILLED.has(res.status) ? 0 : undefined));
  const msg = data.choices[0].message;
  return { content: msg.content ?? null, ...(msg.tool_calls?.length ? { tool_calls: msg.tool_calls } : {}), usd: usd ?? worstCase(route.model, JSON.stringify(messages).length, maxTokens), ...(data.choices[0].finish_reason === "content_filter" ? { refused: true } : {}) };
};

const KEY_ENV: Record<Provider, string> = { anthropic: "ANTHROPIC_API_KEY", openai: "OPENAI_API_KEY", openrouter: "OPENROUTER_API_KEY" };
let keys: Keys = {};
/** The server's keys, read once from the environment (trimmed: a pasted key can carry a newline). Tests and the eval pass their own. */
export function setKeys(next: Keys) { keys = next; }
export const envKeys = (env: Record<string, string | undefined> = process.env): Keys =>
  Object.fromEntries((Object.keys(KEY_ENV) as Provider[]).flatMap((p) => { const v = env[KEY_ENV[p]]?.trim(); return v ? [[p, v]] : []; }));
const keyOf = (route: Route) => { const k = keys[route.provider] ?? envKeys()[route.provider]; if (!k) throw new ModelError(`No key for ${route.provider}`); return k; };

async function callAnthropic(route: Route, messages: Msg[], tools: readonly ToolSpec[], maxTokens: number, signal?: AbortSignal): Promise<ModelReply> {
  // No SDK retries: one reservation covers one call. A failure moves the request to the next route instead.
  const client = new Anthropic({ apiKey: keyOf(route), maxRetries: 0 });
  const body = toAnthropic(messages, tools);
  let res: Anthropic.Message;
  try {
    res = await client.messages.create({
      model: route.model, max_tokens: maxTokens, system: body.system, messages: body.messages, tools: body.tools, tool_choice: { type: "auto" },
      thinking: { type: "adaptive" }, output_config: { effort: route.effort },
      // Tools, then the system prompt, then the turns so far: each call reads the earlier ones from the cache.
      cache_control: { type: "ephemeral" },
    }, { signal });
  } catch (e) {
    // Unbilled only for a status returned before generation; a timeout, dropped connection, abort or 5xx keeps the reservation.
    if (e instanceof Anthropic.APIError && !(e instanceof Anthropic.APIUserAbortError)) throw new ModelError(`Claude call failed (${e.status ?? "network"})`, typeof e.status === "number" && UNBILLED.has(e.status) ? 0 : undefined);
    throw e;
  }
  const usd = anthropicUsd(route.model, res.usage);
  // A refusal ends Claude's part; the loop hands the request to the next route.
  if (res.stop_reason === "refusal") return { content: null, usd, refused: true };
  return { ...fromAnthropic(res.content), usd };
}
