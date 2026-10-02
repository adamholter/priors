// Run the mix assistant offline against the dev Convex budget: npx tsx scripts/try-assistant.mts "Gemini 4 is too high"
import { readFileSync } from "node:fs";
for (const l of readFileSync(".env.local", "utf8").split("\n")) { const m = l.match(/^([A-Z_]+)=(.*)$/); if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^"|"$/g, ""); }
const { ConvexHttpClient } = await import("convex/browser");
const { api } = await import("../convex/_generated/api");
const { loadSnapshot } = await import("../src/data/load");
const { defaultConfig } = await import("../src/engine");
const { runAgent } = await import("../src/agent/agent");
const s = (await loadSnapshot())!;
const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);
const secret = process.env.AGENT_SERVER_SECRET!;
console.log(await convex.mutation(api.agentBudget.begin, { secret, userId: "test-user" }));
let spent = 0;
const t = Date.now();
await runAgent({ snapshot: s, config: defaultConfig(s), history: [{ role: "user", content: process.argv[2] ?? "Fable 5.1 is too high" }], apiKey: process.env.OPENROUTER_API_KEY!, emit: (e) => console.log(JSON.stringify(e).slice(0, 1500)),
  budget: { reserve: (est) => convex.mutation(api.agentBudget.reserve, { secret, estimateUsd: est }), settle: async (est, act) => { spent += act; await convex.mutation(api.agentBudget.settle, { secret, userId: "test-user", estimateUsd: est, actualUsd: act }); } } });
console.log("spent $", spent.toFixed(5), "secs", (Date.now() - t) / 1000);
