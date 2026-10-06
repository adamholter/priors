"use client";
import { track } from "@/lib/analytics";
import Link from "next/link";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { useAuth } from "@clerk/nextjs";
import type { IndexConfig } from "@/engine";
import { encodeIndex } from "@/lib/url";
import { authEnabled } from "@/app/providers";

type View = { benchmarks: { id: string; name: string; share: number; was: number }[]; removed?: { id: string; name: string; was: number }[]; movedFromOriginal: number; ranking: { rank: number; model: string; score: number; was: number | null }[] };
type Turn = { role: "user" | "assistant"; content: string; question?: string; suggestions?: string[]; view?: View; undo?: IndexConfig; undone?: boolean; error?: boolean };
type Event = { type: "step"; text: string } | { type: "done"; reply: string; question?: string; suggestions: string[]; proposal?: { weights: Record<string, number>; required: string[]; view: View } } | { type: "error"; message: string };

const MODE_KEY = "priors:assistant-mode";
const EXAMPLES = ["Gemini 4 feels too high", "Drop TerminalBench but keep the ranking", "Weight coding a bit more"];

/**
 * One-off adjustments to the active index in plain language. A composer bar (Raycast/Figma-style
 * prompt-to-edit) that expands into a short card; it can dock as a side panel for longer back-and-forth.
 * Changes apply immediately with Undo, then the assistant asks what you meant if the ask was vague.
 */
export function MixAssistant(props: { config: IndexConfig; onApply: (c: IndexConfig) => void; date: string; handle?: string }) {
  if (!authEnabled) return null;
  return <Inner {...props} />;
}

function Inner({ config, onApply, date, handle }: { config: IndexConfig; onApply: (c: IndexConfig) => void; date: string; handle?: string }) {
  const { isSignedIn, isLoaded } = useAuth();
  const [turns, setTurns] = useState<Turn[]>([]);
  const [draft, setDraft] = useState("");
  const [steps, setSteps] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(false);
  const [docked, setDocked] = useState(false);
  const input = useRef<HTMLTextAreaElement>(null);
  const scroller = useRef<HTMLDivElement>(null);
  const abort = useRef<AbortController | null>(null);
  const latest = useRef(config);
  useEffect(() => { latest.current = config; }, [config]);
  useEffect(() => { const id = requestAnimationFrame(() => { try { setDocked(localStorage.getItem(MODE_KEY) === "panel"); } catch { /* ignore */ } }); return () => cancelAnimationFrame(id); }, []);
  useEffect(() => { try { localStorage.setItem(MODE_KEY, docked ? "panel" : "bar"); } catch { /* ignore */ } }, [docked]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (e.key === "/" && !e.metaKey && !e.ctrlKey && !t?.closest("input,textarea,select,[contenteditable=true]") && !document.querySelector("dialog[open]")) { e.preventDefault(); input.current?.focus(); setOpen(true); }
      if (e.key === "Escape" && open && !docked && t?.closest(".assistant")) { setOpen(false); input.current?.blur(); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, docked]);
  useEffect(() => { scroller.current?.scrollTo({ top: scroller.current.scrollHeight, behavior: "smooth" }); }, [turns, steps]);
  useEffect(() => () => abort.current?.abort(), []);

  async function send(text: string) {
    const message = text.trim();
    if (!message || busy) return;
    const history = [...turns.filter((t) => !t.error).map((t) => ({ role: t.role, content: t.role === "assistant" ? [t.content, t.question].filter(Boolean).join(" ") : t.content })), { role: "user" as const, content: message }].slice(-12);
    setTurns((t) => [...t, { role: "user", content: message }]); setDraft(""); setSteps([]); setBusy(true); setOpen(true);
    const before = latest.current;
    const ctrl = new AbortController(); abort.current = ctrl;
    try {
      track("assistant_asked", { handle: !!handle });
      const res = await fetch("/api/assistant", { method: "POST", signal: ctrl.signal, headers: { "content-type": "application/json" }, body: JSON.stringify({ index: encodeIndex(before), date, handle, messages: history }) });
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
            if (e.proposal) onApply({ ...before, weights: e.proposal.weights, required: e.proposal.required });
            setTurns((t) => [...t, { role: "assistant", content: e.reply, question: e.question, suggestions: e.suggestions, view: e.proposal?.view, undo: e.proposal ? before : undefined }]);
            done = true;
          }
        }
      }
    } catch (err) {
      if (!(err instanceof DOMException && err.name === "AbortError")) setTurns((t) => [...t, { role: "assistant", content: err instanceof Error ? err.message : "Something went wrong.", error: true }]);
    } finally { setBusy(false); setSteps([]); abort.current = null; }
  }
  const submit = (e: FormEvent) => { e.preventDefault(); void send(draft); };
  const undo = (i: number) => { const t = turns[i]; if (!t.undo) return; onApply(t.undo); setTurns((list) => list.map((x, j) => (j === i ? { ...x, undone: true } : x))); };

  if (!isLoaded) return null;
  const shown = docked ? turns : turns.slice(-2);
  const card = (open || docked) && (turns.length > 0 || busy);
  return (
    <div className={`assistant ${docked ? "assistant-docked" : "assistant-bar"}`} role="region" aria-label="Mix assistant">
      {card && <div className="assistant-card" ref={scroller}>
        <div className="assistant-head"><span className="cap">Mix assistant · {config.name}</span><span className="flex items-center gap-1">
          <button type="button" className="assistant-icon max-lg:hidden" onClick={() => setDocked((d) => !d)} aria-label={docked ? "Show as a bar" : "Dock as a side panel"} title={docked ? "Show as a bar" : "Dock as a side panel"}>{docked ? <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true"><rect x="3" y="14" width="18" height="6" rx="1.5" /></svg> : <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true"><rect x="3" y="4" width="18" height="16" rx="1.5" /><path d="M15 4v16" /></svg>}</button>
          {!docked && <button type="button" className="assistant-icon" onClick={() => setOpen(false)} aria-label="Collapse" title="Collapse (Esc)"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true"><path d="m6 9 6 6 6-6" /></svg></button>}
          {docked && <button type="button" className="assistant-icon" onClick={() => { setDocked(false); setOpen(false); }} aria-label="Close panel" title="Close"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18" /></svg></button>}
        </span></div>
        {!docked && turns.length > 2 && <button type="button" className="text-[11px] text-grey hover:text-ink mb-2" onClick={() => setDocked(true)}>{turns.length - 2} earlier messages · open as panel</button>}
        {shown.map((t, k) => { const i = docked ? k : turns.length - shown.length + k; return t.role === "user"
          ? <p key={i} className="assistant-user">{t.content}</p>
          : <div key={i} className={`assistant-reply ${t.error ? "is-error" : ""}`}>
            <p>{t.content}</p>
            {t.view && <Diff view={t.view} />}
            {t.question && <p className="assistant-question">{t.question}</p>}
            {(t.suggestions?.length || t.undo) && <div className="assistant-actions">
              {t.suggestions?.map((s) => <button key={s} type="button" className="text-control" disabled={busy} onClick={() => void send(s)}>{s}</button>)}
              {t.undo && <button type="button" className="text-control ml-auto" disabled={t.undone || busy || i !== turns.length - 1} onClick={() => undo(i)}>{t.undone ? "Undone" : "Undo"}</button>}
            </div>}
          </div>; })}
        {busy && <div className="assistant-steps" role="status">{(steps.length ? steps : ["Reading your mix"]).map((s, i, a) => <p key={i} className={i === a.length - 1 ? "is-live" : ""}>{s}{i === a.length - 1 ? "…" : ""}</p>)}</div>}
      </div>}
      {isSignedIn ? <form className="assistant-composer" onSubmit={submit}>
        <textarea ref={input} rows={1} value={draft} placeholder={turns.length ? "Follow up…" : `Adjust this ranking — e.g. “${EXAMPLES[0]}”`} aria-label="Ask the mix assistant"
          onFocus={() => setOpen(true)} onChange={(e) => setDraft(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void send(draft); } }} />
        {busy ? <button type="button" className="assistant-send" onClick={() => abort.current?.abort()} aria-label="Stop">■</button> : <button type="submit" className="assistant-send" disabled={!draft.trim()} aria-label="Send"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true"><path d="M12 19V5m-6 6 6-6 6 6" /></svg></button>}
      </form> : <div className="assistant-composer assistant-signin"><span>Adjust your ranking in plain language.</span><Link href="/sign-in" className="text-control">Sign in to use the assistant →</Link></div>}
      {isSignedIn && !turns.length && open && !busy && <div className="assistant-examples">{EXAMPLES.map((x) => <button key={x} type="button" className="text-control" onMouseDown={(e) => e.preventDefault()} onClick={() => void send(x)}>{x}</button>)}</div>}
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
