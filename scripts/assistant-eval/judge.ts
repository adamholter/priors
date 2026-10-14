/**
 * LLM grader: is the assistant's response reasonable and valid? It sees the request, the behavior we
 * expect, facts from the data, and what the assistant said and did (charts as their data, changes as
 * rank moves). It doesn't require a word-for-word match, only a correct, grounded, useful response.
 */
import type { Snapshot } from "../../src/data/types";
import { formatMetric, type AnswerChart } from "../../src/lib/answer-chart";
import { toShares } from "../../src/agent/solver";
import type { Case } from "./cases";
import type { RunResult } from "./harness";

export const JUDGE_MODEL = "anthropic/claude-sonnet-5.5";
export interface Verdict { score: number; pass: boolean; issues: string[]; costUsd: number }

const chartText = (c: AnswerChart) => {
  const f = (v: number | null) => v == null ? "n/a" : formatMetric(c.kind === "scatter" ? c.y : c.metric, v);
  if (c.kind === "bar") return `bar chart "${c.title}": ${c.items.map((i) => `${i.label} ${f(i.value)}`).join("; ")}`;
  if (c.kind === "grouped") return `grouped bars "${c.title}" (${c.series.join(" / ")}): ${c.groups.map((g) => `${g.label} ${g.values.map(f).join(" / ")}`).join("; ")}`;
  if (c.kind === "lines") return `line chart "${c.title}" over ${c.x.join(", ")}: ${c.lines.map((l) => `${l.label} ${l.values.map(f).join(", ")}`).join("; ")}`;
  return `scatter "${c.title}" (${c.y.name} vs ${c.x.name}): ${c.points.map((p) => `${p.label} (${formatMetric(c.x, p.x)}, ${formatMetric(c.y, p.y)})`).join("; ")}`;
};

/** What the assistant did, in words: the reply with charts inlined, and every change it applied. */
export function describeRun(r: RunResult, snapshot: Snapshot): string {
  if (r.error) return `The assistant failed with: ${r.error}`;
  const d = r.done!, name = (id: string) => snapshot.models.find((m) => m.id === id)?.name ?? id;
  const replyText = d.reply.replace(/\[\[chart:(\d+)\]\]/g, (_, n: string) => { const c = d.charts?.[Number(n) - 1]; return c ? `\n[${chartText(c)}]\n` : ""; });
  const lines = [`Reply:\n${replyText}${d.question ? `\nQuestion to the user: ${d.question}` : ""}${d.suggestions?.length ? `\nReply suggestions: ${d.suggestions.join(" | ")}` : ""}`];
  if (d.proposal) {
    const was = toShares(r.before.weights), now = toShares(r.after.weights), b = (id: string) => { const x = snapshot.benchmarks.find((y) => y.id === id); return x ? `${x.name}${x.shortName && x.shortName !== x.name ? ` (${x.shortName})` : ""}` : id; };
    const mix = [...new Set([...Object.keys(was), ...Object.keys(now)])].map((id) => `${b(id)} ${((was[id] ?? 0) * 100).toFixed(1)}%→${((now[id] ?? 0) * 100).toFixed(1)}%`).join(", ");
    const moved = [...r.rankAfter.entries()].filter(([id, a]) => a <= 15 && r.rankBefore.get(id) !== a).map(([id, a]) => `${name(id)} ${r.rankBefore.get(id) ?? "unranked"}→${a}`).join(", ");
    lines.push(`Applied a mix change. Mix: ${mix}. Rank moves in the top 15: ${moved || "none"}.`);
  } else lines.push("Did not change the mix.");
  if (d.highlight) lines.push(`Set highlights to: ${d.highlight.length ? d.highlight.map((it) => { const [m, e] = it.split("@"); return e ? `${name(m)} ${e}` : name(m); }).join(", ") : "(none)"}.`);
  if (d.theme) lines.push(`Changed the look: ${JSON.stringify(d.theme)}.`);
  return lines.join("\n");
}

export async function judge(c: Case, r: RunResult, facts: string, snapshot: Snapshot, apiKey: string): Promise<Verdict> {
  const prompt = `You grade an assistant inside Priors, a site where users build their own AI-model leaderboard (an "index" = a weighted mix of benchmarks). The assistant can answer questions with data and charts, change the mix, highlight models and change the site theme.

User request${c.history?.length ? ` (after this conversation: ${c.history.map((m) => `${m.role}: ${m.content}`).join(" / ")})` : ""}:
${c.prompt}

What a good response does (a guide, not an exact script; other reasonable answers are fine):
${c.expect}

Facts from the data (ground truth for any numbers):
${facts || "(none needed)"}

Data the assistant's tools returned during this run (also real data; numbers taken from here are grounded, misreadings of it are errors):
${r.tools.filter((t) => !["propose", "highlight", "set_theme"].includes(t.name)).map((t) => `${t.name}(${JSON.stringify(t.args)}) → ${JSON.stringify(t.result).slice(0, 3000)}`).join("\n") || "(no data tools called)"}

What the assistant did (each embedded chart appears in the reply as [bracketed chart data] where the user sees it):
${describeRun(r, snapshot)}

Grade from 1 to 5: 5 = correct, grounded and useful; 4 = good with small flaws; 3 = acceptable, answers the request reasonably, no factual errors; 2 = partly wrong, misleading or misses the point; 1 = wrong, invented data, or did something harmful or unasked. Any number that contradicts the facts, or any invented model or data, caps the score at 2. Doing an unrequested change (mix, highlight, theme) caps it at 2. Being slightly different from the guide is fine. Don't penalize brevity.
Reply with JSON only: {"score": <1-5>, "issues": ["short issue", ...]}`;
  let cost = 0, last = "";
  // A verdict is JSON; one retry covers the odd prose reply.
  for (let attempt = 0; attempt < 2; attempt++) {
    const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST", headers: { authorization: `Bearer ${apiKey}`, "content-type": "application/json", "x-title": "Priors assistant eval" },
      body: JSON.stringify({ model: JUDGE_MODEL, messages: [{ role: "user", content: attempt ? `${prompt}\n\nYour previous reply wasn't JSON. Reply with the JSON object only.` : prompt }], max_tokens: 2000, reasoning: { effort: "low" }, usage: { include: true }, response_format: { type: "json_object" } }),
    });
    const data = await res.json() as { choices?: { message: { content: string } }[]; usage?: { cost?: number } };
    cost += data.usage?.cost ?? 0;
    last = data.choices?.[0]?.message.content ?? "";
    try {
      const v = JSON.parse(last.slice(last.indexOf("{"), last.lastIndexOf("}") + 1)) as { score: number; issues?: string[] };
      if (typeof v.score === "number") return { score: v.score, pass: v.score >= 3, issues: v.issues ?? [], costUsd: cost };
    } catch { /* retry */ }
  }
  return { score: 0, pass: false, issues: [`grader returned no verdict: ${last.slice(0, 200)}`], costUsd: cost };
}
