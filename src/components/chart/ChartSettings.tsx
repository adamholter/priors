"use client";
import { useId, useMemo, useRef, useCallback, useState } from "react";

import type { TaskMetricSource } from "@/data/task-metrics";
import { useLightDismiss } from "@/hooks/useLightDismiss";
import type { ScatterView } from "./ScoreScatter";

const RELEASE_WINDOWS: { label: string; months: number }[] = [
  { label: "Last 6 months", months: 6 },
  { label: "Last year", months: 12 },
  { label: "Last 2 years", months: 24 },
];

export function ChartSettings({ label, mode, onChange, releasedAfter, onChangeReleased, models, excluded, onToggleModel, onShowAllModels, onHideAllModels, view, onView, dataSource }: {
  dataSource?: { value: TaskMetricSource; options: { id: TaskMetricSource; name: string; modelCount: number }[]; onChange: (source: TaskMetricSource) => void };
  label: string; mode: "all" | "best"; onChange: (mode: "all" | "best") => void;
  /** Model-age filter: ISO date cutoff; "" means all time. */
  releasedAfter?: string;
  onChangeReleased?: (value: string) => void;
  /** Model picker: ranked-order list + the index's excluded set. */
  models?: { id: string; name: string; color?: string }[];
  excluded?: Set<string>;
  onToggleModel?: (id: string) => void;
  onShowAllModels?: () => void;
  onHideAllModels?: () => void;
  /** Scatter display: label density, frontier line, reasoning-effort lines. */
  view?: ScatterView;
  onView?: (view: ScatterView) => void;
}) {
  const id = useId();
  const root = useRef<HTMLDetailsElement>(null);
  const trigger = useRef<HTMLElement>(null);
  const [query, setQuery] = useState("");
  const [menuShift, setMenuShift] = useState(0);
  const dismiss = useCallback((reason: "outside" | "escape") => {
    if (!root.current?.open) return;
    root.current.open = false;
    if (reason === "escape") trigger.current?.focus();
  }, []);
  useLightDismiss(root, dismiss);
  const windowDate = (months: number) => { const d = new Date(); d.setMonth(d.getMonth() - months); return d.toISOString().slice(0, 10); };
  const daysBetween = (a: string, b: string) => Math.abs((new Date(a).getTime() - new Date(b).getTime()) / 86_400_000);
  // Map a stored cutoff date to the nearest named window (±45 days) so
  // URL-decoded dates still show as "Last year" rather than "Custom".
  const releasedValue = releasedAfter === "" ? "all"
    : releasedAfter === undefined ? "6"
    : (RELEASE_WINDOWS.find((w) => daysBetween(releasedAfter, windowDate(w.months)) <= 45)?.months.toString() ?? "custom");
  const filtered = useMemo(() => {
    if (!models) return models;
    const q = query.trim().toLowerCase();
    return q ? models.filter((m) => m.name.toLowerCase().includes(q)) : models;
  }, [models, query]);
  const shown = models ? models.length - (excluded?.size ?? 0) : 0;
  return (
    <details ref={root} className="relative shrink-0" name="chart-settings" onToggle={(e) => {
      if (!e.currentTarget.open) return;
      const right = e.currentTarget.getBoundingClientRect().right;
      const width = Math.min(256, window.innerWidth * 0.85);
      setMenuShift(Math.max(0, 8 - (right - width)) - Math.max(0, right - window.innerWidth + 8));
    }}>
      <summary ref={trigger} aria-label={`${label} settings`} title={`${label} settings`} className="list-none [&::-webkit-details-marker]:hidden cursor-pointer p-1.5 text-grey hover:text-ink rounded-sm focus-visible:outline-indigo">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true"><path d="M4 6h4m4 0h8M4 12h10m4 0h2M4 18h2m4 0h10" /><circle cx="10" cy="6" r="2" /><circle cx="16" cy="12" r="2" /><circle cx="8" cy="18" r="2" /></svg>
      </summary>
      <div style={{ transform: `translateX(${menuShift}px)` }} className="absolute right-0 top-full mt-1 w-64 max-w-[85vw] max-h-[70dvh] overflow-y-auto overscroll-contain border hairline rounded-sm bg-white p-3 z-20 shadow-sm">
        {dataSource && <div className="mb-3 pb-3 border-b hairline">
          <label htmlFor={`${id}-source`} className="block text-[12px] text-ink-2 mb-2">Data source</label>
          <select id={`${id}-source`} aria-label={`${label} data source`} className="inp" value={dataSource.value} onChange={(e) => dataSource.onChange(e.target.value as TaskMetricSource)}>
            {dataSource.options.map((source) => <option key={source.id} value={source.id}>{source.name} · {source.modelCount} models</option>)}
          </select>
          <p className="text-[11px] text-grey mt-2">Coverage across this snapshot, before your filters. Only models with data from this source appear.</p>
          {dataSource.value === "terminalbench-4" && <p className="text-[11px] text-grey mt-2">Agent and model runs. Uses the best-scoring published harness for each model and effort.</p>}
        </div>}
        <label htmlFor={id} className="block text-[12px] text-ink-2 mb-2">Reasoning efforts</label>
        <select id={id} aria-label={`${label} reasoning efforts`} value={mode} onChange={(e) => { onChange(e.target.value as "all" | "best"); dismiss("escape"); }} className="inp">
          <option value="best">Best effort per model</option>
          <option value="all">All reasoning efforts</option>
        </select>
        {view && onView && <fieldset className="mt-3 pt-3 border-t hairline">
          <legend className="sr-only">Display</legend>
          <div className="flex items-baseline justify-between mb-1.5"><label htmlFor={`${id}-lab`} className="text-[12px] text-ink-2">Labels</label><span className="cap">{view.density >= 0.999 ? "all" : view.density <= 0.001 ? "frontier only" : `${Math.round(view.density * 100)}%`}</span></div>
          <input id={`${id}-lab`} type="range" min={0} max={100} step={5} value={Math.round(view.density * 100)} onChange={(e) => onView({ ...view, density: Number(e.target.value) / 100 })} className="w-full h-[3px]" aria-label={`${label} label density`} />
          <div className="flex justify-between cap mt-1"><span>Fewer</span><span>More</span></div>
          <label className="flex items-center gap-2 mt-2.5 text-[12.5px] cursor-pointer"><input type="checkbox" className="accent-[#2F4FB0]" checked={view.frontier} onChange={(e) => onView({ ...view, frontier: e.target.checked })} />Pareto frontier</label>
          <label className="flex items-center gap-2 mt-1.5 text-[12.5px] cursor-pointer"><input type="checkbox" className="accent-[#2F4FB0]" checked={view.links} onChange={(e) => onView({ ...view, links: e.target.checked })} />Connect a model&rsquo;s efforts</label>
        </fieldset>}
        {onChangeReleased && <>
          <label htmlFor={`${id}-rel`} className="block text-[12px] text-ink-2 mt-3 mb-2">Models released</label>
          <select id={`${id}-rel`} aria-label={`${label} release window`} value={releasedValue}
            onChange={(e) => { const v = e.target.value; onChangeReleased(v === "all" ? "" : windowDate(Number(v))); }} className="inp">
            {RELEASE_WINDOWS.map((w) => <option key={w.months} value={w.months}>{w.label}{w.months === 6 ? " (default)" : ""}</option>)}
            <option value="all">All time</option>
            {releasedValue === "custom" && <option value="custom" disabled>Custom ({releasedAfter})</option>}
          </select>
        </>}
        {models && onToggleModel && <>
          <p className="text-[12px] text-ink-2 mt-3 mb-1.5">Models · {shown} of {models.length}</p>
          <input type="search" placeholder="Search models" aria-label="Search models" value={query} onChange={(e) => setQuery(e.target.value)} className="inp mb-1.5 !py-1 text-[12px]" />
          <div className="max-h-52 overflow-y-auto overscroll-contain -mx-1 px-1">
            {filtered?.map((m) => (
              <label key={m.id} className="flex items-center gap-2 py-[3px] text-[12.5px] cursor-pointer rounded-sm hover:bg-bone">
                <input type="checkbox" className="accent-[#2F4FB0] shrink-0" checked={!excluded?.has(m.id)} onChange={() => onToggleModel(m.id)} />
                {m.color && <i className="w-2 h-2 rounded-full shrink-0" style={{ background: m.color }} aria-hidden="true" />}
                <span className="truncate">{m.name}</span>
              </label>
            ))}
            {filtered && !filtered.length && <p className="text-[12px] text-grey py-1">No matching models.</p>}
          </div>
          <div className="flex justify-between mt-1.5 pt-1.5 border-t hairline">
            <button type="button" className="cap hover:text-ink" onClick={() => onHideAllModels?.()}>Clear</button>
            <button type="button" className="cap hover:text-ink" onClick={() => onShowAllModels?.()}>Select all</button>
          </div>
        </>}
      </div>
    </details>
  );
}
