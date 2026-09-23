"use client";
import { useId, useMemo, useState, useRef, useCallback } from "react";
import type { Benchmark, Snapshot } from "@/data/types";
import { strictnessOf, type IndexConfig, type IndexResult } from "@/engine";

import { useLightDismiss } from "@/hooks/useLightDismiss";
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
  const coverage = (id: string) => { const n = new Set(snapshot.observations.filter((o) => o.benchmarkId === id).map((o) => o.variantId.split("@")[0])).size; return n; };
  const inactive = snapshot.benchmarks.filter((b) => !(config.weights[b.id] > 0) && !b.proxy && b.category !== "speed").sort((a, b) => a.category.localeCompare(b.category) || a.name.localeCompare(b.name));
  const normalize = (value: string) => value.toLowerCase().replace(/[\s._-]+/g, "");
  const terms = query.trim().split(/\s+/).filter(Boolean).map(normalize);
  const matches = inactive.filter((b) => terms.every((term) => normalize([b.name, b.shortName, b.id, b.sourceId, CATS[b.category]].join(" ")).includes(term)));
  const groups = matches.reduce<Record<string, Benchmark[]>>((acc, b) => ((acc[b.category] ??= []).push(b), acc), {});
  const addBenchmark = (id: string) => { setW(id, 10); setQuery(""); setOpen(false); search.current?.focus(); };

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
            onFocus={(e) => { if (!picker.current?.contains(e.relatedTarget as Node | null)) setOpen(true); }} onClick={() => setOpen(true)}
            onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
            onKeyDown={(e) => {
              if (e.key === "Escape") { e.preventDefault(); setQuery(""); setOpen(false); }
              if (e.key === "Enter" && open && terms.length && matches.length) { e.preventDefault(); addBenchmark(matches[0].id); }
            }}
            className="min-w-0 flex-1 bg-transparent text-[12.5px] text-ink-2 outline-none placeholder:text-ink-2" />
          <button type="button" aria-label={open ? "Hide benchmarks" : "Show benchmarks"} aria-expanded={open} aria-controls={resultsId} onClick={() => setOpen(!open)} className="cap shrink-0 hover:text-ink">{matches.length}</button>
        </div>
        {open && (
          <div id={resultsId} aria-label="Available benchmarks" className="mt-2 grid gap-3 max-h-[360px] overflow-auto pr-1">
            {!matches.length && <p className="cap py-2" role="status">No matching benchmarks.</p>}
            {Object.entries(groups).map(([cat, list]) => (
              <div key={cat}>
                <div className="cap mb-1">{CATS[cat] ?? cat}</div>
                {list.map((b) => (
                  <div key={b.id} className="flex items-center gap-1">
                    <button type="button" onClick={() => addBenchmark(b.id)} className="min-w-0 flex-1 text-left flex items-baseline justify-between gap-2 py-[3px] text-[12.5px] hover:text-indigo" title={b.description}>
                      <span className="truncate">{b.name}</span><span className="cap shrink-0">{coverage(b.id)} models</span>
                    </button>
                    <InfoIcon name={b.name} onClick={() => setInfo(b.id)} />
                  </div>
                ))}
              </div>
            ))}
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
