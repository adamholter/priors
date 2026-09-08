"use client";
import { useEffect, useMemo, useRef, useState, type CSSProperties, type PointerEvent } from "react";
import type { Snapshot } from "@/data/types";
import { Wordmark } from "@/components/Wordmark";
import { encodeIndices } from "@/lib/url";
import { benchmarkQuality } from "./quality";
import { PREFERRED, type FitUpdate } from "./optimizer";
import "./onboarding.css";

const INITIAL = ["gpt-6-astra", "claude-fable-5.1", "claude-fable-5", "claude-opus-5", "gpt-5.6-sol", "gemini-3.8-flash", "claude-opus-4.8", "glm-5.3", "gpt-5.6-terra", "grok-4.6", "gemini-3.7-flash", "gpt-5.6-luna", "grok-4.5", "claude-sonnet-5"];
const ROW = 46;
const phaseNames = { preparing: "Reading the evidence", searching: "Searching the combinations", simplifying: "Keeping what matters", complete: "Your index, found" };
function Arrow({ direction = "right" }: { direction?: "right" | "up" | "down" }) { return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true" style={{ transform: direction === "up" ? "rotate(-90deg)" : direction === "down" ? "rotate(90deg)" : undefined }}><path d="M4 12h15m-6-6 6 6-6 6" /></svg>; }
function Grip() { return <svg width="16" height="18" viewBox="0 0 16 18" aria-hidden="true" fill="currentColor">{[4,9,14].flatMap(y => [5,10].map(x => <circle key={`${x}-${y}`} cx={x} cy={y} r="1" />))}</svg>; }
function Cross() { return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18" /></svg>; }
function Trace({ values }: { values: number[] }) {
  const path = values.map((v, i) => `${i ? "L" : "M"}${i / Math.max(1, values.length - 1) * 300},${68 - v * .6}`).join(" ");
  return <svg className="fit-trace" viewBox="0 0 300 76" role="img" aria-label="Ranking agreement over the search"><path d="M0 68H300M0 38H300M0 8H300" stroke="#333732" strokeWidth=".5" /><path d={path} fill="none" stroke="#BBC9A6" strokeWidth="1.5" vectorEffect="non-scaling-stroke" />{values.length > 0 && <circle cx="300" cy={68 - values[values.length - 1] * .6} r="3" fill="#BBC9A6" />}</svg>;
}

export function Onboarding({ snapshot }: { snapshot: Snapshot }) {
  const models = useMemo(() => new Map(snapshot.models.map(m => [m.id, m])), [snapshot]);
  const colors = useMemo(() => new Map(snapshot.labs.map(l => [l.id, l.color])), [snapshot]);
  const quality = useMemo(() => benchmarkQuality(snapshot), [snapshot]);
  const qMap = useMemo(() => new Map(quality.map(q => [q.id, q])), [quality]);
  const observedModels = useMemo(() => { const variants = new Map(snapshot.variants.map(v => [v.id, v.modelId])); return new Set(snapshot.observations.map(o => variants.get(o.variantId))); }, [snapshot]);
  const original = INITIAL.filter(id => models.has(id));
  const [order, setOrder] = useState(original);
  const orderRef = useRef(order);
  useEffect(() => { orderRef.current = order; }, [order]);
  const [stage, setStage] = useState<"order" | "fit">("order");
  const [drag, setDrag] = useState<{ id: string; y: number } | null>(null);
  const dragInfo = useRef<{ id: string; startY: number; top: number; scroll: number; original: string[] } | null>(null);
  const [announcement, setAnnouncement] = useState("");
  const [update, setUpdate] = useState<FitUpdate | null>(null);
  const [logs, setLogs] = useState<{ id: number; text: string }[]>([]);
  const [history, setHistory] = useState<number[]>([]);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const [modal, setModal] = useState<"models" | "quality">("quality");
  const [query, setQuery] = useState("");
  const dialog = useRef<HTMLDialogElement>(null);
  const worker = useRef<Worker | null>(null);
  const latest = useRef<FitUpdate | null>(null);
  const displayTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const startTime = useRef(0);
  const [elapsed, setElapsed] = useState(0);
  const complete = update?.phase === "complete";
  const running = stage === "fit" && !complete && !error;
  useEffect(() => () => { worker.current?.terminate(); if (displayTimer.current) clearTimeout(displayTimer.current); }, []);
  useEffect(() => {
    if (!running) return;
    const timer = setInterval(() => setElapsed((performance.now() - startTime.current) / 1000), 100);
    return () => clearInterval(timer);
  }, [running]);
  useEffect(() => {
    const cancel = (e: KeyboardEvent) => { if (e.key === "Escape" && dragInfo.current) { setOrder(dragInfo.current.original); dragInfo.current = null; setDrag(null); setAnnouncement("Move cancelled."); } };
    window.addEventListener("keydown", cancel); return () => window.removeEventListener("keydown", cancel);
  }, []);
  function move(id: string, to: number) {
    const from = orderRef.current.indexOf(id); const next = [...orderRef.current];
    next.splice(from, 1); next.splice(Math.max(0, Math.min(to, next.length)), 0, id);
    orderRef.current = next; setOrder(next); setAnnouncement(`${models.get(id)?.name} moved to ${next.indexOf(id) + 1} of ${next.length}.`);
  }
  function grab(e: PointerEvent<HTMLButtonElement>, id: string) {
    if (e.button !== 0 || stage !== "order") return;
    if (e.pointerType === "touch" && !(e.target as HTMLElement).closest(".grip")) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    const top = order.indexOf(id) * ROW;
    dragInfo.current = { id, top, startY: e.clientY, scroll: window.scrollY, original: [...order] };
    setDrag({ id, y: top });
  }
  function pull(e: PointerEvent<HTMLButtonElement>) {
    const d = dragInfo.current; if (!d) return;
    if (e.clientY < 80) window.scrollBy(0, -10); else if (e.clientY > innerHeight - 80) window.scrollBy(0, 10);
    const y = Math.max(-8, Math.min((order.length - 1) * ROW + 8, d.top + e.clientY - d.startY + window.scrollY - d.scroll));
    setDrag({ id: d.id, y }); const to = Math.max(0, Math.min(order.length - 1, Math.round(y / ROW)));
    if (orderRef.current.indexOf(d.id) !== to) move(d.id, to);
  }
  function release(cancel = false) {
    if (cancel && dragInfo.current) setOrder(dragInfo.current.original);
    dragInfo.current = null; setDrag(null);
  }
  function start() {
    worker.current?.terminate(); if (displayTimer.current) clearTimeout(displayTimer.current); displayTimer.current = null; setError(""); setCopied(false); setUpdate(null); latest.current = null; setLogs([]); setHistory([]); setElapsed(0); startTime.current = performance.now(); setStage("fit");
    window.scrollTo({ top: 0, behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth" });
    try {
      const w = new Worker(new URL("./fit.worker.ts", import.meta.url)); worker.current = w;
      let lastPaint = -Infinity;
      let logId = 0;
      const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      const paint = () => {
        displayTimer.current = null;
        if (worker.current !== w || !latest.current) return;
        const u = latest.current; latest.current = null; lastPaint = performance.now();
        setUpdate(u);
        const entry = { id: ++logId, text: u.log };
        setLogs(l => l.at(-1)?.text === u.log ? l : [...l.slice(-5), entry]);
        setHistory(h => [...h.slice(-23), u.agreement]);
        if (u.phase === "complete") setAnnouncement(`Search complete. ${u.matchedPairs} of ${u.totalPairs} pairs among your ${order.length} selected models match.`);
      };
      w.onmessage = (e: MessageEvent<FitUpdate | { error: string }>) => {
        if (worker.current !== w) return;
        if ("error" in e.data) { if (displayTimer.current) clearTimeout(displayTimer.current); latest.current = null; setError(e.data.error); w.terminate(); return; }
        latest.current = e.data;
        if (!displayTimer.current) {
          const delay = reduced ? 0 : Math.max(0, 650 - (performance.now() - lastPaint));
          if (delay === 0) paint(); else displayTimer.current = setTimeout(paint, delay);
        }
        if (e.data.phase === "complete") w.terminate();
      };
      w.onerror = () => { setError("The search stopped unexpectedly. Your order is still here."); w.terminate(); };
      w.postMessage({ snapshot, target: order, reducedMotion: window.matchMedia("(prefers-reduced-motion: reduce)").matches, quality: Object.fromEntries(quality.map(q => [q.id, q.score])) });
    } catch { setError("Could not start the search. Please try again."); }
  }
  function edit() { worker.current?.terminate(); worker.current = null; if (displayTimer.current) clearTimeout(displayTimer.current); displayTimer.current = null; latest.current = null; setStage("order"); setUpdate(null); setError(""); }
  function openDialog(kind: "models" | "quality") { setModal(kind); setQuery(""); dialog.current?.showModal(); }
  const liveOrder = stage === "order" || !update?.ranking.length ? order : [...update.ranking.map(r => r.modelId).filter(id => order.includes(id)), ...order.filter(id => !update.ranking.some(r => r.modelId === id))];
  const liveScores = new Map(update?.ranking.map(r => [r.modelId, r]) ?? []);
  const maxScore = Math.max(1, ...[...liveScores.values()].map(r => r.score));
  const activeWeights = Object.entries(update?.weights ?? {}).filter(([, w]) => w > 0).sort((a, b) => { const ai = PREFERRED.indexOf(a[0] as typeof PREFERRED[number]), bi = PREFERRED.indexOf(b[0] as typeof PREFERRED[number]); return (ai < 0 ? 100 : ai) - (bi < 0 ? 100 : bi) || a[0].localeCompare(b[0]); });
  const totalWeight = activeWeights.reduce((sum, [, w]) => sum + w, 0) || 1;
  const resultUrl = update ? `/builder?${encodeIndices([{ ...update.config, name: "My priors" }])}` : "";
  async function copy() { try { await navigator.clipboard.writeText(`${location.origin}${resultUrl}`); setCopied(true); } catch { setError("Couldn't copy. Use Explore this index, then copy its address."); } }
  const modelOptions = snapshot.models.filter(m => m.kind === "llm" && m.name.toLowerCase().includes(query.toLowerCase()) && observedModels.has(m.id)).sort((a, b) => Number(order.includes(b.id)) - Number(order.includes(a.id)) || a.name.localeCompare(b.name));

  return <div className={`onboarding stage-${stage} ${running ? "is-running" : ""}`}>
    <header className="onboard-header"><Wordmark size={32} href={null} /><span className="experiment-label">The priors experiment</span><button className="text-control" onClick={() => openDialog("quality")}>About the evidence <span aria-hidden="true">↗</span></button></header>
    <main className="onboard-main">
      <div className="step-line"><span className={stage === "order" ? "current" : "passed"}>01 <span>Your intuition</span></span><i /><span className={stage === "fit" ? "current" : ""}>02 <span>The evidence</span></span></div>
      <div className="onboard-intro" key={stage}>
        <h1>{stage === "order" ? <>What are your <em>priors?</em></> : complete ? <>Your priors, <em>in numbers.</em></> : <>Putting your priors<br className="mobile-break" /> <em>to the test.</em></>}</h1>
        <p>{stage === "order" ? "You have a sense of which models are better. Put them in order." : complete ? "Here’s the simplest fit we found for the order you believe in." : "Trying the benchmarks. Adjusting the weights. Keeping only what helps."}</p>
      </div>
      <div className="experiment-grid">
        <section className="order-board" aria-label={stage === "order" ? "Your model preferences" : "Fitted model ranking"}>
          <div className="board-heading"><span>{stage === "order" ? "YOUR ORDER" : "BEST FIT · YOUR SELECTED MODELS"}</span><span>{stage === "order" ? "BEST FIRST" : "SCORE / WANTED RANK"}</span></div>
          <div className="tactile-list" role="list" aria-label="Model ranking" style={{ height: order.length * ROW }}>
            {liveOrder.map(id => {
              const model = models.get(id)!; const index = liveOrder.indexOf(id); const wanted = order.indexOf(id); const result = liveScores.get(id); const picked = drag?.id === id;
              return <div key={id} role="listitem" data-model={id} className={`tactile-row ${picked ? "picked" : ""}`} style={{ "--lab": colors.get(model.labId) ?? "#8A8A80", transform: `translateY(${picked ? drag.y : index * ROW}px)`, zIndex: picked ? 20 : 1 } as CSSProperties}>
                <span className="rank-number">{String(index + 1).padStart(2, "0")}</span>
                <button className="model-grab" aria-label={stage === "order" ? `Move ${model.name}, rank ${wanted + 1}` : `${model.name}, rank ${index + 1}, score ${result ? result.score.toFixed(1) : "unavailable"}`} aria-describedby={stage === "order" ? "drag-help" : undefined} onPointerDown={e => grab(e, id)} onPointerMove={pull} onPointerUp={() => release()} onPointerCancel={() => release(true)} onKeyDown={e => { if (stage !== "order") return; if (e.key === "ArrowUp" || e.key === "ArrowDown") { e.preventDefault(); move(id, wanted + (e.key === "ArrowUp" ? -1 : 1)); } }}>
                  <span className="model-name">{model.name}</span><span className="belief-track"><span className="belief-bar" style={{ width: stage === "order" || !update ? "100%" : `${result ? Math.max(2, result.score / maxScore * 100) : 0}%` }} /></span>
                  {stage === "order" ? <span className="grip"><Grip /></span> : <span className="live-score">{result ? result.score.toFixed(1) : "—"}</span>}
                </button>
                {stage === "order" ? <span className="nudge"><button aria-label={`Move ${model.name} up`} disabled={wanted === 0} onClick={() => move(id, wanted - 1)}><Arrow direction="up" /></button><button aria-label={`Move ${model.name} down`} disabled={wanted === order.length - 1} onClick={() => move(id, wanted + 1)}><Arrow direction="down" /></button></span> : <span className={`wanted-rank ${index === wanted ? "matched" : ""}`} title={`You put ${model.name} at ${wanted + 1}`}>{index === wanted ? "✓" : `#${wanted + 1}`}</span>}
              </div>;
            })}
          </div>
          <div className="board-foot">{stage === "order" ? <><span id="drag-help">Drag a handle, or use the arrows.</span><button className="text-control" onClick={() => openDialog("models")}>Choose models <span aria-hidden="true">+</span></button></> : <><span>Best reasoning effort per model.</span><button className="text-control" onClick={edit}>{running ? "Stop & reorder" : "Change my order"}</button></>}</div>
        </section>
        <aside className="experiment-side">
          {stage === "order" ? <div className="setup-note">
            <div className="equal-bars" aria-hidden="true">{["#282828", "#CE7155", "#CE7155", "#397ACC", "#24A38B"].map((c, i) => <i key={i} style={{ background: c, animationDelay: `${i * 65}ms` }} />)}</div>
            <h2>Intuition first.<br />Evidence next.</h2>
            <p>Start with equal footing. We’ll look for a small benchmark mix that comes closest to your order.</p>
            <div className="preference-note"><span className="tiny-star" aria-hidden="true">✳</span><p>Your eight favorites get first consideration. Newer, less saturated, more objective tests get more weight when choosing between similar fits.</p></div>
            <button className="primary-action" onClick={start} disabled={order.length < 3}>Find my index <Arrow /></button>
            <span className="action-note">{order.length} models · up to 12 benchmarks</span>
            <button className="text-control evidence-link" onClick={() => openDialog("quality")}>See benchmark preferences <Arrow /></button>
          </div> : <>
            <div className="solver-monitor" role="region" aria-label="Optimization monitor">
              <span className="sr-only" role="status" aria-label={error ? "Search error" : complete ? "Search complete" : "Search running"}>{error ? "Search stopped" : complete ? "Search complete" : "Searching benchmark combinations"}</span>
              <div className="monitor-top"><span><i className={running ? "pulse" : ""} />{error ? "SEARCH STOPPED" : complete ? "SEARCH COMPLETE" : "SEARCH IN PROGRESS"}</span><span>{elapsed.toFixed(1)}s</span></div>
              <div className="agreement"><strong>{update ? Math.round(update.agreement) : "0"}<span>%</span></strong><span>selected-model agreement<br /><small>{update ? `${update.matchedPairs} of ${update.totalPairs} pairs · ${order.length} models` : "Preparing model comparisons"}</small></span></div>
              <Trace values={history} />
              <div className="monitor-metrics"><span>{(update?.tested ?? 0).toLocaleString()} <small>combinations</small></span><span>{update?.benchmarkCount ?? "—"} <small>benchmarks</small></span></div>
              <div className="terminal-log" aria-hidden="true">{logs.length ? logs.map(log => <div key={log.id}><span>›</span>{log.text}</div>) : <div><span>›</span>Loading the measured results<span className="cursor">_</span></div>}</div>
            </div>
            {error && <div className="fit-error" role="alert"><p>{error}</p><button className="text-control" onClick={start}>Try again <Arrow /></button></div>}
            <div className="mix-panel"><div className="mix-heading"><h2>{complete ? "Your benchmark mix" : update ? phaseNames[update.phase] : "Reading the evidence"}</h2><span className="phase-mark">{complete ? "✓" : "⋯"}</span></div>
              {activeWeights.length ? <div className="mix-rows">{activeWeights.map(([id, w]) => { const q = qMap.get(id); return <button key={id} className="mix-row" onClick={() => openDialog("quality")} title={q?.reason}><span className="mix-name">{q?.preferred && <span className="preferred-star" aria-label="Preferred benchmark">✳</span>}{q?.name ?? snapshot.benchmarks.find(b => b.id === id)?.name ?? id}</span><span className="mix-percent">{(w / totalWeight * 100).toFixed(1)}%</span><span className="mix-weight-track"><i style={{ width: `${w / totalWeight * 100}%` }} /></span></button>; })}</div> : <div className="mix-empty">Checking coverage across your models<span className="cursor">_</span></div>}
              {update && <div className="mix-quality"><button className="text-control" onClick={() => openDialog("quality")}>Evidence quality <span>{Math.round(update.quality)}/100</span></button><span>✳ Your preferred benchmarks</span></div>}
            </div>
            {complete && <div className="result-actions"><p className="fit-disclosure">{update!.matchedPairs === update!.totalPairs ? "Every pair matches your order." : `${update!.totalPairs - update!.matchedPairs} ${update!.totalPairs - update!.matchedPairs === 1 ? "pair differs" : "pairs differ"} from your order. This is the closest fit found, not proof that your ranking is right.`} {update!.estimatedShare > 0 && `${Math.round(update!.estimatedShare * 100)}% of weighted evidence is estimated.`}</p>{update!.mismatches.length > 0 && <details className="fit-details"><summary>See the disagreements</summary><ul>{update!.mismatches.map((pair, i) => <li key={i}>You placed <strong>{models.get(pair.above)?.name}</strong> above <strong>{models.get(pair.below)?.name}</strong>.</li>)}</ul></details>}<details className="fit-details"><summary>How this fit was calculated</summary><p>Strictness {update!.config.strictness ?? 20}/100. {update!.config.effortMatching === "strict" ? "Exact reasoning efforts only." : "Calibrated reasoning-effort estimates allowed."} {update!.config.estimateMissing ? "Missing benchmark results may be estimated from peers." : "Missing results are left out and available weights are renormalized."} Only pairs within your selected lineup count toward agreement. Unselected models cannot compensate for a mistake in that lineup. Best effort per model. Candidates are screened, then checked with the builder’s scoring engine. We search nonnegative weights and prune benchmarks. This is a best fit found, not a guarantee of the global minimum.</p></details><a className="primary-action" href={resultUrl}>Explore this index <Arrow /></a><button className="text-control copy-result" onClick={copy}>{copied ? "Link copied ✓" : "Copy index link"}</button></div>}
          </>}
        </aside>
      </div>
      <footer className="onboard-footer"><span>Intuition is a starting point. Benchmarks are evidence, not a verdict.</span><span>Snapshot {snapshot.date}</span></footer>
    </main>
    <span className="sr-only" aria-live="polite">{announcement}</span>
    <dialog ref={dialog} className="evidence-dialog" aria-labelledby="dialog-heading" onClick={e => { if (e.target === e.currentTarget) { const r = e.currentTarget.getBoundingClientRect(); if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) dialog.current?.close(); } }}>
      <div className="dialog-heading"><div><h2 id="dialog-heading">{modal === "models" ? "Who’s in your lineup?" : "Better evidence, fewer benchmarks."}</h2><p>{modal === "models" ? `Choose 3 to 18 models. ${order.length} selected.` : "Your preferences guide the search. Quality helps break close calls."}</p></div><button aria-label="Close dialog" className="icon-close" onClick={() => dialog.current?.close()}><Cross /></button></div>
      {modal === "models" ? <><input className="model-search" type="search" placeholder="Find a model…" aria-label="Find a model" value={query} onChange={e => setQuery(e.target.value)} /><div className="model-options">{modelOptions.map(m => <label key={m.id}><input type="checkbox" checked={order.includes(m.id)} disabled={order.includes(m.id) ? order.length <= 3 : order.length >= 18} onChange={() => setOrder(o => o.includes(m.id) ? o.filter(id => id !== m.id) : [...o, m.id])} /><i style={{ background: colors.get(m.labId) ?? "#8A8A80" }} /><span>{m.name}</span></label>)}{!modelOptions.length && <p>No models found.</p>}</div><button className="primary-action" onClick={() => dialog.current?.close()}>Use this lineup <Arrow /></button></> : <>
        <div className="quality-explainer"><p><strong>Recency</strong> rewards recent test releases. An unknown release date gets a neutral score. A fresh scrape is not a fresh benchmark.</p><p><strong>Headroom</strong> measures saturation and score spread. Tests that separate models beat tests everyone passes.</p><p><strong>Objectivity</strong> favors verifiable outcomes over preferences and subjective judging.</p></div>
        <p className="quality-caveat">Quality combines 30% recency, 40% headroom, and 30% objectivity. Objectivity is an assigned judgment score. This heuristic does not measure contamination or scientific validity.</p>
        <div className="quality-table"><div className="quality-table-head"><span>Benchmark</span><span>Recent</span><span>Headroom</span><span>Objective</span><span>Quality</span></div>{quality.filter(q => q.preferred || activeWeights.some(([id]) => id === q.id)).sort((a, b) => Number(b.preferred) - Number(a.preferred) || b.score - a.score).map(q => <div className="quality-entry" key={q.id}><div className="quality-table-row"><span>{q.preferred && <span className="preferred-star">✳ </span>}{q.name}</span><span>{q.dateConfidence === "unknown" ? "?" : Math.round(q.recency)}</span><span>{Math.round(q.saturation)}</span><span>{Math.round(q.objectivity)}</span><strong>{Math.round(q.score)}</strong></div><details><summary>{q.releaseDate ? `Released ${q.releaseDate}` : "Release date unverified"} · Why this score</summary><p>{q.reason} <a href={q.sourceUrl} target="_blank" rel="noreferrer">Source ↗</a></p></details></div>)}</div>
      </>}
    </dialog>
  </div>;
}
