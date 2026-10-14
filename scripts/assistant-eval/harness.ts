/**
 * Runs one eval case through the real assistant loop (src/agent/agent.ts) against a pinned snapshot,
 * with a local spend cap instead of the Convex budget, and records everything the grader needs.
 */
import type { Snapshot } from "../../src/data/types";
import type { IndexConfig } from "../../src/engine";
import { runAgent, type AgentEvent, type ChatMessage } from "../../src/agent/agent";
import { DataView } from "../../src/agent/data";
import type { ViewState } from "../../src/agent/tools";

export type Done = Extract<AgentEvent, { type: "done" }>;
export interface RunResult {
  done?: Done; error?: string; steps: string[];
  tools: { name: string; args: Record<string, unknown>; result: unknown }[];
  costUsd: number; seconds: number;
  before: IndexConfig; after: IndexConfig;
  /** Each model's place in the ranking (best effort per model), before and after the change. */
  rankBefore: Map<string, number>; rankAfter: Map<string, number>;
}

export async function runCase(opts: { snapshot: Snapshot; config: IndexConfig; prompt: string; history?: ChatMessage[]; view: ViewState; model: string; apiKey: string; spend: { left: number } }): Promise<RunResult> {
  const { snapshot, config } = opts, t = Date.now();
  const steps: string[] = [], tools: RunResult["tools"] = [];
  let done: Done | undefined, error: string | undefined, costUsd = 0;
  await runAgent({
    snapshot, config, model: opts.model, apiKey: opts.apiKey, view: opts.view,
    history: [...(opts.history ?? []), { role: "user", content: opts.prompt }],
    emit: (e) => { if (e.type === "step") steps.push(e.text); else if (e.type === "done") done = e; else error = e.message; },
    onToolCall: (name, args, result) => tools.push({ name, args, result }),
    budget: {
      reserve: async (estimate) => { if (opts.spend.left < estimate) return false; opts.spend.left -= estimate; return true; },
      settle: async (estimate, actual) => { opts.spend.left += estimate - actual; costUsd += actual; },
    },
  });
  const after: IndexConfig = { ...config, ...(done?.proposal ? { weights: done.proposal.weights, required: done.proposal.required } : {}), ...(done?.highlight ? { highlight: done.highlight } : {}) };
  return { done, error, steps, tools, costUsd, seconds: (Date.now() - t) / 1000, before: config, after, rankBefore: new DataView(snapshot, config).bestRank, rankAfter: new DataView(snapshot, after).bestRank };
}
