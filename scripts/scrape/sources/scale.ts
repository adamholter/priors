/**
 * Scale Labs leaderboards, from the entries inlined in each page's RSC payload.
 *  - SWE Atlas-QnA: agents answer deep questions about real codebases using shell tools; rubric-graded Task Resolve
 *    Rate (± CI).
 *  - SWE-Bench Pro V2 (since 2026-11-11; Benchmark Heaven's copy before): the page's two tabs, Full and HARD, as
 *    `variants: [{ key, label, entries }]`. They keep Benchmark Heaven's ids (`bh-scale-swe-bench-pro-v2-full`,
 *    `-hard`) so saved mixes keep working. Its copy lagged (6 of 18 HARD rows missing) and folded the harness into
 *    the model name ("GPT-6.1-Sol (mini-swe-agent)" became a "GPT-6.1 Sol Mini" model, "(Codex)" a "GPT-6 Astra
 *    Codex" model, "Inkling 2 Small" landed on Inkling Small); here the parenthesis is the harness, as on Scale.
 *    Full is near-saturated on Scale's own board (Opus 5 99.4, Haiku 5.5 87.23, the lowest);
 *    HARD is the one that separates models.
 */
import type { RawRow, ScrapeResult, Source } from "../../../src/data/types";
import { extractKeyed, rscText } from "./_rsc";

const PAGE = "https://labs.scale.com/leaderboard/sweatlas-qna";
type Entry = { model: string; score: number; confidenceInterval_upper?: number; company?: string; deprecated?: boolean; createdAt?: string; contaminationMessage?: string };
const EFFORT = /\b(none|minimal|low|medium|high|xhigh|max)\b/i;

const isEntries = (list: unknown): list is Entry[] => Array.isArray(list) && list.some((e) => typeof e?.score === "number" && typeof e?.model === "string");

export function parseScaleEntries(html: string): RawRow[] {
  const entries = extractKeyed<Entry[]>(rscText(html), "entries").find(isEntries);
  if (!entries) throw new Error("Scale page has no leaderboard entries");
  return rowsFromEntries(entries, "swe-atlas-qna", PAGE);
}

const PRO_V2 = "https://labs.scale.com/leaderboard/swe_bench_pro_public_v2";
export const PRO_V2_BOARDS = {
  full: { id: "bh-scale-swe-bench-pro-v2-full", name: "Scale SEAL: SWE-Bench Pro V2 Full", shortName: "SWE-Bench Pro V2 Full",
    description: "Scale AI's refreshed public SWE-Bench Pro split (642 long-horizon tasks in 11 copyleft repositories) run under a locked protocol with web tools off, every diff re-graded on a pristine image. Resolve rate on the full V2 split, as Scale publishes it; ± is the published confidence half-width. Near-saturated at the top: HARD separates models. Best harness per model and effort." },
  hard: { id: "bh-scale-swe-bench-pro-v2-hard", name: "Scale SEAL: SWE-Bench Pro V2 HARD", shortName: "SWE-Bench Pro V2 HARD",
    description: "The HARD subset of Scale AI's SWE-Bench Pro V2 (642 long-horizon tasks in 11 copyleft repositories, locked protocol, web tools off, diffs re-graded on a pristine image). Resolve rate on the hardest tasks, as Scale publishes it; ± is the published confidence half-width. Best harness per model and effort." },
} as const;

/** SWE-Bench Pro V2: one row set per tab ("full", "hard"). */
export function parseProV2(html: string): Record<keyof typeof PRO_V2_BOARDS, RawRow[]> {
  const variants = extractKeyed<{ key: string; label: string; entries: Entry[] }[]>(rscText(html), "variants")
    .find((list) => Array.isArray(list) && list.some((v) => isEntries(v?.entries)));
  if (!variants) throw new Error("SWE-Bench Pro V2 page has no leaderboard tabs");
  const out = {} as Record<keyof typeof PRO_V2_BOARDS, RawRow[]>;
  for (const key of Object.keys(PRO_V2_BOARDS) as (keyof typeof PRO_V2_BOARDS)[]) {
    const v = variants.find((x) => x.key === key);
    if (!v || !isEntries(v.entries)) throw new Error(`SWE-Bench Pro V2 page has no "${key}" tab (tabs: ${variants.map((x) => x.key).join(", ")})`);
    out[key] = rowsFromEntries(v.entries, PRO_V2_BOARDS[key].id, PRO_V2);
  }
  return out;
}

function rowsFromEntries(entries: Entry[], benchmarkId: string, page: string): RawRow[] {
  const best = new Map<string, RawRow>();
  for (const e of entries) {
    if (e.deprecated || !Number.isFinite(e.score)) continue;
    const raw = e.model.replace(/\*/g, "").replace(/\s+/g, " ").trim(); // "Opus 5 (Claude Code) xHigh"
    const harness = raw.match(/\(([^)]*)\)/)?.[1];
    const effort = raw.replace(/\([^)]*\)/g, " ").match(EFFORT)?.[1]?.toLowerCase();
    // Scale writes some versions with a "p" for the point ("Minimax M3p1 Flash" is MiniMax M3.1 Flash).
    const label = raw.replace(/\([^)]*\)/g, " ").replace(EFFORT, " ").replace(/\b([A-Za-z]+\d+)p(\d+)\b/g, "$1.$2").replace(/\s+/g, " ").trim();
    const ci = e.confidenceInterval_upper != null ? [e.score - e.confidenceInterval_upper, e.score + e.confidenceInterval_upper] as [number, number] : undefined;
    const row: RawRow = { benchmarkId, modelLabel: label, effort, value: e.score, ci, harness, labHint: e.company, sourceUrl: page, note: [raw, e.contaminationMessage].filter(Boolean).join(" · ") };
    const key = `${label}|${effort ?? ""}`;
    if (!best.has(key) || row.value > best.get(key)!.value) best.set(key, row);
  }
  return [...best.values()];
}

const source: Source = {
  id: "scale", name: "Scale Labs", url: PAGE,
  async scrape(ctx): Promise<ScrapeResult> {
    const [html, v2html] = await Promise.all([ctx.fetchText(PAGE), ctx.fetchText(PRO_V2)]);
    const qna = parseScaleEntries(html);
    if (!qna.length) throw new Error("SWE Atlas-QnA returned no rows");
    const v2 = parseProV2(v2html);
    const rows = [...qna, ...v2.full, ...v2.hard];
    return {
      benchmarks: [...(Object.keys(PRO_V2_BOARDS) as (keyof typeof PRO_V2_BOARDS)[]).map((k) => ({
        ...PRO_V2_BOARDS[k], sourceId: "scale", url: PRO_V2, unit: "percent" as const, higherIsBetter: true, category: "coding" as const, versionPolicy: { kind: "fresh" as const }, defaultWeight: 0,
      })), { id: "swe-atlas-qna", name: "SWE Atlas-QnA", shortName: "SWE Atlas QnA", sourceId: "scale", url: PAGE, unit: "percent", higherIsBetter: true, category: "coding", eligibleForDefault: true, defaultWeight: 0,
        description: "Agents explore real repositories with shell tools and answer deep codebase questions; rubric-graded Task Resolve Rate (all rubric items met). Best harness per model/effort." }],
      rows, raw: { "sweatlas-qna.html": html, "swe-bench-pro-v2.html": v2html }, notes: [`SWE Atlas-QnA ${qna.length} rows; SWE-Bench Pro V2 Full ${v2.full.length}, HARD ${v2.hard.length}`],
    };
  },
};
export default source;
