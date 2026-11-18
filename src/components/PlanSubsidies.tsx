"use client";
import Link from "next/link";
import { useMemo, useState, type MouseEvent } from "react";
import { IconChevronRight, IconSearch } from "@tabler/icons-react";
import type { PlanSubsidy, SubsidySeller } from "@/lib/model-availability";
import { markColor, useChartPalette } from "./chart/echarts";

type Model = PlanSubsidy["models"][number];
type Scale = { pct: (m: number) => string; share: (m: number) => number; color: (lab: string) => string };
const times = (m: number) => `${m >= 10 ? Math.round(m) : m.toFixed(1)}x`;
const fee = (v?: number) => (v == null ? "" : `$${Number.isInteger(v) ? v : v.toFixed(2)}/mo`);
const dollars = (v: number) => `$${v >= 100 ? Math.round(v).toLocaleString() : v.toFixed(v >= 10 ? 0 : 2)}`;
const TICKS = [1, 3, 10, 30, 100];
/** How close the pointer must be to a dot, and how close dots must be to share one card. */
const REACH_PX = 16, SAME_SPOT_PX = 7;
const GRID = "grid gap-x-4 sm:grid-cols-[minmax(0,330px)_minmax(0,1fr)_52px]";

/** One plan's models as dots on the shared log scale, with a card for the dot under the pointer. */
function PlanStrip({ plan, scale }: { plan: PlanSubsidy; scale: Scale }) {
  const [hover, setHover] = useState<{ at: number; width: number; models: Model[] } | null>(null);
  const move = (e: MouseEvent<HTMLElement>) => {
    const box = e.currentTarget.getBoundingClientRect(), x = e.clientX - box.left, px = (m: Model) => scale.share(m.multiple) * box.width;
    const near = plan.models.reduce<Model | null>((a, m) => (!a || Math.abs(px(m) - x) < Math.abs(px(a) - x) ? m : a), null);
    if (!near || Math.abs(px(near) - x) > REACH_PX) return setHover(null);
    setHover({ at: px(near), width: box.width, models: plan.models.filter((m) => Math.abs(px(m) - px(near)) <= SAME_SPOT_PX) });
  };
  return <span className="relative block h-[21px]" aria-hidden="true" onMouseMove={move} onMouseLeave={() => setHover(null)}>
    <i className="absolute left-0 right-0 top-[10px] h-px bg-hair" />
    {plan.models.map((m) => <i key={m.id} className="absolute top-[6px] -ml-[4.5px] w-[9px] h-[9px] rounded-full transition-transform" style={{ left: scale.pct(m.multiple), background: scale.color(m.lab), boxShadow: "0 0 0 1px var(--bone)", transform: hover?.models.includes(m) ? "scale(1.45)" : undefined }} />)}
    {hover && <span className="absolute bottom-[calc(100%+6px)] z-20 w-[230px] grid gap-1 rounded-[4px] border hairline px-2.5 py-2 pointer-events-none shadow-lg" style={{ left: Math.max(0, Math.min(hover.at - 115, hover.width - 230)), background: "var(--white)" }}>
      {hover.models.slice(0, 5).map((m) => <span key={m.id} className="grid grid-cols-[8px_minmax(0,1fr)_auto] items-center gap-2 text-[12.5px]"><i className="w-2 h-2 rounded-full" style={{ background: scale.color(m.lab) }} /><span className="truncate">{m.name}</span><span className="num">{times(m.multiple)}</span></span>)}
      {hover.models.length === 1 && plan.feeUsd != null && <span className="cap">{dollars(plan.feeUsd * hover.models[0].multiple)} of API use for {dollars(plan.feeUsd)}</span>}
    </span>}
  </span>;
}

function ModelBars({ models, scale }: { models: Model[]; scale: Scale }) {
  return <ul className="pb-3 pt-1">{models.map((m) => <li key={m.id} className={`${GRID} items-center gap-y-1 py-[5px] text-[13px]`}>
    <span className="min-w-0 flex items-baseline gap-2 pl-[42px]"><Link href={`/models/${encodeURIComponent(m.id)}` as "/"} prefetch={false} className="truncate hover:underline" title={m.name}>{m.name}</Link>{m.assumed && <span className="cap shrink-0">assumed</span>}<span className="num ml-auto shrink-0 sm:hidden">{times(m.multiple)}</span></span>
    <span className="relative block h-[7px] max-sm:ml-[42px] rounded-[2px] bg-hair-2" aria-hidden="true"><i className="absolute inset-y-0 left-0 rounded-[2px]" style={{ width: `max(3px, ${scale.pct(m.multiple)})`, background: scale.color(m.lab) }} /></span>
    <span className="num text-right max-sm:hidden">{times(m.multiple)}</span>
  </li>)}</ul>;
}

function Logo({ seller }: { seller: SubsidySeller }) {
  // eslint-disable-next-line @next/next/no-img-element
  return seller.logo ? <img src={`/logos/${seller.id}.png`} alt="" width={20} height={20} loading="lazy" className="w-5 h-5 shrink-0 rounded-[4px] border hairline object-contain" /> : <span aria-hidden="true" className="w-5 h-5 shrink-0 rounded-[4px] border hairline grid place-items-center text-[11px] text-grey">{seller.name.slice(0, 1)}</span>;
}

/** Plans by the company selling them. A row shows the company's default plan on one log scale of API value per dollar; opening it shows every plan it sells. */
export function PlanSubsidies({ sellers, labColors }: { sellers: SubsidySeller[]; labColors: Record<string, string | undefined> }) {
  const pal = useChartPalette();
  const [query, setQuery] = useState(""), [open, setOpen] = useState<Record<string, boolean>>({}), [picked, setPicked] = useState<Record<string, string>>({});
  const high = Math.max(100, ...sellers.flatMap((s) => s.plans.flatMap((p) => p.models.map((m) => m.multiple))));
  const scale: Scale = useMemo(() => { const share = (m: number) => Math.log(Math.max(m, 1)) / Math.log(high); return { share, pct: (m) => `${(share(m) * 100).toFixed(2)}%`, color: (lab) => markColor(labColors[lab], pal, lab) }; }, [high, labColors, pal]);
  const words = query.toLowerCase().split(/\s+/).filter(Boolean), has = (text: string) => words.every((w) => text.toLowerCase().includes(w));
  /** What a search found in a seller: every plan when its name matched, else the plans and models that did. */
  const found = (s: SubsidySeller) => {
    if (!words.length || has(s.name)) return { plans: s.plans, models: null as Set<string> | null, deep: false };
    const models = new Set(s.plans.flatMap((p) => p.models.filter((m) => has(m.name)).map((m) => m.id))), plans = s.plans.filter((p) => has(`${s.name} ${p.plan}`) || p.models.some((m) => models.has(m.id)));
    return { plans, models: models.size ? models : null, deep: true };
  };
  const shown = sellers.map((s) => ({ s, hit: found(s) })).filter(({ hit }) => hit.plans.length);
  return <div className="grid gap-5">
    <label className="relative block max-w-[420px]"><IconSearch size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-grey" aria-hidden="true" /><input className="inp !pl-9 h-[44px] !text-[14px]" value={query} placeholder="Search companies, plans or models" aria-label="Search companies, plans or models" onChange={(e) => setQuery(e.target.value)} /></label>
    <div>
      <div className={`${GRID} max-sm:hidden pb-1 border-b hairline`}><span /><div className="relative h-4">{TICKS.filter((t) => t <= high).map((t, i) => <span key={t} className={`cap absolute ${i === 0 ? "" : "-translate-x-1/2"}`} style={{ left: scale.pct(t) }}>{t}x</span>)}</div><span className="cap text-right">median</span></div>
      {!shown.length && <p className="cap py-10 text-center">Nothing matches.</p>}
      {shown.map(({ s, hit }) => {
        const main = hit.deep ? hit.plans[0] : s.plans[0], expanded = open[s.id] ?? hit.deep, choice = hit.plans.find((p) => p.plan === picked[s.id]) ?? main;
        const modelsOf = (p: PlanSubsidy) => hit.models ? p.models.filter((m) => hit.models!.has(m.id)) : p.models;
        return <section key={s.id} className="border-b hairline" data-seller={s.id}>
          <button type="button" aria-expanded={expanded} onClick={() => setOpen((v) => ({ ...v, [s.id]: !expanded }))} className={`${GRID} -mx-2 w-[calc(100%+16px)] px-2 text-left items-center gap-y-1 py-2 min-h-[48px] rounded-[3px] [@media(hover:hover)]:hover:bg-hair-2`}>
            <span className="min-w-0 flex items-center gap-2 text-[14px]"><IconChevronRight size={14} className={`shrink-0 text-grey transition-transform ${expanded ? "rotate-90" : ""}`} aria-hidden="true" /><Logo seller={s} /><span className="shrink-0">{s.name}</span><span className="cap truncate" title={main.plan}>{main.plan}</span><span className="cap shrink-0">{fee(main.feeUsd)}</span><span className="num text-[13px] ml-auto sm:hidden">{times(main.median)}</span></span>
            <PlanStrip plan={main} scale={scale} />
            <span className="num text-[13px] text-right max-sm:hidden">{times(main.median)}</span>
          </button>
          {expanded && (hit.plans.length === 1 ? <ModelBars models={modelsOf(choice)} scale={scale} /> : <div className="pb-2">{hit.plans.map((p) => { const on = p.plan === choice.plan; return <div key={p.plan}>
            <button type="button" aria-pressed={on} onClick={() => setPicked((v) => ({ ...v, [s.id]: p.plan }))} className={`${GRID} -mx-2 w-[calc(100%+16px)] px-2 text-left items-center gap-y-1 py-1.5 min-h-[40px] max-sm:min-h-[48px] rounded-[3px] [@media(hover:hover)]:hover:bg-hair-2 ${on ? "bg-hair-2" : ""}`}>
              <span className="min-w-0 flex items-baseline gap-2 pl-[42px] text-[13px]"><span className={`truncate ${on ? "text-indigo" : ""}`} title={p.plan}>{p.plan}</span><span className="cap shrink-0">{fee(p.feeUsd)}</span>{p === s.plans[0] && <span className="cap shrink-0">default</span>}<span className="num ml-auto sm:hidden">{times(p.median)}</span></span>
              <PlanStrip plan={p} scale={scale} />
              <span className="num text-[13px] text-right max-sm:hidden">{times(p.median)}</span>
            </button>
            {on && <ModelBars models={modelsOf(p)} scale={scale} />}
          </div>; })}</div>)}
        </section>;
      })}
    </div>
  </div>;
}
