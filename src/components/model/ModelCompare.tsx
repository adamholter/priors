"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { IconArrowsLeftRight } from "@tabler/icons-react";
import { categoryName } from "@/data/categories";
import { money } from "@/lib/metrics";
import type { CompareBench, CompareOption, CompareSide, ModelCompareView } from "@/lib/model-view";
import { HeaderAccount } from "../AccountMenu";
import { Radar, RadarSwatch } from "../chart/Radar";
import type { RadarSeries } from "../chart/radar-view";
import { markColor, useChartPalette } from "../chart/echarts";
import { SiteFooter } from "../SiteFooter";
import { SiteNav } from "../SiteNav";
import { SettingsButton } from "../SiteSettings";
import { Wordmark } from "../Wordmark";
import "../chart/radar.css";

const FIRST_BENCHMARKS = 12;
const secs = (v: number) => (v >= 60 ? `${(v / 60).toFixed(v >= 600 ? 0 : 1)} min` : `${v.toFixed(v >= 10 ? 0 : 1)}s`);
const count = (v: number) => (v >= 1000 ? `${(v / 1000).toFixed(v >= 10000 ? 0 : 1)}k` : `${Math.round(v)}`);
const value = (b: Pick<CompareBench, "unit">, v: number) => b.unit === "percent" ? `${v.toFixed(1)}%` : b.unit === "usd" ? `$${v.toFixed(2)}` : b.unit === "seconds" ? secs(v) : Math.abs(v) >= 100 ? v.toFixed(0) : v.toFixed(1);
const href = (a: string, b: string) => `/models/${encodeURIComponent(a)}/compare?with=${encodeURIComponent(b)}`;

const METRICS: { label: string; better: "higher" | "lower"; of: (s: CompareSide) => number | undefined; fmt: (v: number) => string }[] = [
  { label: "Score", better: "higher", of: (s) => s.score, fmt: (v) => v.toFixed(1) },
  { label: "Cost per task", better: "lower", of: (s) => s.costUsd, fmt: (v) => (v === 0 ? "free" : money(v)) },
  { label: "Time per task", better: "lower", of: (s) => s.tpt, fmt: secs },
  { label: "Output speed", better: "higher", of: (s) => s.speed, fmt: (v) => `${Math.round(v)} tok/s` },
  { label: "Time to first token", better: "lower", of: (s) => s.latency, fmt: secs },
  { label: "Output tokens per task", better: "lower", of: (s) => s.tokens, fmt: count },
];

function Picker({ value, options, label, onChange }: { value: string; options: CompareOption[]; label: string; onChange: (id: string) => void }) {
  const ranked = options.filter((o) => o.ranked), rest = options.filter((o) => !o.ranked);
  return <select className="inp min-w-0 h-[44px]" value={value} aria-label={label} onChange={(e) => onChange(e.target.value)}>
    <optgroup label="Ranked">{ranked.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}</optgroup>
    {rest.length > 0 && <optgroup label="Other models">{rest.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}</optgroup>}
  </select>;
}

/** Two models side by side: headline numbers, who leads on shared benchmarks, categories, then the benchmarks with the widest gaps. */
export function ModelCompare({ view }: { view: ModelCompareView }) {
  const { a, b, benches, domains, options, labColors, mixName } = view;
  const router = useRouter(), pal = useChartPalette();
  const [all, setAll] = useState(false), [axis, setAxis] = useState<number | null>(null);
  const colorA = markColor(a.lab?.color ?? labColors[a.lab?.id ?? ""], pal, a.lab?.id ?? ""), colorB = a.lab?.id === b.lab?.id ? pal.ink2 : markColor(b.lab?.color ?? labColors[b.lab?.id ?? ""], pal, b.lab?.id ?? "");
  const wins = useMemo(() => benches.reduce((n, x) => { const w = x.a === x.b ? "tie" : (x.a > x.b) === (x.higherIsBetter !== false) ? "a" : "b"; n[w]++; return n; }, { a: 0, b: 0, tie: 0 }), [benches]);
  const metrics = METRICS.filter((m) => m.of(a) != null || m.of(b) != null).map((m) => m.label === "Cost per task" && view.costBasis === "subscription" ? { ...m, label: "Cost per task on plan" } : m), shown = all ? benches : benches.slice(0, FIRST_BENCHMARKS);
  const series: RadarSeries[] = domains ? [{ id: a.id, name: a.name, color: colorA, points: domains.me }, ...(domains.leader ? [{ id: b.id, name: b.name, color: colorB, dash: "5 4", points: domains.leader.points }] : [])] : [];
  const go = (nextA: string, nextB: string) => router.push(href(nextA, nextB) as "/");
  return <main className="min-h-dvh">
    <header className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 sm:px-8 py-2 sm:h-14 border-b hairline">
      <div className="flex items-center gap-5"><Wordmark /><span className="max-sm:hidden"><SiteNav /></span></div>
      <span className="ml-auto flex items-center gap-2"><HeaderAccount /><SettingsButton /></span>
      <span className="sm:hidden w-full"><SiteNav /></span>
    </header>
    <div className="max-w-[1100px] mx-auto px-5 sm:px-8 py-10 grid gap-12">
      <section className="grid gap-5">
        <h1 className="text-[36px] sm:text-[44px] leading-[1.05]"><Link className="hover:underline" href={`/models/${encodeURIComponent(a.id)}` as "/"} prefetch={false}>{a.name}</Link> <span className="text-grey">vs</span> <Link className="hover:underline" href={`/models/${encodeURIComponent(b.id)}` as "/"} prefetch={false}>{b.name}</Link></h1>
        <div className="grid grid-cols-[minmax(0,1fr)_44px_minmax(0,1fr)] items-center gap-2 max-w-[640px]">
          <Picker value={a.id} options={options.filter((o) => o.id !== b.id)} label="First model" onChange={(id) => go(id, b.id)} />
          <Link href={href(b.id, a.id) as "/"} aria-label="Swap models" title="Swap models" className="btn-quiet h-[44px] grid place-items-center !p-0"><IconArrowsLeftRight size={16} /></Link>
          <Picker value={b.id} options={options.filter((o) => o.id !== a.id)} label="Second model" onChange={(id) => go(a.id, id)} />
        </div>
      </section>

      <section className="grid gap-3">
        <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)_minmax(0,1fr)] gap-3 items-baseline border-b-2 border-ink pb-2">
          <SideName s={a} color={colorA} /><span className="cap text-center">{mixName}</span><SideName s={b} color={colorB} right />
        </div>
        <dl className="grid">{metrics.map((m) => {
          const x = m.of(a), y = m.of(b), lead = x == null || y == null || x === y ? null : (x > y) === (m.better === "higher") ? "a" : "b";
          return <div key={m.label} className="grid grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)_minmax(0,1fr)] gap-3 items-baseline py-2 border-b hairline">
            <dt className="cap text-center order-2">{m.label}</dt>
            <dd className={`num text-[15px] order-1 ${lead === "a" ? "text-indigo" : ""}`}>{x == null ? "" : m.fmt(x)}</dd>
            <dd className={`num text-[15px] text-right order-3 ${lead === "b" ? "text-indigo" : ""}`}>{y == null ? "" : m.fmt(y)}</dd>
          </div>;
        })}</dl>
      </section>

      {benches.length > 0 && <section className="grid gap-2" aria-label="Shared benchmarks">
        <div className="flex items-baseline justify-between gap-3 text-[14px]"><span><b className="num font-medium" style={{ color: colorA }}>{wins.a}</b> {a.name}</span>{wins.tie > 0 && <span className="cap">{wins.tie} tied</span>}<span className="text-right">{b.name} <b className="num font-medium" style={{ color: colorB }}>{wins.b}</b></span></div>
        <div className="flex h-[10px] gap-[2px] rounded-[2px] overflow-hidden" aria-hidden="true"><i style={{ flex: wins.a, background: colorA }} />{wins.tie > 0 && <i className="bg-hair" style={{ flex: wins.tie }} />}<i style={{ flex: wins.b, background: colorB }} /></div>
      </section>}

      {domains && series.length > 1 && <section className="grid gap-4">
        <div className="flex flex-wrap items-baseline justify-between gap-2 border-b hairline pb-2"><h2 className="text-[26px]">By category</h2><ul className="rl-legend" aria-label="On the radar">{series.map((s) => <li key={s.id}><RadarSwatch color={s.color} dash={s.dash} />{s.name}</li>)}</ul></div>
        <div className="grid gap-8 lg:grid-cols-2 items-center">
          <div className="flex justify-center min-w-0 overflow-x-clip"><Radar axes={domains.axes} series={series} norm="rank" size={300} hoverAxis={axis} onHoverAxis={setAxis} ariaLabel={`${a.name} and ${b.name} by category`} /></div>
          <ol className="grid gap-3 min-w-0" onMouseLeave={() => setAxis(null)}>{domains.axes.map((c, i) => {
            const p = domains.me[i].value, q = domains.leader?.points[i]?.value;
            return <li key={c.id} className={`grid gap-1 rounded-[4px] -mx-2 px-2 py-1 ${axis === i ? "bg-hair-2" : ""}`} onMouseEnter={() => setAxis(i)}>
              <div className="flex items-baseline gap-3 text-[13px]"><span className="truncate mr-auto">{c.name}</span><span className="num" style={{ color: colorA }}>{p == null ? "" : p.toFixed(0)}</span><span className="num w-[26px] text-right" style={{ color: colorB }}>{q == null ? "" : q.toFixed(0)}</span></div>
              <span className="grid gap-[2px]" aria-hidden="true">{[[p, colorA], [q, colorB]].map(([v, color], n) => <span key={n} className="block h-[4px] bg-hair-2 rounded-[2px] overflow-hidden"><i className="block h-full" style={{ width: `${((v as number | undefined) ?? 0).toFixed(2)}%`, background: color as string }} /></span>)}</span>
            </li>;
          })}</ol>
        </div>
      </section>}

      <section className="grid gap-3">
        <div className="flex items-baseline justify-between border-b hairline pb-2"><h2 className="text-[26px]">Benchmarks</h2><span className="cap">{benches.length} shared</span></div>
        {benches.length ? <ul className="grid">{shown.map((x) => <BenchRow key={x.id} x={x} colorA={colorA} colorB={colorB} />)}</ul> : <p className="cap">No current benchmark measured both models.</p>}
        {benches.length > FIRST_BENCHMARKS && <button type="button" className="btn-quiet justify-self-start min-h-[44px]" onClick={() => setAll((v) => !v)}>{all ? "Show fewer" : `Show all ${benches.length}`}</button>}
      </section>
    </div>
    <SiteFooter />
  </main>;
}

function SideName({ s, color, right = false }: { s: CompareSide; color: string; right?: boolean }) {
  return <div className={`min-w-0 ${right ? "text-right" : ""}`}><p className={`text-[15px] truncate flex items-center gap-2 ${right ? "justify-end" : ""}`} title={s.name}><i className="inline-block w-2.5 h-2.5 rounded-full shrink-0" style={{ background: color }} /><span className="truncate">{s.name}</span></p><p className="cap truncate">{s.rank ? `#${s.rank}${s.effort && s.effort !== "default" ? ` · ${s.effort}` : ""}` : "not ranked"}</p></div>;
}

/** A bar from the center toward the model that placed higher, as long as the gap between their places. */
function BenchRow({ x, colorA, colorB }: { x: CompareBench; colorA: string; colorB: string }) {
  const gap = x.aPlace - x.bPlace, width = (Math.abs(gap) * 50).toFixed(2);
  return <li className="grid grid-cols-[64px_minmax(0,1fr)_64px] sm:grid-cols-[minmax(0,1.1fr)_72px_minmax(0,1fr)_72px] gap-x-3 gap-y-1 items-center py-2 border-b hairline text-[13px]">
    <Link href={`/benchmarks/${encodeURIComponent(x.id)}` as "/"} prefetch={false} className="min-w-0 max-sm:col-span-3 hover:underline"><span className="block truncate" title={x.name}>{x.name}</span><span className="cap block truncate">{categoryName(x.category)}</span></Link>
    <span className="num text-[12.5px]" title={`#${x.aRank} of ${x.of}`}>{value(x, x.a)}</span>
    <span className="relative h-[8px] bg-hair-2 rounded-[2px]" aria-hidden="true"><i className="absolute inset-y-0 rounded-[2px]" style={gap >= 0 ? { right: "50%", width: `${width}%`, background: colorA } : { left: "50%", width: `${width}%`, background: colorB }} /><i className="absolute -inset-y-[2px] left-1/2 w-px bg-ink opacity-40" /></span>
    <span className="num text-[12.5px] text-right" title={`#${x.bRank} of ${x.of}`}>{value(x, x.b)}</span>
  </li>;
}
