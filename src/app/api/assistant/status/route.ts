import { timingSafeEqual } from "node:crypto";
import { envKeys } from "@/agent/providers";
import { assistantStatus } from "@/agent/status";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Is the assistant able to answer: `{ ok, routes }` for anyone (at least one route whose provider accepts its key). The per-provider
 * detail (`assistantStatus`: routes, each provider's answer, Claude on or off) needs `Authorization: Bearer <AGENT_SERVER_SECRET>`,
 * so which providers are configured is not public. Never a key either way.
 */
let cached: { at: number; body: Awaited<ReturnType<typeof assistantStatus>> } | undefined;
const same = (a: string, b: string) => a.length === b.length && timingSafeEqual(Buffer.from(a), Buffer.from(b));
export async function GET(req: Request) {
  if (!cached || Date.now() - cached.at > 600_000) cached = { at: Date.now(), body: await assistantStatus(envKeys(), process.env) };
  const s = cached.body, secret = process.env.AGENT_SERVER_SECRET, given = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
  const ok = s.routes.some((r) => s.keys[r.provider] === 200);
  const body = secret && given && same(given, secret) ? { ok, ...s } : { ok, routes: s.routes.length };
  return Response.json(body, { headers: { "cache-control": "no-store" } });
}
