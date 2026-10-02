"use client";
import { createContext, useCallback, useContext, useMemo, useRef, useState } from "react";
import { useLightDismiss } from "@/hooks/useLightDismiss";
import { featuredPoints, type ScatterPoint } from "./scatter-option";

/**
 * Highlighted models for every chart on a page. Items are model ids (feature the model's best effort)
 * or variant ids (feature exactly that effort). Stored on the index (`hl=` in URLs), so links, saved
 * pages and exported images keep them.
 */
export type HighlightState = { items: string[]; set: (items: string[]) => void; models: { id: string; name: string; color?: string }[] };
export const HighlightContext = createContext<HighlightState | null>(null);
export const useHighlight = () => useContext(HighlightContext);

const modelOf = (item: string) => item.split("@")[0];
export const isHighlighted = (items: string[], modelId: string) => items.some((it) => modelOf(it) === modelId);
/** Star / menu checkbox: a model is on if any of its efforts is; turning it off clears them all. */
export const toggleModel = (items: string[], modelId: string) => (isHighlighted(items, modelId) ? items.filter((it) => modelOf(it) !== modelId) : [...items, modelId]);
/** Clicking a mark: a featured effort turns off; any other effort is added (several per model allowed). */
export function togglePoint(items: string[], pts: ScatterPoint[], p: ScatterPoint) {
  const id = p.r.variant.id;
  if (items.includes(id)) return items.filter((it) => it !== id);
  const viaModel = items.includes(p.r.model.id) && featuredPoints(pts, [p.r.model.id])[0]?.r.variant.id === id;
  return viaModel ? items.filter((it) => it !== p.r.model.id) : [...items, id];
}
export function itemLabel(item: string, models: HighlightState["models"]) {
  const [m, v] = item.split("@"), name = models.find((x) => x.id === m)?.name ?? m, effort = v?.split("~")[0];
  return effort && effort !== "default" ? `${name} ${effort}` : name;
}

/** The current highlights under a chart title, each removable. */
export function HighlightList() {
  const h = useHighlight();
  if (!h?.items.length) return null;
  return <p className="hl-list pointer-events-auto">{h.items.map((it) => { const m = h.models.find((x) => x.id === modelOf(it)); return (
    <span key={it} className="hl-item"><i style={{ background: m?.color }} aria-hidden="true" />{itemLabel(it, h.models)}<button type="button" aria-label={`Remove highlight ${itemLabel(it, h.models)}`} onClick={() => h.set(h.items.filter((x) => x !== it))}>×</button></span>
  ); })}{h.items.length > 1 && <button type="button" className="hl-clear" onClick={() => h.set([])}>Clear</button>}</p>;
}

/** Highlight control next to a chart's settings: search, tick models. Clicking marks on the chart adds specific efforts. */
export function HighlightMenu({ label }: { label: string }) {
  const h = useHighlight();
  const root = useRef<HTMLDetailsElement>(null), trigger = useRef<HTMLElement>(null);
  const [q, setQ] = useState("");
  const dismiss = useCallback((reason: "outside" | "escape") => { if (!root.current?.open) return; root.current.open = false; if (reason === "escape") trigger.current?.focus(); }, []);
  useLightDismiss(root, dismiss);
  const list = useMemo(() => { const n = q.trim().toLowerCase(); const all = h?.models ?? []; const f = n ? all.filter((m) => m.name.toLowerCase().includes(n)) : all; return [...f.filter((m) => isHighlighted(h!.items, m.id)), ...f.filter((m) => !isHighlighted(h!.items, m.id))]; }, [h, q]);
  if (!h) return null;
  return <details ref={root} className="relative shrink-0" name="chart-settings">
    <summary ref={trigger} aria-label={`Highlight models in ${label}`} title="Highlight models" className={`list-none [&::-webkit-details-marker]:hidden cursor-pointer p-1.5 rounded-sm hover:text-ink focus-visible:outline-indigo ${h.items.length ? "text-indigo" : "text-grey"}`}>
      <svg width="16" height="16" viewBox="0 0 24 24" fill={h.items.length ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.5" aria-hidden="true"><path d="m12 3.5 2.6 5.3 5.9.9-4.25 4.1 1 5.8L12 16.9l-5.25 2.7 1-5.8L3.5 9.7l5.9-.9z" /></svg>
    </summary>
    <div className="chart-settings-menu absolute right-0 top-full mt-1 w-64 max-w-[85vw] max-h-[70dvh] overflow-y-auto overscroll-contain border hairline rounded-sm bg-white p-3 z-20 shadow-sm">
      <p className="text-[12px] text-ink-2 mb-1.5">Highlight models</p>
      <input type="search" placeholder="Search models" aria-label="Search models to highlight" value={q} onChange={(e) => setQ(e.target.value)} className="inp mb-1.5 !py-1 text-[12px]" />
      <div className="max-h-60 overflow-y-auto overscroll-contain -mx-1 px-1">
        {list.map((m) => <label key={m.id} className="flex items-center gap-2 py-[3px] text-[12.5px] cursor-pointer rounded-sm hover:bg-bone">
          <input type="checkbox" className="accent-indigo shrink-0" checked={isHighlighted(h.items, m.id)} onChange={() => h.set(toggleModel(h.items, m.id))} />
          {m.color && <i className="w-2 h-2 rounded-full shrink-0" style={{ background: m.color }} aria-hidden="true" />}
          <span className="truncate">{m.name}</span>
        </label>)}
        {!list.length && <p className="text-[12px] text-grey py-1">No matching models.</p>}
      </div>
      <p className="text-[11px] text-grey mt-2 pt-2 border-t hairline">Click a point on the chart to highlight that exact effort; click it again to remove it.</p>
    </div>
  </details>;
}
