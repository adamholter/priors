"use client";
import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import type { Snapshot } from "@/data/types";
import { defaultConfig } from "@/engine";
import { INTRO_CARDS } from "@/lib/share-designs";

export const INTRO_KEY = "priors:intro-seen";
const STEP_MS = [3200, 3400, 5200];
const STEPS = [
  { n: "01", title: "Rank a few models", body: "Put them in the order your own experience says." },
  { n: "02", title: "We find the evidence", body: "Priors searches thousands of benchmark mixes for the one that reproduces your order." },
  { n: "03", title: "Share your leaderboard", body: "Every model ranked by your index, live, with a card ready to post." },
];

function Arrow() { return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true"><path d="M4 12h15m-6-6 6 6-6 6" /></svg>; }
function Cross() { return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18" /></svg>; }

export function Intro({ snapshot, lineup, dialogRef, onClose }: { snapshot: Snapshot; lineup: string[]; dialogRef: React.RefObject<HTMLDialogElement | null>; onClose: () => void }) {
  const [step, setStep] = useState(2);
  const [open, setOpen] = useState(false);
  const [reduced, setReduced] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const models = useMemo(() => new Map(snapshot.models.map(m => [m.id, m])), [snapshot]);
  const colors = useMemo(() => new Map(snapshot.labs.map(l => [l.id, l.color])), [snapshot]);
  const rows = lineup.slice(0, 4).map(id => models.get(id)).filter(m => !!m);
  const mix = useMemo(() => {
    const w = Object.entries(defaultConfig(snapshot).weights).sort((a, b) => b[1] - a[1]).slice(0, 4);
    const total = w.reduce((s, [, v]) => s + v, 0);
    return w.map(([id, v]) => ({ name: snapshot.benchmarks.find(b => b.id === id)?.shortName ?? snapshot.benchmarks.find(b => b.id === id)?.name ?? id, share: v / total }));
  }, [snapshot]);

  useEffect(() => {
    const el = dialogRef.current; if (!el) return;
    const sync = () => setOpen(el.open);
    const mo = new MutationObserver(sync); mo.observe(el, { attributes: true, attributeFilter: ["open"] });
    sync();
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const r = () => setReduced(mq.matches); r(); mq.addEventListener("change", r);
    return () => { mo.disconnect(); mq.removeEventListener("change", r); };
  }, [dialogRef]);
  useEffect(() => {
    if (!open || reduced) return;
    timer.current = setTimeout(() => setStep(s => (s + 1) % STEPS.length), STEP_MS[step]);
    return () => { if (timer.current) clearTimeout(timer.current); };
  }, [open, step, reduced]);
  const shown = reduced ? 2 : step;

  return <dialog ref={dialogRef} className="intro-dialog" aria-labelledby="intro-heading" onClose={onClose} onClick={e => { if (e.target === e.currentTarget) dialogRef.current?.close(); }}>
    <div className="intro-shell" tabIndex={-1} autoFocus>
      <div className={`intro-stage step-${shown}`} aria-hidden="true" key={open ? "open" : "closed"}>
        <div className="intro-scene scene-rank">
          <span className="scene-label">Your order</span>
          <div className="mini-list" style={{ height: rows.length * 44 }}>
            {rows.map((m, i) => { const to = i === 2 ? 1 : i === 1 ? 2 : i; return <div key={m.id} className={`mini-row ${i === 2 ? "lift" : i === 1 ? "drop" : ""}`} style={{ "--from": `${i * 44}px`, "--to": `${to * 44}px` } as CSSProperties}><span className="mini-name">{m.name}</span><i style={{ background: colors.get(m.labId) ?? "#8A8A80" }} /><span className="mini-grip">⋮⋮</span></div>; })}
          </div>
        </div>
        <div className="intro-scene scene-fit">
          <div className="fit-top"><span className="scene-label">Benchmarks that agree</span><span className="fit-match">Matches your order ✓</span></div>
          {mix.map((b, i) => <div key={b.name} className="fit-row" style={{ "--d": `${i * 120}ms`, "--w": `${Math.round(b.share * 100)}%` } as CSSProperties}><span>{b.name}</span><em>{Math.round(b.share * 100)}%</em><b><i /></b></div>)}
        </div>
        <div className="intro-scene scene-cards">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {INTRO_CARDS.map((d, i) => <img key={d} className={`share-card card-${i}`} src={`/intro/${d}.png`} alt="" width={1200} height={630} loading="eager" fetchPriority="high" decoding="async" />)}
        </div>
      </div>
      <div className="intro-copy">
        <div className="intro-top"><h2 id="intro-heading">Your gut ranking, <em>backed by benchmarks.</em></h2><button className="icon-close" aria-label="Close" onClick={() => dialogRef.current?.close()}><Cross /></button></div>
        <ol className="intro-steps">
          {STEPS.map((s, i) => <li key={s.n}><button className={i === shown ? "active" : ""} aria-current={i === shown ? "step" : undefined} onClick={() => setStep(i)}><span className="intro-n">{s.n}</span><span><strong>{s.title}</strong><span>{s.body}</span></span></button></li>)}
        </ol>
        <button className="primary-action" onClick={() => dialogRef.current?.close()}>Start ranking <Arrow /></button>
        <span className="intro-note">About a minute. No sign-in.</span>
      </div>
    </div>
  </dialog>;
}
