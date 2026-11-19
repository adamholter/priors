/**
 * The chart settings agent (server only): one model call that reads a chart's settings and data summary and answers with one
 * `apply_changes` call (view, settings, plan picks, models shown, data adjustments). The browser applies the changes
 * (`ChartComposer`, `ChartSettings`). Same routes and daily caps as the assistant (`agentRoutes`, convex/agentBudget.ts).
 */
import type { Msg, ToolSpec } from "@/agent/providers";

export const CHART_AGENT_SYSTEM = `You adjust one chart in Priors, an AI-model leaderboard, for the person using it. They type what they want in plain words; you answer with exactly one apply_changes call.

You can change anything the chart's settings can, and the data itself:
- view: labelScale (name size, 0.75 to 3), dotScale and lineScale (0.5 to 3; scatter charts), kind ("scatter" or "bars"), density (share of points with a name, 0 to 1), frontier, links (lines between a model's efforts), scale ("log" or "linear"), allModels, paretoOnly.
- settings: costBasis ("subscription" or "api"), efforts (the reasoning efforts shown), mode ("all" or "best"), releasedAfter (ISO date, "" for all time), dataSource (one of the listed ids), freeTiers ("generous", "limited", "off"), planResets (true/false), planReading (one of the listed ids).
- plans: the plan a lab's models are priced at, by lab id; plan null goes back to the default.
- models: showOnly, hide or show, by model id from the list.
- dataOverrides, for anything the data does not know: kind "subsidy" multiplies a plan's allowance by factor (bonus credits, a promotion, a bigger limit than measured), scoped by lab, plan name and/or model; kind "cost" multiplies every cost figure of one model by factor (a discount, a price change).

Working out a factor: a plan line reads "ChatGPT Pro 10x · $100/mo · 29.9x API value ≈ $2,990/mo". Extra usage worth $E a month on that plan is factor 1 + E / 2990. One-off credits spread over the months they last. Never refuse for want of a conversion: pick the most plausible value, apply it, and state the assumption in the reply in one short sentence. OpenAI sells extra Codex credits at about $40 per 1,000, so one credit is about $0.04 of usage. With no duration given, assume the extra usage is spent within one month. With no plan named, use the plan the lab is priced at now.

Only include fields you are changing. Keep reply to one or two plain sentences saying what changed. If nothing fits the request, change nothing and say why.`;

export const CHART_AGENT_TOOL: ToolSpec = {
  name: "apply_changes",
  description: "Apply changes to the chart and say what changed.",
  parameters: {
    type: "object", additionalProperties: false, required: ["reply"],
    properties: {
      reply: { type: "string" },
      view: { type: "object", additionalProperties: false, properties: { labelScale: { type: "number" }, dotScale: { type: "number" }, lineScale: { type: "number" }, density: { type: "number" }, frontier: { type: "boolean" }, links: { type: "boolean" }, scale: { type: "string", enum: ["log", "linear"] }, allModels: { type: "boolean" }, paretoOnly: { type: "boolean" }, kind: { type: "string", enum: ["scatter", "bars"] } } },
      settings: { type: "object", additionalProperties: false, properties: { costBasis: { type: "string", enum: ["subscription", "api"] }, efforts: { type: "array", items: { type: "string" } }, mode: { type: "string", enum: ["all", "best"] }, releasedAfter: { type: "string" }, dataSource: { type: "string" }, freeTiers: { type: "string", enum: ["generous", "limited", "off"] }, planResets: { type: "boolean" }, planReading: { type: "string" } } },
      plans: { type: "array", items: { type: "object", additionalProperties: false, required: ["lab"], properties: { lab: { type: "string" }, plan: { type: ["string", "null"] } } } },
      models: { type: "object", additionalProperties: false, properties: { showOnly: { type: "array", items: { type: "string" } }, hide: { type: "array", items: { type: "string" } }, show: { type: "array", items: { type: "string" } } } },
      dataOverrides: { type: "array", items: { type: "object", additionalProperties: false, required: ["kind", "factor", "note"], properties: { kind: { type: "string", enum: ["subsidy", "cost"] }, factor: { type: "number" }, lab: { type: "string" }, plan: { type: "string" }, model: { type: "string" }, note: { type: "string" } } } },
    },
  },
};

export const chartAgentMessages = (context: string, message: string): Msg[] => [{ role: "system", content: CHART_AGENT_SYSTEM }, { role: "user", content: `${context.slice(0, 40_000)}\n\nRequest: ${message.trim().slice(0, 2000)}` }];
