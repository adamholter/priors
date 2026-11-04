"use client";
import Link from "next/link";
import { useState } from "react";

/** `href` is the benchmark's page. Left out for an import, which has none. */
export interface MixSlice { id: string; name: string; share: number; href?: string }

const SIZE = 132, R = 50, STROKE = 24, C = 2 * Math.PI * R;
const tone = (i: number, n: number) => Math.max(0.22, 1 - (i / Math.max(1, n - 1)) * 0.78);

/** A mix's weights as a donut and a list of the same numbers, biggest first; hovering either lights the other, and both open the benchmark. */
export function MixPie({ slices, className = "" }: { slices: MixSlice[]; className?: string }) {
  const [on, setOn] = useState<string | null>(null);
  const total = slices.reduce((s, x) => s + x.share, 0) || 1;
  const starts = slices.reduce<number[]>((acc, s, i) => [...acc, i === 0 ? 0 : acc[i - 1] + (slices[i - 1].share / total) * C], []);
  return <div className={`flex flex-wrap items-center gap-x-8 gap-y-4 ${className}`} onMouseLeave={() => setOn(null)}>
    <svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`} role="img" aria-label={slices.map((s) => `${s.name} ${Math.round(s.share)}%`).join(", ")} className="shrink-0 -rotate-90">
      <circle cx={SIZE / 2} cy={SIZE / 2} r={R} fill="none" stroke="var(--hair-2)" strokeWidth={STROKE} />
      {slices.map((s, i) => {
        const len = (s.share / total) * C, start = starts[i];
        const gap = slices.length > 1 ? Math.min(2, len * 0.3) : 0;
        const arc = <circle cx={SIZE / 2} cy={SIZE / 2} r={R} fill="none" stroke="var(--indigo)" strokeWidth={on === s.id ? STROKE + 4 : STROKE}
          strokeDasharray={`${Math.max(0, len - gap)} ${C - Math.max(0, len - gap)}`} strokeDashoffset={-start}
          style={{ opacity: on && on !== s.id ? 0.25 : tone(i, slices.length), transition: "opacity .12s, stroke-width .12s" }}
          onMouseEnter={() => setOn(s.id)}><title>{`${s.name}: ${Math.round(s.share)}%`}</title></circle>;
        // The list below is the keyboard and screen reader route, so a slice is a second tab stop for nobody.
        return s.href ? <Link key={s.id} href={s.href as "/"} prefetch={false} tabIndex={-1} transitionTypes={["nav-forward"]}>{arc}</Link> : <g key={s.id}>{arc}</g>;
      })}
    </svg>
    <ul className="grid gap-x-8 gap-y-1.5 text-[12.5px] min-w-0 sm:grid-cols-2">
      {slices.map((s, i) => {
        const row = <>
          <i aria-hidden="true" className="inline-block w-2.5 h-2.5 rounded-[2px] shrink-0" style={{ background: "var(--indigo)", opacity: tone(i, slices.length) }} />
          <span className="truncate">{s.name}</span><span className="num text-ink-2 ml-auto pl-2">{Math.round(s.share)}%</span>
        </>;
        return <li key={s.id} className="min-w-0" onMouseEnter={() => setOn(s.id)} style={{ opacity: on && on !== s.id ? 0.45 : 1, transition: "opacity .12s" }}>
          {s.href
            ? <Link href={s.href as "/"} prefetch={false} transitionTypes={["nav-forward"]} className="flex items-center gap-2 min-w-0 text-ink hover:text-indigo focus-visible:text-indigo" onFocus={() => setOn(s.id)} onBlur={() => setOn(null)}>{row}</Link>
            : <span className="flex items-center gap-2 min-w-0 text-ink cursor-default">{row}</span>}
        </li>;
      })}
    </ul>
  </div>;
}
