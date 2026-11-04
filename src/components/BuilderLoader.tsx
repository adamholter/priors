"use client";
import type { IndexConfig } from "@/engine";
import { SettingsButton } from "./SiteSettings";
import { SiteNav } from "./SiteNav";
import { Wordmark } from "./Wordmark";
import { Builder } from "./Builder";
import { useEffect } from "react";
import { loadECharts } from "./chart/echarts";
import { useCoreSnapshot } from "./use-core-snapshot";
import "./builder.css";

/** The top of the default ranking, drawn from the server's HTML so the page has data before its scripts and dataset arrive. */
export interface RankingPreview { name: string; rows: { rank: number; name: string; score: number; color: string }[] }

function Preview({ name, rows }: RankingPreview) {
  const max = Math.max(...rows.map((r) => r.score), 1);
  return <section className="builder-rank min-w-0" data-ranking-preview>
    <h1 className="text-[26px] leading-tight mb-1 min-h-8">{name}</h1>
    <p className="cap mb-3">Scores as published by Artificial Analysis</p>
    <ol>{rows.map((r, i) => <li key={r.rank} className={`grid grid-cols-[28px_minmax(0,140px)_minmax(0,1fr)_48px] sm:grid-cols-[28px_minmax(120px,210px)_minmax(0,1fr)_48px] items-center gap-x-3 h-[30px] xl:h-[33px] text-[14px] ${i >= 10 ? "max-lg:hidden" : ""}`}>
      <span className="cap text-right">{r.rank}</span><span className="truncate">{r.name}</span>
      <span className="h-[12px] rounded-[2px] bg-hair-2 overflow-hidden"><i className="block h-full rounded-[2px]" style={{ width: `${(r.score / max * 100).toFixed(2)}%`, background: r.color }} /></span>
      <span className="num text-right">{r.score.toFixed(1)}</span>
    </li>)}</ol>
  </section>;
}

/** Keep the large calculation dataset out of the HTML response. */
export function BuilderLoader({ initialIndices, preview }: { initialIndices: IndexConfig[]; preview?: RankingPreview }) {
  const { snapshot, error, retry: load } = useCoreSnapshot();
  // The builder opens on a chart: fetch its library alongside the data rather than after it.
  useEffect(() => { void loadECharts(); }, []);
  if (snapshot) return <Builder snapshot={snapshot} initialIndices={initialIndices} />;
  if (preview && !error) return <div className="builder min-h-screen">
    <header className="builder-header flex items-center gap-5 px-4 sm:px-8 h-14 border-b hairline"><Wordmark /><span className="max-sm:hidden"><SiteNav current="builder" /></span><span className="ml-auto"><SettingsButton /></span></header>
    <main className="builder-main mix-closed grid grid-cols-1 gap-10 px-4 sm:px-8 pt-5 lg:pt-8 pb-8 max-w-[1500px] items-start" aria-busy="true">
      <div className="builder-charts grid gap-10 min-w-0 content-start"><Preview {...preview} /><div className="load-bar w-full h-[620px] max-lg:hidden" /></div>
    </main>
    <div role="status" className="sr-only">Loading benchmark data…</div>
  </div>;
  return <div className="builder min-h-screen">
    <header className="builder-header flex items-center px-4 sm:px-8 h-14 border-b hairline"><Wordmark /><span className="ml-auto"><SettingsButton /></span></header>
    <main className="builder-main grid grid-cols-1 lg:grid-cols-[360px_minmax(0,1fr)] gap-10 px-4 sm:px-8 py-8 max-w-[1500px]" aria-busy={!error}>
      <aside className="grid content-start gap-4"><div className="load-bar w-32 h-8" /><div className="load-bar w-full h-4" /><div className="load-bar w-4/5 h-4" /><div className="load-bar w-3/5 h-4" /></aside>
      <section className="grid content-start gap-6"><div className="load-bar w-44 h-8" /><div className="load-bar w-full h-64" /><div className="load-bar w-full h-48" /></section>
    </main>
    <div role="status" className="px-4 sm:px-8 text-[12px] text-grey">{error ? <>{error} <button type="button" className="underline" onClick={load}>Retry</button></> : "Loading benchmark data…"}</div>
  </div>;
}
