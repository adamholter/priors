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
const EFFORT = /\b(none|minimal|low|medium|high|xhigh|max)$/i;

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

/** One row set per tab of a Scale page whose leaderboard comes in tabs (`variants`), keyed like `boards`. */
function parseTabs<K extends string>(html: string, boards: Record<K, { id: string }>, page: string, what: string): Record<K, RawRow[]> {
  const variants = extractKeyed<{ key: string; label: string; entries: Entry[] }[]>(rscText(html), "variants")
    .find((list) => Array.isArray(list) && list.some((v) => isEntries(v?.entries)));
  if (!variants) throw new Error(`${what} page has no leaderboard tabs`);
  const out = {} as Record<K, RawRow[]>;
  for (const key of Object.keys(boards) as K[]) {
    const v = variants.find((x) => x.key === key);
    if (!v || !isEntries(v.entries)) throw new Error(`${what} page has no "${key}" tab (tabs: ${variants.map((x) => x.key).join(", ")})`);
    out[key] = rowsFromEntries(v.entries, boards[key].id, page);
  }
  return out;
}

/** SWE-Bench Pro V2: one row set per tab ("full", "hard"). */
export const parseProV2 = (html: string) => parseTabs(html, PRO_V2_BOARDS, PRO_V2, "SWE-Bench Pro V2");

/**
 * SWE Atlas v1.1 (November 2026): one page with an Overall tab and one per lane, the same 284 tasks as v1.0 re-run with a
 * new judge (GPT-6.1 Sol, majority of three), refined criteria and restricted network, so not comparable with v1.0.
 * Each lane replaces its v1.0 board: QnA the old sweatlas-qna page Priors read, Test Writing and Refactoring the boards
 * Benchmark Heaven carries.
 */
export const SWE_ATLAS = "https://labs.scale.com/leaderboard/swe-atlas";
const ATLAS_NOTE = " Version 1.1: every model re-run with a new judge (GPT-6.1 Sol, majority of three votes), refined grading criteria and restricted network access, so scores are not comparable with v1.0. Best harness per model and effort.";
export const SWE_ATLAS_BOARDS = {
  overall: { id: "swe-atlas-v1-1", name: "SWE Atlas v1.1", shortName: "SWE Atlas",
    description: `Scale AI's index of professional coding work beyond fixing issues: 284 tasks in real repositories across three lanes, answering questions about a codebase, writing tests and refactoring.${ATLAS_NOTE}` },
  qna: { id: "swe-atlas-qna-v1-1", name: "SWE Atlas v1.1 Codebase QnA", shortName: "SWE Atlas QnA", supersedes: "swe-atlas-qna",
    description: `Agents explore real repositories with shell tools and answer deep codebase questions (124 tasks); a task counts when every rubric item is met.${ATLAS_NOTE}` },
  testwriting: { id: "swe-atlas-tw-v1-1", name: "SWE Atlas v1.1 Test Writing", shortName: "SWE Atlas Test Writing", supersedes: "bh-swe-atlas-test-writing",
    description: `Agents write tests for described behaviour in real repositories (90 tasks); the tests must pass on the code and fail once the implementation is replaced, plus rubrics.${ATLAS_NOTE}` },
  refactoring: { id: "swe-atlas-refactoring-v1-1", name: "SWE Atlas v1.1 Refactoring", shortName: "SWE Atlas Refactoring", supersedes: "bh-swe-atlas-refactoring",
    description: `Agents refactor production code without changing what it does (70 tasks); the relevant tests must still pass, plus rubrics.${ATLAS_NOTE}` },
} as const;
export const parseSweAtlas = (html: string) => parseTabs(html, SWE_ATLAS_BOARDS, SWE_ATLAS, "SWE Atlas v1.1");

function rowsFromEntries(entries: Entry[], benchmarkId: string, page: string): RawRow[] {
  const best = new Map<string, RawRow>();
  for (const e of entries) {
    if (e.deprecated || !Number.isFinite(e.score)) continue;
    const raw = e.model.replace(/\*/g, "").replace(/\s+/g, " ").trim(); // "Opus 5 (Claude Code) xHigh"
    const harness = raw.match(/\(([^)]*)\)/)?.[1];
    // The effort is the last word ("Qwen 3.8 Max (mini-swe-agent) max": "Max" is the model's name, "max" its effort).
    const bare = raw.replace(/\([^)]*\)/g, " ").replace(/\s+/g, " ").trim(), last = bare.match(EFFORT);
    const effort = last?.[1]?.toLowerCase();
    // Scale writes some versions with a "p" for the point ("Minimax M3p1 Flash" is MiniMax M3.1 Flash).
    const label = (last ? bare.slice(0, last.index) : bare).replace(/\b([A-Za-z]+\d+)p(\d+)\b/g, "$1.$2").trim();
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
    const [html, v2html, atlasHtml] = await Promise.all([ctx.fetchText(PAGE), ctx.fetchText(PRO_V2), ctx.fetchText(SWE_ATLAS)]);
    const qna = parseScaleEntries(html);
    if (!qna.length) throw new Error("SWE Atlas-QnA returned no rows");
    const v2 = parseProV2(v2html);
    const atlas = parseSweAtlas(atlasHtml);
    const atlasKeys = Object.keys(SWE_ATLAS_BOARDS) as (keyof typeof SWE_ATLAS_BOARDS)[];
    const rows = [...qna, ...v2.full, ...v2.hard, ...atlasKeys.flatMap((k) => atlas[k])];
    return {
      benchmarks: [...(Object.keys(PRO_V2_BOARDS) as (keyof typeof PRO_V2_BOARDS)[]).map((k) => ({
        ...PRO_V2_BOARDS[k], sourceId: "scale", url: PRO_V2, unit: "percent" as const, higherIsBetter: true, category: "coding" as const, versionPolicy: { kind: "fresh" as const }, defaultWeight: 0,
      })), { id: "swe-atlas-qna", name: "SWE Atlas-QnA", shortName: "SWE Atlas QnA", sourceId: "scale", url: PAGE, unit: "percent", higherIsBetter: true, category: "coding", eligibleForDefault: true, defaultWeight: 0,
        description: "Agents explore real repositories with shell tools and answer deep codebase questions; rubric-graded Task Resolve Rate (all rubric items met). Best harness per model/effort." },
      ...atlasKeys.map((k) => { const { supersedes, ...b } = SWE_ATLAS_BOARDS[k] as typeof SWE_ATLAS_BOARDS[typeof k] & { supersedes?: string }; return {
        ...b, sourceId: "scale", url: SWE_ATLAS, unit: "percent" as const, higherIsBetter: true, category: "coding" as const, defaultWeight: 0,
        versionPolicy: { kind: "fresh" as const, ...(supersedes ? { supersedes } : {}) }, ...(k === "qna" ? { eligibleForDefault: true } : {}) }; })],
      rows, raw: { "sweatlas-qna.html": html, "swe-bench-pro-v2.html": v2html, "swe-atlas.html": atlasHtml },
      notes: [`SWE Atlas-QnA ${qna.length} rows; SWE-Bench Pro V2 Full ${v2.full.length}, HARD ${v2.hard.length}; SWE Atlas v1.1 ${atlasKeys.map((k) => `${k} ${atlas[k].length}`).join(", ")}`],
    };
  },
};
export default source;
