import { TOOLS, callTool, type ToolEnv } from "./tools";

export const PROTOCOL_VERSION = "2025-03-26";
const SUPPORTED = ["2025-06-18", "2025-03-26", "2024-11-05"];
export const SERVER_INFO = { name: "priors", title: "Priors", version: "1.0.0" };
const INSTRUCTIONS = "Priors (mypriors.com) ranks AI models with a weighted index of benchmarks. Read tools are public. Pass `index` (a @handle, a link, or { weights }) to rank under a custom mix; omit it for the default General frontier index. Tools that change a page need the owner's agent token. Scores are as published: never estimate or invent a benchmark value.";

type Req = { jsonrpc?: string; id?: string | number | null; method?: string; params?: Record<string, unknown> };
export type Reply = { jsonrpc: "2.0"; id: string | number | null; result?: unknown; error?: { code: number; message: string; data?: unknown } };

const err = (id: Req["id"], code: number, message: string): Reply => ({ jsonrpc: "2.0", id: id ?? null, error: { code, message } });

/** One JSON-RPC message in, one reply out (null for notifications). Stateless: nothing is kept between requests. */
export async function handle(msg: Req, env: ToolEnv): Promise<Reply | null> {
  if (!msg || msg.jsonrpc !== "2.0" || typeof msg.method !== "string") return err(msg?.id, -32600, "Invalid request");
  const id = msg.id;
  if (id === undefined) return null; // notifications/initialized and friends
  switch (msg.method) {
    case "initialize": {
      const asked = String(msg.params?.protocolVersion ?? "");
      return { jsonrpc: "2.0", id, result: { protocolVersion: SUPPORTED.includes(asked) ? asked : PROTOCOL_VERSION, capabilities: { tools: { listChanged: false } }, serverInfo: SERVER_INFO, instructions: INSTRUCTIONS } };
    }
    case "ping": return { jsonrpc: "2.0", id, result: {} };
    case "tools/list": return { jsonrpc: "2.0", id, result: { tools: TOOLS.map((t) => ({ name: t.name, description: t.write ? `${t.description} Needs your agent token.` : t.description, inputSchema: t.inputSchema, annotations: { readOnlyHint: !t.write, openWorldHint: false } })) } };
    case "tools/call": {
      const name = String(msg.params?.name ?? "");
      const out = await callTool(name, msg.params?.arguments, env);
      // A failing tool is a result the model can read and correct, not a protocol error.
      return { jsonrpc: "2.0", id, result: { content: [{ type: "text", text: out.ok ? JSON.stringify(out.result) : JSON.stringify({ error: out.error }) }], isError: !out.ok } };
    }
    case "resources/list": return { jsonrpc: "2.0", id, result: { resources: [] } };
    case "prompts/list": return { jsonrpc: "2.0", id, result: { prompts: [] } };
    default: return err(id, -32601, `Method not found: ${msg.method}`);
  }
}
