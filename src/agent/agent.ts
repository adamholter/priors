/**
 * The mix-adjustment agent loop (server only). OpenRouter chat completions with tool calls; every model
 * call is pre-authorized against the daily spend cap and settled with the provider's reported cost.
 */
import type { Snapshot } from "../data/types";
import type { IndexConfig } from "../engine";
import { TOOL_SPECS, describe, runTool, stepLabel, type Proposal, type ToolContext } from "./tools";
import { toShares, toWeights } from "./solver";

export const AGENT_MODEL = "openai/gpt-6-luna";
/** USD per token (OpenRouter list price for the model above), used only to pre-authorize a call. */
const PRICE = { input: 0.1 / 1e6, output: 0.5 / 1e6 };
const MAX_OUTPUT = 16384, MAX_TURNS = 10;

export type ChatMessage = { role: "user" | "assistant"; content: string };
export type AgentEvent = { type: "step"; text: string } | { type: "done"; reply: string; proposal?: Proposal & { view: ReturnType<typeof describe> }; question?: string; suggestions: string[] } | { type: "error"; message: string };
export type Budget = { reserve: (estimateUsd: number) => Promise<boolean>; settle: (estimateUsd: number, actualUsd: number) => Promise<void> };

const SYSTEM = `You adjust a user's AI-model leaderboard on Priors. Their "mix" is a set of benchmarks with percentage shares; every model's index score is the share-weighted mean of its normalized benchmark scores, and the ranking follows the score.

How to work:
- Act first, then check in. For a vague request ("Gemini is too high"), infer the gentlest sensible reading — usually one place down, below the model just under it — make that change, then explain it and ask exactly what they meant ("Want it lower still, or back up a touch? Where should it sit?"). Every change request must end with a real change applied: if the cleanest options are heavy, apply the smallest satisfying candidate and say plainly what it cost. Never answer a change request with only a question or an unchanged mix; only pure questions about the data get an answer without a change.
- Prefer solve_edit for ranking moves and constraints: it finds the smallest change that works and keeps other rankings stable. Use explain_model and find_benchmarks to understand why a model sits where it does and which benchmarks would move it. Use fit_ranking (the quality-aware generator) when the user wants a bigger rebuild or to drop a benchmark while recreating a similar ranking. Use try_mix for simple manual tweaks ("make DeepSWE 30%"), or to refine a solver candidate by hand.
- When editing, stay as close as possible to the user's current mix and keep other models where they were. Good mixes have few benchmarks with roughly even shares; 5–40% per benchmark is a soft guide — go outside it only when the ranking requires it, never just to widen spacing between models. Prefer dropping a tiny passenger benchmark to keeping it.
- Only state numbers and rankings that tools returned. Never invent benchmark names or results. Refer to benchmarks by the ids tools return when you pass weights.
- Finish every change by calling propose with the final weights (percent per benchmark, by name or id). The summary is 1–3 short sentences in plain language: what moved, which benchmarks changed and why, and what else shifted. Add a question and 2–3 short reply suggestions when the request was vague (the interface already has an Undo button, so never suggest undoing). Keep it concise; no markdown headings.`;

type ToolCall = { id: string; type: "function"; function: { name: string; arguments: string } };
type Msg = { role: "system" | "user" | "assistant" | "tool"; content: string | null; tool_calls?: ToolCall[]; tool_call_id?: string };

export async function runAgent(opts: { snapshot: Snapshot; config: IndexConfig; history: ChatMessage[]; apiKey: string; budget: Budget; emit: (e: AgentEvent) => void; signal?: AbortSignal; referer?: string }) {
  const { snapshot, apiKey, budget, emit } = opts;
  // Benchmarks this snapshot doesn't know (renamed or retired ids) contribute nothing to the ranking; drop them so "the original mix" is what actually ranks.
  const known = new Set(snapshot.benchmarks.map((b) => b.id));
  const config = { ...opts.config, weights: Object.fromEntries(Object.entries(opts.config.weights).filter(([id]) => known.has(id))), required: opts.config.required.filter((id) => known.has(id)) };
  if (!Object.keys(config.weights).length) { emit({ type: "error", message: "None of this index's benchmarks are in the current data." }); return; }
  const ctx: ToolContext = { snapshot, original: config };
  const state = describe(ctx, config.weights, 16);
  const messages: Msg[] = [
    { role: "system", content: SYSTEM },
    { role: "system", content: `Current mix and ranking (snapshot ${snapshot.date}, index "${config.name}"):\n${JSON.stringify(state)}` },
    ...opts.history.slice(-10).map((m) => ({ role: m.role, content: m.content.slice(0, 4000) })),
  ];
  const tools = TOOL_SPECS.map((t) => ({ type: "function" as const, function: t }));
  for (let turn = 0; turn < MAX_TURNS; turn++) {
    const promptChars = JSON.stringify(messages).length + JSON.stringify(tools).length;
    const estimate = (promptChars / 3) * PRICE.input + MAX_OUTPUT * PRICE.output;
    if (!(await budget.reserve(estimate))) { emit({ type: "error", message: "The assistant has reached today's usage limit. It resets at midnight UTC." }); return; }
    let actual = estimate;
    let data: { choices?: { message: { content: string | null; tool_calls?: ToolCall[] } }[]; usage?: { cost?: number; prompt_tokens?: number; completion_tokens?: number }; error?: { message?: string } };
    try {
      const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST", signal: opts.signal,
        headers: { authorization: `Bearer ${apiKey}`, "content-type": "application/json", "x-title": "Priors mix assistant", ...(opts.referer ? { "http-referer": opts.referer } : {}) },
        body: JSON.stringify({ model: AGENT_MODEL, messages, tools, tool_choice: "auto", max_tokens: MAX_OUTPUT, reasoning: { effort: "low" }, usage: { include: true } }),
      });
      data = await res.json();
      const u = data.usage;
      if (u) actual = typeof u.cost === "number" ? u.cost : (u.prompt_tokens ?? 0) * PRICE.input + (u.completion_tokens ?? 0) * PRICE.output;
      if (!res.ok || !data.choices?.length) throw new Error(data.error?.message ?? `Model call failed (${res.status})`);
    } catch (e) {
      await budget.settle(estimate, actual);
      emit({ type: "error", message: e instanceof Error && e.name === "AbortError" ? "Stopped." : "The assistant couldn't reach its model. Try again in a moment." });
      return;
    }
    await budget.settle(estimate, actual);
    const msg = data.choices[0].message;
    messages.push({ role: "assistant", content: msg.content ?? null, tool_calls: msg.tool_calls });
    if (!msg.tool_calls?.length) {
      // A plain answer (a question about the data, or no change needed).
      emit(finish(ctx, msg.content ?? ""));
      return;
    }
    for (const call of msg.tool_calls) {
      let args: Record<string, unknown> = {};
      try { args = JSON.parse(call.function.arguments || "{}"); } catch { /* bad JSON: tool reports */ }
      emit({ type: "step", text: stepLabel(call.function.name, args) });
      let result: unknown;
      try { result = await runTool(ctx, call.function.name, args); } catch (e) { result = { error: e instanceof Error ? e.message : String(e) }; }
      messages.push({ role: "tool", tool_call_id: call.id, content: JSON.stringify(result).slice(0, 24000) });
    }
    if (ctx.proposal) { emit(finish(ctx, "")); return; }
  }
  emit(ctx.proposal ? finish(ctx, "") : { type: "error", message: "The assistant ran out of steps before finishing. Try a more specific request." });
}

function finish(ctx: ToolContext, text: string): AgentEvent {
  const p = ctx.proposal;
  // An unchanged mix isn't a change: report the answer without a proposal (and without an Undo).
  if (p && JSON.stringify(Object.entries(p.weights).sort()) === JSON.stringify(Object.entries(toWeights(toShares(ctx.original.weights))).sort())) return { type: "done", reply: p.summary, question: p.question, suggestions: p.suggestions };
  if (!p) return { type: "done", reply: text.trim() || "No change needed.", suggestions: [] };
  return { type: "done", reply: p.summary, question: p.question, suggestions: p.suggestions, proposal: { ...p, view: describe(ctx, p.weights, 25) } };
}
