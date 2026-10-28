import { TOOLS, callTool, type ToolEnv } from "./tools";

export const PROTOCOL_VERSION = "2025-03-26";
const SUPPORTED = ["2025-06-18", "2025-03-26", "2024-11-05"];
export const SERVER_INFO = { name: "priors", title: "Priors", version: "1.0.0" };
const INSTRUCTIONS = `Priors (mypriors.com) ranks AI models by an index: a weighted mix of public benchmarks. The ranked unit is a model at one reasoning effort ("GPT-6 Sol max"). Benchmark values are scraped from their publishers about every 15 minutes and used as published: never estimate or invent a value.

How a ranking is made (state these when you report one):
- Omit \`index\` for the default General frontier index. Or pass "@handle", "@handle/tab", a mypriors.com link, or { weights: { benchmarkId: weight }, ...settings }; an object is merged onto the default.
- Index score: the weighted mean of each benchmark's score (percent benchmarks as published, others scaled 0 to 100 across models).
- strictness (default 50): a model is ranked only when measured results cover at least that % of the index's weight; the rest of its score is estimated from similar models. measuredPct on each row says how much is measured.
- releasedAfter: by default only models released in the last six months are ranked ("" for all).
- In an index nobody curated, older versions of a newer model are left out (excludeModels: [] shows them).
- Cost per task defaults to the subscription basis: measured API cost scaled by what the lab's plan works out to, where it has one. costBasis: "api" uses API prices. planResets: true also lowers subscription prices by what OpenAI and Anthropic limit resets gave subscribers in the last 30 days (banked resets not counted); off by default.
- Reasoning effort: one model at low and at max are different configurations with different score, cost and time. Leaderboards default to each model's best effort; tradeoff charts and tables (pareto_frontier, scatter, cost or time columns) show every effort. Name the effort whenever you name a configuration ("GPT-6.1 Terra high", not "GPT-6.1 Terra").
So a model missing from a ranking is not missing from the data. rank_models lists the near misses in \`excluded\`; get_model's \`status\` says why one model is not ranked. Check before saying a model is absent.

Which tool:
- Leaderboard, best model: rank_models.
- Best value, cost / time / speed vs score, Pareto: pareto_frontier. Show its \`image\` and list \`frontier\`.
- Why a model ranks where it does: get_model, explain_model, compare_models.
- One benchmark's own results (no index): get_benchmark.
- Any other chart: make_chart, then show its \`image\` URL (a PNG) and \`link\`.
- Numbers for a table: query_data.
- Building or tuning a mix: search_benchmarks, try_mix, solve_edit, fit_ranking; share it with index_link.

When answering, name the index and the snapshot date, say which settings shaped the result (strictness, the release cutoff, models left out and why), and give the user the mypriors.com link or image. Tools that change a page need the owner's agent token (priors login <token>; mint it on the page under Edit page, Agent access).`;

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
