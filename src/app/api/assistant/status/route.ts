import { envKeys } from "@/agent/providers";
import { assistantStatus } from "@/agent/status";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** The assistant's routes and whether each provider accepts its key (`assistantStatus`). Never a key. */
let cached: { at: number; body: Awaited<ReturnType<typeof assistantStatus>> } | undefined;
export async function GET() {
  if (!cached || Date.now() - cached.at > 600_000) cached = { at: Date.now(), body: await assistantStatus(envKeys(), process.env) };
  return Response.json(cached.body, { headers: { "cache-control": "no-store" } });
}
