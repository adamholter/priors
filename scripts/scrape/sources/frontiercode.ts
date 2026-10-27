/**
 * FrontierCode (Cognition). 2.0 is the live methodology (10.27.26): one 132-task suite, served from
 * /data/frontier-code-2.0/data.json with the same per-model x effort shape. 1.1 (07.07.26) stays as
 * history: "Main" (100 tasks) and "Extended" (150 tasks); the Diamond subset is deprecated and skipped.
 * The leaderboard is a client component hydrated from a static JSON document at
 * /data/frontiercode-leaderboard/data.json — scores are `new_score` (mergeability %)
 * per model × reasoning effort × subset, with per-task cost and a flag rate for
 * runs caught consulting solution-bearing sources. The page itself is archived for
 * provenance; v1 (1.0) rows in the payload are ignored.
 */
import type { Source, ScrapeResult, RawRow, Benchmark } from "../../../src/data/types";

const SITE = "https://cognition.com";
const PAGE = `${SITE}/frontiercode`;
const DATA = `${SITE}/data/frontiercode-leaderboard/data.json`;
const DATA_2 = `${SITE}/data/frontier-code-2.0/data.json`;

const isNum = (x: unknown): x is number => typeof x === "number" && Number.isFinite(x);

interface FcCell {
  correct?: number | null; // share of tasks graded mergeable
  new_score?: number | null; // displayed score (0–1)
  tokens?: number | null;
  cost?: number | null; // average cost per task, USD
  duration_min?: number | null;
  tool_calls?: number | null;
  steps?: number | null;
  ote?: number | null;
  flagged_rate?: number | null; // share of runs zeroed for unfair internet use
}
interface FcVersion {
  models: string[];
  harness: Record<string, string>;
  efforts: Record<string, string[]>;
  subsets: Record<string, number>;
  data: Record<string, Record<string, Partial<Record<"main" | "extended", FcCell>>>>;
}

const SUBSETS = [
  { key: "main" as const, benchmarkId: "frontiercode-1.1-main", name: "FrontierCode 1.1 Main", shortName: "FrontierCode 1.1", primary: false, supersedes: undefined as string | undefined },
  { key: "extended" as const, benchmarkId: "frontiercode-1.1-extended", name: "FrontierCode 1.1 Extended", shortName: "FrontierCode 1.1 Ext", primary: false, supersedes: undefined as string | undefined },
];
const SUBSETS_2 = [
  { key: "main" as const, benchmarkId: "frontiercode-2.0-main", name: "FrontierCode 2.0", shortName: "FrontierCode", primary: true, supersedes: "frontiercode-1.1-main" as string | undefined },
];
type Subset = (typeof SUBSETS)[number] | (typeof SUBSETS_2)[number];

const source: Source = {
  id: "frontiercode",
  name: "FrontierCode",
  url: PAGE,
  async scrape(ctx): Promise<ScrapeResult> {
    const rows: RawRow[] = [];
    const raw: Record<string, string> = {};
    const notes: string[] = [];

    const res = await ctx.fetchText(DATA);
    raw["data.json"] = res;
    const payload = JSON.parse(res) as { v1?: FcVersion; v1_1?: FcVersion };
    const v = payload.v1_1;
    if (!v?.data || !v.models?.length) throw new Error("FrontierCode: v1_1 leaderboard data missing from data.json");
    const res2 = await ctx.fetchText(DATA_2);
    raw["data-2.0.json"] = res2;
    const v2 = JSON.parse(res2) as FcVersion;
    if (!v2?.data || !v2.models?.length) throw new Error("FrontierCode: 2.0 leaderboard data missing");

    try { raw["page.html"] = await ctx.fetchText(PAGE); } catch { /* page archive is best-effort */ }

    const emit = (ver: FcVersion, subsets: readonly Subset[], label: string) => {
      // Rank = the model's position by its best-effort Main score, matching the site table.
      const bestMain = new Map<string, number>();
      for (const m of ver.models) {
        let best = -1;
        for (const eff of ver.efforts[m] ?? Object.keys(ver.data[m] ?? {})) {
          const s = ver.data[m]?.[eff]?.main?.new_score;
          if (isNum(s) && s > best) best = s;
        }
        if (best >= 0) bestMain.set(m, best);
      }
      const order = [...bestMain.entries()].sort((a, b) => b[1] - a[1]).map(([m]) => m);
      const rankOf = new Map(order.map((m, i) => [m, i + 1]));
      const before = rows.length;
      for (const model of ver.models) {
        const perEffort = ver.data[model];
        if (!perEffort) continue;
        const harness = ver.harness[model];
        const efforts = ver.efforts[model] ?? Object.keys(perEffort);
        for (const effort of efforts) {
          const cells = perEffort[effort];
          if (!cells) continue;
          for (const sub of subsets) {
            const c = cells[sub.key];
            if (!c || !isNum(c.new_score)) continue;
            const tasks = ver.subsets?.[sub.key];
            rows.push({
              benchmarkId: sub.benchmarkId,
              modelLabel: model,
              effort,
              value: c.new_score * 100,
              costUsd: isNum(c.cost) ? c.cost : undefined,
              outputTokens: isNum(c.tokens) ? c.tokens : undefined,
              durationSec: isNum(c.duration_min) ? c.duration_min * 60 : undefined,
              harness,
              rank: rankOf.get(model),
              sourceUrl: PAGE,
              note: [
                isNum(tasks) ? `${sub.key} subset, ${tasks} tasks` : `${sub.key} subset`,
                isNum(c.correct) ? `mergeable ${(c.correct * 100).toFixed(1)}%` : undefined,
                isNum(c.flagged_rate) && c.flagged_rate > 0 ? `${(c.flagged_rate * 100).toFixed(1)}% flagged for unfair internet use` : undefined,
              ].filter(Boolean).join("; "),
            });
          }
        }
      }
      notes.push(`${label}: ${ver.models.length} models, ${rows.length - before} rows`);
    };
    emit(v, SUBSETS, "v1.1");
    emit(v2, SUBSETS_2, "v2.0");

    const benchmarks: Benchmark[] = [...SUBSETS, ...SUBSETS_2].filter((s) => rows.some((r) => r.benchmarkId === s.benchmarkId)).map((s) => ({
      id: s.benchmarkId, name: s.name, shortName: s.shortName, sourceId: this.id, url: PAGE,
      description: "Mergeability of coding-agent changes on private maintainer-authored tasks, graded by unit tests, rubrics and verifiers (Cognition).",
      unit: "percent", higherIsBetter: true, category: "coding",
      versionPolicy: s.supersedes ? { kind: "fresh", supersedes: s.supersedes } : { kind: "fresh" }, eligibleForDefault: s.primary, defaultWeight: s.primary ? 25 : 0,
    }));
    return { benchmarks, rows, raw, notes };
  },
};
export default source;
