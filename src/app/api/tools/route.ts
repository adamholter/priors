import { TOOLS } from "@/mcp/tools";

export const runtime = "nodejs";

/** Tool catalog: name, description, JSON schema, and whether it needs the owner's token. */
export async function GET() {
  return Response.json({ tools: TOOLS.map((t) => ({ name: t.name, description: t.description, write: !!t.write, inputSchema: t.inputSchema })) }, { headers: { "access-control-allow-origin": "*", "cache-control": "public, max-age=300" } });
}
