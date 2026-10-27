import { handle } from "@/mcp/protocol";
import { SERVER_INFO } from "@/mcp/protocol";
import { TOOLS } from "@/mcp/tools";

export const runtime = "nodejs";
export const maxDuration = 60;

const CORS = { "access-control-allow-origin": "*", "access-control-allow-headers": "authorization, content-type, mcp-protocol-version, mcp-session-id", "access-control-allow-methods": "POST, GET, OPTIONS" };
const tokenOf = (req: Request) => req.headers.get("authorization")?.replace(/^Bearer\s+/i, "").trim() || undefined;

/**
 * Remote MCP server (Streamable HTTP, stateless, JSON replies): https://mypriors.com/mcp
 * Public tools work without a header; tools that change a page read `Authorization: Bearer pri_...`.
 */
export async function POST(req: Request) {
  let body: unknown;
  try { body = await req.json(); } catch { return Response.json({ jsonrpc: "2.0", id: null, error: { code: -32700, message: "Parse error" } }, { status: 400, headers: CORS }); }
  const env = { token: tokenOf(req), origin: new URL(req.url).origin };
  if (Array.isArray(body)) {
    const replies = (await Promise.all(body.slice(0, 20).map((m) => handle(m, env)))).filter(Boolean);
    return replies.length ? Response.json(replies, { headers: CORS }) : new Response(null, { status: 202, headers: CORS });
  }
  const reply = await handle(body as never, env);
  return reply ? Response.json(reply, { headers: CORS }) : new Response(null, { status: 202, headers: CORS });
}

export async function GET() {
  return Response.json({ ...SERVER_INFO, transport: "streamable-http", tools: TOOLS.length, docs: "https://mypriors.com/cli" }, { headers: CORS });
}
export const OPTIONS = () => new Response(null, { status: 204, headers: CORS });
