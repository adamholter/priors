"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import type { Snapshot } from "@/data/types";
import { chartVariantMode, computeIndex, defaultConfig, selectVariants, type IndexConfig } from "@/engine";
import { ShareCards } from "./ShareCards";
import { encodeIndices } from "@/lib/url";
import { WeightsPanel } from "./WeightsPanel";
import { Rankings } from "./Rankings";
import { ParetoChart } from "./chart/ParetoChart";
import { Wordmark } from "./Wordmark";
import { IndexTabs } from "./IndexTabs";
import { CalculationSettings, type CalculationSettingsHandle } from "./CalculationSettings";
import { ChartSettings } from "./chart/ChartSettings";
import { HeaderAuth } from "./HeaderAuth";
import { DatePicker } from "./DatePicker";
import { mergeImports, type ImportPayload } from "@/lib/import";
import { SourceStatus } from "./SourceStatus";

export function Builder({ snapshot: base, dates, initialIndices }: { snapshot: Snapshot; dates: string[]; initialIndices: IndexConfig[] }) {
  // Benchmarks imported in this browser (via /import without an account) are merged client-side.
  const calculations = useRef<CalculationSettingsHandle>(null);
  const [local, setLocal] = useState<ImportPayload[]>([]);
  useEffect(() => { const id = requestAnimationFrame(() => { try { setLocal(JSON.parse(localStorage.getItem("priors:imports") ?? "[]")); } catch { /* ignore */ } }); return () => cancelAnimationFrame(id); }, []);
  const [live, setLive] = useState({ base, snapshot: base });
  const sourceSnapshot = live.base === base ? live.snapshot : base;
  const receiveSnapshot = useCallback((s: Snapshot) => setLive({ base, snapshot: s }), [base]);
  const snapshot = useMemo(() => mergeImports(sourceSnapshot, local).snapshot, [sourceSnapshot, local]);
  // URL is the source of truth for anonymous builds; multiple `i` params = multiple indices.
  const [indices, setIndices] = useState<IndexConfig[]>(() => (initialIndices.length ? initialIndices : [defaultConfig(base)]));
  const [activeId, setActiveId] = useState(indices[0].id);
  const active = indices.find((i) => i.id === activeId) ?? indices[0];
  const result = useMemo(() => computeIndex(snapshot, { ...active, variants: "all" }), [snapshot, active]);
  const rankingMode = chartVariantMode(active, "ranking"), paretoMode = chartVariantMode(active, "pareto");
  const rankingRows = useMemo(() => selectVariants(result.ranked, rankingMode), [result, rankingMode]);
  const paretoRows = useMemo(() => selectVariants(result.ranked, paretoMode), [result, paretoMode]);

  // write URL (debounced) when indices change
  const t = useRef<number | null>(null);
  useEffect(() => {
    if (t.current) window.clearTimeout(t.current);
    t.current = window.setTimeout(() => {
      const p = encodeIndices(indices); const url = new URL(window.location.href);
      url.searchParams.delete("i");
      p.getAll("i").forEach((value) => url.searchParams.append("i", value));
      window.history.replaceState(null, "", url.toString());
    }, 150);
    return () => { if (t.current) window.clearTimeout(t.current); };
  }, [indices]);

  const update = useCallback((c: IndexConfig) => setIndices((list) => list.map((i) => (i.id === c.id ? c : i))), []);
  const add = () => { const id = `i${Date.now().toString(36)}`; const c = { ...defaultConfig(snapshot, id, "New index") }; setIndices((l) => [...l, c]); setActiveId(id); };
  const remove = (id: string) => { setIndices((l) => { const n = l.filter((i) => i.id !== id); if (!n.length) n.push(defaultConfig(snapshot)); if (activeId === id) setActiveId(n[0].id); return n; }); };

  return (
    <div className="min-h-screen">
      <header className="flex flex-wrap lg:flex-nowrap items-center gap-x-4 gap-y-2 px-4 sm:px-8 py-3 lg:py-0 lg:h-14 border-b hairline sticky top-0 bg-bone/90 backdrop-blur z-10">
        <div className="shrink-0"><Wordmark /></div>
        <div className="min-w-0 flex-1 overflow-x-auto">
          <IndexTabs indices={indices} activeId={active.id} onSelect={setActiveId} onRename={(id, name) => update({ ...indices.find((i) => i.id === id)!, name })} onAdd={add} onRemove={remove} />
        </div>
        <div className="w-full lg:w-auto lg:ml-auto flex flex-wrap items-center gap-2 shrink-0">
          <DatePicker current={snapshot.date} dates={[...new Set([snapshot.date, ...dates])].sort().reverse()} />
          <ShareCards indices={indices} active={active} date={snapshot.date} />
          <HeaderAuth indices={indices} />
        </div>
      </header>

      <main className="grid grid-cols-1 lg:grid-cols-[360px_minmax(0,1fr)] gap-10 px-4 sm:px-8 py-8 max-w-[1500px] items-start">
        <aside aria-label="Index controls" className="flex flex-col gap-5 min-h-0 lg:sticky lg:top-[88px] lg:h-[calc(100dvh-120px)]">
          <section aria-label="Benchmarks and eligibility" className="min-h-0 lg:flex-1 lg:overflow-y-auto overscroll-contain pr-2 pb-2">
            <h2 className="text-[22px] mb-1">Your mix</h2>
            <p className="cap mb-4">{result.benchmarks.length} benchmarks · {new Set(result.ranked.map((r) => r.model.id)).size} models</p>
            <WeightsPanel snapshot={snapshot} config={active} result={result} onChange={update} />
            <CalculationSettings ref={calculations} config={active} result={result} snapshot={snapshot} onChange={update}>
              <SourceStatus snapshot={sourceSnapshot} onSnapshot={receiveSnapshot} />
            </CalculationSettings>
          </section>
          <section aria-label="Import a benchmark" className="shrink-0 border-t hairline pt-5">
            <h3 className="text-[16px] mb-1">Missing a benchmark?</h3>
            <p className="text-[12.5px] text-ink-2 mb-2">Hand your agent the Priors skill. It researches the benchmark, produces the JSON, and uploads it here.</p>
            <div className="flex gap-2"><Link className="btn-quiet" href="/skill">Get the skill</Link><Link className="btn-quiet" href="/import">Import JSON</Link></div>
          </section>
        </aside>

        <section className="grid gap-10 min-w-0 content-start [&>div]:min-w-0">
          <div>
            <div className="flex flex-wrap gap-x-4 gap-y-1 items-baseline justify-between mb-3">
              <h2 className="text-[26px]">{active.name}</h2>
              <ChartSettings label="Ranking" mode={rankingMode} onChange={(rankingVariants) => update({ ...active, rankingVariants })} />
            </div>
            <Rankings onSelect={(r) => { if (r) calculations.current?.inspect(r.variant.id); }} ranked={rankingRows} labs={snapshot.labs} showEffort={rankingMode === "all"} />
          </div>
          <div>
            <div className="flex flex-wrap gap-x-4 gap-y-1 items-baseline justify-between mb-1">
              <h2 className="text-[22px]">Score vs cost per task</h2>
              <ChartSettings label="Pareto" mode={paretoMode} onChange={(paretoVariants) => update({ ...active, paretoVariants })} />
            </div>
            <ParetoChart ranked={paretoRows} labs={snapshot.labs} />
          </div>
        </section>
      </main>
    </div>
  );
}

