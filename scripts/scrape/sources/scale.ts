/**
 * Scale Labs leaderboards. SWE Atlas-QnA: agents answer deep questions about real codebases using
 * shell tools; rubric-graded Task Resolve Rate (± CI). Entries are inlined in the page's RSC payload.
 */
import type { RawRow, ScrapeResult, Source } from "../../../src/data/types";
import { extractKeyed, rscText } from "./_rsc";

const PAGE = "https://labs.scale.com/leaderboard/sweatlas-qna";
type Entry = { model: string; score: number; confidenceInterval_upper?: number; company?: string; deprecated?: boolean; createdAt?: string; contaminationMessage?: string };
const EFFORT = /\b(none|minimal|low|medium|high|xhigh|max)\b/i;

export function parseScaleEntries(html: string): RawRow[] {
  const entries = extractKeyed<Entry[]>(rscText(html), "entries").find((list) => Array.isArray(list) && list.some((e) => typeof e?.score === "number" && typeof e?.model === "string"));
  if (!entries) throw new Error("Scale page has no leaderboard entries");
  const best = new Map<string, RawRow>();
  for (const e of entries) {
    if (e.deprecated || !Number.isFinite(e.score)) continue;
    const raw = e.model.replace(/\*/g, "").replace(/\s+/g, " ").trim(); // "Opus 5 (Claude Code) xHigh"
    const harness = raw.match(/\(([^)]*)\)/)?.[1];
    const effort = raw.replace(/\([^)]*\)/g, " ").match(EFFORT)?.[1]?.toLowerCase();
    const label = raw.replace(/\([^)]*\)/g, " ").replace(EFFORT, " ").replace(/\s+/g, " ").trim();
    const ci = e.confidenceInterval_upper != null ? [e.score - e.confidenceInterval_upper, e.score + e.confidenceInterval_upper] as [number, number] : undefined;
    const row: RawRow = { benchmarkId: "swe-atlas-qna", modelLabel: label, effort, value: e.score, ci, harness, labHint: e.company, sourceUrl: PAGE, note: [raw, e.contaminationMessage].filter(Boolean).join(" · ") };
    const key = `${label}|${effort ?? ""}`;
    if (!best.has(key) || row.value > best.get(key)!.value) best.set(key, row);
  }
  return [...best.values()];
}

const source: Source = {
  id: "scale", name: "Scale Labs", url: PAGE,
  async scrape(ctx): Promise<ScrapeResult> {
    const html = await ctx.fetchText(PAGE);
    const rows = parseScaleEntries(html);
    if (!rows.length) throw new Error("SWE Atlas-QnA returned no rows");
    return {
      benchmarks: [{ id: "swe-atlas-qna", name: "SWE Atlas-QnA", shortName: "SWE Atlas QnA", sourceId: "scale", url: PAGE, unit: "percent", higherIsBetter: true, category: "coding", eligibleForDefault: true, defaultWeight: 0,
        description: "Agents explore real repositories with shell tools and answer deep codebase questions; rubric-graded Task Resolve Rate (all rubric items met). Best harness per model/effort." }],
      rows, raw: { "sweatlas-qna.html": html }, notes: [`${rows.length} rows`],
    };
  },
};
export default source;
