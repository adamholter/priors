import type { PlanResetEvent, PlanResets, ScrapeContext } from "../../src/data/types";

export const CODEX_RESETS_URL = "https://opentherank.com/codex-reset";
export const CLAUDE_RESETS_URL = "https://claude-resets.com/data/resets.json";

const attr = (tag: string, name: string) => new RegExp(`\\b${name}="([^"]*)"`).exec(tag)?.[1];

/**
 * OpenTheRank's Codex reset tracker (Tibo's, linked to his posts). Every reset is a `cx-stamp` element with an ISO
 * time (`data-at`), a type (`regular`, `banked` or `both`) and the X post id. Throws when the page has too few to be right.
 */
export function parseCodexResets(html: string): PlanResetEvent[] {
  const seen = new Set<string>(), events: PlanResetEvent[] = [];
  for (const m of html.matchAll(/<(?:a|span)\b[^>]*class="cx-stamp"[^>]*>/g)) {
    const at = attr(m[0], "data-at"), type = attr(m[0], "data-type"), id = attr(m[0], "data-id");
    if (!at || !Number.isFinite(Date.parse(at)) || seen.has(id ?? at)) continue;
    seen.add(id ?? at);
    events.push({ at: new Date(at).toISOString(), kind: type === "banked" ? "banked" : type === "both" ? "both" : "reset", scope: "all", url: id ? `https://x.com/thsottiaux/status/${id}` : undefined });
  }
  if (events.length < 30) throw new Error(`OpenTheRank: ${events.length} resets found; page changed?`);
  return events.sort((a, b) => a.at.localeCompare(b.at));
}

interface ClaudeResetsFile { providers?: { claude?: { events?: { date?: string; kind?: string; resetType?: string; scope?: string; url?: string }[] } } }
/** claude-resets.com (CC BY 4.0): Anthropic's resets. `policy` entries (a limit change, no refill) are not resets. */
export function parseClaudeResets(file: ClaudeResetsFile): PlanResetEvent[] {
  const events = file.providers?.claude?.events;
  if (!Array.isArray(events)) throw new Error("claude-resets.com: unexpected file shape");
  const out = events.filter((e) => e.kind === "reset" && e.date && Number.isFinite(Date.parse(e.date)))
    .map((e): PlanResetEvent => ({ at: new Date(e.date!).toISOString(), kind: e.resetType === "banked" ? "banked" : "reset", scope: e.scope, url: e.url }))
    .sort((a, b) => a.at.localeCompare(b.at));
  if (out.length < 5) throw new Error(`claude-resets.com: ${out.length} resets found; file changed?`);
  return out;
}

/**
 * Each lab's reset history. A lab whose source fails or changed shape is reported in `failed`, so the caller carries
 * its last history forward instead of dropping it (a missing history would silently price plans without resets).
 */
export async function fetchPlanResets(ctx: ScrapeContext): Promise<{ resets: PlanResets[]; failed: string[]; raw: Record<string, string> }> {
  const resets: PlanResets[] = [], failed: string[] = [], raw: Record<string, string> = {};
  const jobs: { labId: string; plan: string; source: string; url: string; run: () => Promise<PlanResetEvent[]> }[] = [
    { labId: "openai", plan: "ChatGPT / Codex", source: "OpenTheRank Codex reset tracker", url: CODEX_RESETS_URL, run: async () => { const html = await ctx.fetchText(CODEX_RESETS_URL); raw["codex-reset.html"] = html; return parseCodexResets(html); } },
    { labId: "anthropic", plan: "Claude", source: "claude-resets.com", url: CLAUDE_RESETS_URL, run: async () => { const text = await ctx.fetchText(CLAUDE_RESETS_URL); raw["claude-resets.json"] = text; return parseClaudeResets(JSON.parse(text) as ClaudeResetsFile); } },
  ];
  await Promise.all(jobs.map(async ({ run, ...meta }) => {
    try { resets.push({ ...meta, events: await run() }); }
    catch (e) { failed.push(meta.labId); ctx.log(`${meta.source}: ${e instanceof Error ? e.message : String(e)}`); }
  }));
  if (!resets.length) throw new Error("no reset history could be read");
  for (const r of resets) ctx.log(`${r.labId}: ${r.events.length} resets (${r.events.filter((e) => e.kind !== "banked").length} regular), latest ${r.events.at(-1)?.at}`);
  return { resets: resets.sort((a, b) => a.labId.localeCompare(b.labId)), failed, raw };
}
