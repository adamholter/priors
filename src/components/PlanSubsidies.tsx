"use client";
import Link from "next/link";
import { useState, type MouseEvent } from "react";
import { IconChevronRight } from "@tabler/icons-react";
import type { PlanSubsidy } from "@/lib/model-availability";
import { markColor, useChartPalette } from "./chart/echarts";

type Model = PlanSubsidy["models"][number];
const times = (m: number) => `${m >= 10 ? Math.round(m) : m.toFixed(1)}x`;
const fee = (v?: number) => (v == null ? "" : `$${Number.isInteger(v) ? v : v.toFixed(2)}/mo`);
const dollars = (v: number) => `$${v >= 100 ? Math.round(v).toLocaleString() : v.toFixed(v >= 10 ? 0 : 2)}`;
const TICKS = [1, 3, 10, 30, 100];
/** How close the pointer must be to a dot, and how close dots must be to share one card. */
const REACH_PX = 16, SAME_SPOT_PX = 7;
const GRID = "grid gap-x-4 sm:grid-cols-[minmax(0,280px)_minmax(0,1fr)_52px]";

/** Every plan on one log scale of API value per dollar, one dot per model. A row opens onto the same scale, one bar per model. */
export function PlanSubsidies({ plans, labColors }: { plans: PlanSubsidy[]; labColors: Record<string, string | undefined> }) {
  const pal = useChartPalette();
  const [hover, setHover] = useState<{ plan: string; at: number; width: number; models: Model[] } | null>(null);
  const high = Math.max(100, ...plans.flatMap((p) => p.models.map((m) => m.multiple)));
  const share = (m: number) => Math.log(Math.max(m, 1)) / Math.log(high), pct = (m: number) => `${(share(m) * 100).toFixed(2)}%`;
  const color = (lab: string) => markColor(labColors[lab], pal, lab);
  const move = (e: MouseEvent<HTMLElement>, p: PlanSubsidy) => {
    const box = e.currentTarget.getBoundingClientRect(), x = e.clientX - box.left, px = (m: Model) => share(m.multiple) * box.width;
    const near = p.models.reduce<Model | null>((a, m) => (!a || Math.abs(px(m) - x) < Math.abs(px(a) - x) ? m : a), null);
    if (!near || Math.abs(px(near) - x) > REACH_PX) return setHover(null);
    setHover({ plan: p.plan, at: px(near), width: box.width, models: p.models.filter((m) => Math.abs(px(m) - px(near)) <= SAME_SPOT_PX) });
  };
  return <div>
    <div className={`${GRID} max-sm:hidden pb-1 border-b hairline`}><span /><div className="relative h-4">{TICKS.filter((t) => t <= high).map((t, i) => <span key={t} className={`cap absolute ${i === 0 ? "" : "-translate-x-1/2"}`} style={{ left: pct(t) }}>{t}x</span>)}</div><span className="cap text-right">median</span></div>
    {plans.map((p) => <details key={p.plan} className="group border-b hairline">
      <summary className={`${GRID} items-center gap-y-1 py-2 min-h-[44px] cursor-pointer list-none [&::-webkit-details-marker]:hidden hover:bg-hair-2`}>
        <span className="min-w-0 flex items-center gap-1.5 text-[13.5px]"><IconChevronRight size={14} className="shrink-0 text-grey transition-transform group-open:rotate-90" aria-hidden="true" /><span className="truncate" title={p.plan}>{p.plan}</span><span className="cap shrink-0">{fee(p.feeUsd)}</span><span className="num text-[13px] ml-auto sm:hidden">{times(p.median)}</span></span>
        <span className="relative block h-[21px]" aria-hidden="true" onMouseMove={(e) => move(e, p)} onMouseLeave={() => setHover(null)}>
          <i className="absolute left-0 right-0 top-[10px] h-px bg-hair" />
          {p.models.map((m) => { const on = hover?.plan === p.plan && hover.models.includes(m); return <i key={m.id} className="absolute top-[6px] -ml-[4.5px] w-[9px] h-[9px] rounded-full transition-transform" style={{ left: pct(m.multiple), background: color(m.lab), boxShadow: "0 0 0 1px var(--bone)", transform: on ? "scale(1.45)" : undefined }} />; })}
          {hover?.plan === p.plan && <span className="absolute bottom-[calc(100%+6px)] z-20 w-[230px] grid gap-1 rounded-[4px] border hairline px-2.5 py-2 pointer-events-none shadow-lg" style={{ left: Math.max(0, Math.min(hover.at - 115, hover.width - 230)), background: "var(--white)" }}>
            {hover.models.slice(0, 5).map((m) => <span key={m.id} className="grid grid-cols-[8px_minmax(0,1fr)_auto] items-center gap-2 text-[12.5px]"><i className="w-2 h-2 rounded-full" style={{ background: color(m.lab) }} /><span className="truncate">{m.name}</span><span className="num">{times(m.multiple)}</span></span>)}
            {hover.models.length === 1 && p.feeUsd != null && <span className="cap">{dollars(p.feeUsd * hover.models[0].multiple)} of API use for {dollars(p.feeUsd)}</span>}
          </span>}
        </span>
        <span className="num text-[13px] text-right max-sm:hidden">{times(p.median)}</span>
      </summary>
      <ul className="pb-3 pt-1">{p.models.map((m) => <li key={m.id} className={`${GRID} items-center gap-y-1 py-[5px] text-[13px]`}>
        <span className="min-w-0 flex items-baseline gap-2 pl-5"><Link href={`/models/${encodeURIComponent(m.id)}` as "/"} prefetch={false} className="truncate hover:underline" title={m.name}>{m.name}</Link>{m.assumed && <span className="cap shrink-0">assumed</span>}<span className="num ml-auto shrink-0 sm:hidden">{times(m.multiple)}</span></span>
        <span className="relative block h-[7px] max-sm:ml-5 rounded-[2px] bg-hair-2" aria-hidden="true"><i className="absolute inset-y-0 left-0 rounded-[2px]" style={{ width: `max(3px, ${pct(m.multiple)})`, background: color(m.lab) }} /></span>
        <span className="num text-right max-sm:hidden">{times(m.multiple)}</span>
      </li>)}</ul>
    </details>)}
  </div>;
}
