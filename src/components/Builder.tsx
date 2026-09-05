"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import type { Snapshot } from "@/data/types";
import { computeIndex, defaultConfig, type IndexConfig, type RankedVariant } from "@/engine";
import { encodeIndices } from "@/lib/url";
import { WeightsPanel } from "./WeightsPanel";
import { Rankings } from "./Rankings";
import { ParetoChart } from "./chart/ParetoChart";
import { Wordmark } from "./Wordmark";
import { IndexTabs } from "./IndexTabs";
import { ModelDetail } from "./ModelDetail";
import { HeaderAuth } from "./HeaderAuth";
import { DatePicker } from "./DatePicker";
import { mergeImports, type ImportPayload } from "@/lib/import";

export function Builder({ snapshot: base, dates, initialIndices }: { snapshot: Snapshot; dates: string[]; initialIndices: IndexConfig[] }) {
  // Benchmarks imported in this browser (via /import without an account) are merged client-side.
  const [local, setLocal] = useState<ImportPayload[]>([]);
  useEffect(() => { const id = requestAnimationFrame(() => { try { setLocal(JSON.parse(localStorage.getItem("priors:imports") ?? "[]")); } catch { /* ignore */ } }); return () => cancelAnimationFrame(id); }, []);
  const snapshot = useMemo(() => mergeImports(base, local).snapshot, [base, local]);
  // URL is the source of truth for anonymous builds; multiple `i` params = multiple indices.
  const [indices, setIndices] = useState<IndexConfig[]>(() => (initialIndices.length ? initialIndices : [defaultConfig(base)]));
  const [activeId, setActiveId] = useState(indices[0].id);
  const [selected, setSelected] = useState<string | null>(null);
  const active = indices.find((i) => i.id === activeId) ?? indices[0];
  const result = useMemo(() => computeIndex(snapshot, active), [snapshot, active]);

  // write URL (debounced) when indices change
  const t = useRef<number | null>(null);
  useEffect(() => {
    if (t.current) window.clearTimeout(t.current);
    t.current = window.setTimeout(() => {
      const p = encodeIndices(indices); const url = new URL(window.location.href);
      url.search = p.toString(); window.history.replaceState(null, "", url.toString());
    }, 150);
    return () => { if (t.current) window.clearTimeout(t.current); };
  }, [indices]);

  const update = useCallback((c: IndexConfig) => setIndices((list) => list.map((i) => (i.id === c.id ? c : i))), []);
  const add = () => { const id = `i${Date.now().toString(36)}`; const c = { ...defaultConfig(snapshot, id, "New index") }; setIndices((l) => [...l, c]); setActiveId(id); };
  const remove = (id: string) => { setIndices((l) => { const n = l.filter((i) => i.id !== id); if (!n.length) n.push(defaultConfig(snapshot)); if (activeId === id) setActiveId(n[0].id); return n; }); };
  const sel: RankedVariant | null = selected ? result.ranked.find((r) => r.variant.id === selected) ?? null : null;

  return (
    <div className="min-h-screen">
      <header className="flex items-center gap-6 px-8 h-14 border-b hairline sticky top-0 bg-bone/90 backdrop-blur z-10">
        <Wordmark size={22} />
        <IndexTabs indices={indices} activeId={active.id} onSelect={setActiveId} onRename={(id, name) => update({ ...indices.find((i) => i.id === id)!, name })} onAdd={add} onRemove={remove} />
        <div className="ml-auto flex items-center gap-2">
          <DatePicker current={snapshot.date} dates={dates} />
          <ShareButton />
          <HeaderAuth indices={indices} />
        </div>
      </header>

      <main className="grid grid-cols-[360px_1fr] gap-10 px-8 py-8 max-w-[1500px]">
        <aside className="grid gap-8 content-start">
          <section>
            <h2 className="text-[22px] mb-1">Your mix</h2>
            <p className="cap mb-4">{result.benchmarks.length} benchmarks · {result.ranked.length} ranked · {result.excluded.length} excluded</p>
            <WeightsPanel snapshot={snapshot} config={active} result={result} onChange={update} />
          </section>
          <section className="border-t hairline pt-5">
            <h3 className="text-[16px] mb-1">Missing a benchmark?</h3>
            <p className="text-[12.5px] text-ink-2 mb-2">Hand your agent the Priors skill. It researches the benchmark, produces the JSON, and uploads it here.</p>
            <div className="flex gap-2"><Link className="btn-quiet" href="/skill">Get the skill</Link><Link className="btn-quiet" href="/import">Import JSON</Link></div>
          </section>
        </aside>

        <section className="grid gap-10 min-w-0">
          <div>
            <div className="flex items-baseline justify-between mb-3">
              <h2 className="text-[26px]">{active.name}</h2>
              <span className="cap">score 0–100 · color by lab · dot = partly estimated</span>
            </div>
            <Rankings ranked={result.ranked} labs={snapshot.labs} onSelect={(r) => setSelected(r?.variant.id ?? null)} selected={selected} />
            {result.excluded.length > 0 && <Excluded result={result} />}
          </div>
          <div>
            <div className="flex items-baseline justify-between mb-1">
              <h2 className="text-[22px]">Score vs cost per task</h2>
              <span className="cap">measured run cost, not token price · ink ring = Pareto frontier</span>
            </div>
            <ParetoChart ranked={result.ranked} labs={snapshot.labs} />
          </div>
          {sel && <ModelDetail r={sel} snapshot={snapshot} result={result} onClose={() => setSelected(null)} />}
        </section>
      </main>
    </div>
  );
}

function Excluded({ result }: { result: ReturnType<typeof computeIndex> }) {
  const [open, setOpen] = useState(false);
  const names = new Map(result.benchmarks.map((b) => [b.benchmark.id, b.benchmark.shortName ?? b.benchmark.name]));
  return (
    <div className="mt-4">
      <button type="button" onClick={() => setOpen(!open)} className="cap hover:text-ink">{open ? "Hide" : "Show"} {result.excluded.length} excluded for missing required benchmarks</button>
      {open && <ul className="mt-2 grid gap-1 text-[12px] text-ink-2 columns-2">{result.excluded.slice(0, 60).map((e) => <li key={e.variant.id}>{e.model.name}{e.variant.effort !== "default" && <em className="not-italic cap ml-1">{e.variant.effort}</em>} <span className="cap">— no {e.missing.map((m) => names.get(m) ?? m).join(", ")}</span></li>)}</ul>}
    </div>
  );
}

function ShareButton() {
  const [ok, setOk] = useState(false);
  return (
    <span className="flex items-center gap-1">
      <button type="button" className="btn-quiet" onClick={async () => { await navigator.clipboard.writeText(window.location.href); setOk(true); setTimeout(() => setOk(false), 1400); }}>{ok ? "Link copied" : "Copy link"}</button>
      <a className="btn-quiet" href="#" onClick={(e) => { e.preventDefault(); window.open(`/og${window.location.search}`, "_blank", "noopener"); }} title="Share card image">Card</a>
    </span>
  );
}
