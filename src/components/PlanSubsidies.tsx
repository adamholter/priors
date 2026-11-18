"use client";
import Link from "next/link";
import type { PlanSubsidy } from "@/lib/model-availability";
import { markColor, useChartPalette } from "./chart/echarts";

const times = (m: number) => `${m >= 10 ? Math.round(m) : m.toFixed(1)}x`;
const fee = (v?: number) => (v == null ? "" : `$${Number.isInteger(v) ? v : v.toFixed(2)}/mo`);
const TICKS = [1, 3, 10, 30, 100];

/** Every plan on one log scale of API value per dollar, one dot per model. A row opens to name them. */
export function PlanSubsidies({ plans, labColors }: { plans: PlanSubsidy[]; labColors: Record<string, string | undefined> }) {
  const pal = useChartPalette();
  const high = Math.max(100, ...plans.flatMap((p) => p.models.map((m) => m.multiple))), x = (m: number) => `${((Math.log(Math.max(m, 1)) / Math.log(high)) * 100).toFixed(2)}%`;
  const grid = "grid gap-x-4 sm:grid-cols-[minmax(0,240px)_minmax(0,1fr)_52px]";
  return <div>
    <div className={`${grid} max-sm:hidden pb-1 border-b hairline`}><span /><div className="relative h-4 mx-1">{TICKS.filter((t) => t <= high).map((t) => <span key={t} className="cap absolute -translate-x-1/2" style={{ left: x(t) }}>{t}x</span>)}</div><span className="cap text-right">median</span></div>
    {plans.map((p) => <details key={p.plan} className="group border-b hairline">
      <summary className={`${grid} items-center gap-y-1 py-2 min-h-[44px] cursor-pointer list-none [&::-webkit-details-marker]:hidden hover:bg-hair-2`}>
        <span className="min-w-0 flex items-baseline gap-2 text-[13.5px]"><span className="truncate" title={p.plan}>{p.plan}</span><span className="cap shrink-0">{fee(p.feeUsd)}</span></span>
        <span className="relative block h-4 mx-1" aria-hidden="true"><i className="absolute left-0 right-0 top-1/2 h-px bg-hair" />{p.models.map((m) => <i key={m.id} title={`${m.name} ${times(m.multiple)}`} className="absolute top-1/2 w-[9px] h-[9px] -ml-[4.5px] -mt-[4.5px] rounded-full border border-[var(--white)]" style={{ left: x(m.multiple), background: markColor(labColors[m.lab], pal, m.lab) }} />)}</span>
        <span className="num text-[13px] sm:text-right max-sm:hidden">{times(p.median)}</span>
      </summary>
      <ul className="grid gap-x-8 sm:grid-cols-2 lg:grid-cols-3 pb-3">{p.models.map((m) => <li key={m.id} className="flex items-baseline gap-2 text-[13px] py-1 min-w-0">
        <Link href={`/models/${encodeURIComponent(m.id)}` as "/"} prefetch={false} className="truncate hover:underline" title={m.name}>{m.name}</Link>
        {m.assumed && <span className="cap shrink-0">assumed</span>}
        <span className="num ml-auto shrink-0">{times(m.multiple)}</span>
      </li>)}</ul>
    </details>)}
  </div>;
}
