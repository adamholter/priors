"use client";
import { useEffect, useMemo, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent } from "react";
import type { Lab, Model } from "@/data/types";
import { QUICK, finishWithIndex, pairKey, runBracket, type Answer, type BracketOptions, type BracketStep } from "./bracket";
import { track } from "@/lib/analytics";

const KEY = "priors:bracket";
const SWIPE = 72;
type Side = "left" | "right" | "tie";

/** Starts a fresh production run when the user explicitly chooses Rank in pairs. */
export function resetSavedBracket() {
  try { localStorage.removeItem(KEY); } catch { /* storage can be disabled */ }
}

function Arrow({ left = false }: { left?: boolean }) { return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true" style={left ? { transform: "rotate(180deg)" } : undefined}><path d="M4 12h15m-6-6 6 6-6 6" /></svg>; }
const TIERS = { frontier: "Frontier tier", mid: "Mid tier", small: "Small model" } as const;
const released = (iso?: string) => iso ? `Released ${new Date(`${iso.slice(0, 10)}T00:00:00Z`).toLocaleDateString("en-US", { month: "short", year: "numeric", timeZone: "UTC" })}` : "Release date unknown";

/** Drops the last real call from the saved bracket, so reopening the matchups resumes one step back. */
export function undoSavedCall() {
  try {
    const saved = JSON.parse(localStorage.getItem(KEY) ?? "null") as { v?: number; answers?: Answer[] } | null;
    if (!saved?.answers?.length) return;
    let i = saved.answers.length - 1;
    while (i >= 0 && saved.answers[i].auto) i--;
    localStorage.setItem(KEY, JSON.stringify({ ...saved, answers: saved.answers.slice(0, Math.max(0, i)) }));
  } catch { /* ignore */ }
}

export function Bracket({ seeds, models, labs, onFinish, onList, options, storageKey = KEY }: { seeds: string[]; models: Map<string, Model>; labs: Map<string, Lab>; onFinish: (step: BracketStep) => void; onList: () => void; options?: BracketOptions; storageKey?: string | null }) {
  const [answers, setAnswers] = useState<Answer[]>([]);
  const step = useMemo(() => runBracket(seeds, answers, options), [seeds, answers, options]);
  // Saved answers replay only against the same seeds and bracket shape.
  const shape = `${seeds.join()}|${JSON.stringify(options ?? {})}`;
  const [leaving, setLeaving] = useState<Side | null>(null);
  const [offset, setOffset] = useState<{ x: number; y: number } | null>(null);
  const [announcement, setAnnouncement] = useState("");
  const gesture = useRef<{ x: number; y: number; id: number; moved: boolean; cleanup: () => void } | null>(null);
  const suppressClick = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const restored = useRef(false);
  const stepRef = useRef(step);
  useEffect(() => { stepRef.current = step; }, [step]);

  useEffect(() => {
    const raf = requestAnimationFrame(() => {
      try {
        const saved = JSON.parse(storageKey ? localStorage.getItem(storageKey) ?? "null" : "null") as { v?: number; seeds?: string; answers?: Answer[] } | null;
        if (saved?.v === 2 && saved.seeds === shape && Array.isArray(saved.answers)) setAnswers(saved.answers);
      } catch { /* start fresh */ }
      restored.current = true;
    });
    return () => cancelAnimationFrame(raf);
  }, [shape, storageKey]);
  useEffect(() => { if (restored.current && storageKey) try { localStorage.setItem(storageKey, JSON.stringify({ v: 2, seeds: shape, answers })); } catch { /* ignore */ } }, [answers, shape, storageKey]);
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); gesture.current?.cleanup(); }, []);
  // A finished bracket goes straight to the full ranking for review.
  const finish = useRef(onFinish);
  useEffect(() => { finish.current = onFinish; }, [onFinish]);
  useEffect(() => { if (step.done && step.order.length) finish.current(step); }, [step]);

  function choose(side: Side) {
    const s = stepRef.current;
    if (!s.pair || timer.current) return;
    const [l, r] = s.pair;
    const winner = side === "left" ? l : side === "right" ? r : null;
    const commit = () => {
      timer.current = null; setLeaving(null); setOffset(null);
      if (!s.asked) track("onboarding_started", { mode: "pairs", first: winner ? "pick" : "unsure" });
      setAnswers((a) => [...a, { a: l, b: r, winner, check: s.check }]);
      setAnnouncement(winner ? `${models.get(winner)?.name} is better.` : "Not sure. The index decides this one.");
    };
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) { commit(); return; }
    setLeaving(side);
    timer.current = setTimeout(commit, side === "tie" ? 420 : 560);
  }
  function undo() {
    if (timer.current) return;
    setAnswers((a) => { let i = a.length - 1; while (i >= 0 && a[i].auto) i--; return i < 0 ? a : a.slice(0, i); });
    setAnnouncement("Last call undone.");
  }
  function finishRest() { setAnswers((a) => finishWithIndex(seeds, a, options)); }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey || document.querySelector("dialog[open]")) return;
      if ((e.target as HTMLElement)?.closest("input,textarea,select")) return;
      const map: Record<string, Side> = { ArrowLeft: "left", ArrowRight: "right", ArrowDown: "tie", ArrowUp: "tie" };
      if (map[e.key] && stepRef.current.pair) { e.preventDefault(); choose(map[e.key]); }
      else if (e.key === "Backspace" || e.key.toLowerCase() === "z") { e.preventDefault(); undo(); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function down(e: ReactPointerEvent<HTMLDivElement>) {
    if (e.button !== 0 || timer.current || gesture.current) return;
    const g = { x: e.clientX, y: e.clientY, id: e.pointerId, moved: false, locked: false, cleanup: () => {} };
    const move = (ev: PointerEvent) => {
      if (ev.pointerId !== g.id) return;
      const x = ev.clientX - g.x, y = ev.clientY - g.y;
      if (!g.moved && Math.hypot(x, y) < 6) return;
      g.moved = true; setOffset({ x, y });
      const locked = Math.abs(x) >= SWIPE && Math.abs(x) > Math.abs(y);
      if (locked && !g.locked) try { navigator.vibrate?.(8); } catch { /* unsupported */ }
      g.locked = locked;
    };
    const up = (ev: PointerEvent) => {
      if (ev.pointerId !== g.id) return;
      g.cleanup(); gesture.current = null;
      if (!g.moved) return;
      suppressClick.current = true; setTimeout(() => { suppressClick.current = false; }, 0);
      const x = ev.clientX - g.x, y = ev.clientY - g.y;
      if (Math.abs(x) >= SWIPE && Math.abs(x) > Math.abs(y)) choose(x < 0 ? "left" : "right");
      else setOffset(null);
    };
    const cancel = () => { g.cleanup(); gesture.current = null; setOffset(null); };
    g.cleanup = () => { window.removeEventListener("pointermove", move); window.removeEventListener("pointerup", up); window.removeEventListener("pointercancel", cancel); };
    window.addEventListener("pointermove", move); window.addEventListener("pointerup", up); window.addEventListener("pointercancel", cancel);
    gesture.current = g;
  }

  // Dragging toward a card votes for it. `pull` is 0–1 toward the commit threshold; the leaning
  // card visibly takes over (lifts, outlines, names itself) while the other one recedes.
  const horizontal = offset && Math.abs(offset.x) > Math.abs(offset.y) && Math.abs(offset.x) > 8;
  const lean: Side | null = leaving ?? (horizontal ? offset!.x < 0 ? "left" : "right" : null);
  const pull = leaving ? 1 : horizontal ? Math.min(1, Math.abs(offset!.x) / SWIPE) : 0;
  const armed = pull >= 1;
  const cardStyle = (side: "left" | "right"): CSSProperties | undefined => {
    if (leaving || !lean || lean === "tie") return undefined;
    const towardCenter = side === "left" ? 1 : -1;
    return lean === side
      ? { transform: `translate(${towardCenter * pull * 10}px, ${-6 * pull}px) scale(${1 + 0.035 * pull})`, borderColor: armed ? "var(--indigo)" : `color-mix(in srgb, var(--indigo) ${Math.round(25 + 50 * pull)}%, transparent)`, boxShadow: `0 0 0 ${armed ? 2 : pull}px color-mix(in srgb, var(--indigo) ${Math.round(35 + 65 * pull)}%, transparent), 0 ${12 + 14 * pull}px 40px -22px color-mix(in srgb, var(--indigo-fill) ${Math.round(50 * pull)}%, transparent)` }
      : { transform: `translate(${-towardCenter * pull * 14}px, ${4 * pull}px) scale(${1 - 0.06 * pull})`, opacity: 1 - 0.6 * pull, filter: `grayscale(${pull})` };
  };
  const card = (id: string, side: "left" | "right") => {
    const m = models.get(id); const lab = m ? labs.get(m.labId) : undefined;
    const state = leaving === side ? "won" : leaving === "tie" ? "unsure" : leaving ? "lost" : lean === side ? "leaning" : lean ? "receding" : "";
    return <button key={id} type="button" data-side={side} className={`duel-card ${side} ${state}`} style={{ "--lab": lab?.color ?? "#8A8A80", "--pull": lean === side ? pull : 0, ...cardStyle(side) } as CSSProperties} aria-label={`${m?.name ?? id} is better`} onClick={() => { if (!suppressClick.current) choose(side); }}>
      <span className="duel-stripe" aria-hidden="true" />
      <span className="duel-lab"><i aria-hidden="true" />{lab?.name ?? m?.labId}</span>
      <span className="duel-name">{m?.name ?? id}</span>
      <span className="duel-meta">{[m?.priceTier && TIERS[m.priceTier], m?.reasoning && "Reasoning"].filter(Boolean).join(" · ") || "\u00a0"}</span>
      <span className="duel-meta">{released(m?.releaseDate)}</span>
      <span className="duel-stamp" aria-hidden="true"><svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="m5 12.5 4.5 4.5L19 7.5" /></svg>Better</span>
    </button>;
  };
  const leanName = lean && lean !== "tie" && step.pair ? models.get(step.pair[lean === "left" ? 0 : 1])?.name : undefined;
  const live = new Set(step.pair ?? []);

  return <div className="bracket" data-done={step.done || undefined}>
    <section className="bracket-main" aria-label="Head-to-head matchups">
      {step.done ? null : <>
        <div className="bracket-meta"><span className="bracket-round">{step.round}</span><span>Call {String(step.asked + 1).padStart(2, "0")} · up to {options?.cap ?? QUICK.cap}</span></div>
        <div className="bracket-progress" role="progressbar" aria-label="Bracket progress" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(step.progress * 100)}><i style={{ transform: `scaleX(${step.progress})` }} /></div>
        {step.check && <p className="check-note">Quick check: this one follows from your earlier calls.</p>}
        <div className={`duel ${offset ? "dragging" : ""} ${leaving ? `leaving-${leaving}` : ""} ${answers.length === 0 && !offset && !leaving ? "first" : ""}`} onPointerDown={down}>
          <div className="duel-pair" key={pairKey(step.pair![0], step.pair![1])}>
            {card(step.pair![0], "left")}
            <span className={`duel-vs ${lean ? `toward-${lean}` : ""}`} aria-hidden="true">{lean === "left" ? "‹" : lean === "right" ? "›" : lean === "tie" ? "?" : "vs"}</span>
            {card(step.pair![1], "right")}
          </div>
        </div>
        <p className={`duel-verdict ${lean ? `toward-${lean}` : ""} ${armed ? "armed" : ""}`} aria-hidden="true" style={{ "--pull": pull } as CSSProperties}>
          {lean === "tie" ? "Not sure · the index decides" : leanName ? <>{lean === "left" && <Arrow left />}<span>{leaving ? "✓ " : ""}<strong>{leanName}</strong> is better</span>{lean === "right" && <Arrow />}</> : <><span className="hint-touch">Drag toward the better model, or tap it</span><span className="hint-keys">Click the better model, or press ← →</span></>}
        </p>
        <div className="duel-actions">
          <button className={`duel-choice ${lean === "left" ? "armed" : ""}`} onClick={() => choose("left")}><Arrow left /><span>Left is better</span></button>
          <button className={`duel-unsure ${lean === "tie" ? "armed" : ""}`} onClick={() => choose("tie")}>Not sure</button>
          <button className={`duel-choice ${lean === "right" ? "armed" : ""}`} onClick={() => choose("right")}><span>Right is better</span><Arrow /></button>
        </div>
        <div className="duel-foot">
          <button className="text-control" onClick={undo} disabled={!answers.some((a) => !a.auto)}>Undo</button>
          <button className="text-control" onClick={finishRest}>Let the index decide the rest</button>
        </div>
      </>}
    </section>
    <aside className="bracket-side" aria-label="Ranking so far">
      <div className="board-heading"><span>TAKING SHAPE</span><span>BEST FIRST</span></div>
      <ol className="shape-list">{step.blocks.flatMap((block, bi) => block.map((id, i) => { const m = models.get(id); return <li key={id} className={`${i === 0 && bi > 0 ? "group-start" : ""} ${live.has(id) ? "live" : ""}`} style={{ "--lab": labs.get(m?.labId ?? "")?.color ?? "#8A8A80" } as CSSProperties}><i aria-hidden="true" /><span>{m?.name ?? id}</span></li>; }))}</ol>
      <button className="text-control" onClick={onList}>Rank the list instead <Arrow /></button>
    </aside>
    <span className="sr-only" aria-live="polite">{announcement}</span>
  </div>;
}
