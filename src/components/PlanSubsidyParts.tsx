"use client";
import Link from "next/link";
import { useState, type CSSProperties, type ReactNode } from "react";
import { IconFlask, IconTilde } from "@tabler/icons-react";
import { PlanCaveatSources } from "@/components/PlanCaveatSources";
import { times, type Model, type Scale } from "@/lib/plan-subsidies";

/** The row index a reveal animation staggers on. */
export const order = (i: number) => ({ "--i": i }) as CSSProperties;

/** Keeps what it opened, so closing can animate too. */
export function Collapse({ open, children }: { open: boolean; children: ReactNode }) {
  const [seen, setSeen] = useState(open);
  if (open && !seen) setSeen(true);
  return <div className="sub-collapse" data-open={open} inert={!open}><div className="sub-clip">{seen && children}</div></div>;
}

export const ModelLink = ({ m, className = "" }: { m: Model; className?: string }) => <Link href={`/models/${encodeURIComponent(m.id)}` as "/"} prefetch={false} className={`truncate hover:underline max-sm:py-3 max-sm:-my-3 ${className}`} title={m.name}>{m.name}</Link>;

/** Assumed and preliminary figures: one small icon each, with the reason in its title. A preliminary figure's flask opens who it rests on. */
export function Flags({ m, open, onToggle }: { m: Model; open?: boolean; onToggle?: () => void }) {
  if (m.preliminary) return <button type="button" className="hit shrink-0 text-grey hover:text-ink" aria-label={`${m.preliminary.label}: ${m.preliminary.short}`} aria-expanded={open} title={`${m.preliminary.short} ${m.preliminary.note}`} onClick={onToggle}><IconFlask size={14} stroke={1.6} aria-hidden="true" /></button>;
  if (m.assumed) return <span className="shrink-0 text-grey inline-flex" title="Assumed: priced like a sibling plan, not measured" role="img" aria-label="Assumed"><IconTilde size={14} stroke={1.6} aria-hidden="true" /></span>;
  return null;
}
export const Sources = ({ m, className = "" }: { m: Model; className?: string }) => <PlanCaveatSources caveat={m.preliminary} className={className} />;

/** One plan's models as bars on the shared log scale: the view of a company with one plan to compare, or a search that left one. */
export function ModelBars({ models, scale }: { models: Model[]; scale: Scale }) {
  const [src, setSrc] = useState<Record<string, boolean>>({});
  return <div className="relative">
    <div className="sub-lines" aria-hidden="true">{scale.ticks.slice(1).map((t) => <i key={t} style={{ left: scale.pct(t) }} />)}</div>
    <ul className="relative">
      {models.map((m, i) => <li key={m.id} style={order(i)} className="sub-anim sub-bar-row relative">
        <span className="min-w-0 flex items-center gap-1.5 text-[13px] sm:pl-[50px]"><ModelLink m={m} /><Flags m={m} open={!!src[m.id]} onToggle={() => setSrc((v) => ({ ...v, [m.id]: !v[m.id] }))} />{m.multiple != null && <span className="num ml-auto shrink-0 sm:hidden">{times(m.multiple)}</span>}</span>
        {m.multiple != null ? <span className="relative block h-[7px] rounded-[2px] bg-hair-2" aria-hidden="true"><i className="sub-grow absolute inset-y-0 left-0 rounded-[2px]" style={{ width: `max(3px, ${scale.pct(m.multiple)})`, background: scale.color(m.lab) }} /></span> : <span className="cap">not measured</span>}
        <span className="num text-[13px] text-right max-sm:hidden">{m.multiple != null ? times(m.multiple) : ""}</span>
        {src[m.id] && <Sources m={m} className="sub-bar-src sm:pl-[50px]" />}
      </li>)}
    </ul>
  </div>;
}
