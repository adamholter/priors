import { auth } from "@clerk/nextjs/server";
import { ConvexHttpClient } from "convex/browser";
import { z } from "zod";
import { api } from "../../../../convex/_generated/api";
import { loadSnapshot } from "@/data/load";
import { mergeImports } from "@/lib/import";
import { decodeIndex } from "@/lib/url";
import type { Profile } from "@/components/page/IndexPage";
import { runAgent, type AgentEvent } from "@/agent/agent";

export const runtime = "nodejs";
export const maxDuration = 120;

const body = z.object({
  index: z.string().min(3).max(4000),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  handle: z.string().regex(/^[a-z0-9][a-z0-9-]{1,29}$/i).optional(),
  messages: z.array(z.object({ role: z.enum(["user", "assistant"]), content: z.string().min(1).max(4000) })).min(1).max(20),
});

/**
 * Mix assistant. Signed-in only. Streams NDJSON events: {type:"step"} progress lines, then one
 * {type:"done"} with the proposal (or {type:"error"}). The OpenRouter key and the budget secret stay
 * on the server; every model call is pre-authorized against the Convex daily cap.
 */
export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: "Sign in to use the assistant." }, { status: 401 });
  const key = process.env.OPENROUTER_API_KEY, secret = process.env.AGENT_SERVER_SECRET, convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;
  if (!key || !secret || !convexUrl) return Response.json({ error: "The assistant isn't configured." }, { status: 503 });
  const parsed = body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Invalid request." }, { status: 400 });
  const { index, date, handle, messages } = parsed.data;
  if (messages[messages.length - 1].role !== "user") return Response.json({ error: "Invalid request." }, { status: 400 });

  const convex = new ConvexHttpClient(convexUrl);
  const gate = await convex.mutation(api.agentBudget.begin, { secret, userId });
  if (!gate.ok) return Response.json({ error: gate.reason === "user-limit" ? "You've used today's assistant requests. They reset at midnight UTC." : "The assistant has reached today's usage limit. It resets at midnight UTC." }, { status: 429 });

  let snapshot = await loadSnapshot(date);
  if (!snapshot) return Response.json({ error: "Benchmark data unavailable." }, { status: 404 });
  if (handle) {
    const profile = await convex.query(api.profiles.byHandle, { handle }) as Profile | null;
    if (profile?.imports?.length) snapshot = mergeImports(snapshot, profile.imports).snapshot;
  }
  const config = decodeIndex(index, "assistant");
  if (!config || !Object.keys(config.weights).length) return Response.json({ error: "Invalid index." }, { status: 400 });

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const emit = (e: AgentEvent) => controller.enqueue(encoder.encode(JSON.stringify(e) + "\n"));
      try {
        await runAgent({
          snapshot: snapshot!, config, history: messages, apiKey: key, signal: req.signal, referer: new URL(req.url).origin, emit,
          budget: {
            reserve: (estimateUsd) => convex.mutation(api.agentBudget.reserve, { secret, estimateUsd }),
            settle: async (estimateUsd, actualUsd) => { await convex.mutation(api.agentBudget.settle, { secret, userId, estimateUsd, actualUsd }); },
          },
        });
      } catch {
        emit({ type: "error", message: "Something went wrong. Your index wasn't changed." });
      } finally { controller.close(); }
    },
  });
  return new Response(stream, { headers: { "content-type": "application/x-ndjson; charset=utf-8", "cache-control": "no-store" } });
}
