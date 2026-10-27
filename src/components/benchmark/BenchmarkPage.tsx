"use client";
import Link from "next/link";
import { useCallback, useMemo, useState } from "react";
import type { Benchmark, Snapshot } from "@/data/types";
import { chartVariantMode, computeIndex, DEFAULT_EFFORTS, EFFORT_CHOICES, filterEfforts, rankingRows as rankingRowsOf, type IndexConfig, type RankedVariant } from "@/engine";
import { costDescription, hasSubscriptionPrices } from "@/data/task-metrics";
import { effectiveBasis, type CostBasis } from "@/data/subscription";
import { subscriptionShare } from "@/engine";
import { benchmarkIndex, benchmarkView, hasOwnCost } from "@/lib/benchmark-page";
import { SiteFooter } from "../SiteFooter";
import { HeaderAccount } from "../AccountMenu";
import { SettingsButton } from "../SiteSettings";
import { Wordmark } from "../Wordmark";
import { SiteNav } from "../SiteNav";
import { Rankings } from "../Rankings";
import { ParetoChart } from "../chart/ParetoChart";
import { ChartSettings } from "../chart/ChartSettings";
import { useScatterView } from "../chart/ScoreScatter";
import { HighlightContext } from "../chart/highlight";
import { markColor, useChartPalette } from "../chart/echarts";

function fmt(b: Benchmark, v: number) {
  if (b.unit === "percent") return `${v.toFixed(1)}%`;
  if (b.unit === "usd") return `$${v >= 100 ? Math.round(v).toLocaleString() : v.toFixed(2)}`;
  if (b.unit === "seconds") return `${v.toFixed(v >= 10 ? 0 : 1)}s`;
  return v.toFixed(b.unit === "elo" ? 0 : 1);
}
const usd = (v: number) => v === 0 ? "free" : `$${v >= 10 ? v.toFixed(0) : v >= 1 ? v.toFixed(2) : v.toFixed(v >= 0.1 ? 2 : 3)}`;

/** One benchmark on its own: who leads it, and what each result costs, priced the way a subscriber pays when the lab has a plan. */
export function BenchmarkPage({ snapshot, benchmarkId, models }: { snapshot: Snapshot; benchmarkId: string; models: number }) {
  const b = snapshot.benchmarks.find((x) => x.id === benchmarkId)!;
  const [config, setConfig] = useState<IndexConfig>(() => benchmarkIndex(snapshot, benchmarkId));
  const patch = useCallback((p: Partial<IndexConfig>) => setConfig((c) => ({ ...c, ...p })), []);
  const result = useMemo(() => computeIndex(snapshot, { ...config, variants: "all" }, benchmarkView(snapshot, benchmarkId)), [snapshot, config, benchmarkId]);
  const pal = useChartPalette();
  const rankingMode = chartVariantMode(config, "ranking"), paretoMode = chartVariantMode(config, "pareto");
  const rows = useMemo(() => rankingRowsOf(result.ranked, config), [result, config]);
  const metricRanked = useMemo(() => filterEfforts(result.ranked, config.efforts), [result.ranked, config.efforts]);
  const hasCost = hasOwnCost(snapshot, benchmarkId) && result.ranked.some((r) => r.costUsd != null);
  const plans = hasSubscriptionPrices(snapshot);
  const basis = effectiveBasis(config.costBasis, plans);
  const apiCost = useMemo(() => new Map(snapshot.observations.filter((o) => o.benchmarkId === benchmarkId && o.costUsd != null).map((o) => [o.variantId, o.costUsd!])), [snapshot, benchmarkId]);
  const [paretoView, setParetoView] = useScatterView("benchmark-pareto");
  const [allRows, setAllRows] = useState(false);
  const [highlight, setHighlight] = useState<string[]>([]);
  const pickerModels = useMemo(() => {
    const col = new Map(snapshot.labs.map((l) => [l.id, markColor(l.color, pal, l.id)]));
    const seen = new Map<string, { id: string; name: string; color?: string; open?: boolean }>();
    for (const r of result.ranked) if (!seen.has(r.model.id)) seen.set(r.model.id, { id: r.model.id, name: r.model.name, color: col.get(r.model.labId), open: r.model.openWeights });
    return [...seen.values()];
  }, [result, snapshot.labs, pal]);
  const highlightState = useMemo(() => ({ items: highlight, set: setHighlight, models: pickerModels, linkIndices: [config] }), [highlight, pickerModels, config]);
  const host = (() => { try { return new URL(b.url).hostname.replace(/^www\./, ""); } catch { return ""; } })();
  const table = result.ranked; // best first; scores already account for direction
  const effortProps = { efforts: { value: config.efforts ?? DEFAULT_EFFORTS, onChange: (efforts: string[]) => patch({ efforts }) } };
  const title = (name: string) => <h2 className="text-[22px] sm:text-[26px]">{name}</h2>;

  return (
    <main className="min-h-screen">
      <header className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 sm:px-8 py-2 sm:h-14 border-b hairline"><div className="flex items-center gap-5"><Wordmark /><span className="max-sm:hidden"><SiteNav /></span></div><span className="ml-auto flex items-center gap-2"><HeaderAccount /><SettingsButton /></span><span className="sm:hidden w-full"><SiteNav /></span></header>
      <HighlightContext.Provider value={highlightState}>
        <div className="max-w-[1100px] mx-auto px-5 sm:px-8 py-10 grid gap-12">
          <section className="grid gap-2">
            <p className="cap"><Link href={"/benchmarks" as "/"} className="hover:text-ink">Benchmarks</Link> · {b.category}</p>
            <h1 className="text-[34px] sm:text-[44px] leading-[1.05]">{b.name}</h1>
            <p className="text-[15px] text-ink-2 max-w-[68ch]">{b.description}</p>
            <p className="cap">{models} models · {result.ranked.length} results{b.lastUpdated ? ` · updated ${b.lastUpdated}` : ` · data as of ${snapshot.date}`}{host && <> · <a href={b.url} target="_blank" rel="noreferrer" className="hover:text-ink underline decoration-dotted">{host} ↗</a></>}</p>
          </section>

          <section className="chart-panel">
            <Rankings anchor="rankings" title={title("Leaderboard")} ranked={rows} labs={snapshot.labs} showEffort={rankingMode === "all"} limit={25}
              actions={<ChartSettings label="Ranking" efforts={{ value: config.rankingEfforts ?? [...EFFORT_CHOICES], onChange: (rankingEfforts) => patch({ rankingEfforts }), withMode: true }} mode={rankingMode} onChange={(rankingVariants) => patch({ rankingVariants })} />} />
          </section>

          {hasCost && <section className="chart-panel">
            <ParetoChart anchor="cost" basis={basis} description={costDescription(config.costSource ?? "aa", basis).replace(/^[^·]+/, `${b.name} · measured cost per task`)} ranked={metricRanked} mode={paretoMode} labs={snapshot.labs} height={440} view={paretoView} onView={setParetoView}
              title={title(basis === "subscription" ? "Score vs subscription cost per task" : "Score vs cost per task")}
              actions={() => <ChartSettings anchor="cost" defaultScale="log" label="Pareto" mode={paretoMode} onChange={(paretoVariants) => patch({ paretoVariants })} {...effortProps}
                costBasis={plans ? { value: effectiveBasis(config.costBasis), onChange: (next: CostBasis) => patch({ costBasis: next === "subscription" ? undefined : next }) } : undefined} />} />
          </section>}

          <section className="grid gap-3">
            <div className="flex items-baseline justify-between border-b hairline pb-2"><h2 className="text-[22px] sm:text-[26px]">All results</h2><span className="cap">{table.length} rows</span></div>
            <div className="overflow-x-auto"><table className="w-full text-[13px] min-w-[560px]">
              <thead><tr className="cap text-left"><th className="py-1.5 pr-3 font-normal w-10">#</th><th className="py-1.5 pr-3 font-normal">Model</th><th className="py-1.5 pr-3 font-normal">Effort</th><th className="py-1.5 pr-3 font-normal text-right">{b.name.length > 24 ? "Score" : b.name}</th>{hasCost && <th className="py-1.5 pr-3 font-normal text-right">{basis === "subscription" ? "Subscription $ / task" : "$ / task"}</th>}{hasCost && basis === "subscription" && <th className="py-1.5 font-normal text-right">API $ / task</th>}</tr></thead>
              <tbody>{(allRows ? table : table.slice(0, 30)).map((r, i) => <Row key={r.variant.id} r={r} i={i} b={b} hasCost={hasCost} basis={basis} api={apiCost.get(r.variant.id)} />)}</tbody>
            </table></div>
            {table.length > 30 && <button type="button" className="btn-quiet justify-self-start" onClick={() => setAllRows((v) => !v)}>{allRows ? "Show fewer" : `Show all ${table.length}`}</button>}
          </section>
        </div>
      </HighlightContext.Provider>
      <SiteFooter />
    </main>
  );
}

function Row({ r, i, b, hasCost, basis, api }: { r: RankedVariant; i: number; b: Benchmark; hasCost: boolean; basis: CostBasis; api?: number }) {
  const raw = r.values[0]?.raw;
  return <tr className="border-t hairline">
    <td className="py-1.5 pr-3 num text-grey">{i + 1}</td>
    <td className="py-1.5 pr-3"><Link href={`/models/${r.model.id}` as "/"} className="hover:text-ink">{r.model.name}</Link></td>
    <td className="py-1.5 pr-3 mono text-ink-2">{r.variant.effort === "default" ? "" : r.variant.effort}</td>
    <td className="py-1.5 pr-3 num text-right">{raw != null ? fmt(b, raw) : r.score.toFixed(1)}</td>
    {hasCost && <td className="py-1.5 pr-3 num text-right" title={r.costPlan ? `${r.costPlan.plan}: ${subscriptionShare(r.costPlan.ratio)} of API price` : undefined}>{r.costUsd != null ? usd(r.costUsd) : ""}</td>}
    {hasCost && basis === "subscription" && <td className="py-1.5 num text-right text-grey">{api != null ? usd(api) : ""}</td>}
  </tr>;
}
