"use client";
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";

type Gone<T> = { id: string; y: number; item: T };

/** One row's box. Its height is watched (by the list's single observer) so the rows below can sit under it. */
function Slot({ id, observe, y, gone, role, children }: { id: string; observe: (el: HTMLElement | null) => void | (() => void); y: number; gone?: boolean; role?: string; children: ReactNode }) {
  return <div ref={gone ? undefined : observe} data-id={id} data-gone={gone ? "" : undefined} aria-hidden={gone ? true : undefined} inert={gone ? true : undefined} className="results-gl" role={gone ? undefined : role} style={{ transform: `translateY(${y}px)` }}>{children}</div>;
}

/**
 * Keyed rows placed at the sum of the heights above them (measured, with `est` until then), so a sort, a search or a row
 * opening glides every row to its place. Rows that leave fade out where they were. One ResizeObserver watches every row and
 * reports a frame's changes in a single state update. Like the rankings, positions are list-local (see docs/charts.md).
 */
export function GlideList<T extends { id: string }>({ items, est, render, label }: { items: T[]; est: number; render: (item: T, gone: boolean) => ReactNode; label: string }) {
  const [hs, setHs] = useState<Record<string, number>>({});
  // "order": rows glide to new places. "size": a row grew or shrank, and the rows under it follow it frame by frame.
  const [mode, setMode] = useState<"order" | "size">("size");
  const sig = useMemo(() => items.map((t) => t.id).join("|"), [items]);
  const [prevSig, setPrevSig] = useState(sig);
  if (prevSig !== sig) { setPrevSig(sig); setMode("order"); }

  const heights = useRef<Record<string, number>>({});
  const watcher = useRef<ResizeObserver | null>(null);
  const observe = useCallback((el: HTMLElement | null) => {
    if (!el) return;
    watcher.current ??= new ResizeObserver((entries) => {
      const changed: Record<string, number> = {};
      let resized = false;
      for (const e of entries) {
        const id = (e.target as HTMLElement).dataset.id;
        const h = Math.round(e.borderBoxSize?.[0]?.blockSize ?? e.contentRect.height);
        if (!id || !h || heights.current[id] === h) continue;
        if (heights.current[id] !== undefined) resized = true;
        heights.current[id] = h; changed[id] = h;
      }
      if (!Object.keys(changed).length) return;
      if (resized) setMode("size");
      setHs((cur) => ({ ...cur, ...changed }));
    });
    const ro = watcher.current;
    ro.observe(el);
    return () => ro.unobserve(el);
  }, []);
  useEffect(() => () => { watcher.current?.disconnect(); watcher.current = null; }, []);

  const { ys, total } = useMemo(() => {
    const ys: number[] = []; let y = 0;
    for (const t of items) { ys.push(y); y += hs[t.id] ?? est; }
    return { ys, total: y };
  }, [items, hs, est]);

  const [gone, setGone] = useState<Gone<T>[]>([]);
  // The previous render's rows and places: what a row that just left was drawn at.
  const prev = useRef({ items, ys });
  useEffect(() => {
    const cur = new Set(items.map((t) => t.id));
    const left: Gone<T>[] = [];
    prev.current.items.forEach((t, i) => { if (!cur.has(t.id)) left.push({ id: t.id, y: prev.current.ys[i], item: t }); });
    if (left.length) setGone((g) => [...g.filter((x) => !cur.has(x.id) && !left.some((l) => l.id === x.id)), ...left.slice(0, 40)]);
  }, [items]);
  useEffect(() => { prev.current = { items, ys }; });
  // Whatever left is dropped 340ms after the last departure.
  useEffect(() => {
    if (!gone.length) return;
    const t = window.setTimeout(() => setGone([]), 340);
    return () => window.clearTimeout(t);
  }, [gone]);

  const live = new Set(items.map((t) => t.id));
  return <div className="results-list" data-mode={mode} style={{ height: total }} role="list" aria-label={label}>
    {items.map((t, i) => <Slot key={t.id} id={t.id} observe={observe} y={ys[i]} role="listitem">{render(t, false)}</Slot>)}
    {gone.filter((g) => !live.has(g.id)).map((g) => <Slot key={g.id} id={g.id} observe={observe} y={g.y} gone>{render(g.item, true)}</Slot>)}
  </div>;
}
