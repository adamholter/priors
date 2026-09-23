"use client";
import { useEffect, useMemo, useRef } from "react";
import type { Benchmark, Snapshot } from "@/data/types";

const CATS: Record<string, string> = { coding: "Coding", agentic: "Agentic", reasoning: "Reasoning", knowledge: "Knowledge", math: "Math", "long-context": "Long context", instruction: "Instruction following", creative: "Creative", safety: "Safety", economics: "Economics", composite: "Composite index", speed: "Speed", cost: "Cost", reliability: "Reliability", other: "Other" };
const UNIT: Record<string, string> = { percent: "Percent", elo: "Elo rating", score: "Score", usd: "US dollars", seconds: "Seconds", count: "Count" };

export function InfoIcon({ name, onClick }: { name: string; onClick: () => void }) {
  return <button type="button" onClick={onClick} aria-label={`About ${name}`} title={`About ${name}`} className="shrink-0 grid place-items-center w-[18px] h-[18px] rounded-full text-grey hover:text-indigo focus-visible:outline-indigo">
    <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3" aria-hidden="true"><circle cx="8" cy="8" r="6.4" /><path d="M8 7.2v4" strokeLinecap="round" /><circle cx="8" cy="4.9" r=".55" fill="currentColor" stroke="none" /></svg>
  </button>;
}

function format(b: Benchmark, v: number) {
  if (b.unit === "percent") return `${v.toFixed(1)}%`;
  if (b.unit === "usd") return `$${v >= 100 ? Math.round(v).toLocaleString() : v.toFixed(2)}`;
  if (b.unit === "seconds") return `${v.toFixed(v >= 10 ? 0 : 1)}s`;
  return v.toFixed(b.unit === "elo" ? 0 : 1);
}

/** A benchmark's own leaderboard (best configuration per model, as published), what it measures, and its source. */
export function BenchmarkInfo({ snapshot, benchmarkId, inMix, onAdd, onClose }: { snapshot: Snapshot; benchmarkId: string | null; inMix?: boolean; onAdd?: (id: string) => void; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => { const d = ref.current; if (!d) return; if (benchmarkId && !d.open) d.showModal(); if (!benchmarkId && d.open) d.close(); }, [benchmarkId]);
  const b = snapshot.benchmarks.find((x) => x.id === benchmarkId);
  const data = useMemo(() => {
    if (!b) return null;
    const variants = new Map(snapshot.variants.map((v) => [v.id, v]));
    const models = new Map(snapshot.models.map((m) => [m.id, m]));
    const color = new Map(snapshot.labs.map((l) => [l.id, l.color]));
    const best = new Map<string, { value: number; effort: string }>();
    for (const o of snapshot.observations) {
      if (o.benchmarkId !== b.id) continue;
      const v = variants.get(o.variantId), mid = v?.modelId ?? o.variantId.split("@")[0];
      const cur = best.get(mid);
      if (!cur || (b.higherIsBetter ? o.value > cur.value : o.value < cur.value)) best.set(mid, { value: o.value, effort: v?.effort ?? "default" });
    }
    const rows = [...best].map(([mid, x]) => ({ name: models.get(mid)?.name ?? mid, color: color.get(models.get(mid)?.labId ?? "") ?? "#A3A39B", ...x }))
      .sort((p, q) => b.higherIsBetter ? q.value - p.value : p.value - q.value);
    const top = rows.slice(0, 10), values = rows.map((r) => r.value);
    const lo = b.unit === "percent" ? 0 : Math.min(...values), hi = b.unit === "percent" ? 100 : Math.max(...values);
    const width = (v: number) => Math.max(3, hi > lo ? ((b.higherIsBetter ? v - lo : hi - v) / (hi - lo)) * 100 : 50);
    let host = ""; try { host = new URL(b.url).hostname.replace(/^www\./, ""); } catch { /* no url */ }
    return { top, total: rows.length, width, host };
  }, [b, snapshot]);

  return <dialog ref={ref} className="bench-dialog" aria-labelledby="bench-title" onClose={onClose} onClick={(e) => { if (e.target === e.currentTarget) ref.current?.close(); }}>
    {b && data && <div className="p-6 sm:p-7">
      <div className="flex items-start justify-between gap-6">
        <div className="min-w-0">
          <p className="cap">{CATS[b.category] ?? b.category}{b.lastUpdated ? ` · updated ${b.lastUpdated}` : ""}</p>
          <h2 id="bench-title" className="text-[30px] leading-[1.08] mt-1.5">{b.name}</h2>
        </div>
        <button type="button" aria-label="Close" onClick={() => ref.current?.close()} className="shrink-0 grid place-items-center w-8 h-8 border hairline rounded-sm text-grey hover:text-ink"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18" /></svg></button>
      </div>
      {b.description && <p className="text-[13.5px] leading-[1.65] text-ink-2 mt-3 max-w-[62ch]">{b.description}</p>}
      <dl className="flex flex-wrap gap-x-6 gap-y-1 mt-4 text-[12px]">
        <div className="flex gap-1.5"><dt className="text-grey">Scale</dt><dd>{UNIT[b.unit] ?? b.unit}, {b.higherIsBetter ? "higher is better" : "lower is better"}</dd></div>
        <div className="flex gap-1.5"><dt className="text-grey">Models</dt><dd className="num">{data.total}</dd></div>
      </dl>
      <div className="mt-5 border-t-2 border-ink pt-3">
        <div className="flex items-baseline justify-between mb-2"><h3 className="text-[17px]">Top models</h3><span className="cap">best configuration per model</span></div>
        {data.top.length ? <ol className="grid gap-[5px]">
          {data.top.map((r, i) => <li key={r.name} className="grid grid-cols-[20px_minmax(0,1.15fr)_minmax(56px,1fr)_60px] items-center gap-2.5 h-[24px] text-[12.5px]">
            <span className="cap text-right">{i + 1}</span>
            <span className="truncate">{r.name}{r.effort !== "default" && <em className="not-italic cap ml-1.5">{r.effort}</em>}</span>
            <span className="h-[9px] bg-hair-2 rounded-[2px] overflow-hidden"><i className="block h-full rounded-[2px]" style={{ width: `${data.width(r.value)}%`, background: r.color }} /></span>
            <span className="num text-right">{format(b, r.value)}</span>
          </li>)}
        </ol> : <p className="cap py-3">No results in this snapshot.</p>}
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3 mt-6 pt-4 border-t hairline">
        {b.url ? <a href={b.url} target="_blank" rel="noreferrer" className="text-[13px] text-indigo hover:underline">View on {data.host || "the source"} ↗</a> : <span />}
        {onAdd && (inMix ? <span className="cap">In your mix</span> : <button type="button" className="btn-quiet" onClick={() => { onAdd(b.id); ref.current?.close(); }}>Add to your mix</button>)}
      </div>
    </div>}
  </dialog>;
}
