"use client";
import { useLayoutEffect, useRef } from "react";
import type { Lab } from "@/data/types";
import type { RankedVariant } from "@/engine";
import { variantLabel } from "./chart/ParetoChart";

/** Dense horizontal bars, color by lab, rows slide to their new position when the order changes. */
export function Rankings({ ranked, labs, limit = 30, onSelect, selected }: { ranked: RankedVariant[]; labs: Lab[]; limit?: number; onSelect?: (r: RankedVariant | null) => void; selected?: string | null }) {
  const color = new Map(labs.map((l) => [l.id, l.color]));
  const rows = ranked.slice(0, limit);
  const max = Math.max(...rows.map((r) => r.score), 1);
  const listRef = useRef<HTMLDivElement>(null);
  const prev = useRef<Map<string, number>>(new Map());

  useLayoutEffect(() => {
    const el = listRef.current; if (!el) return;
    const next = new Map<string, number>();
    for (const child of el.children) { const k = (child as HTMLElement).dataset.k!; next.set(k, (child as HTMLElement).getBoundingClientRect().top); }
    for (const child of el.children) {
      const c = child as HTMLElement; const k = c.dataset.k!;
      const before = prev.current.get(k); const after = next.get(k)!;
      if (before != null && before !== after) {
        c.style.transition = "none"; c.style.transform = `translateY(${before - after}px)`;
        requestAnimationFrame(() => { c.style.transition = ""; c.style.transform = ""; });
      }
    }
    prev.current = next;
  });

  if (!rows.length) return <p className="cap py-6">No model has every required benchmark. Loosen a requirement or lower a weight.</p>;
  return (
    <div ref={listRef} className="grid gap-[4px]">
      {rows.map((r) => (
        <button type="button" key={r.variant.id} data-k={r.variant.id} onClick={() => onSelect?.(selected === r.variant.id ? null : r)}
          className={`row-move grid grid-cols-[28px_minmax(150px,210px)_1fr_48px] items-center gap-2.5 h-[26px] text-left text-[12.5px] rounded-sm px-1 -mx-1 ${selected === r.variant.id ? "bg-white" : "hover:bg-white/60"}`}>
          <span className="cap text-right">{r.rank}</span>
          <span className="truncate">{r.model.name}{r.variant.effort !== "default" && <em className="not-italic cap ml-1.5">{r.variant.effort}</em>}{r.coverage < 1 && <span title={`${Math.round(r.coverage * 100)}% of weight measured; rest estimated`} className="ml-1 text-grey">·</span>}</span>
          <span className="h-[12px] rounded-[2px] bg-hair-2 overflow-hidden"><i className="bar-fill block h-full rounded-[2px]" style={{ width: `${(r.score / max) * 100}%`, background: color.get(r.model.labId) ?? "#A3A39B", opacity: r.coverage < 1 ? 0.75 : 1 }} /></span>
          <span className="num text-right">{r.score.toFixed(1)}</span>
        </button>
      ))}
      <span className="sr-only">{variantLabel(rows[0])}</span>
    </div>
  );
}
