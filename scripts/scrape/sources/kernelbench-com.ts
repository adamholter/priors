/**
 * kernelbench.com (Elliot Arledge, github.com/Infatoshi/kernelbench.com): autonomous coding agents write
 * GPU kernels in long unlimited sessions, graded against the hardware roofline and audited for reward
 * hacking before a result counts. Independent of Stanford's KernelBench (the site says so), hence the
 * `kernelbench-com` ids.
 *
 * Data: the site's own model index, `/data/models.json` (the repo's `public/data/models.json`, which the
 * site bakes its boards from). It publishes three decks; we read the two scored per problem, on the
 * canonical RTX PRO 6000 board (the top-level block of each bench; the H100/B200 boards are left out):
 *  - Hard (`kernelbench-com-hard`): six per-op kernels in CUDA or Triton, cell score = peak fraction of
 *    roofline.
 *  - CUDA (`kernelbench-com-cuda`): four CUDA-only problems (Triton and other DSLs fail), cell score =
 *    peak fraction of roofline except DeepSeek NSA, scored from latency against a reference, so a cell
 *    can exceed 1.
 * Mega (one megakernel problem, scored as a speedup) is not read.
 *
 * One number per model is the homepage deck's ranking (`DeckPanel` in app/_components/home-decks.tsx):
 * each problem's score as a share of the best listed model's score on that problem, averaged over the full
 * deck (every problem any listed model has a cell for). Only `valid` cells count (correct and audited
 * clean); failed, flagged, unaudited or missing cells count 0. Scaling per problem matters on CUDA: DeepSeek
 * NSA is scored against a reference latency (around 1.0) while the others are shares of roofline (around
 * 0.1), so a plain mean of raw scores (the site's column charts) is decided by that one problem. The raw
 * full-deck mean stays in `details.rawMean`, each problem's raw score and best in `details`. A model whose
 * cells on a board are all still unaudited is skipped there (pending, not 0).
 *
 * Only the live roster counts: the homepage links each listed model at `/models/<slug>`. Retired
 * (superseded or historical) models keep their pages but are off the boards, so they are left out too.
 * Labels are the index's display names ("Gemini 4 Argon (High)"); effort is the board's own setting.
 */
import type { RawRow, ScrapeResult, Source } from "../../../src/data/types";

const SITE = "https://kernelbench.com/";
const DATA = "https://kernelbench.com/data/models.json";

export const KERNELBENCH_COM = {
  hard: { id: "kernelbench-com-hard", name: "KernelBench Hard (kernelbench.com)", shortName: "kernelbench.com Hard", page: "https://kernelbench.com/#hard",
    description: "Coding agents write six GPU kernels (FP8 and W4A16 GEMMs, KDA, paged attention, top-k, MoE) in CUDA or Triton, one unlimited session per problem on an RTX PRO 6000, each run audited for reward hacking. Each problem scored as a share of the best model's result on it (peak fraction of roofline), averaged over the full deck, as kernelbench.com ranks its board; failed, flagged or unaudited problems count 0. Independent of Stanford's KernelBench." },
  cuda: { id: "kernelbench-com-cuda", name: "KernelBench CUDA (kernelbench.com)", shortName: "kernelbench.com CUDA", page: "https://kernelbench.com/#cuda",
    description: "Coding agents write four CUDA-only GPU kernels (GLM-5.2 fused MoE, DeepSeek sparse attention, MegaQwen decode, grid MinGRU scan) where Triton and other DSLs fail, one unlimited session per problem on an RTX PRO 6000, each run audited for reward hacking. Each problem scored as a share of the best model's result on it (peak fraction of roofline; sparse attention against a reference latency), averaged over the full deck, as kernelbench.com ranks its board, so no one problem's scale decides the mean; failed, flagged or unaudited problems count 0. Independent of Stanford's KernelBench." },
} as const;
type Deck = keyof typeof KERNELBENCH_COM;

interface Cell { score?: number | null; valid?: boolean; verdict?: string | null }
interface Block { label?: string | null; harness?: string | null; effort?: string | null; passed?: number; total_problems?: number; cells: Record<string, Cell> }
interface ModelEntry { slug: string; name: string; lab?: string; benches: Partial<Record<string, Block>>; totals?: { audited?: number; flagged?: number } }
export interface KernelbenchIndex { generated?: string; benches: Record<string, { problems: string[]; gpu?: unknown }>; models: ModelEntry[] }

/** Live roster: every `/models/<slug>` link on the homepage. */
export function liveSlugs(html: string): Set<string> {
  return new Set([...html.matchAll(/href="\/models\/([^"/?#]+)"/g)].map((m) => decodeURIComponent(m[1])));
}

export function parseKernelbenchCom(index: KernelbenchIndex, roster: Set<string>): RawRow[] {
  if (!Array.isArray(index?.models) || !index.benches) throw new Error("kernelbench.com models.json format changed (expected benches and models[])");
  if (!roster.size) throw new Error("kernelbench.com homepage lists no models");
  const rows: RawRow[] = [];
  for (const deck of Object.keys(KERNELBENCH_COM) as Deck[]) {
    const b = KERNELBENCH_COM[deck];
    if (!index.benches[deck]) throw new Error(`kernelbench.com models.json has no ${deck} bench`);
    const live = index.models.filter((m) => roster.has(m.slug) && Object.keys(m.benches[deck]?.cells ?? {}).length);
    const problems = [...new Set(live.flatMap((m) => Object.keys(m.benches[deck]!.cells)))].sort();
    const validScore = (m: ModelEntry, p: string) => { const c = m.benches[deck]!.cells[p]; return c?.valid && c.score != null ? c.score : null; };
    const best = Object.fromEntries(problems.map((p) => [p, Math.max(0, ...live.map((m) => validScore(m, p) ?? 0))]));
    for (const m of live) {
      const blk = m.benches[deck]!, cells = Object.entries(blk.cells);
      if (cells.every(([, c]) => (c.verdict || "unaudited") === "unaudited")) continue;
      const scores = Object.fromEntries(problems.map((p) => [p, validScore(m, p)]));
      const value = (100 * problems.reduce((s, p) => s + (scores[p] != null && best[p] > 0 ? scores[p]! / best[p] : 0), 0)) / problems.length;
      const rawMean = (100 * Object.values(scores).reduce<number>((s, v) => s + (v ?? 0), 0)) / problems.length;
      const passed = Object.values(scores).filter((v) => v != null).length;
      rows.push({
        benchmarkId: b.id, modelLabel: m.name, effort: blk.effort || undefined, value, sourceUrl: b.page,
        labHint: m.lab || undefined, harness: blk.harness || undefined, sourceModelId: m.slug,
        note: `${m.name}${blk.effort ? ` (${blk.effort})` : ""} · ${passed}/${problems.length} valid passes · harness ${blk.harness ?? "?"} · RTX PRO 6000`,
        details: { passed, total: problems.length, scores, best, rawMean, harness: blk.harness, sourceLabel: blk.label, audited: m.totals?.audited, flagged: m.totals?.flagged },
      });
    }
    if (!rows.some((r) => r.benchmarkId === b.id)) throw new Error(`kernelbench.com ${deck} board had no rows`);
  }
  return rows.sort((a, z) => a.benchmarkId.localeCompare(z.benchmarkId) || z.value - a.value);
}

const source: Source = {
  id: "kernelbench-com",
  name: "KernelBench (kernelbench.com)",
  url: SITE,
  async scrape(ctx): Promise<ScrapeResult> {
    const [html, text] = await Promise.all([ctx.fetchText(SITE), ctx.fetchText(DATA)]);
    const index = JSON.parse(text) as KernelbenchIndex;
    const roster = liveSlugs(html);
    const rows = parseKernelbenchCom(index, roster);
    const updated = index.generated?.slice(0, 10);
    return {
      benchmarks: (Object.keys(KERNELBENCH_COM) as Deck[]).map((deck) => {
        const b = KERNELBENCH_COM[deck];
        return {
          id: b.id, name: b.name, shortName: b.shortName, sourceId: this.id, url: b.page, lastUpdated: updated, description: b.description,
          unit: "percent" as const, higherIsBetter: true, category: "coding" as const, eligibleForDefault: false, defaultWeight: 0,
        };
      }),
      rows, raw: { "models.json": text, "home.html": html },
      notes: [`${rows.length} rows (${(Object.keys(KERNELBENCH_COM) as Deck[]).map((d) => `${d} ${rows.filter((r) => r.benchmarkId === KERNELBENCH_COM[d].id).length}`).join(", ")}), ${roster.size} live models, data ${updated ?? "?"}`],
    };
  },
};
export default source;
