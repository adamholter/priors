/** Scale's Humanity's Last Exam, text-only subset (questions without images): accuracy ± 95% CI. Entries are inlined in the page's RSC payload. */
import type { RawRow, Source } from "../../../src/data/types";
import { extractKeyed, rscText } from "./_rsc";

const PAGE = "https://scale.com/leaderboard/humanitys_last_exam_text_only";
export const HLE_TEXT_ID = "hle-text-only";
type Entry = { model: string; score: number; confidenceInterval_upper?: number; company?: string; deprecated?: boolean; contaminationMessage?: string };
const EFFORT = /\b(none|minimal|low|medium|high|xhigh|max)\b/i;

export function parseHleText(html: string): RawRow[] {
  const entries = extractKeyed<Entry[]>(rscText(html), "entries").find((list) => Array.isArray(list) && list.some((e) => typeof e?.score === "number" && typeof e?.model === "string"));
  if (!entries) throw new Error("Scale HLE page has no leaderboard entries");
  const best = new Map<string, RawRow>();
  for (const e of entries) {
    if (e.deprecated || !Number.isFinite(e.score)) continue;
    const raw = e.model.replace(/\*/g, "").replace(/\s+/g, " ").trim(); // "gemini-3.1-pro-preview (thinking high)"
    const inner = raw.match(/\(([^)]*)\)/)?.[1] ?? "", effort = inner.match(EFFORT)?.[1]?.toLowerCase();
    // Only an effort word is removed from the label; "(preview)" and the like stay.
    const label = raw.replace(/\(([^)]*)\)/g, (all, p: string) => (EFFORT.test(p) || /^thinking$/i.test(p.trim()) ? " " : all)).replace(/\s+/g, " ").trim();
    const ci = e.confidenceInterval_upper != null ? [e.score - e.confidenceInterval_upper, e.score + e.confidenceInterval_upper] as [number, number] : undefined;
    const row: RawRow = { benchmarkId: HLE_TEXT_ID, modelLabel: label, effort, value: e.score, ci, labHint: e.company, sourceUrl: PAGE, note: [raw, e.contaminationMessage].filter(Boolean).join(" · ") };
    const key = `${label}|${effort ?? ""}`;
    if (!best.has(key) || row.value > best.get(key)!.value) best.set(key, row);
  }
  return [...best.values()];
}

const source: Source = {
  id: "scale-hle-text", name: "Scale HLE (text only)", url: PAGE,
  async scrape(ctx) {
    const html = await ctx.fetchText(PAGE);
    const rows = parseHleText(html);
    if (!rows.length) throw new Error("Scale HLE text-only returned no rows");
    return {
      benchmarks: [{
        id: HLE_TEXT_ID, name: "Humanity's Last Exam (text only)", shortName: "HLE text-only", sourceId: this.id, url: PAGE, unit: "percent" as const, higherIsBetter: true, category: "reasoning" as const,
        normalization: { kind: "linear" as const, min: 0, max: 100 }, eligibleForDefault: true, defaultWeight: 0,
        description: "Scale's run of Humanity's Last Exam on its text-only subset (the questions without images): expert-written frontier questions across disciplines, accuracy with a 95% confidence interval. Models evaluated after HLE became public carry a contamination warning.",
      }],
      rows, raw: { "hle-text.html": html }, notes: [`${rows.length} rows`],
    };
  },
};
export default source;
