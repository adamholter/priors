/**
 * prinzbench (prinz, github.com/prinz-ai/prinzbench): a lawyer's private benchmark of 25 legal research
 * questions in a niche area of U.S. law and 8 needle-in-the-haystack web search questions. Each question is
 * asked three times and graded by hand at pass@1 by the author (not blind), 99 points in all. Models are run
 * in their own apps and CLIs (ChatGPT, Codex, claude.ai, AI Studio, kimi.com, ...) with web search.
 *
 * The leaderboard is a Markdown table in the repo README between `<!-- LEADERBOARD_START -->` and
 * `<!-- LEADERBOARD_END -->`, read from raw.githubusercontent.com. The column maxima come from the header
 * ("(x/99)"), so a change in question count changes the scale instead of misreading it. Value is the full
 * score; the Legal Research and Search sub-scores are in `details`. A trailing `*` (accessed in early
 * testing, before release) is a footnote, dropped from the label and kept in the note. API efforts in
 * parentheses ("(max)", "(xhigh)") go to `effort`. ChatGPT's thinking-time settings ("(extended)",
 * "(heavy)") have no published API equivalent, so they stay in the label and the row takes the model's
 * highest known effort. Rows are emitted best first, so where several settings land on one variant the
 * build keeps the best.
 */
import type { RawRow, ScrapeResult, Source } from "../../../src/data/types";
import { num } from "../harness";
import { splitLabel } from "./_board";

const REPO = "https://github.com/prinz-ai/prinzbench";
const RAW = "https://raw.githubusercontent.com/prinz-ai/prinzbench";
const README = `${RAW}/main/README.md`, README_COMMITS = "https://api.github.com/repos/prinz-ai/prinzbench/commits?path=README.md&per_page=10";
export const PRINZBENCH_ID = "prinzbench";

const MONTHS = ["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december"];

/** "Last updated on July 18, 2026" → "2026-07-18". */
function updatedOn(block: string): string | undefined {
  const m = block.match(/Last updated on\s+([A-Za-z]+)\s+(\d{1,2}),\s*(\d{4})/i);
  const month = m ? MONTHS.indexOf(m[1].toLowerCase()) + 1 : 0;
  return m && month ? `${m[3]}-${String(month).padStart(2, "0")}-${m[2].padStart(2, "0")}` : undefined;
}

export function parsePrinzbench(md: string): { rows: RawRow[]; outOf: number; updated?: string } {
  const block = md.match(/<!--\s*LEADERBOARD_START\s*-->([\s\S]*?)<!--\s*LEADERBOARD_END\s*-->/)?.[1];
  if (!block) throw new Error("prinzbench README has no LEADERBOARD_START/END block");
  const cells = (line: string) => line.trim().replace(/^\|/, "").replace(/\|$/, "").split("|").map((c) => c.trim());
  const lines = block.split(/\r?\n/).filter((l) => l.trim().startsWith("|"));
  const header = cells(lines[0] ?? "");
  const col = (re: RegExp) => header.findIndex((h) => re.test(h));
  const outOfCol = (i: number) => num(header[i]?.match(/x\s*\/\s*(\d+)/i)?.[1]);
  // "\bsearch" so the "Legal Research" column does not match.
  const iModel = col(/^model$/i), iFull = col(/full/i), iLegal = col(/legal/i), iSearch = col(/\bsearch\b/i);
  const outOf = outOfCol(iFull);
  if (iModel < 0 || iFull < 0 || !outOf) throw new Error(`prinzbench leaderboard columns changed: ${header.join(" | ")}`);
  const legalOutOf = outOfCol(iLegal), searchOutOf = outOfCol(iSearch);

  const rows: RawRow[] = [];
  for (const line of lines.slice(1)) {
    const c = cells(line);
    if (c.every((x) => /^:?-+:?$/.test(x))) continue;
    const shown = c[iModel] ?? "", value = num(c[iFull]);
    if (!shown || value == null) continue;
    const earlyAccess = /\*\s*$/.test(shown);
    const plain = shown.replace(/\s*\*+\s*$/, "").trim();
    const { label, effort } = splitLabel(plain);
    const legal = iLegal >= 0 ? num(c[iLegal]) : undefined, search = iSearch >= 0 ? num(c[iSearch]) : undefined;
    const parts = [plain];
    if (legal != null) parts.push(`Legal Research ${legal}/${legalOutOf ?? "?"}`);
    if (search != null) parts.push(`Search ${search}/${searchOutOf ?? "?"}`);
    if (earlyAccess) parts.push("accessed in early testing, before public release");
    rows.push({
      benchmarkId: PRINZBENCH_ID, modelLabel: label, effort, value, sourceUrl: REPO,
      note: parts.join(" · "),
      details: { legalResearch: legal, legalResearchOutOf: legalOutOf, search, searchOutOf, earlyAccess },
    });
  }
  if (!rows.length) throw new Error("prinzbench leaderboard had no rows");
  rows.sort((a, b) => b.value - a.value);
  return { rows, outOf, updated: updatedOn(block) };
}

export const hasLeaderboard = (md: string) => /<!--\s*LEADERBOARD_START\s*-->/.test(md);

/**
 * The README on main, or, when it no longer carries the leaderboard (a November 2026 upload replaced it with another of the
 * author's documents), the newest earlier version that does, so the published scores stay readable.
 */
export async function latestBoard(fetchText: (url: string) => Promise<string>): Promise<{ md: string; commit?: string }> {
  const md = await fetchText(README);
  if (hasLeaderboard(md)) return { md };
  for (const { sha } of JSON.parse(await fetchText(README_COMMITS)) as { sha: string }[]) {
    const old = await fetchText(`${RAW}/${sha}/README.md`);
    if (hasLeaderboard(old)) return { md: old, commit: sha.slice(0, 7) };
  }
  throw new Error("prinzbench: no recent README has a leaderboard");
}

const source: Source = {
  id: "prinzbench",
  name: "PrinzBench",
  url: REPO,
  async scrape(ctx): Promise<ScrapeResult> {
    const { md, commit } = await latestBoard(ctx.fetchText);
    const { rows, outOf, updated } = parsePrinzbench(md);
    return {
      benchmarks: [{
        id: PRINZBENCH_ID, name: "PrinzBench", shortName: "PrinzBench", sourceId: this.id, url: REPO, lastUpdated: updated,
        description: `A lawyer's private benchmark: 25 legal research questions in a niche area of U.S. law (find the statutes, regulations and guidance online, then reach the right conclusion) and 8 needle-in-the-haystack web search questions. Each is asked three times and hand-graded by the author at pass@1, not blind; score out of ${outOf}. The author considers it saturated since June 2026 and no longer tests OpenAI's Pro models.`,
        normalization: { kind: "linear", min: 0, max: outOf },
        unit: "score", higherIsBetter: true, category: "knowledge", eligibleForDefault: false, defaultWeight: 0,
      }],
      rows, raw: { "README.md": md },
      notes: [`${rows.length} rows, updated ${updated ?? "?"}${commit ? `; main's README has no leaderboard, read from ${commit}` : ""}`],
    };
  },
};
export default source;
