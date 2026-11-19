import { auth } from "@clerk/nextjs/server";
import { ConvexHttpClient } from "convex/browser";
import { z } from "zod";
import { api } from "../../../../convex/_generated/api";
import { agentRoutes } from "@/agent/agent";
import { CHART_AGENT_TOOL, chartAgentMessages } from "@/lib/chart-agent";
import { callModel, envKeys, ModelError, worstCase } from "@/agent/providers";

export const runtime = "nodejs";
export const maxDuration = 60;

const body = z.object({ message: z.string().trim().min(1).max(2000), context: z.string().min(1).max(60_000) });
const MAX_OUTPUT = 4000;

/**
 * The chart settings agent: one request, one model call, one `apply_changes` answer for the browser to apply. Signed-in only, counted
 * against the assistant's per-user and daily caps (every call reserved before it runs and settled with the provider's usage), on the
 * assistant's routes: GPT-6 Luna on OpenAI, then on OpenRouter.
 */
export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: "Sign in to change charts by asking." }, { status: 401 });
  const routes = agentRoutes(envKeys(), process.env), secret = process.env.AGENT_SERVER_SECRET, convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;
  if (!routes.length || !secret || !convexUrl) return Response.json({ error: "The chart agent isn't configured." }, { status: 503 });
  const parsed = body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Say what to change." }, { status: 400 });
  const convex = new ConvexHttpClient(convexUrl);
  const gate = await convex.mutation(api.agentBudget.begin, { secret, userId });
  if (!gate.ok) return Response.json({ error: gate.reason === "user-limit" ? "You've used today's agent requests. They reset at midnight UTC." : "The agent has reached today's usage limit. It resets at midnight UTC." }, { status: 429 });
  const messages = chartAgentMessages(parsed.data.context, parsed.data.message);
  for (const route of routes) {
    const estimate = worstCase(route.model, JSON.stringify(messages).length, MAX_OUTPUT);
    if (!(await convex.mutation(api.agentBudget.reserve, { secret, estimateUsd: estimate, pool: route.pool }))) continue;
    let spent = estimate;
    try {
      const out = await callModel(route, { messages, tools: [CHART_AGENT_TOOL], maxTokens: MAX_OUTPUT, signal: req.signal, referer: new URL(req.url).origin });
      spent = out.usd;
      if (out.refused) continue;
      const call = out.tool_calls?.find((c) => c.function.name === "apply_changes");
      const changes = call ? JSON.parse(call.function.arguments || "{}") : {};
      return Response.json({ reply: changes.reply ?? out.content ?? "No change.", changes });
    } catch (e) {
      if (e instanceof ModelError && e.usd !== undefined) spent = e.usd;
      if (!(e instanceof ModelError) && !(e instanceof SyntaxError)) throw e;
    } finally {
      await convex.mutation(api.agentBudget.settle, { secret, userId, estimateUsd: estimate, actualUsd: spent, pool: route.pool });
    }
  }
  return Response.json({ error: "The agent couldn't answer just now. Nothing was changed." }, { status: 502 });
}
