import { callTool } from "@/mcp/tools";

export const runtime = "nodejs";
export const maxDuration = 60;

const CORS = { "access-control-allow-origin": "*", "access-control-allow-headers": "authorization, content-type", "access-control-allow-methods": "POST, OPTIONS" };

/** The same tools as /mcp over plain HTTP, for the CLI and scripts: POST a JSON object of arguments, get the result as JSON. */
export async function POST(req: Request, { params }: { params: Promise<{ tool: string }> }) {
  const { tool } = await params;
  let args: unknown = {};
  const text = await req.text();
  if (text.trim()) { try { args = JSON.parse(text); } catch { return Response.json({ error: "Body must be a JSON object of arguments." }, { status: 400, headers: CORS }); } }
  const token = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "").trim() || undefined;
  const out = await callTool(tool, args, { token, origin: new URL(req.url).origin });
  return out.ok ? Response.json(out.result, { headers: CORS }) : Response.json({ error: out.error }, { status: out.status, headers: CORS });
}
export const OPTIONS = () => new Response(null, { status: 204, headers: CORS });
