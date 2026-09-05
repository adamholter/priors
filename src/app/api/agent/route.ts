import { ConvexHttpClient } from "convex/browser";
import { NextResponse } from "next/server";
import { api } from "../../../../convex/_generated/api";
import { importSchema } from "@/lib/import";

/**
 * Agent endpoint used by the Priors skill.
 *   Authorization: Bearer pri_...
 *   POST { action: "whoami" | "import" | "indices" | "page", payload }
 */
export async function POST(req: Request) {
  const url = process.env.NEXT_PUBLIC_CONVEX_URL;
  if (!url) return NextResponse.json({ error: "Convex not configured" }, { status: 500 });
  const token = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) return NextResponse.json({ error: "Missing bearer token. Mint one on your page under Settings → Agent access." }, { status: 401 });
  let body: { action?: string; payload?: unknown };
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Body must be JSON" }, { status: 400 }); }
  const action = body.action;
  if (action !== "whoami" && action !== "import" && action !== "indices" && action !== "page") return NextResponse.json({ error: "action must be whoami | import | indices | page" }, { status: 400 });
  if (action === "import") {
    const parsed = importSchema.safeParse(body.payload);
    if (!parsed.success) return NextResponse.json({ error: "Invalid import payload", issues: parsed.error.issues.slice(0, 20) }, { status: 400 });
    body.payload = parsed.data;
  }
  try {
    const client = new ConvexHttpClient(url);
    const result = await client.mutation(api.profiles.agentApply, { token, action, payload: body.payload });
    return NextResponse.json(result);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg.replace(/^[\s\S]*Uncaught Error:\s*/, "").split("\n")[0] }, { status: /Invalid token/.test(msg) ? 401 : 400 });
  }
}

export async function GET() {
  return NextResponse.json({ ok: true, usage: "POST with Authorization: Bearer <token> and { action, payload }. See /skill." });
}
