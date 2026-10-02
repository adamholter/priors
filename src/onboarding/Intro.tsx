"use client";
import Link from "next/link";
import { useLabColor } from "@/components/chart/echarts";
import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import type { Snapshot } from "@/data/types";
import { defaultConfig } from "@/engine";
import { INTRO_CARDS } from "@/lib/share-designs";

export const INTRO_KEY = "priors:intro-seen";
const STEP_MS = [3200, 3400, 5200];
const STEPS = [
  { n: "01", title: "Pick the better model", body: "Two at a time. Swipe or tap. Skip any you don’t know." },
  { n: "02", title: "We find the evidence", body: "Your calls become a ranking. Priors searches thousands of benchmark mixes for the one that reproduces it." },
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
  const labColor = useLabColor();
  const colors = useMemo(() => new Map(snapshot.labs.map(l => [l.id, labColor(l.id, l.color)])), [snapshot, labColor]);
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
          <span className="scene-label">Which is better?</span>
          <div className="mini-duel">
            {rows.slice(0, 2).map((m, i) => <div key={m.id} className={`mini-card ${i === 0 ? "pick" : "pass"}`} style={{ "--lab": colors.get(m.labId) ?? "#8A8A80" } as CSSProperties}><i /><span>{m.name}</span><em>✓ Better</em></div>)}
          </div>
          <div className="mini-choices"><span>← Left</span><span>Not sure</span><span>Right →</span></div>
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
        <div className="intro-top"><h2 id="intro-heading">Your gut calls, <em>backed by benchmarks.</em></h2><button className="icon-close" aria-label="Close" onClick={() => dialogRef.current?.close()}><Cross /></button></div>
        <ol className="intro-steps">
          {STEPS.map((s, i) => <li key={s.n}><button className={i === shown ? "active" : ""} aria-current={i === shown ? "step" : undefined} onClick={() => setStep(i)}><span className="intro-n">{s.n}</span><span><strong>{s.title}</strong><span>{s.body}</span></span></button></li>)}
        </ol>
        <button className="primary-action" onClick={() => dialogRef.current?.close()}>Start choosing <Arrow /></button>
        <span className="intro-note">About a minute. No sign-in. · <Link href="/privacy" className="hover:text-ink">Privacy</Link></span>
      </div>
    </div>
  </dialog>;
}
