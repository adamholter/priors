/** Scale's live Humanity's Sixth Sense leaderboard, inlined in its RSC page payload. */
import type { RawRow, ScrapeResult, Source } from "../../../src/data/types";
import { extractKeyed, rscText } from "./_rsc";

export const HSS_PAGE = "https://labs.scale.com/leaderboard/hss";
export const HSS_ID = "humanitys-sixth-sense";
type Entry = {
  model: string;
  score: number;
  rank?: number;
  confidenceInterval_upper?: number;
  company?: string;
  deprecated?: boolean;
  contaminationMessage?: string;
};

export function parseHssEntries(html: string): RawRow[] {
  const lists = extractKeyed<unknown>(rscText(html), "entries");
  const entries = lists.find((list): list is Entry[] => Array.isArray(list)
    && list.some((e) => e && typeof e.model === "string" && "score" in e));
  if (!entries) throw new Error("HSS page has no leaderboard entries");
  const rows: RawRow[] = [];
  for (const entry of entries) {
    if (entry?.deprecated) continue;
    if (typeof entry?.model !== "string" || !entry.model.trim()
      || typeof entry.score !== "number" || !Number.isFinite(entry.score)
      || entry.score < 0 || entry.score > 100) throw new Error("HSS leaderboard entry schema changed");
    const label = entry.model.replace(/\s+/g, " ").trim();
    if (/^humans?(?:\s|$|\()/i.test(label)) continue;
    // Keep model names such as Qwen3.8-Max intact; only parentheses specify effort.
    const effort = label.match(/\((none|minimal|low|medium|high|xhigh|max)\)\s*$/i)?.[1]?.toLowerCase();
    const halfWidth = entry.confidenceInterval_upper;
    if (halfWidth != null && (typeof halfWidth !== "number" || !Number.isFinite(halfWidth) || halfWidth < 0)) {
      throw new Error("HSS confidence interval schema changed");
    }
    rows.push({
      benchmarkId: HSS_ID, modelLabel: label, effort, value: entry.score,
      ci: halfWidth == null ? undefined : [entry.score - halfWidth, entry.score + halfWidth],
      rank: entry.rank, labHint: entry.company, sourceUrl: HSS_PAGE,
      note: [label, entry.contaminationMessage].filter(Boolean).join(" · "),
    });
  }
  if (!rows.length) throw new Error("HSS returned no active model results");
  return rows;
}

const source: Source = {
  id: "scale-hss", name: "Scale Labs HSS", url: HSS_PAGE,
  async scrape(ctx): Promise<ScrapeResult> {
    const html = await ctx.fetchText(HSS_PAGE);
    const rows = parseHssEntries(html);
    return {
      benchmarks: [{
        id: HSS_ID, name: "Humanity's Sixth Sense", shortName: "HSS", sourceId: this.id,
        url: HSS_PAGE, unit: "percent", higherIsBetter: true, category: "reasoning",
        eligibleForDefault: true, defaultWeight: 0,
        description: "Scale AI and Elorian's intuitive visual reasoning benchmark: 522 image and silent-video tasks covering temporal, spatial, social and abstract inference. Pass@1 averaged over three attempts per task; all rubric criteria must pass. Published intervals are 95% task-cluster bootstrap intervals.",
      }],
      rows, raw: { "hss.html": html }, notes: [`${rows.length} live model results`],
    };
  },
};
export default source;
