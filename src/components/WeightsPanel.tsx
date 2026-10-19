"use client";
import { useId, useMemo, useState, useRef, useCallback } from "react";
import type { Benchmark, Snapshot } from "@/data/types";
import type { IndexConfig, IndexResult } from "@/engine";
import Link from "next/link";

import { useLightDismiss } from "@/lib/useLightDismiss";
import { searchBenchmarks } from "@/lib/benchmark-search";
import { BenchmarkInfo, InfoIcon } from "./BenchmarkInfo";
import { useLabColor } from "./chart/echarts";
import { groupBySource, tierBenchmarks } from "@/lib/benchmark-groups";
import { benchmarkFamilies } from "@/lib/benchmark-family";
import { FamilyGear } from "./FamilyGear";
import { benchmarkQuality } from "@/onboarding/quality";

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
  const counts = useMemo(() => { const m = new Map<string, Set<string>>(); for (const o of snapshot.observations) (m.get(o.benchmarkId) ?? m.set(o.benchmarkId, new Set()).get(o.benchmarkId)!).add(o.variantId.split("@")[0]); return m; }, [snapshot]);
  const coverage = (id: string) => counts.get(id)?.size ?? 0;
  const [recent, setRecent] = useState<string | null>(null);
  const searchable = useMemo(() => snapshot.benchmarks.filter((b) => !b.proxy && b.category !== "speed").sort((a, b) => a.category.localeCompare(b.category) || a.name.localeCompare(b.name)), [snapshot]);
  // A benchmark's other cuts (categories, prompts, subsets) hide behind its gear; searching still finds them.
  const listable = useMemo(() => searchable.filter((b) => !b.variantOf), [searchable]);
  const families = useMemo(() => benchmarkFamilies(snapshot.benchmarks), [snapshot]);
  // Who is on top of each benchmark right now, shown as a lab-colored dot.
  const leaders = useMemo(() => {
    const model = new Map(snapshot.variants.map((v) => [v.id, v.modelId])), names = new Map(snapshot.models.map((m) => [m.id, m]));
    const best = new Map<string, { modelId: string; value: number }>();
    for (const o of snapshot.observations) {
      const b = benches.get(o.benchmarkId); if (!b || !Number.isFinite(o.value)) continue;
      const modelId = model.get(o.variantId) ?? model.get(o.variantId.split("~")[0]) ?? o.variantId.split("@")[0];
      const cur = best.get(o.benchmarkId);
      if (!cur || (b.higherIsBetter === false ? o.value < cur.value : o.value > cur.value)) best.set(o.benchmarkId, { modelId, value: o.value });
    }
    const out = new Map<string, { name: string; labId: string; value: number; released?: string }>();
    for (const [id, l] of best) { const m = names.get(l.modelId); if (m) out.set(id, { name: m.name, labId: m.labId, value: l.value, released: m.releaseDate }); }
    return out;
  }, [snapshot, benches]);
  const labs = useMemo(() => new Map(snapshot.labs.map((l) => [l.id, l.color])), [snapshot]);
  const tiers = useMemo(() => tierBenchmarks(listable, new Map(benchmarkQuality(snapshot).map((q) => [q.id, q])), new Map([...leaders].map(([id, l]) => [id, l.released])), snapshot.date), [listable, snapshot, leaders]);
  const [by, setBy] = useState<"topic" | "source">("topic");
  // Rows hold still while the list is open: what was in the mix when it opened stays pinned on top,
  // and anything added while browsing is checked in place instead of jumping away.
  const [pinnedIds, setPinnedIds] = useState<Set<string>>(new Set());
  const openList = () => { if (!open) setPinnedIds(new Set(active.map((b) => b.id))); setOpen(true); };
  const terms = query.trim().split(/\s+/).filter(Boolean);
  const inactive = (terms.length ? searchable : listable).filter((b) => !pinnedIds.has(b.id));
  // Names rank first, then other fields, then descriptions (src/lib/benchmark-search.ts). A search shows one list, best match first; browsing groups by category.
  const catName = (c: string) => CATS[c] ?? c;
  const matches = searchBenchmarks(inactive, query, catName);
  const pinned = searchBenchmarks(searchable.filter((b) => pinnedIds.has(b.id)), query, catName);
  const unpinned = (l: Benchmark[]) => l.filter((b) => !pinnedIds.has(b.id));
  const mainList = unpinned(tiers.main), popularList = unpinned(tiers.popular), oldList = unpinned(tiers.old);
  const sections: [string, Benchmark[]][] = by === "source" ? groupBySource(mainList) : Object.entries(mainList.reduce<Record<string, Benchmark[]>>((acc, b) => ((acc[b.category] ??= []).push(b), acc), {})).map(([c, l]) => [catName(c), l]);
  const row = (b: Benchmark) => <BenchRow key={b.id} b={b} on={config.weights[b.id] > 0} models={coverage(b.id)} fresh={recent === b.id} leader={leaders.get(b.id)} labColor={labs.get(leaders.get(b.id)?.labId ?? "")} gear={gear(b, "add")} onToggle={() => toggle(b.id)} onInfo={() => setInfo(b.id)} />;
  const groups = terms.length ? { "Best matches": matches } : matches.reduce<Record<string, Benchmark[]>>((acc, b) => ((acc[b.category] ??= []).push(b), acc), {});
  // Adding keeps the list open and the query intact: people often add several while browsing.
  const toggle = (id: string) => { const on = config.weights[id] > 0; setW(id, on ? 0 : 10); setRecent(on ? null : id); };
  const addBenchmark = (id: string) => { setW(id, 10); setRecent(id); };
  /** Rank on another cut of the same benchmark: it takes the weight (and the required or optional mark) of the one it replaces. */
  const swap = (from: string, to: string) => {
    if (from === to) return;
    const w = config.weights[from];
    const weights = Object.fromEntries(Object.entries(config.weights).map(([k, v]) => (k === from ? [to, w ?? v] : [k, v])));
    const map = (l: string[]) => l.map((x) => (x === from ? to : x));
    onChange({ ...config, weights, required: map(config.required), ...(config.optional ? { optional: map(config.optional) } : {}) });
    setRecent(to);
  };
  const gear = (b: Benchmark, mode: "swap" | "add") => { const f = families.get(b.id); return f ? <FamilyGear family={f} name={b.name} mode={mode} selected={f.options.map((o) => o.id).filter((id) => config.weights[id] > 0)} onPick={(id) => (mode === "swap" ? swap(b.id, id) : toggle(id))} /> : null; };

  return (
    <div className="grid gap-5">
      <div className="grid gap-2.5">
        {active.map((b) => {
          const share = shareOf(b.id), req = isRequired(b.id);
          return (
            <div key={b.id} className="grid gap-1.5">
              <div className="flex items-center justify-between gap-2 min-w-0">
                <span className="flex items-center gap-1 min-w-0"><LeaderDot leader={leaders.get(b.id)} color={labs.get(leaders.get(b.id)?.labId ?? "")} /><span className="truncate text-[13px]" title={b.description}>{b.name}</span><InfoIcon name={b.name} onClick={() => setInfo(b.id)} />{gear(b, "swap")}{req && <span className="cap shrink-0" title="Models without a measured score here are not ranked. Change this in Calculation settings.">required</span>}</span>
                <span className="flex items-center shrink-0"><span className="num text-right text-[12.5px] w-9">{share.toFixed(0)}%</span><button type="button" onClick={() => setW(b.id, 0)} className="bench-remove" aria-label={`Remove ${b.name}`} title={`Remove ${b.name}`}>×</button></span>
              </div>
              <input type="range" min={0} max={Math.max(70, Math.ceil(share))} step={1} value={Math.round(share)} onChange={(e) => setShare(b.id, +e.target.value)} className="w-full h-[3px]" aria-label={`${b.name} weight`} />
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
                <input autoFocus type="search" aria-label="Search benchmarks" placeholder="Search by name, topic, lab or category" value={query} onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Escape") { e.preventDefault(); setOpen(false); setQuery(""); search.current?.focus(); } if (e.key === "Enter" && terms.length && matches.length) { e.preventDefault(); addBenchmark(matches[0].id); } }}
                  className="min-w-0 flex-1 bg-transparent text-[13px] outline-none" />
              </div>
              <div className="flex items-center justify-between mt-2.5"><span className="cap">{terms.length ? `${pinned.length + matches.length} matching` : `${active.length} in your mix · ${listable.length - active.length} more`}</span><button type="button" className="btn-quiet !py-1" onClick={() => { setOpen(false); setQuery(""); }}>Done</button></div>
            </div>
            <div className="bench-sheet-body grid gap-4">
              {pinned.length > 0 && <BenchGroup label="In your mix">{pinned.map(row)}</BenchGroup>}
              {!matches.length && !pinned.length && <p className="cap py-2" role="status">No matching benchmarks.</p>}
              {terms.length
                ? Object.entries(groups).map(([cat, list]) => <BenchGroup key={cat} label={cat}>{list.map(row)}</BenchGroup>)
                : <>
                  {popularList.length > 0 && <BenchGroup label="Popular">{popularList.map(row)}</BenchGroup>}
                  <div className="flex items-center justify-between gap-3 border-t hairline pt-3">
                    <span className="cap">All benchmarks</span>
                    <div className="seg" role="group" aria-label="Group benchmarks"><button type="button" aria-pressed={by === "topic"} onClick={() => setBy("topic")}>By topic</button><button type="button" aria-pressed={by === "source"} onClick={() => setBy("source")}>By source</button></div>
                  </div>
                  {sections.map(([label, list]) => <BenchGroup key={label} label={label}>{list.map(row)}</BenchGroup>)}
                  {oldList.length > 0 && <details className="bench-old">
                    <summary className="cap cursor-pointer hover:text-ink w-fit">Older and niche · {oldList.length}</summary>
                    <p className="text-[12px] text-ink-2 my-2 max-w-[48ch]">Earlier-generation tests, superseded versions and benchmarks no top model has been run on.</p>
                    <div className="grid">{oldList.map(row)}</div>
                  </details>}
                </>}
              <p className="text-[12px] text-ink-2 border-t hairline pt-3">Missing one? <Link className="text-indigo hover:underline" href="/skill" transitionTypes={["nav-forward"]}>Have your agent add it</Link> or <Link className="text-indigo hover:underline" href="/import" transitionTypes={["nav-forward"]}>import JSON</Link>.</p>
            </div>
          </div>
        )}
      </div>

      <BenchmarkInfo snapshot={snapshot} benchmarkId={info} inMix={!!info && config.weights[info] > 0} onAdd={(id) => setW(id, 10)} onClose={() => setInfo(null)} />
    </div>
  );
}

function BenchGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return <div role="group" aria-label={label}><div className="cap mb-1">{label}</div><div className="grid">{children}</div></div>;
}

/** One benchmark: the whole row toggles it in or out of the mix; the info icon opens its leaderboard. */
function BenchRow({ b, on, models, fresh, leader, labColor, gear, onToggle, onInfo }: { b: Benchmark; on: boolean; models: number; fresh: boolean; leader?: Leader; labColor?: string; gear?: React.ReactNode; onToggle: () => void; onInfo: () => void }) {
  return (
    <div className={`bench-row flex items-center gap-1 min-w-0 rounded-sm ${fresh ? "bench-fresh" : ""}`}>
      <button type="button" role="checkbox" aria-checked={on} onClick={onToggle} title={b.description} className="min-w-0 flex-1 flex items-center gap-2 py-[5px] px-1 text-left text-[12.5px]">
        <span className={`bench-check ${on ? "on" : ""}`} aria-hidden="true">{on && <svg viewBox="0 0 12 12" width="10" height="10"><path d="M2.5 6.2 5 8.6l4.6-5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg>}</span>
        <LeaderDot leader={leader} color={labColor} />
        <span className="truncate flex-1">{b.name}</span>
        <span className="cap shrink-0">{models} models</span>
      </button>
      {gear}
      <InfoIcon name={b.name} onClick={onInfo} />
    </div>
  );
}

type Leader = { name: string; labId: string; value: number };

/** The lab color of whichever model is on top of this benchmark; hover for who. */
function LeaderDot({ leader, color }: { leader?: Leader; color?: string }) {
  const lab = useLabColor();
  if (!leader) return <span className="bench-dot" aria-hidden="true" />;
  const c = lab(leader.labId, color);
  return <span className="bench-dot" role="img" aria-label={`Top: ${leader.name}`} title={`Top: ${leader.name}`} style={{ background: c }} />;
}
