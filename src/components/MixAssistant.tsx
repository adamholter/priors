"use client";
import { track } from "@/lib/analytics";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState, type CSSProperties, type FormEvent, type KeyboardEvent as ReactKeyboardEvent, type PointerEvent as ReactPointerEvent } from "react";
import { useAuth } from "@clerk/nextjs";
import type { IndexConfig } from "@/engine";
import { encodeIndex } from "@/lib/url";
import { authEnabled } from "@/app/providers";
import type { AnswerChart } from "@/lib/answer-chart";
import { AssistantAnswer, type AnswerHighlight } from "./AssistantAnswer";
import { chatDocument, printDocument } from "./assistant-print";
import { useTheme, type ThemeMode } from "./Theme";
import { IconAdjustmentsHorizontal, IconChartBar, IconCheck, IconListDetails, IconPalette, IconScale, IconSearch, IconSparkles, IconStar, IconTable, IconZoomQuestion } from "@tabler/icons-react";

type View = { benchmarks: { id: string; name: string; share: number; was: number }[]; removed?: { id: string; name: string; was: number }[]; movedFromOriginal: number; ranking: { rank: number; model: string; score: number; was: number | null }[] };
/** What Undo restores: the index before the change and, when the theme changed, the previous look. */
type Undo = { config?: IndexConfig; theme?: { id: string; mode: ThemeMode } };
type Turn = { role: "user" | "assistant"; content: string; question?: string; suggestions?: string[]; view?: View; charts?: AnswerChart[]; undo?: Undo; undone?: boolean; error?: boolean };
type Event = { type: "step"; text: string }
  | { type: "done"; reply: string; question?: string; suggestions: string[]; proposal?: { weights: Record<string, number>; required: string[]; view: View }; charts?: AnswerChart[]; highlight?: string[]; theme?: { id?: string; mode?: ThemeMode } }
  | { type: "error"; message: string };

/** An icon for each kind of step the assistant reports (labels come from `stepLabel` in src/agent/tools.ts). */
const STEP_ICONS: [RegExp, typeof IconTable][] = [
  [/^Reading the data/, IconTable], [/^Reading your mix/, IconListDetails], [/^Drawing a chart/, IconChartBar],
  [/^(Searching|Finding)/, IconSearch], [/^Comparing/, IconScale], [/^Looking at why/, IconZoomQuestion],
  [/^(Solving|Rebuilding|Testing)/, IconAdjustmentsHorizontal], [/highlight/i, IconStar], [/theme/i, IconPalette], [/^Applying/, IconCheck],
];
function Step({ text, live }: { text: string; live: boolean }) {
  const Icon = STEP_ICONS.find(([re]) => re.test(text))?.[1] ?? IconSparkles;
  return <p className={live ? "is-live" : ""}><Icon size={14} stroke={1.6} aria-hidden="true" /><span>{text}{live ? "…" : ""}</span></p>;
}

/** Typed into the empty composer one at a time, in a fresh random order each visit. */
const HINTS = [
  "How much does max reasoning add over xhigh?", "Gemini 4 feels too high", "Highlight the Claude models",
  "Which model is the best value?", "Chart cost against score for the top 10", "Weight coding benchmarks more",
  "Compare the top two models", "Is the fastest model any good?", "Switch to a dark theme",
];
const HINT_KEY = "priors:assistant-hint";
/** The panel size the user dragged to (desktop), and the current conversation, per signed-in user. */
const SIZE_KEY = "priors:assistant-size";
const chatKey = (userId: string) => `priors:assistant-chat:${userId}`;
type Size = { w: number; h: number };
const MIN: Size = { w: 340, h: 280 };
const NONE: string[] = [];
const fit = (s: Size): Size => ({ w: Math.round(Math.min(Math.max(s.w, MIN.w), innerWidth - 40)), h: Math.round(Math.min(Math.max(s.h, MIN.h), innerHeight - 40)) });

function load<T>(key: string): T | null {
  try { const v = localStorage.getItem(key); return v ? JSON.parse(v) as T : null; } catch { return null; }
}
function store(key: string, value: unknown) {
  try { if (value == null) localStorage.removeItem(key); else localStorage.setItem(key, JSON.stringify(value)); } catch { /* storage blocked or full */ }
}

/**
 * A placeholder that types out one hint, holds it, erases it and moves to the next. Order is shuffled
 * per visit and never opens on the hint the last visit opened on. With reduced motion, hints swap whole.
 */
function useTypedHint(active: boolean, fallback: string) {
  const [text, setText] = useState("");
  useEffect(() => {
    if (!active) return;
    const order = [...HINTS];
    for (let k = order.length - 1; k > 0; k--) { const j = Math.floor(Math.random() * (k + 1)); [order[k], order[j]] = [order[j], order[k]]; }
    let last: string | null = null;
    try { last = localStorage.getItem(HINT_KEY); } catch { /* storage blocked */ }
    if (order[0] === last) order.push(order.shift()!);
    try { localStorage.setItem(HINT_KEY, order[0]); } catch { /* storage blocked */ }
    const still = matchMedia("(prefers-reduced-motion: reduce)").matches;
    let i = 0, n = 0, erasing = false, timer = 0;
    const tick = () => {
      const hint = order[i % order.length];
      if (still) { setText(hint); i++; timer = window.setTimeout(tick, 3200); return; }
      if (!erasing) { n++; setText(hint.slice(0, n)); if (n < hint.length) { timer = window.setTimeout(tick, 32 + Math.random() * 30); return; } erasing = true; timer = window.setTimeout(tick, 2200); return; }
      n--; setText(hint.slice(0, n));
      if (n > 0) { timer = window.setTimeout(tick, 14); return; }
      erasing = false; i++; timer = window.setTimeout(tick, 350);
    };
    timer = window.setTimeout(tick, 250);
    return () => window.clearTimeout(timer);
  }, [active]);
  return active ? text : fallback;
}

/**
 * The assistant: questions about the data (answered with charts), changes to the active index,
 * highlights and the site theme, in plain language. Out of the way until asked for: a round button in the
 * bottom-right corner that opens a chat panel (or press /). Changes apply immediately with Undo, then
 * the assistant asks what you meant if the ask was vague.
 */
export function MixAssistant(props: { config: IndexConfig; onApply: (c: IndexConfig) => void; date: string; handle?: string }) {
  if (!authEnabled) return null;
  return <Inner {...props} />;
}

function Inner({ config, onApply, date, handle }: { config: IndexConfig; onApply: (c: IndexConfig) => void; date: string; handle?: string }) {
  const { isSignedIn, isLoaded, userId } = useAuth();
  const { mode, setMode, siteTheme, setSiteTheme } = useTheme();
  const [turns, setTurns] = useState<Turn[]>([]);
  const [draft, setDraft] = useState("");
  const [steps, setSteps] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(false);
  const input = useRef<HTMLTextAreaElement>(null);
  const fab = useRef<HTMLButtonElement>(null);
  const scroller = useRef<HTMLDivElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState<Size | null>(null);
  const restored = useRef<string | null>(null);
  const hint = useTypedHint(open && !!isSignedIn && !turns.length && !busy && !draft, turns.length ? "Follow up…" : "Ask about the data, or adjust this ranking");
  const abort = useRef<AbortController | null>(null);
  const latest = useRef(config);
  useEffect(() => { latest.current = config; }, [config]);
  useEffect(() => { if (open) input.current?.focus(); }, [open]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (e.key === "/" && !e.metaKey && !e.ctrlKey && !t?.closest("input,textarea,select,[contenteditable=true]") && !document.querySelector("dialog[open]")) { e.preventDefault(); setOpen(true); input.current?.focus(); }
      if (e.key === "Escape" && open && t?.closest(".assistant")) { setOpen(false); fab.current?.focus(); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);
  useEffect(() => { scroller.current?.scrollTo({ top: scroller.current.scrollHeight, behavior: "smooth" }); }, [turns, steps]);
  useEffect(() => () => abort.current?.abort(), []);
  useEffect(() => { const s = load<Size>(SIZE_KEY); if (s?.w && s?.h) setSize(s); }, []);
  // The conversation survives reloads in this browser only (never on our servers). Undo doesn't: the page it undid is gone.
  useEffect(() => {
    if (!userId || restored.current === userId) return;
    restored.current = userId;
    const saved = load<Turn[]>(chatKey(userId));
    if (Array.isArray(saved)) setTurns((t) => (t.length ? t : saved));
  }, [userId]);
  useEffect(() => {
    if (!userId || restored.current !== userId) return;
    store(chatKey(userId), turns.length ? turns.slice(-40).map((t) => ({ ...t, undo: undefined })) : null);
  }, [turns, userId]);
  const highlight = useMemo<AnswerHighlight>(() => ({ items: config.highlight ?? NONE, set: (items) => onApply({ ...latest.current, highlight: items.length ? items : undefined }) }), [config.highlight, onApply]);

  async function send(text: string) {
    const message = text.trim();
    if (!message || busy) return;
    const history = [...turns.filter((t) => !t.error).map((t) => ({ role: t.role, content: t.role === "assistant" ? [t.content.replace(/\[\[chart:(\d+)\]\]/g, (_, n: string) => `(chart: ${t.charts?.[Number(n) - 1]?.title ?? "chart"})`), t.question].filter(Boolean).join(" ") : t.content })), { role: "user" as const, content: message }].slice(-12);
    setTurns((t) => [...t, { role: "user", content: message }]); setDraft(""); setSteps([]); setBusy(true); setOpen(true);
    const before = latest.current;
    const ctrl = new AbortController(); abort.current = ctrl;
    try {
      track("assistant_asked", { handle: !!handle });
      const res = await fetch("/api/assistant", { method: "POST", signal: ctrl.signal, headers: { "content-type": "application/json" }, body: JSON.stringify({ index: encodeIndex(before), date, handle, messages: history, view: { page: handle ? "page" : "builder", theme: siteTheme, mode } }) });
      if (!res.ok || !res.body) { const j = await res.json().catch(() => ({})); throw new Error(j.error ?? "The assistant is unavailable right now."); }
      const reader = res.body.getReader(), decoder = new TextDecoder();
      let buf = "", done = false;
      while (!done) {
        const chunk = await reader.read();
        if (chunk.done) break;
        buf += decoder.decode(chunk.value, { stream: true });
        let nl;
        while ((nl = buf.indexOf("\n")) >= 0) {
          const line = buf.slice(0, nl); buf = buf.slice(nl + 1);
          if (!line.trim()) continue;
          const e = JSON.parse(line) as Event;
          if (e.type === "step") setSteps((s) => (s[s.length - 1] === e.text ? s : [...s, e.text]));
          else if (e.type === "error") { setTurns((t) => [...t, { role: "assistant", content: e.message, error: true }]); done = true; }
          else {
            const next = { ...before, ...(e.proposal ? { weights: e.proposal.weights, required: e.proposal.required } : {}), ...(e.highlight ? { highlight: e.highlight.length ? e.highlight : undefined } : {}) };
            const changed = !!e.proposal || !!e.highlight;
            if (changed) onApply(next);
            const undo: Undo = { ...(changed ? { config: before } : {}), ...(e.theme ? { theme: { id: siteTheme, mode } } : {}) };
            if (e.theme?.id) setSiteTheme(e.theme.id);
            if (e.theme?.mode) setMode(e.theme.mode);
            setTurns((t) => [...t, { role: "assistant", content: e.reply, question: e.question, suggestions: e.suggestions, view: e.proposal?.view, charts: e.charts, undo: undo.config || undo.theme ? undo : undefined }]);
            done = true;
          }
        }
      }
    } catch (err) {
      if (!(err instanceof DOMException && err.name === "AbortError")) setTurns((t) => [...t, { role: "assistant", content: err instanceof Error ? err.message : "Something went wrong.", error: true }]);
    } finally { setBusy(false); setSteps([]); abort.current = null; }
  }
  const submit = (e: FormEvent) => { e.preventDefault(); void send(draft); };
  const clear = () => { abort.current?.abort(); setTurns([]); setSteps([]); setDraft(""); input.current?.focus(); };
  const save = () => {
    const title = `Priors assistant · ${config.name} · ${date}`;
    printDocument(chatDocument(turns, { title, index: config.name, date, url: location.href }), title);
    track("assistant_saved", { turns: turns.length });
  };
  /** Drag the top-left corner to resize; the panel stays anchored bottom-right. */
  const startResize = (e: ReactPointerEvent<HTMLButtonElement>) => {
    const el = panel.current;
    if (!el || e.button !== 0) return;
    e.preventDefault();
    const r = el.getBoundingClientRect(), x0 = e.clientX, y0 = e.clientY, grip = e.currentTarget;
    grip.setPointerCapture(e.pointerId);
    let last: Size = { w: r.width, h: r.height };
    const move = (ev: PointerEvent) => { last = fit({ w: r.width + x0 - ev.clientX, h: r.height + y0 - ev.clientY }); setSize(last); };
    const up = () => { grip.removeEventListener("pointermove", move); grip.removeEventListener("pointerup", up); grip.removeEventListener("pointercancel", up); store(SIZE_KEY, last); };
    grip.addEventListener("pointermove", move); grip.addEventListener("pointerup", up); grip.addEventListener("pointercancel", up);
  };
  const keyResize = (e: ReactKeyboardEvent) => {
    const d = { ArrowLeft: [24, 0], ArrowRight: [-24, 0], ArrowUp: [0, 24], ArrowDown: [0, -24] }[e.key];
    const r = panel.current?.getBoundingClientRect();
    if (!d || !r) return;
    e.preventDefault();
    const next = fit({ w: r.width + d[0], h: r.height + d[1] });
    setSize(next); store(SIZE_KEY, next);
  };
  const resetSize = () => { setSize(null); store(SIZE_KEY, null); };
  const undo = (i: number) => {
    const u = turns[i].undo;
    if (!u) return;
    if (u.config) onApply(u.config);
    if (u.theme) { setSiteTheme(u.theme.id); setMode(u.theme.mode); }
    setTurns((list) => list.map((x, j) => (j === i ? { ...x, undone: true } : x)));
  };

  if (!isLoaded) return null;
  if (!open) return <button ref={fab} type="button" className="assistant-fab" onClick={() => setOpen(true)} aria-label="Open the assistant" title="Ask about the data, or adjust this ranking (/)">
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" aria-hidden="true"><path d="M5 5.5h14a1.5 1.5 0 0 1 1.5 1.5v8.5A1.5 1.5 0 0 1 19 17h-7.5L7 20.5V17H5a1.5 1.5 0 0 1-1.5-1.5V7A1.5 1.5 0 0 1 5 5.5Z" /></svg>
    {busy && <i className="assistant-fab-dot" aria-hidden="true" />}
  </button>;
  return (
    <div ref={panel} className={`assistant assistant-panel ${size ? "is-sized" : ""}`} role="region" aria-label="Assistant" style={size ? { "--assistant-w": `${size.w}px`, "--assistant-h": `${size.h}px` } as CSSProperties : undefined}>
      <button type="button" className="assistant-grip" onPointerDown={startResize} onKeyDown={keyResize} onDoubleClick={resetSize} aria-label="Resize the assistant (arrow keys; double-click resets)" title="Drag to resize · double-click to reset">
        <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.2" aria-hidden="true"><path d="M1 9V1h8M1 5.5 5.5 1" /></svg>
      </button>
      <div className="assistant-head"><span className="cap">Assistant · {config.name}</span>
        {turns.length > 0 && <>
          <button type="button" className="assistant-icon ml-auto" onClick={save} disabled={busy} aria-label="Save the chat as a PDF" title="Save as PDF"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 4v11m-4.5-4.5L12 15l4.5-4.5M5 19.5h14" /></svg></button>
          <button type="button" className="assistant-icon" onClick={clear} aria-label="Clear the chat" title="Clear chat"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4.5 7h15M9.5 7V4.5h5V7m-8 0 .8 12.5h9.4L17.5 7M10.5 11v5m3-5v5" /></svg></button>
        </>}
        <button type="button" className={`assistant-icon ${turns.length ? "" : "ml-auto"}`} onClick={() => { setOpen(false); requestAnimationFrame(() => fab.current?.focus()); }} aria-label="Close the assistant" title="Close (Esc)"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18" /></svg></button>
      </div>
      {(turns.length > 0 || busy) && <div className="assistant-body" ref={scroller}>
        {turns.map((t, i) => t.role === "user"
          ? <p key={i} className="assistant-user">{t.content}</p>
          : <div key={i} className={`assistant-reply ${t.error ? "is-error" : ""}`}>
            {t.error ? <p>{t.content}</p> : <AssistantAnswer text={t.content} charts={t.charts} highlight={highlight} />}
            {t.view && <Diff view={t.view} />}
            {t.question && <p className="assistant-question">{t.question}</p>}
            {(t.suggestions?.length || t.undo) && <div className="assistant-actions">
              {t.suggestions?.map((s) => <button key={s} type="button" className="text-control" disabled={busy} onClick={() => void send(s)}>{s}</button>)}
              {t.undo && <button type="button" className="text-control ml-auto" disabled={t.undone || busy || i !== turns.length - 1} onClick={() => undo(i)}>{t.undone ? "Undone" : "Undo"}</button>}
            </div>}
          </div>)}
        {busy && <div className="assistant-steps" role="status">{(steps.length ? steps : ["Thinking"]).map((s, i, a) => <Step key={i} text={s} live={i === a.length - 1} />)}</div>}
      </div>}
      {isSignedIn ? <form className="assistant-composer" onSubmit={submit}>
        <textarea ref={input} rows={1} value={draft} placeholder={hint} aria-label="Ask about the data, or adjust this ranking"
          onChange={(e) => setDraft(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void send(draft); } }} />
        {busy ? <button type="button" className="assistant-send" onClick={() => abort.current?.abort()} aria-label="Stop">■</button> : <button type="submit" className="assistant-send" disabled={!draft.trim()} aria-label="Send"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true"><path d="M12 19V5m-6 6 6-6 6 6" /></svg></button>}
      </form> : <div className="assistant-composer assistant-signin"><Link href="/sign-in" className="text-control">Sign in to ask about the data or adjust this ranking →</Link></div>}
    </div>
  );
}

function Diff({ view }: { view: View }) {
  const moved = view.ranking.filter((r) => r.was !== r.rank).slice(0, 6);
  const rows = [...view.benchmarks.filter((b) => Math.abs(b.share - b.was) >= 0.5).map((b) => ({ id: b.id, name: b.name, was: b.was, now: b.share })), ...(view.removed ?? []).map((b) => ({ id: b.id, name: b.name, was: b.was, now: 0 }))];
  const max = Math.max(1, ...rows.flatMap((r) => [r.was, r.now]));
  return <div className="assistant-diff">
    {moved.length > 0 && <div><span className="cap">Ranking</span>{moved.map((r) => <p key={r.model}><span className="num w-7 inline-block">#{r.rank}</span>{r.model}<span className={`num ml-2 ${r.was == null ? "text-grey" : r.was > r.rank ? "is-up" : "is-down"}`}>{r.was == null ? "new" : r.was > r.rank ? `↑${r.was - r.rank}` : `↓${r.rank - r.was}`}</span></p>)}</div>}
    {rows.length > 0 && <div><span className="cap">Mix · {view.movedFromOriginal}% of weight moved</span>{rows.map((r) => <ShareChange key={r.id} {...r} max={max} />)}</div>}
  </div>;
}

/**
 * One benchmark's share change on a shared scale. The part that stayed is solid; a gain extends past a
 * tick marking the old share; a loss leaves a dashed outline where the share used to reach.
 */
export function ShareChange({ name, was, now, max }: { name: string; was: number; now: number; max: number }) {
  const pct = (v: number) => `${(v / max) * 100}%`, keep = Math.min(was, now), d = now - was;
  return <p className="share-change" title={`${name}: ${was ? `${was}%` : "not in mix"} → ${now ? `${now}%` : "removed"}`}>
    <span className="share-name">{name}</span>
    <span className="share-bar" aria-hidden="true">
      <i className="share-keep" style={{ width: pct(keep) }} />
      {d > 0 && <i className="share-gain" style={{ left: pct(keep), width: pct(d) }} />}
      {d < 0 && <i className="share-loss" style={{ left: pct(keep), width: pct(-d) }} />}
      {was > 0 && d > 0 && <i className="share-was" style={{ left: pct(was) }} />}
    </span>
    <span className={`num share-delta ${d > 0 ? "is-up" : "is-down"}`}>{!was ? "new" : !now ? "out" : `${d > 0 ? "+" : "−"}${Math.abs(d).toFixed(1)}`}</span>
  </p>;
}
