"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { IconArrowsLeftRight, IconChevronDown, IconSearch, IconX } from "@tabler/icons-react";
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

const FIRST_BENCHMARKS = 12, FIRST_PER_LAB = 5, NEAR = 3, MAX_RESULTS = 40;
const secs = (v: number) => (v >= 60 ? `${(v / 60).toFixed(v >= 600 ? 0 : 1)} min` : `${v.toFixed(v >= 10 ? 0 : 1)}s`);
const count = (v: number) => (v >= 1000 ? `${(v / 1000).toFixed(v >= 10000 ? 0 : 1)}k` : `${Math.round(v)}`);
const value = (b: Pick<CompareBench, "unit">, v: number) => b.unit === "percent" ? `${v.toFixed(1)}%` : b.unit === "usd" ? `$${v.toFixed(2)}` : b.unit === "seconds" ? secs(v) : Math.abs(v) >= 100 ? v.toFixed(0) : v.toFixed(1);
const href = (a: string, b?: string) => `/models/${encodeURIComponent(a)}/compare${b ? `?with=${encodeURIComponent(b)}` : ""}`;
const modelHref = (id: string) => `/models/${encodeURIComponent(id)}`;

const METRICS: { label: string; better: "higher" | "lower"; of: (s: CompareSide) => number | undefined; fmt: (v: number) => string }[] = [
  { label: "Score", better: "higher", of: (s) => s.score, fmt: (v) => v.toFixed(1) },
  { label: "Cost per task", better: "lower", of: (s) => s.costUsd, fmt: (v) => (v === 0 ? "free" : money(v)) },
  { label: "Time per task", better: "lower", of: (s) => s.tpt, fmt: secs },
  { label: "Output speed", better: "higher", of: (s) => s.speed, fmt: (v) => `${Math.round(v)} tok/s` },
  { label: "Time to first token", better: "lower", of: (s) => s.latency, fmt: secs },
  { label: "Output tokens per task", better: "lower", of: (s) => s.tokens, fmt: count },
];

function OptionRow({ o, active, lab, onPick }: { o: CompareOption; active?: boolean; lab?: boolean; onPick: (id: string) => void }) {
  return <button type="button" data-active={active || undefined} onClick={() => onPick(o.id)} className={`w-full min-h-[34px] max-sm:min-h-[44px] flex items-baseline gap-2 rounded-[3px] px-2 py-1.5 text-left text-[13.5px] hover:bg-hair-2 focus-visible:bg-hair-2 ${active ? "bg-hair-2" : ""}`}>
    <span className="truncate" title={o.name}>{o.name}</span>{lab && <span className="cap truncate">{o.labName}</span>}<span className="cap ml-auto shrink-0">{o.rank ? `#${o.rank}` : ""}</span>
  </button>;
}

/** Find a model: type to search everything, or browse the ranked models by lab with the ones ranked nearby first. */
function ModelChooser({ options, near, autoFocus, onPick, labColors }: { options: CompareOption[]; near?: number; autoFocus?: boolean; onPick: (id: string) => void; labColors: ModelCompareView["labColors"] }) {
  const pal = useChartPalette();
  const [query, setQuery] = useState(""), [active, setActive] = useState(0), [open, setOpen] = useState<Record<string, boolean>>({});
  const list = useRef<HTMLDivElement>(null);
  const terms = query.toLowerCase().trim();
  const results = useMemo(() => {
    const words = terms.split(/\s+/).filter(Boolean);
    if (!words.length) return [];
    const score = (o: CompareOption) => (o.name.toLowerCase().startsWith(words[0]) ? 0 : 1) * 1000 + (o.rank ?? 999);
    return options.filter((o) => words.every((w) => `${o.name} ${o.labName}`.toLowerCase().includes(w))).sort((a, b) => score(a) - score(b)).slice(0, MAX_RESULTS);
  }, [options, terms]);
  const labs = useMemo(() => {
    const by = new Map<string, CompareOption[]>();
    for (const o of options) by.set(o.labId, [...(by.get(o.labId) ?? []), o]);
    return [...by.values()].filter((l) => l.some((o) => o.rank)).sort((a, b) => (a[0].rank ?? 999) - (b[0].rank ?? 999));
  }, [options]);
  const nearby = near ? options.filter((o) => o.rank && Math.abs(o.rank - near) <= NEAR) : [];
  const key = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") { e.preventDefault(); setActive((i) => Math.max(0, Math.min(results.length - 1, i + (e.key === "ArrowDown" ? 1 : -1)))); }
    if (e.key === "Enter" && results[active]) onPick(results[active].id);
  };
  useEffect(() => { list.current?.querySelector("[data-active]")?.scrollIntoView({ block: "nearest" }); }, [active]);
  return <div className="grid gap-4">
    <label className="relative block"><IconSearch size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-grey" aria-hidden="true" /><input autoFocus={autoFocus} className="inp !pl-9 h-[44px] !text-[15px]" value={query} placeholder="Search models or labs" aria-label="Search models or labs" onChange={(e) => { setQuery(e.target.value); setActive(0); }} onKeyDown={key} /></label>
    <div ref={list}>
      {terms ? (results.length ? <div className="grid sm:grid-cols-2 gap-x-6">{results.map((o, i) => <OptionRow key={o.id} o={o} lab active={i === active} onPick={onPick} />)}</div> : <p className="cap py-6 text-center">No model matches.</p>) : <div className="grid gap-6">
        {nearby.length > 0 && <section><h3 className="cap mb-1 px-2">Ranked nearby</h3><div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-x-6">{nearby.map((o) => <OptionRow key={o.id} o={o} lab onPick={onPick} />)}</div></section>}
        <div className="columns-1 sm:columns-2 lg:columns-3 gap-x-6">{labs.map((models) => {
          const lab = models[0], all = open[lab.labId], shown = all ? models : models.filter((o) => o.rank).slice(0, FIRST_PER_LAB), more = models.length - shown.length;
          return <section key={lab.labId} className="break-inside-avoid mb-5">
            <h3 className="flex items-center gap-2 px-2 mb-1 text-[13px] text-ink-2"><i className="w-2 h-2 rounded-full shrink-0" style={{ background: markColor(labColors[lab.labId], pal, lab.labId) }} />{lab.labName}</h3>
            {shown.map((o) => <OptionRow key={o.id} o={o} onPick={onPick} />)}
            {more > 0 && <button type="button" className="cap px-2 py-1.5 max-sm:min-h-[44px] hover:text-ink" onClick={() => setOpen((s) => ({ ...s, [lab.labId]: true }))}>{more} more</button>}
          </section>;
        })}</div>
      </div>}
    </div>
  </div>;
}

function ChooserDialog({ title, options, near, labColors, onPick, onClose }: { title: string; options: CompareOption[]; near?: number; labColors: ModelCompareView["labColors"]; onPick: (id: string) => void; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => { const d = ref.current; if (d && !d.open) d.showModal(); }, []);
  return <dialog ref={ref} aria-label={title} onClose={onClose} onClick={(e) => { if (e.target === ref.current) ref.current?.close(); }} className="m-auto w-[min(920px,calc(100vw-20px))] max-h-[min(780px,calc(100dvh-20px))] rounded-[6px] border hairline p-0 text-ink backdrop:bg-black/55" style={{ background: "var(--white)" }}>
    <div className="p-4 sm:p-5 grid gap-3">
      <div className="flex items-center justify-between"><h2 className="text-[22px]">{title}</h2><button type="button" aria-label="Close" className="w-[44px] h-[44px] -mr-2 grid place-items-center text-grey hover:text-ink" onClick={() => ref.current?.close()}><IconX size={18} /></button></div>
      <ModelChooser options={options} near={near} autoFocus labColors={labColors} onPick={onPick} />
    </div>
  </dialog>;
}

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
    <header className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 sm:px-8 py-2 sm:h-14 border-b hairline">
      <div className="flex items-center gap-5"><Wordmark /><span className="max-sm:hidden"><SiteNav /></span></div>
      <span className="ml-auto flex items-center gap-2"><HeaderAccount /><SettingsButton /></span>
      <span className="sm:hidden w-full"><SiteNav /></span>
    </header>
    <div className="max-w-[1100px] mx-auto px-5 sm:px-8 py-10 grid gap-12">
      {!b ? <section className="grid gap-6">
        <h1 className="text-[36px] sm:text-[44px] leading-[1.05]">Compare <Link className="hover:underline decoration-1 underline-offset-[6px]" href={modelHref(a.id) as "/"} prefetch={false}>{a.name}</Link></h1>
        <ModelChooser options={without(a.id)} near={a.rank} autoFocus labColors={labColors} onPick={(id) => go(a.id, id)} />
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
    {b && choosing && <ChooserDialog title={`Replace ${choosing === "a" ? a.name : b.name}`} options={without(a.id, b.id)} near={(choosing === "a" ? b : a).rank} labColors={labColors} onClose={() => setChoosing(null)} onPick={(id) => choosing === "a" ? go(id, b.id) : go(a.id, id)} />}
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
