"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { IconArrowsLeftRight, IconChevronDown } from "@tabler/icons-react";
import { categoryName } from "@/data/categories";
import { fmtCost, fmtScore, secs } from "@/lib/compare-chooser";
import type { CompareBench, CompareSide, ModelCompareView } from "@/lib/model-view";
import { Radar, RadarSwatch } from "../chart/Radar";
import type { RadarSeries } from "../chart/radar-view";
import { useChartPalette } from "../chart/palette-context";
import { markColor } from "../chart/theme-tokens";
import { SiteFooter } from "../SiteFooter";
import { ChooserDialog, CompareChooser } from "./CompareChooser";
import "../chart/radar.css";
import { SiteHeader } from "@/components/SiteHeader";

const FIRST_BENCHMARKS = 12;
const count = (v: number) => (v >= 1000 ? `${(v / 1000).toFixed(v >= 10000 ? 0 : 1)}k` : `${Math.round(v)}`);
const value = (b: Pick<CompareBench, "unit">, v: number) => b.unit === "percent" ? `${v.toFixed(1)}%` : b.unit === "usd" ? `$${v.toFixed(2)}` : b.unit === "seconds" ? secs(v) : Math.abs(v) >= 100 ? v.toFixed(0) : v.toFixed(1);
const href = (a: string, b?: string) => `/models/${encodeURIComponent(a)}/compare${b ? `?with=${encodeURIComponent(b)}` : ""}`;
const modelHref = (id: string) => `/models/${encodeURIComponent(id)}`;

const METRICS: { label: string; better: "higher" | "lower"; of: (s: CompareSide) => number | undefined; fmt: (v: number) => string }[] = [
  { label: "Score", better: "higher", of: (s) => s.score, fmt: fmtScore },
  { label: "Cost per task", better: "lower", of: (s) => s.costUsd, fmt: fmtCost },
  { label: "Time per task", better: "lower", of: (s) => s.tpt, fmt: secs },
  { label: "Output speed", better: "higher", of: (s) => s.speed, fmt: (v) => `${Math.round(v)} tok/s` },
  { label: "Time to first token", better: "lower", of: (s) => s.latency, fmt: secs },
  { label: "Output tokens per task", better: "lower", of: (s) => s.tokens, fmt: count },
];

/** Two models side by side. With only one chosen, the page is a place to find the other. */
export function ModelCompare({ view }: { view: ModelCompareView }) {
  const { a, b, benches, domains, options, labColors, mixName } = view;
  const router = useRouter(), pal = useChartPalette();
  const [all, setAll] = useState(false), [axis, setAxis] = useState<number | null>(null), [choosing, setChoosing] = useState<"a" | "b" | null>(null);
  const colorA = markColor(a.lab?.color ?? labColors[a.lab?.id ?? ""], pal, a.lab?.id ?? ""), colorB = b ? (a.lab?.id === b.lab?.id ? pal.ink2 : markColor(b.lab?.color ?? labColors[b.lab?.id ?? ""], pal, b.lab?.id ?? "")) : pal.ink2;
  const wins = useMemo(() => benches.reduce((n, x) => { const w = x.a === x.b ? "tie" : (x.a > x.b) === (x.higherIsBetter !== false) ? "a" : "b"; n[w]++; return n; }, { a: 0, b: 0, tie: 0 }), [benches]);
  const metrics = b ? METRICS.filter((m) => m.of(a) != null || m.of(b) != null).map((m) => m.label === "Cost per task" && view.costBasis === "subscription" ? { ...m, label: "Cost per task on plan" } : m) : [], shown = all ? benches : benches.slice(0, FIRST_BENCHMARKS);
  const series: RadarSeries[] = domains && b ? [{ id: a.id, name: a.name, color: colorA, points: domains.me }, ...(domains.leader ? [{ id: b.id, name: b.name, color: colorB, dash: "5 4", points: domains.leader.points }] : [])] : [];
  const without = (...ids: (string | undefined)[]) => options.filter((o) => !ids.includes(o.id));
  const go = (nextA: string, nextB?: string) => { setChoosing(null); router.push(href(nextA, nextB) as "/"); };
  const nameButton = (s: CompareSide, side: "a" | "b") => <button type="button" className="inline-flex items-baseline gap-1 text-left hover:underline decoration-1 underline-offset-[6px]" aria-label={`Change ${s.name}`} onClick={() => setChoosing(side)}>{s.name}<IconChevronDown size={20} className="self-center text-grey shrink-0" aria-hidden="true" /></button>;
  return <main className="min-h-dvh">
    <SiteHeader current="models" />
    <div className="max-w-[1100px] mx-auto px-5 sm:px-8 py-10 grid gap-12">
      {!b ? <section className="grid gap-6">
        <h1 className="text-[36px] sm:text-[44px] leading-[1.05]">Compare <Link className="hover:underline decoration-1 underline-offset-[6px]" href={modelHref(a.id) as "/"} prefetch={false}>{a.name}</Link></h1>
        <CompareChooser options={without(a.id)} kept={a} labColors={labColors} costBasis={view.costBasis} autoFocus onPick={(id) => go(a.id, id)} />
      </section> : <>
        <section className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <h1 className="text-[32px] sm:text-[44px] leading-[1.1]">{nameButton(a, "a")} <span className="text-grey">vs</span> {nameButton(b, "b")}</h1>
          <Link href={href(b.id, a.id) as "/"} aria-label="Swap models" title="Swap models" className="btn-quiet w-[44px] h-[44px] grid place-items-center !p-0"><IconArrowsLeftRight size={16} /></Link>
        </section>

        <section className="grid gap-3">
          <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)_minmax(0,1fr)] gap-3 items-baseline border-b-2 border-ink pb-2"><SideName s={a} color={colorA} /><span className="cap text-center">{mixName}</span><SideName s={b} color={colorB} right /></div>
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
                <span className="grid gap-[2px]" aria-hidden="true">{([[p, colorA], [q, colorB]] as const).map(([v, color], n) => <span key={n} className="block h-[4px] bg-hair-2 rounded-[2px] overflow-hidden"><i className="block h-full" style={{ width: `${(v ?? 0).toFixed(2)}%`, background: color }} /></span>)}</span>
              </li>;
            })}</ol>
          </div>
        </section>}

        <section className="grid gap-3">
          <div className="flex items-baseline justify-between border-b hairline pb-2"><h2 className="text-[26px]">Benchmarks</h2><span className="cap">{benches.length} shared</span></div>
          {benches.length ? <ul className="grid">{shown.map((x) => <BenchRow key={x.id} x={x} colorA={colorA} colorB={colorB} />)}</ul> : <p className="cap">No current benchmark measured both models.</p>}
          {benches.length > FIRST_BENCHMARKS && <button type="button" className="btn-quiet justify-self-start min-h-[44px]" onClick={() => setAll((v) => !v)}>{all ? "Show fewer" : `Show all ${benches.length}`}</button>}
        </section>
      </>}
    </div>
    {b && choosing && <ChooserDialog title={`Replace ${choosing === "a" ? a.name : b.name}`} options={without(a.id, b.id)} kept={choosing === "a" ? b : a} labColors={labColors} costBasis={view.costBasis} onClose={() => setChoosing(null)} onPick={(id) => choosing === "a" ? go(id, b.id) : go(a.id, id)} />}
    <SiteFooter />
  </main>;
}

function SideName({ s, color, right = false }: { s: CompareSide; color: string; right?: boolean }) {
  return <div className={`min-w-0 ${right ? "text-right" : ""}`}><Link href={modelHref(s.id) as "/"} prefetch={false} className={`text-[15px] hover:underline flex items-center gap-2 ${right ? "justify-end" : ""}`} title={s.name}><i className="inline-block w-2.5 h-2.5 rounded-full shrink-0" style={{ background: color }} /><span className="truncate">{s.name}</span></Link><p className="cap truncate">{s.rank ? `#${s.rank}${s.effort && s.effort !== "default" ? ` · ${s.effort}` : ""}` : "not ranked"}</p></div>;
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
