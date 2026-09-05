/**
 * ARC Prize leaderboard (arcprize.org/leaderboard). The page's own script loads pre-joined
 * per-version files `/media/data/leaderboard/{v1,v2,v3}.json` (semi-private eval sets); we read the same.
 * Only rows whose modelType is a plain model (CoT / Base LLM) are emitted; human baselines, Kaggle
 * ensembles and bespoke refinement systems are dropped so every row is a real model.
 * costPerTask (v1/v2) -> costUsd. v3 publishes total run cost only, which is kept in the note.
 */
import type { Source, ScrapeResult, RawRow, Benchmark } from "../../../src/data/types";

const SITE = "https://arcprize.org/leaderboard";
const DATA = "https://arcprize.org/media/data/leaderboard";

interface Eval {
  datasetId: string; datasetDisplayName?: string; modelId: string; modelDisplayName: string; modelType?: string | null;
  modelGroup?: string; modelReleaseDate?: string; providerDisplayName?: string; score: number;
  costPerTask?: number | null; cost?: number | null; display?: boolean;
}
interface VersionFile { version?: string; generatedAt?: string; evaluations: Eval[] }

const VERSIONS = [
  { key: "v1", id: "arc-agi-1", name: "ARC-AGI-1", weight: 0, desc: "ARC-AGI-1 semi-private evaluation set: novel grid-transformation puzzles measuring fluid intelligence; percent of tasks solved, with verified cost per task." },
  { key: "v2", id: "arc-agi-2", name: "ARC-AGI-2", weight: 10, desc: "ARC-AGI-2 semi-private evaluation set: harder compositional grid puzzles designed to resist memorization; percent solved with verified cost per task." },
  { key: "v3", id: "arc-agi-3", name: "ARC-AGI-3", weight: 10, desc: "ARC-AGI-3 semi-private set: interactive game-like environments where the agent must learn rules on the fly; percent of possible score." },
];
const MODEL_TYPES = new Set(["cot", "base llm"]);
const NON_MODEL = /mturker|human|architects|stem grad|kaggle/i;

const source: Source = {
  id: "arcagi",
  name: "ARC Prize",
  url: SITE,
  async scrape(ctx): Promise<ScrapeResult> {
    const rows: RawRow[] = [];
    const raw: Record<string, string> = {};
    const notes: string[] = [];
    const benchmarks: Benchmark[] = [];
    // Confirm the page still points at the same data loader (auditable discovery).
    try {
      const html = await ctx.fetchText(SITE);
      raw["leaderboard.html"] = html;
      const dataJs = html.match(/href="([^"]*scripts\/leaderboard\/data\.js)"/)?.[1];
      if (dataJs) {
        const js = await ctx.fetchText(new URL(dataJs, SITE).toString());
        raw["data.js"] = js;
        if (!js.includes("/media/data/leaderboard/")) notes.push("warning: data.js no longer references /media/data/leaderboard/");
      }
    } catch (e) { notes.push(`page fetch failed (continuing with data files): ${e instanceof Error ? e.message : e}`); }

    for (const v of VERSIONS) {
      let file: VersionFile;
      try { file = await ctx.fetchJson<VersionFile>(`${DATA}/${v.key}.json`); }
      catch (e) { notes.push(`${v.name} unavailable: ${e instanceof Error ? e.message : e}`); continue; }
      raw[`${v.key}.json`] = JSON.stringify(file, null, 2);
      let n = 0, dropped = 0;
      const sorted = [...file.evaluations].sort((a, b) => b.score - a.score);
      for (const e of sorted) {
        if (e.display === false) continue;
        const type = (e.modelType ?? "").toLowerCase();
        if (!MODEL_TYPES.has(type) || NON_MODEL.test(e.modelDisplayName)) { dropped++; continue; }
        // "GPT-6 Astra - Provider Adapter (High)" -> harness "Provider Adapter", label kept as shown.
        const harness = e.modelDisplayName.match(/ - ([^()]+?)\s*(?:\(|$)/)?.[1]?.trim();
        rows.push({
          benchmarkId: v.id,
          modelLabel: e.modelDisplayName,
          value: e.score * 100,
          costUsd: e.costPerTask ?? undefined,
          harness,
          sourceUrl: `${SITE}`,
          labHint: e.providerDisplayName,
          releaseDateHint: e.modelReleaseDate?.slice(0, 10),
          note: [
            e.modelType ? `type ${e.modelType}` : undefined,
            e.cost != null ? `total cost $${e.cost.toFixed(0)}` : undefined,
            e.datasetDisplayName ? `${e.datasetDisplayName} semi-private` : undefined,
          ].filter(Boolean).join("; ") || undefined,
        });
        n++;
      }
      benchmarks.push({
        id: v.id, name: v.name, sourceId: this.id, url: `https://arcprize.org/leaderboard`, description: v.desc,
        unit: "percent", higherIsBetter: true, category: "reasoning",
        versionPolicy: { kind: "fresh" }, eligibleForDefault: v.weight > 0, defaultWeight: v.weight,
      });
      notes.push(`${v.name}: ${n} model rows, ${dropped} non-model/system rows dropped (generated ${file.generatedAt ?? "?"})`);
    }
    if (!rows.length) throw new Error("ARC Prize: no rows parsed");
    return { benchmarks, rows, raw, notes };
  },
};
export default source;
