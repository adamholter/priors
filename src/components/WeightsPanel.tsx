"use client";
import { useId, useMemo, useState, useRef, useCallback } from "react";
import type { Benchmark, Snapshot } from "@/data/types";
import { strictnessOf, type IndexConfig, type IndexResult } from "@/engine";

import { useLightDismiss } from "@/lib/useLightDismiss";
import { BenchmarkInfo, InfoIcon } from "./BenchmarkInfo";

const CATS: Record<string, string> = { coding: "Coding", agentic: "Agentic", reasoning: "Reasoning", knowledge: "Knowledge", math: "Math", "long-context": "Long context", instruction: "Instruction following", creative: "Creative", safety: "Safety", economics: "Economics", composite: "Composite indices", speed: "Speed", cost: "Cost", other: "Other" };

export function WeightsPanel({ snapshot, config, onChange }: { snapshot: Snapshot; config: IndexConfig; result: IndexResult; onChange: (c: IndexConfig) => void }) {
  const [open, setOpen] = useState(false);
  const picker = useRef<HTMLDivElement>(null);
  const search = useRef<HTMLInputElement>(null);
  const dismiss = useCallback((reason: "outside" | "escape") => {
    setOpen(false);
    if (reason === "escape") search.current?.focus();
  }, []);
  useLightDismiss(picker, dismiss);
  const [query, setQuery] = useState("");
  const [info, setInfo] = useState<string | null>(null);
  const resultsId = useId();
  const strictness = strictnessOf(config);
  const benches = useMemo(() => new Map(snapshot.benchmarks.map((b) => [b.id, b])), [snapshot]);
  const active = Object.entries(config.weights).filter(([, w]) => w > 0).map(([id]) => benches.get(id)).filter((b): b is Benchmark => !!b);
  const total = active.reduce((a, b) => a + config.weights[b.id], 0) || 1;
  const shareOf = (id: string) => (config.weights[id] / total) * 100;
  const isRequired = (id: string) => config.required.includes(id);
  /** Slider position is the benchmark's share of the index — a fixed 0–70%
   *  range that behaves identically regardless of the raw weight scale. */
  const setShare = (id: string, s: number) => {
    const others = total - config.weights[id];
    const w = s <= 0 ? 0 : others > 0 ? +(s / (100 - s) * others).toFixed(1) : 10;
    setW(id, w);
  };
  const set = (patch: Partial<IndexConfig>) => onChange({ ...config, ...patch });
  const setW = (id: string, w: number) => set({ weights: { ...config.weights, [id]: w } });
  const toggleReq = (id: string, checked: boolean) => set({
    required: [...config.required.filter((x) => x !== id), ...(checked ? [id] : [])],
    optional: [...(config.optional ?? []).filter((x) => x !== id), ...(checked ? [] : [id])],
  });
  const counts = useMemo(() => { const m = new Map<string, Set<string>>(); for (const o of snapshot.observations) (m.get(o.benchmarkId) ?? m.set(o.benchmarkId, new Set()).get(o.benchmarkId)!).add(o.variantId.split("@")[0]); return m; }, [snapshot]);
  const coverage = (id: string) => counts.get(id)?.size ?? 0;
  const [recent, setRecent] = useState<string | null>(null);
  const listable = useMemo(() => snapshot.benchmarks.filter((b) => !b.proxy && b.category !== "speed").sort((a, b) => a.category.localeCompare(b.category) || a.name.localeCompare(b.name)), [snapshot]);
  // Rows hold still while the list is open: what was in the mix when it opened stays pinned on top,
  // and anything added while browsing is checked in place instead of jumping away.
  const [pinnedIds, setPinnedIds] = useState<Set<string>>(new Set());
  const openList = () => { if (!open) setPinnedIds(new Set(active.map((b) => b.id))); setOpen(true); };
  const inactive = listable.filter((b) => !pinnedIds.has(b.id));
  const normalize = (value: string) => value.toLowerCase().replace(/[\s._-]+/g, "");
  const terms = query.trim().split(/\s+/).filter(Boolean).map(normalize);
  const hit = (b: Benchmark) => terms.every((term) => normalize([b.name, b.shortName, b.id, b.sourceId, CATS[b.category]].join(" ")).includes(term));
  const matches = inactive.filter(hit);
  const pinned = listable.filter((b) => pinnedIds.has(b.id) && hit(b));
  const groups = matches.reduce<Record<string, Benchmark[]>>((acc, b) => ((acc[b.category] ??= []).push(b), acc), {});
  // Adding keeps the list open and the query intact: people often add several while browsing.
  const toggle = (id: string) => { const on = config.weights[id] > 0; setW(id, on ? 0 : 10); setRecent(on ? null : id); };
  const addBenchmark = (id: string) => { setW(id, 10); setRecent(id); };

  return (
    <div className="grid gap-5">
      <div className="grid gap-2.5">
        {active.map((b) => {
          const share = shareOf(b.id), req = isRequired(b.id);
          return (
            <div key={b.id} className="grid grid-cols-[1fr_44px] gap-x-3 gap-y-1 items-center">
              <div className="flex items-baseline justify-between gap-2 min-w-0">
                <span className="flex items-center gap-1 min-w-0"><span className="truncate text-[13px]" title={b.description}>{b.name}</span><InfoIcon name={b.name} onClick={() => setInfo(b.id)} /></span>
                <label className="flex items-center gap-1.5 text-[11px] text-grey shrink-0 cursor-pointer">
                  <input type="checkbox" aria-label={`${b.name} required`} checked={req} onChange={(e) => toggleReq(b.id, e.target.checked)} className="accent-indigo" />Required
                </label>
              </div>
              <span className="num text-right text-[12.5px]">{share.toFixed(0)}%</span>
              <input type="range" min={0} max={Math.max(70, Math.ceil(share))} step={1} value={Math.round(share)} onChange={(e) => setShare(b.id, +e.target.value)} className="w-full h-[3px]" aria-label={`${b.name} weight`} />
              <button type="button" onClick={() => setW(b.id, 0)} className="cap text-right hover:text-ink" aria-label={`Remove ${b.name}`}>×</button>
            </div>
          );
        })}
      </div>

      <div ref={picker}>
        <div className="flex items-center gap-2 border hairline rounded-sm px-2.5 py-1.5 focus-within:border-indigo">
          <input ref={search} type="search" aria-label="Add a benchmark" aria-controls={resultsId} autoComplete="off" placeholder="Add a benchmark" value={query}
            onFocus={(e) => { if (!picker.current?.contains(e.relatedTarget as Node | null)) openList(); }} onClick={openList}
            onChange={(e) => { setQuery(e.target.value); openList(); }}
            onKeyDown={(e) => {
              if (e.key === "Escape") { e.preventDefault(); setQuery(""); setOpen(false); }
              if (e.key === "Enter" && open && terms.length && matches.length) { e.preventDefault(); addBenchmark(matches[0].id); }
            }}
            className="min-w-0 flex-1 bg-transparent text-[12.5px] text-ink-2 outline-none placeholder:text-ink-2" />
          <button type="button" aria-label={open ? "Hide benchmarks" : "Browse all benchmarks"} aria-expanded={open} aria-controls={resultsId} onClick={() => open ? setOpen(false) : openList()} className="cap shrink-0 hover:text-ink">{open ? "Close" : `Browse ${listable.length}`}</button>
        </div>
        {open && (
          // A sheet beside the sidebar (full screen on phones): one scroll area, room to browse,
          // and the sliders stay visible while benchmarks are toggled.
          <div id={resultsId} aria-label="Benchmarks" className="bench-sheet">
            <div className="bench-sheet-head">
              <div className="flex items-center gap-2 border hairline rounded-sm px-2.5 py-1.5 focus-within:border-indigo bg-white">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" className="text-grey shrink-0" aria-hidden="true"><circle cx="11" cy="11" r="6.5" /><path d="m20 20-4.2-4.2" /></svg>
                <input autoFocus type="search" aria-label="Search benchmarks" placeholder="Search by name, lab, or category" value={query} onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Escape") { e.preventDefault(); setOpen(false); setQuery(""); search.current?.focus(); } if (e.key === "Enter" && terms.length && matches.length) { e.preventDefault(); addBenchmark(matches[0].id); } }}
                  className="min-w-0 flex-1 bg-transparent text-[13px] outline-none" />
              </div>
              <div className="flex items-center justify-between mt-2.5"><span className="cap">{terms.length ? `${pinned.length + matches.length} matching` : `${active.length} in your mix · ${listable.length - active.length} more`}</span><button type="button" className="btn-quiet !py-1" onClick={() => { setOpen(false); setQuery(""); }}>Done</button></div>
            </div>
            <div className="bench-sheet-body grid gap-4">
              {pinned.length > 0 && <BenchGroup label="In your mix">{pinned.map((b) => <BenchRow key={b.id} b={b} on={config.weights[b.id] > 0} models={coverage(b.id)} fresh={recent === b.id} onToggle={() => toggle(b.id)} onInfo={() => setInfo(b.id)} />)}</BenchGroup>}
              {!matches.length && !pinned.length && <p className="cap py-2" role="status">No matching benchmarks.</p>}
              {Object.entries(groups).map(([cat, list]) => (
                <BenchGroup key={cat} label={CATS[cat] ?? cat}>{list.map((b) => <BenchRow key={b.id} b={b} on={config.weights[b.id] > 0} models={coverage(b.id)} fresh={recent === b.id} onToggle={() => toggle(b.id)} onInfo={() => setInfo(b.id)} />)}</BenchGroup>
              ))}
            </div>
          </div>
        )}
      </div>

      <BenchmarkInfo snapshot={snapshot} benchmarkId={info} inMix={!!info && config.weights[info] > 0} onAdd={(id) => setW(id, 10)} onClose={() => setInfo(null)} />
      <label className="grid gap-2 text-[13px] pt-2">
        <span className="flex justify-between"><span>Strictness</span><span className="cap">{Math.round(strictness)}</span></span>
        <input type="range" aria-label="Strictness" min={0} max={100} value={strictness} onChange={(e) => set({ strictness: Number(e.target.value) })} className="h-[3px] w-full" />
        <span className="flex justify-between text-[11px] text-grey"><span>Flexible</span><span>Strict</span></span>
      </label>
    </div>
  );
}

function BenchGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return <div role="group" aria-label={label}><div className="cap mb-1">{label}</div><div className="grid">{children}</div></div>;
}

/** One benchmark: the whole row toggles it in or out of the mix; the info icon opens its leaderboard. */
function BenchRow({ b, on, models, fresh, onToggle, onInfo }: { b: Benchmark; on: boolean; models: number; fresh: boolean; onToggle: () => void; onInfo: () => void }) {
  return (
    <div className={`bench-row flex items-center gap-1 min-w-0 rounded-sm ${fresh ? "bench-fresh" : ""}`}>
      <button type="button" role="checkbox" aria-checked={on} onClick={onToggle} title={b.description} className="min-w-0 flex-1 flex items-center gap-2 py-[5px] px-1 text-left text-[12.5px]">
        <span className={`bench-check ${on ? "on" : ""}`} aria-hidden="true">{on && <svg viewBox="0 0 12 12" width="10" height="10"><path d="M2.5 6.2 5 8.6l4.6-5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg>}</span>
        <span className="truncate flex-1">{b.name}</span>
        <span className="cap shrink-0">{models} models</span>
      </button>
      <InfoIcon name={b.name} onClick={onInfo} />
    </div>
  );
}
