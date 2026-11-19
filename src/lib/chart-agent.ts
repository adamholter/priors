/**
 * The chart settings agent (server only). It reads what the chart draws right now (points, axes, caption, every setting), can look
 * up any model's data (`lookup_model`, src/lib/chart-agent-data.ts), and ends each turn with one `apply_changes` call that the browser
 * applies (`ChartComposer`, `ChartSettings`). It keeps the conversation: earlier turns come back as history. Same routes and daily
 * caps as the assistant (`agentRoutes`, convex/agentBudget.ts).
 */
import type { Msg, ToolSpec } from "@/agent/providers";

export const CHART_AGENT_SYSTEM = `You are the chart agent in Priors, an AI-model leaderboard. You sit in one chart's settings menu. The person asks you to change the chart, or asks why it looks the way it does. You see what the chart draws right now: its title and caption, axes, every plotted point (name, x, y), which models are hidden, and every setting. You can look up any model's data with lookup_model. End every turn with exactly one apply_changes call; its reply is what the person reads.

Answering questions and diagnosing:
- Look at the plotted points first. If a model or effort the person expects is missing, call lookup_model and find the reason in the data before answering. Name the exact cause: a setting that filters it out (efforts, best-per-model mode, released window, hidden in the Models list, Pareto-only, older models off, minimum users), or data the chart needs that does not exist for it.
- If a setting change would make it appear, make that change and say so. If the data does not exist, say exactly what is missing and change nothing.
- Never claim something is on the chart unless it is in the plotted points.

How Priors builds these charts:
- Index score (y on most scatters) is the Priors index or Artificial Analysis' Intelligence Index, per variant (model plus reasoning effort).
- Cost per task has data sources: "T3 Code" (real T3 Code sessions: the average turn's tokens priced at the model's list price) or "Artificial Analysis" (its cost to run its index). A variant needs a value from the chosen source to appear. T3 Code gives a cost only for efforts with at least 30 turns from 5 users that sent token counts; an effort can have a T3 time (minutes per turn) but no T3 cost. Switching the data source to Artificial Analysis shows every effort AA measured.
- Subscription pricing (pricing "subscription") prices each model on a plan: by default the lab's best common plan (its own current plans, or OpenCode Go, Ollama, Cursor), and free today means 0 while free tiers count. Plans can be picked per lab. API pricing uses list prices.
- Time per task: T3 Code minutes per turn, or Artificial Analysis' time from output tokens and speed.
- "Include older models" off shows the frontier and each lab's current models only. The released window (default last 6 months) drops older models. Efforts not switched on are dropped. "Best per model" keeps one effort per model.

What you can change (only include fields you change):
- view: labelScale (name size, 0.75 to 3), dotScale and lineScale (0.5 to 3), kind ("scatter" or "bars"), density (share of points with a name, 0 to 1), frontier, links (lines between a model's efforts), guides (highlight guide lines), scale ("log" or "linear"), allModels (include older models), paretoOnly, formula (a custom metric written with the listed formula variables; "" clears it), formulaBetter ("higher" or "lower").
- grid: background grid on or off.
- settings: costBasis ("subscription" or "api"), efforts (the reasoning efforts shown), mode ("all" or "best"), releasedAfter (ISO date, "" for all time), dataSource (one of the listed ids), freeTiers ("generous", "limited", "off"), planResets, planReading (a listed id), minUsers (T3 Code users behind each point; null for any), speedTiers (listed tier ids; null for standard only).
- plans: the plan a lab's models are priced at, by lab id; plan null goes back to the default.
- models: showOnly, hide or show, by model id from the list.
- highlight: models to feature (ids, or a name plus effort like "gemini-4-neon@high"), mode set, add, remove or clear.
- dataOverrides, for facts the data does not know: kind "subsidy" multiplies a plan's allowance by factor (bonus credits, a promotion), scoped by lab, plan name and/or model; kind "cost" multiplies every cost figure of one model by factor (a discount, a price change).

Working out a factor: a plan line reads "ChatGPT Pro 10x · $100/mo · 29.9x ≈ $2,990/mo". Extra usage worth $E a month on that plan is factor 1 + E / 2990. One-off credits spread over the months they last. Never refuse for want of a conversion: pick the most plausible value, apply it, and state the assumption in one short sentence. OpenAI sells extra Codex credits at about $40 per 1,000. With no duration, assume a month. With no plan named, use the plan the lab is priced at now.

Replies: plain words, two or three short sentences, no markdown headings. Say what you changed, or what you found. If you need to know something only the person can tell you, ask one short question and change nothing.`;

export const CHART_AGENT_TOOL: ToolSpec = {
  name: "apply_changes",
  description: "End the turn: apply any changes to the chart and give the reply the person reads. With nothing to change, send only reply.",
  parameters: {
    type: "object", additionalProperties: false, required: ["reply"],
    properties: {
      reply: { type: "string" },
      view: { type: "object", additionalProperties: false, properties: { labelScale: { type: "number" }, dotScale: { type: "number" }, lineScale: { type: "number" }, density: { type: "number" }, frontier: { type: "boolean" }, links: { type: "boolean" }, guides: { type: "boolean" }, scale: { type: "string", enum: ["log", "linear"] }, allModels: { type: "boolean" }, paretoOnly: { type: "boolean" }, kind: { type: "string", enum: ["scatter", "bars"] }, formula: { type: "string" }, formulaBetter: { type: "string", enum: ["higher", "lower"] } } },
      grid: { type: "boolean" },
      settings: { type: "object", additionalProperties: false, properties: { costBasis: { type: "string", enum: ["subscription", "api"] }, efforts: { type: "array", items: { type: "string" } }, mode: { type: "string", enum: ["all", "best"] }, releasedAfter: { type: "string" }, dataSource: { type: "string" }, freeTiers: { type: "string", enum: ["generous", "limited", "off"] }, planResets: { type: "boolean" }, planReading: { type: "string" }, minUsers: { type: ["number", "null"] }, speedTiers: { type: ["array", "null"], items: { type: "string" } } } },
      plans: { type: "array", items: { type: "object", additionalProperties: false, required: ["lab"], properties: { lab: { type: "string" }, plan: { type: ["string", "null"] } } } },
      models: { type: "object", additionalProperties: false, properties: { showOnly: { type: "array", items: { type: "string" } }, hide: { type: "array", items: { type: "string" } }, show: { type: "array", items: { type: "string" } } } },
      highlight: { type: "object", additionalProperties: false, required: ["mode"], properties: { mode: { type: "string", enum: ["set", "add", "remove", "clear"] }, models: { type: "array", items: { type: "string" } } } },
      dataOverrides: { type: "array", items: { type: "object", additionalProperties: false, required: ["kind", "factor", "note"], properties: { kind: { type: "string", enum: ["subsidy", "cost"] }, factor: { type: "number" }, lab: { type: "string" }, plan: { type: "string" }, model: { type: "string" }, note: { type: "string" } } } },
    },
  },
};

export type ChartTurn = { role: "user" | "assistant"; content: string };

/** System prompt, the earlier turns (their text only), then this request with the chart as it is now. */
export const chartAgentMessages = (context: string, message: string, history: ChartTurn[] = []): Msg[] => [
  { role: "system", content: CHART_AGENT_SYSTEM },
  ...history.slice(-8).map((t): Msg => ({ role: t.role, content: t.content.slice(0, 2000) })),
  { role: "user", content: `The chart right now:\n${context.slice(0, 80_000)}\n\nRequest: ${message.trim().slice(0, 2000)}` },
];
