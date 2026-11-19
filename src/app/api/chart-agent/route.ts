import { auth } from "@clerk/nextjs/server";
import { ConvexHttpClient } from "convex/browser";
import { z } from "zod";
import { api } from "../../../../convex/_generated/api";
import { agentRoutes } from "@/agent/agent";
import { CHART_AGENT_TOOL, chartAgentMessages } from "@/lib/chart-agent";
import { LOOKUP_TOOL, lookupModels } from "@/lib/chart-agent-data";
import { callModel, envKeys, ModelError, worstCase, type Msg } from "@/agent/providers";

export const runtime = "nodejs";
export const maxDuration = 120;

const body = z.object({
  message: z.string().trim().min(1).max(2000),
  context: z.string().min(1).max(120_000),
  history: z.array(z.object({ role: z.enum(["user", "assistant"]), content: z.string().max(4000) })).max(16).optional(),
});
/** MAX_STEPS per route, and MAX_CALLS across routes: one request never makes more model calls than this, whatever fails. */
const MAX_OUTPUT = 4000, MAX_STEPS = 5, MAX_CALLS = 6;
const TOOLS = [LOOKUP_TOOL, CHART_AGENT_TOOL];

/**
 * The chart settings agent: up to MAX_STEPS model calls per request, looking up model data (`lookup_model`) until it ends with one
 * `apply_changes` call for the browser to apply. Signed-in only, counted against the assistant's per-user and daily caps (every call
 * reserved before it runs and settled with the provider's usage), on the assistant's routes: GPT-6 Luna on OpenAI, then OpenRouter.
 */
export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: "Sign in to change charts by asking." }, { status: 401 });
  // Diagnosing a chart takes more thought than the assistant's quick edits: medium reasoning on the cheap routes.
  const routes = agentRoutes(envKeys(), process.env).map((r) => r.pool === "base" ? { ...r, effort: "medium" as const } : r), secret = process.env.AGENT_SERVER_SECRET, convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;
  if (!routes.length || !secret || !convexUrl) return Response.json({ error: "The chart agent isn't configured." }, { status: 503 });
  const parsed = body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Say what to change." }, { status: 400 });
  const convex = new ConvexHttpClient(convexUrl);
  const gate = await convex.mutation(api.agentBudget.begin, { secret, userId });
  if (!gate.ok) return Response.json({ error: gate.reason === "user-limit" ? "You've used today's agent requests. They reset at midnight UTC." : "The agent has reached today's usage limit. It resets at midnight UTC." }, { status: 429 });
  const messages: Msg[] = chartAgentMessages(parsed.data.context, parsed.data.message, parsed.data.history);
  const looked: string[] = [];
  let calls = 0;
  for (const route of routes) {
    for (let step = 0; step < MAX_STEPS && calls < MAX_CALLS; step++) {
      const estimate = worstCase(route.model, JSON.stringify(messages).length, MAX_OUTPUT);
      if (!(await convex.mutation(api.agentBudget.reserve, { secret, estimateUsd: estimate, pool: route.pool }))) break;
      calls++;
      let spent = estimate, out;
      try {
        // The last step may only answer.
        out = await callModel(route, { messages, tools: step === MAX_STEPS - 1 || calls === MAX_CALLS ? [CHART_AGENT_TOOL] : TOOLS, maxTokens: MAX_OUTPUT, signal: req.signal, referer: new URL(req.url).origin });
        spent = out.usd;
      } catch (e) {
        if (e instanceof ModelError && e.usd !== undefined) spent = e.usd;
        if (!(e instanceof ModelError)) throw e;
        break;
      } finally {
        await convex.mutation(api.agentBudget.settle, { secret, userId, estimateUsd: estimate, actualUsd: spent, pool: route.pool });
      }
      if (out.refused) break;
      const toolCalls = out.tool_calls ?? [], final = toolCalls.find((c) => c.function.name === "apply_changes");
      if (final || !toolCalls.length) {
        let changes: Record<string, unknown> = {};
        try { changes = final ? JSON.parse(final.function.arguments || "{}") : {}; } catch { changes = {}; }
        return Response.json({ reply: (changes.reply as string | undefined) ?? out.content ?? "No change.", changes, looked });
      }
      messages.push({ role: "assistant", content: out.content, tool_calls: toolCalls, ...(out.raw ? { raw: out.raw } : {}) });
      for (const c of toolCalls) {
        let result: string;
        if (c.function.name === "lookup_model") {
          let args: { models?: unknown; benchmarks?: unknown } = {};
          try { args = JSON.parse(c.function.arguments || "{}"); } catch { /* empty lookup */ }
          if (Array.isArray(args.models)) looked.push(...args.models.filter((m): m is string => typeof m === "string"));
          result = await lookupModels(args);
        } else result = JSON.stringify({ error: `Unknown tool ${c.function.name}` });
        messages.push({ role: "tool", content: result, tool_call_id: c.id });
      }
    }
    // A route that failed part-way starts over clean on the next one.
    messages.splice(chartAgentMessages(parsed.data.context, parsed.data.message, parsed.data.history).length);
  }
  return Response.json({ error: "The agent couldn't answer just now. Nothing was changed." }, { status: 502 });
}
