"use client";
import { useMemo, useState } from "react";
import type { Benchmark, Snapshot } from "@/data/types";
import type { IndexConfig, IndexResult } from "@/engine";

const CATS: Record<string, string> = { coding: "Coding", agentic: "Agentic", reasoning: "Reasoning", knowledge: "Knowledge", math: "Math", "long-context": "Long context", instruction: "Instruction following", creative: "Creative", safety: "Safety", economics: "Economics", composite: "Composite indices", speed: "Speed", cost: "Cost", other: "Other" };

export function WeightsPanel({ snapshot, config, result, onChange }: { snapshot: Snapshot; config: IndexConfig; result: IndexResult; onChange: (c: IndexConfig) => void }) {
  const [open, setOpen] = useState(false);
  const [advanced, setAdvanced] = useState(false);
  const benches = useMemo(() => new Map(snapshot.benchmarks.map((b) => [b.id, b])), [snapshot]);
  const active = Object.entries(config.weights).filter(([, w]) => w > 0).map(([id]) => benches.get(id)).filter((b): b is Benchmark => !!b);
  const total = active.reduce((a, b) => a + config.weights[b.id], 0) || 1;
  const shareOf = (id: string) => (config.weights[id] / total) * 100;
  const isRequired = (id: string) => config.required.includes(id) || shareOf(id) > config.cutoff;
  const set = (patch: Partial<IndexConfig>) => onChange({ ...config, ...patch });
  const setW = (id: string, w: number) => set({ weights: { ...config.weights, [id]: w } });
  const toggleReq = (id: string) => set({ required: config.required.includes(id) ? config.required.filter((x) => x !== id) : [...config.required, id] });
  const coverage = (id: string) => { const n = new Set(snapshot.observations.filter((o) => o.benchmarkId === id).map((o) => o.variantId.split("@")[0])).size; return n; };
  const inactive = snapshot.benchmarks.filter((b) => !(config.weights[b.id] > 0) && !b.proxy && b.category !== "speed").sort((a, b) => a.category.localeCompare(b.category) || a.name.localeCompare(b.name));
  const groups = inactive.reduce<Record<string, Benchmark[]>>((acc, b) => ((acc[b.category] ??= []).push(b), acc), {});

  return (
    <div className="grid gap-5">
      <div className="grid gap-2.5">
        {active.map((b) => {
          const share = shareOf(b.id), req = isRequired(b.id), explicit = config.required.includes(b.id);
          return (
            <div key={b.id} className="grid grid-cols-[1fr_44px] gap-x-3 gap-y-1 items-center">
              <div className="flex items-baseline justify-between gap-2 min-w-0">
                <span className="truncate text-[13px]" title={b.description}>{b.name}{result.benchmarks.find((x) => x.benchmark.id === b.id)?.benchmark.versionPolicy?.kind === "fallback" && <span className="cap ml-1" title="falls back to the previous version for models not yet evaluated">+fallback</span>}</span>
                <button type="button" onClick={() => toggleReq(b.id)} title={explicit ? "Required (click to unpin)" : req ? `Required because its share exceeds the ${config.cutoff}% cutoff` : "Optional (click to require)"}
                  className={`cap shrink-0 ${explicit ? "text-indigo" : req ? "text-ink-2" : "text-grey/70 hover:text-ink-2"}`}>{explicit ? "required" : req ? "required·" : "optional"}</button>
              </div>
              <span className="num text-right text-[12.5px]">{share.toFixed(0)}%</span>
              <input type="range" min={0} max={60} step={1} value={config.weights[b.id]} onChange={(e) => setW(b.id, +e.target.value)} className="w-full h-[3px]" aria-label={`${b.name} weight`} />
              <button type="button" onClick={() => setW(b.id, 0)} className="cap text-right hover:text-ink" aria-label={`Remove ${b.name}`}>×</button>
            </div>
          );
        })}
      </div>

      <div>
        <button type="button" onClick={() => setOpen(!open)} className="btn-quiet w-full text-left flex justify-between"><span>Add a benchmark</span><span className="cap">{inactive.length}</span></button>
        {open && (
          <div className="mt-2 grid gap-3 max-h-[360px] overflow-auto pr-1">
            {Object.entries(groups).map(([cat, list]) => (
              <div key={cat}>
                <div className="cap mb-1">{CATS[cat] ?? cat}</div>
                {list.map((b) => (
                  <button type="button" key={b.id} onClick={() => setW(b.id, 10)} className="w-full text-left flex items-baseline justify-between gap-2 py-[3px] text-[12.5px] hover:text-indigo" title={b.description}>
                    <span className="truncate">{b.name}</span><span className="cap shrink-0">{coverage(b.id)} models</span>
                  </button>
                ))}
              </div>
            ))}
          </div>
        )}
      </div>

      <div>
        <button type="button" onClick={() => setAdvanced(!advanced)} className="cap hover:text-ink">{advanced ? "Hide" : "Show"} eligibility rules</button>
        {advanced && (
          <div className="mt-3 grid gap-3 text-[12.5px]">
            <label className="grid grid-cols-[1fr_44px] gap-x-3 items-center">
              <span>Benchmarks above this share are required<br /><span className="cap">Missing a required benchmark excludes the model.</span></span>
              <span className="num text-right">{config.cutoff}%</span>
              <input type="range" min={0} max={50} step={1} value={config.cutoff} onChange={(e) => set({ cutoff: +e.target.value })} className="col-span-2 h-[3px]" />
            </label>
            <label className="flex items-start gap-2"><input type="checkbox" checked={config.estimateMissing} onChange={(e) => set({ estimateMissing: e.target.checked })} className="mt-1 accent-indigo" /><span>Estimate small missing benchmarks from similar models<br /><span className="cap">Otherwise weights renormalize over what was measured. Estimates are always marked.</span></span></label>
            <label className="flex items-center gap-2"><span>Rank</span>
              <select value={config.variants} onChange={(e) => set({ variants: e.target.value as "all" | "best" })} className="btn-quiet"><option value="all">every reasoning effort</option><option value="best">each model’s best effort</option></select>
            </label>
          </div>
        )}
      </div>
    </div>
  );
}
