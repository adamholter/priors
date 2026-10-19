"use client";
import { useState } from "react";

export interface MixSlice { id: string; name: string; share: number }

const SIZE = 132, R = 50, STROKE = 24, C = 2 * Math.PI * R;
const tone = (i: number, n: number) => Math.max(0.22, 1 - (i / Math.max(1, n - 1)) * 0.78);

/** A mix's weights as a donut and a list of the same numbers, biggest first; hovering either lights the other. */
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
        return <circle key={s.id} cx={SIZE / 2} cy={SIZE / 2} r={R} fill="none" stroke="var(--indigo)" strokeWidth={on === s.id ? STROKE + 4 : STROKE}
          strokeDasharray={`${Math.max(0, len - gap)} ${C - Math.max(0, len - gap)}`} strokeDashoffset={-start}
          style={{ opacity: on && on !== s.id ? 0.25 : tone(i, slices.length), transition: "opacity .12s, stroke-width .12s" }}
          onMouseEnter={() => setOn(s.id)}><title>{`${s.name}: ${Math.round(s.share)}%`}</title></circle>;
      })}
    </svg>
    <ul className="grid gap-x-8 gap-y-1.5 text-[12.5px] min-w-0 sm:grid-cols-2">
      {slices.map((s, i) => <li key={s.id} className="flex items-center gap-2 min-w-0 cursor-default" onMouseEnter={() => setOn(s.id)} style={{ opacity: on && on !== s.id ? 0.45 : 1, transition: "opacity .12s" }}>
        <i aria-hidden="true" className="inline-block w-2.5 h-2.5 rounded-[2px] shrink-0" style={{ background: "var(--indigo)", opacity: tone(i, slices.length) }} />
        <span className="text-ink truncate">{s.name}</span><span className="num text-ink-2 ml-auto pl-2">{Math.round(s.share)}%</span>
      </li>)}
    </ul>
  </div>;
}
