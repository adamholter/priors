"use client";
import { track } from "@/lib/analytics";
import Link from "next/link";
import { useLabColor } from "@/components/chart/echarts";
import { ThemeToggle, useTheme } from "@/components/Theme";
import { useEffect, useMemo, useRef, useState, type CSSProperties, type PointerEvent } from "react";
import type { Snapshot } from "@/data/types";
import { Wordmark } from "@/components/Wordmark";
import { decodeIndices, encodeIndex, encodeIndices } from "@/lib/url";
import { PREFERRED, type BenchmarkQuality } from "./quality";
import type { FitUpdate } from "./optimizer";
import { DEFAULT_FOCUS, FOCUSES, FOCUS_IDS, type FocusId } from "./focus";
import type { MixLibrary } from "./library";
import { useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { convexEnabled } from "@/app/providers";
import { Intro, INTRO_KEY } from "./Intro";
import { PRIORS_MIX_COOKIE, savedLineup } from "./defaults";
import { Bracket, resetSavedBracket, undoSavedCall } from "./BracketDuel";
import type { Answer, BracketOptions, BracketStep } from "./bracket";
import { SearchMonitor, type MonitorVariant } from "./SearchMonitor";
import { readVia, type Via } from "@/lib/share";
import { TopPicker } from "./TopPicker";
import type { RankingEvidence } from "./adaptive";
import { Finish } from "./Finish";
import "./onboarding.css";
const ROW = 46;
const phaseNames = { preparing: "Reading the evidence", searching: "Searching the combinations", simplifying: "Keeping what matters", complete: "Your index, found" };
function Arrow({ direction = "right" }: { direction?: "right" | "up" | "down" }) { return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true" style={{ transform: direction === "up" ? "rotate(-90deg)" : direction === "down" ? "rotate(90deg)" : undefined }}><path d="M4 12h15m-6-6 6 6-6 6" /></svg>; }
function Grip() { return <svg width="16" height="18" viewBox="0 0 16 18" aria-hidden="true" fill="currentColor">{[4,9,14].flatMap(y => [5,10].map(x => <circle key={`${x}-${y}`} cx={x} cy={y} r="1" />))}</svg>; }
function Cross() { return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18" /></svg>; }
function searchMessage(u: FitUpdate, snapshot: Snapshot) {
  if (u.log.startsWith("Exploring ")) return "Trying a fresh search direction.";
  if (u.log.startsWith("Read a new search path")) return "Testing another mix against your lineup.";
  if (u.phase === "complete") return u.exactMatch ? "Your selected models match your order." : "No exact match found for this lineup.";
  const benchmark = snapshot.benchmarks.find(b => ["Refining ", "Kept ", "Removed "].some(prefix => u.log === `${prefix}${b.id}`));
  const name = benchmark?.shortName ?? benchmark?.name;
  if (name) return `${u.log.startsWith("Removed ") ? "Simplified the mix without" : u.log.startsWith("Kept ") ? "Kept" : "Adjusted"} ${name}.`;
  if (u.phase === "preparing" || u.log.startsWith("Read ")) return "Checking evidence for your selected models.";
  if (u.log.startsWith("Check ")) return "Comparing weights and reasoning settings.";
  return "Refining the remaining disagreements.";
}
type LineupArgs = { focus: string; lineup: string[]; weights: Record<string, number>; strictness: number; fitScore: number; exact: boolean; snapshotDate: string };
export type OnboardingLabOptions = { label: string; placement: "heading" | "board-heading" | "board-top"; /** Search lab: start searching on load, replay when done, no completion dialog. */ search?: boolean };
/**
 * How the onboarding runs. Production uses LIVE_FLOW; /lab/onboarding swaps in variants.
 * start: first screen (pairwise duel, the drag list, or tap-your-top-3). autoFit: finishing the
 * duel/picker starts the search straight away instead of stopping at the review list. Live stops
 * at the review list: a short sprint cannot ask every matchup, so the ranking is confirmed first.
 * done: the completion dialog (share card first, the old stats-only one, or share + comparison).
 */
export type OnboardingFlow = {
  start: "compare" | "order" | "pick";
  bracket?: BracketOptions;
  autoFit: boolean;
  intro: boolean;
  focus: "full" | "compact";
  done: "share" | "classic" | "compare";
  /** Smart sprint: ask the pairs the benchmark evidence is least sure about, at most this many. Falls back to `bracket` without evidence. */
  adaptiveCap?: number;
  pickCount?: number;
  /** Look of the search-in-progress panel. */
  monitor?: MonitorVariant;
};
/** Extra calls each time the review list reopens the matchups. */
const MORE_CALLS = 6;
/** About 9 calls when you agree with the index, never more than 10; seeds 11–16 keep index order. */
/** Smart sprint, at most 6 calls; without ranking evidence, the plain bracket at most 10. */
export const LIVE_FLOW: OnboardingFlow = { start: "compare", bracket: { challengers: 5, cap: 10 }, adaptiveCap: 6, autoFit: false, intro: false, focus: "compact", done: "share" };
/** Registers the Convex mutation on a stable ref; mounted only when Convex is configured. */
function LineupRecorder({ onRegister }: { onRegister: (fn: ((a: LineupArgs) => void) | null) => void }) {
  const record = useMutation(api.lineups.record);
  useEffect(() => {
    onRegister((a) => { track("onboarding_completed", { focus: a.focus, lineup_size: a.lineup.length, exact: a.exact }); void record(a).catch(() => {}); });
    return () => onRegister(null);
  }, [record, onRegister]);
  return null;
}

export function Onboarding({ snapshot, lineup, seeds, quality, observedModelIds, hasSavedMix, labMode, flow = LIVE_FLOW, rankedCount = 0, evidence, labReference }: { snapshot: Snapshot; lineup: string[]; seeds: string[]; quality: BenchmarkQuality[]; observedModelIds: string[]; hasSavedMix: boolean; labMode?: OnboardingLabOptions; flow?: OnboardingFlow; rankedCount?: number; /** Rankings from today's benchmark mixes; they steer the smart sprint. */ evidence?: RankingEvidence[]; /** Lab only: a ranking to compare the result with. */ labReference?: string[] }) {
  const inLab = !!labMode;
  const adaptive = useMemo(() => flow.adaptiveCap && evidence?.length ? { evidence, cap: flow.adaptiveCap } : undefined, [flow.adaptiveCap, evidence]);
  const { dark } = useTheme();
  const models = useMemo(() => new Map(snapshot.models.map(m => [m.id, m])), [snapshot]);
  const labColor = useLabColor();
  const colors = useMemo(() => new Map(snapshot.labs.map(l => [l.id, labColor(l.id, l.color)])), [snapshot, labColor]);
  const labs = useMemo(() => new Map(snapshot.labs.map(l => [l.id, { ...l, color: labColor(l.id, l.color) }])), [snapshot, labColor]);
  const [resolvedSeeds, setResolvedSeeds] = useState(seeds);
  const bracketSeeds = useMemo(() => resolvedSeeds.filter(id => models.has(id)), [resolvedSeeds, models]);
  const searchable = useMemo(() => snapshot.benchmarks.filter(b => !b.proxy && !["cost", "speed", "composite", "reliability"].includes(b.category)).map(b => ({ id: b.id, name: b.shortName ?? b.name })), [snapshot]);
  const qMap = useMemo(() => new Map(quality.map(q => [q.id, q])), [quality]);
  const observedModels = useMemo(() => new Set(observedModelIds), [observedModelIds]);
  const original = useMemo(() => lineup.filter(id => models.has(id)), [lineup, models]);
  const [order, setOrder] = useState(original);
  const orderRef = useRef(order);
  useEffect(() => { orderRef.current = order; }, [order]);
  // Persist only user edits, so untouched visitors track the dynamic default as it changes.
  const restored = useRef(false);
  const edited = useRef(false);
  useEffect(() => {
    if (inLab) { restored.current = true; return; }
    const raf = requestAnimationFrame(() => {
      restored.current = true;
      {
        try {
          const indices = decodeIndices(JSON.parse(localStorage.getItem("priors:indices") ?? "[]") as string[]);
          const fit = indices[0];
          const handle = localStorage.getItem("priors:handle");
          if (fit || handle) {
            const encoded = fit ? encodeURIComponent(encodeIndex({ ...fit, onlyModels: undefined, excludeModels: undefined })) : "";
            if (encoded.length > 2048) return;
            const url = fit ? `/api/lineup?mix=${encoded}` : `/api/lineup?handle=${encodeURIComponent(handle!)}`;
            fetch(url, { cache: "no-store" }).then((r) => r.ok ? r.json() : null).then((data) => {
              const ids = (data?.lineup as string[] | undefined)?.filter((id) => models.has(id));
              if (ids) { setResolvedSeeds(ids); setStage("order"); setOrder(ids); orderRef.current = ids; edited.current = false; localStorage.removeItem("priors:lineup"); document.cookie = `${PRIORS_MIX_COOKIE}=${encodeURIComponent(data.mix)}; Path=/; Max-Age=31536000; SameSite=Lax${location.protocol === "https:" ? "; Secure" : ""}`; }
            }).catch(() => {});
            return;
          }
        } catch { /* use the earlier unfinished lineup below */ }
      }
      const saved = hasSavedMix ? null : savedLineup(localStorage.getItem("priors:lineup"), (id) => bracketSeeds.includes(id));
      if (saved) { const resumed = [...saved, ...bracketSeeds.filter(id => !saved.includes(id))].slice(0, 16); setOrder(resumed); orderRef.current = resumed; edited.current = true; }
    });
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => { if (inLab || !restored.current || !edited.current) return; try { localStorage.setItem("priors:lineup", JSON.stringify({ v: 2, lineup: order })); } catch { /* ignore */ } }, [order, inLab]);
  const [stage, setStage] = useState<"compare" | "pick" | "order" | "fit">(hasSavedMix && !inLab ? "order" : flow.start);
  const [bracket, setBracket] = useState<BracketStep | null>(null);
  // The finished bracket's ranking is the review list; going back reopens the last call so there's something to change.
  const [calls, setCalls] = useState<Answer[]>();
  const [extra, setExtra] = useState(0);
  function backToMatchups() { if (bracket) undoSavedCall(); setStage("compare"); }
  /** Reopen the matchups from the review list for pairs that never came up. Drag edits survive as settled calls. */
  function compareMore() {
    release();
    const pos = new Map((bracket?.order ?? []).map((id, i) => [id, i]));
    const kept = orderRef.current.flatMap((id, i, all): Answer[] => { const next = all[i + 1]; return next && pos.has(id) && pos.has(next) && pos.get(id)! > pos.get(next)! ? [{ a: id, b: next, winner: id, auto: true }] : []; });
    if (orderRef.current.length !== bracketSeeds.length || orderRef.current.some(id => !bracketSeeds.includes(id))) setResolvedSeeds(orderRef.current);
    setCalls([...(calls ?? []), ...kept]); setExtra(n => n + MORE_CALLS);
    track("onboarding_compare_more", { calls: bracket?.asked ?? 0 });
    setStage("compare"); window.scrollTo({ top: 0 });
  }
  function finishBracket(step: BracketStep, answers: Answer[]) {
    setCalls(answers);
    setBracket(step); setOrder(step.order); orderRef.current = step.order; edited.current = true;
    track("onboarding_bracket_done", { calls: step.asked });
    if (flow.autoFit) { void start(step.order, "pairs"); return; }
    setStage("order"); window.scrollTo({ top: 0 });
  }
  function finishPick(picked: string[]) {
    const next = [...picked, ...orderRef.current.filter((id) => !picked.includes(id))];
    setOrder(next); orderRef.current = next; edited.current = true;
    track("onboarding_bracket_done", { picked: picked.length });
    if (flow.autoFit) { void start(next, "pick"); return; }
    setStage("order"); window.scrollTo({ top: 0 });
  }
  const [focus, setFocus] = useState<FocusId>(DEFAULT_FOCUS);
  const [library, setLibrary] = useState<MixLibrary | null>(null);
  const recordLineup = useRef<((a: LineupArgs) => void) | null>(null);
  // Restore the last focus after mount (localStorage is client-only).
  useEffect(() => {
    if (inLab) return;
    const raf = requestAnimationFrame(() => {
      try { const saved = localStorage.getItem("priors:focus"); if (FOCUS_IDS.includes(saved as FocusId)) setFocus(saved as FocusId); } catch { /* ignore */ }
    });
    return () => cancelAnimationFrame(raf);
  }, [inLab]);
  useEffect(() => { if (!inLab) try { localStorage.setItem("priors:focus", focus); } catch { /* ignore */ } }, [focus, inLab]);
  // Precomputed mix library seeds the search; absent or stale, the worker computes live.
  useEffect(() => {
    let live = true;
    fetch("/api/library").then((r) => (r.ok ? r.json() : null)).then((l) => { if (live && l && l.date === snapshot.date) setLibrary(l); }).catch(() => {});
    return () => { live = false; };
  }, [snapshot.date]);
  const [drag, setDrag] = useState<{ id: string; y: number } | null>(null);
  const dragInfo = useRef<{ id: string; startY: number; top: number; scroll: number; original: string[]; pointerId: number; cleanup: () => void } | null>(null);
  const [announcement, setAnnouncement] = useState("");
  const [update, setUpdate] = useState<FitUpdate | null>(null);
  const [logs, setLogs] = useState<{ id: number; text: string }[]>([]);
  const [history, setHistory] = useState<number[]>([]);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const [modal, setModal] = useState<"models" | "quality">("quality");
  const [query, setQuery] = useState("");
  const dialog = useRef<HTMLDialogElement>(null);
  const intro = useRef<HTMLDialogElement>(null);
  const done = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    if (inLab) return;
    try { if (flow.intro && !localStorage.getItem(INTRO_KEY)) intro.current?.showModal(); } catch { /* ignore */ }
  }, [inLab, flow.intro]);
  const worker = useRef<Worker | null>(null);
  const calculationSnapshot = useRef<Snapshot | null>(null);
  const searchAttempt = useRef(0);
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
    const cancel = (e: KeyboardEvent) => { if (e.key === "Escape" && dragInfo.current) { release(true); setAnnouncement("Move cancelled."); } };
    window.addEventListener("keydown", cancel); return () => window.removeEventListener("keydown", cancel);
  }, []);
  function move(id: string, to: number) {
    const from = orderRef.current.indexOf(id); const next = [...orderRef.current];
    next.splice(from, 1); next.splice(Math.max(0, Math.min(to, next.length)), 0, id);
    orderRef.current = next; setOrder(next); setAnnouncement(`${models.get(id)?.name} moved to ${next.indexOf(id) + 1} of ${next.length}.`);
  }
  function grab(e: PointerEvent<HTMLButtonElement>, id: string) {
    if (e.button !== 0 || stage !== "order" || dragInfo.current) return;
    if (e.pointerType === "touch" && !(e.target as HTMLElement).closest(".grip")) return;
    e.preventDefault();
    const top = order.indexOf(id) * ROW;
    const info = { id, top, startY: e.clientY, scroll: window.scrollY, original: [...order], pointerId: e.pointerId, cleanup: () => {} };
    // Window listeners are the real delivery path. Pointer capture is only a cursor nicety:
    // reordering the row mid-drag releases it (lostpointercapture), which must not end the drag.
    const move = (ev: globalThis.PointerEvent) => { if (ev.pointerId === info.pointerId) pullAt(ev.clientY); };
    const end = (ev: globalThis.PointerEvent) => { if (ev.pointerId === info.pointerId) release(); };
    const bail = () => release(true);
    info.cleanup = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", end);
      window.removeEventListener("pointercancel", bail);
      window.removeEventListener("blur", bail);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", end);
    window.addEventListener("pointercancel", bail);
    window.addEventListener("blur", bail);
    try { e.currentTarget.setPointerCapture(e.pointerId); } catch { /* some touch browsers throw here */ }
    dragInfo.current = info;
    setDrag({ id, y: top });
  }
  function pullAt(clientY: number) {
    const d = dragInfo.current; if (!d) return;
    if (clientY < 80) window.scrollBy(0, -10); else if (clientY > innerHeight - 80) window.scrollBy(0, 10);
    const y = Math.max(-8, Math.min((order.length - 1) * ROW + 8, d.top + clientY - d.startY + window.scrollY - d.scroll));
    setDrag({ id: d.id, y }); const to = Math.max(0, Math.min(order.length - 1, Math.round(y / ROW)));
    if (orderRef.current.indexOf(d.id) !== to) move(d.id, to);
  }
  function release(cancel = false) {
    const d = dragInfo.current; if (!d) return;
    d.cleanup();
    dragInfo.current = null;
    if (cancel) { orderRef.current = d.original; setOrder(d.original); }
    else if (orderRef.current.join(",") !== d.original.join(",")) edited.current = true;
    setDrag(null);
  }
  function openPairwise() {
    release();
    setBracket(null); setCalls(undefined); setExtra(0);
    if (!inLab) resetSavedBracket();
    setStage("compare");
    window.scrollTo({ top: 0, behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth" });
  }
  async function start(target: string[] = orderRef.current, from = "list") {
    const attempt = ++searchAttempt.current;
    track("onboarding_fit_started", { from, lineup_size: target.length });
    release();
    worker.current?.terminate(); if (displayTimer.current) clearTimeout(displayTimer.current); displayTimer.current = null; setError(""); setCopied(false); setUpdate(null); latest.current = null; setLogs([]); setHistory([]); setElapsed(0); startTime.current = performance.now(); setStage("fit");
    window.scrollTo({ top: 0, behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth" });
    let fullSnapshot = calculationSnapshot.current;
    if (!fullSnapshot || fullSnapshot.date !== snapshot.date) {
      try {
        const response = await fetch(`/api/snapshot?view=core&date=${encodeURIComponent(snapshot.date)}&version=${encodeURIComponent(snapshot.generatedAt)}`);
        if (!response.ok) throw new Error("Could not load benchmark data.");
        const payload = await response.json();
        fullSnapshot = payload.snapshot as Snapshot;
        if (fullSnapshot.date !== snapshot.date) throw new Error("Benchmark data changed. Please reload the page.");
        calculationSnapshot.current = fullSnapshot;
      } catch (e) {
        if (searchAttempt.current === attempt) setError(e instanceof Error ? e.message : "Could not load benchmark data.");
        return;
      }
    }
    if (searchAttempt.current !== attempt) return;
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
        const text = u.phase === "complete" && !u.exactMatch ? "Closest benchmark mix found." : searchMessage(u, snapshot);
        const entry = { id: ++logId, text };
        setLogs(l => l.at(-1)?.text === text ? l : [...l.slice(-2), entry]);
        setHistory(h => [...h.slice(-23), u.fitScore]);
        if (u.phase === "complete") {
          if (!inLab) try { document.cookie = `${PRIORS_MIX_COOKIE}=${encodeURIComponent(encodeIndex(u.config))}; Path=/; Max-Age=31536000; SameSite=Lax${location.protocol === "https:" ? "; Secure" : ""}`; } catch { /* storage can be disabled */ }
          setAnnouncement(`Search complete. ${u.exactMatch ? "Your full order matches." : "Your closest benchmark mix is ready."} ${u.matchedPositions} of ${target.length} models are in their requested positions.`);
          recordLineup.current?.({ focus, lineup: target, weights: u.weights, strictness: u.config.strictness ?? 50, fitScore: u.fitScore, exact: u.exactMatch, snapshotDate: snapshot.date });
        }
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
      w.postMessage({ snapshot: fullSnapshot, target, priorities: { baseline: original }, reducedMotion: window.matchMedia("(prefers-reduced-motion: reduce)").matches, quality: Object.fromEntries(quality.map(q => [q.id, q.score])), focus, library });
    } catch { setError("Could not start the search. Please try again."); }
  }
  function edit() { ++searchAttempt.current; release(); worker.current?.terminate(); worker.current = null; if (displayTimer.current) clearTimeout(displayTimer.current); displayTimer.current = null; latest.current = null; setStage("order"); setUpdate(null); setError(""); }
  function openDialog(kind: "models" | "quality") { setModal(kind); setQuery(""); dialog.current?.showModal(); }
  const liveOrder = stage === "order" || !update?.ranking.length ? order : [...update.ranking.map(r => r.modelId).filter(id => order.includes(id)), ...order.filter(id => !update.ranking.some(r => r.modelId === id))];
  const liveScores = new Map(update?.ranking.map(r => [r.modelId, r]) ?? []);
  const maxScore = Math.max(1, ...[...liveScores.values()].map(r => r.score));
  const activeWeights = Object.entries(update?.weights ?? {}).filter(([, w]) => w > 0).sort((a, b) => { const ai = PREFERRED.indexOf(a[0] as typeof PREFERRED[number]), bi = PREFERRED.indexOf(b[0] as typeof PREFERRED[number]); return (ai < 0 ? 100 : ai) - (bi < 0 ? 100 : bi) || a[0].localeCompare(b[0]); });
  const totalWeight = activeWeights.reduce((sum, [, w]) => sum + w, 0) || 1;
  useEffect(() => { if (complete && stage === "fit" && !done.current?.open && !labMode?.search) { const t = setTimeout(() => { done.current?.showModal(); if (flow.done !== "classic") track("share_card_opened", { from: "onboarding" }); }, 450); return () => clearTimeout(t); } }, [complete, stage, flow.done, labMode?.search]);
  // Search lab: run on load and replay a few seconds after each result.
  const replay = useRef(start);
  useEffect(() => { replay.current = start; });
  useEffect(() => { if (!labMode?.search || (stage === "fit" && !complete)) return; const t = setTimeout(() => void replay.current(), stage === "fit" ? 6000 : 300); return () => clearTimeout(t); }, [labMode?.search, stage, complete]);
  const resultQuery = update ? encodeIndices([{ ...update.config, name: "My priors", focus }]) : new URLSearchParams();
  if (inLab) resultQuery.set("date", snapshot.date);
  const resultUrl = update ? `${inLab ? "/lab/index" : "/builder"}?${resultQuery}` : "";
  async function copy() { try { await navigator.clipboard.writeText(`${location.origin}${resultUrl}`); setCopied(true); } catch { setError("Couldn't copy. Use Explore this index, then copy its address."); } }
  const modelOptions = snapshot.models.filter(m => m.kind === "llm" && m.name.toLowerCase().includes(query.toLowerCase()) && observedModels.has(m.id)).sort((a, b) => Number(order.includes(b.id)) - Number(order.includes(a.id)) || a.name.localeCompare(b.name));
  const topNames = update ? update.ranking.slice(0, 5).map((r) => models.get(r.modelId)?.name ?? r.modelId) : [];
  const fittedIndex = update ? { ...update.config, name: "My priors", focus } : null;
  const cardUrl = fittedIndex ? `/og?${(() => { const q = encodeIndices([fittedIndex]); q.set("date", snapshot.date); if (dark) q.set("scheme", "dark"); return q; })()}` : "";
  const [via, setVia] = useState<Via | null>(null);
  const rankedLabel = `${rankedCount.toLocaleString()}${rankedCount >= 1000 ? "+" : ""}`;
  useEffect(() => { if (inLab) return; const id = requestAnimationFrame(() => setVia(readVia())); return () => cancelAnimationFrame(id); }, [inLab]);
  const pairwiseAction = () => <button type="button" className={inLab ? "lab-pairwise-action" : "production-pairwise-action"} onClick={openPairwise} aria-label={`${labMode?.label ?? "Rank in pairs"}, compare the models in pairs`}><span>{labMode?.label ?? "Rank in pairs"}</span><Arrow /></button>;
  const introTitle = <h1>{stage === "compare" ? <>Which is <em>better?</em></> : stage === "pick" ? <>Who are your <em>top {flow.pickCount ?? 3}?</em></> : stage === "order" ? bracket ? <>Does this look <em>right?</em></> : <>What are your <em>priors?</em></> : complete ? update?.exactMatch ? <>Your priors, <em>in numbers.</em></> : <>The closest <em>we found.</em></> : <>Putting your priors<br className="mobile-break" /> <em>to the test.</em></>}</h1>;

  return <div className={`onboarding stage-${stage} ${running ? "is-running" : ""} ${inLab ? "lab-mode" : ""}`}>
    {!inLab && convexEnabled && <LineupRecorder onRegister={(fn) => { recordLineup.current = fn; }} />}
    <header className="onboard-header"><Wordmark size={32} href={null} /><div className="header-links"><Link className="text-control" href="/explore">Explore</Link><button className="text-control" onClick={() => intro.current?.showModal()}>How it works</button><Link className="text-control" href="/privacy">Privacy</Link><button className="text-control" onClick={() => openDialog("quality")} aria-label="About the evidence"><span className="label-long">About the evidence</span><span className="label-short">Evidence</span><span aria-hidden="true">↗</span></button><ThemeToggle className="text-control theme-icon" /></div></header>
    <main className="onboard-main">
      <div className="step-line"><span className={stage === "compare" ? "current" : "passed"}>01 <span>Your calls</span></span><i /><span className={stage === "order" ? "current" : stage === "fit" ? "passed" : ""}>02 <span>Your ranking</span></span><i /><span className={stage === "fit" ? "current" : ""}>03 <span>The evidence</span></span></div>
      <div className="onboard-intro" key={stage}>
        {labMode?.placement === "heading" && stage === "order" ? <div className="lab-onboard-title">{introTitle}{pairwiseAction()}</div> : introTitle}
        <p>{stage === "compare" ? <>Tap the better model, {extra && adaptive ? `up to ${MORE_CALLS} more calls` : `${adaptive?.cap ?? flow.bracket?.cap ?? 15} quick calls at most`}. We find the benchmarks that agree with you. <span className="intro-proof">{extra ? "Your earlier calls are kept" : <>About a minute · no sign-in{rankedCount > 20 ? ` · ${rankedLabel} rankings so far` : ""}</>}</span></> : stage === "pick" ? <>Tap them in order, best first. We find the benchmarks that agree with you. <span className="intro-proof">Takes seconds · no sign-in{rankedCount > 20 ? ` · ${rankedLabel} rankings so far` : ""}</span></> : stage === "order" ? bracket ? `${bracket.asked ? `Built from your ${bracket.asked} ${bracket.asked === 1 ? "call" : "calls"} and today's benchmarks.` : "Built from today's benchmarks."} Not every matchup came up, so check it before the search starts.` : "You have a sense of which models are better. Put them in order." : complete ? update?.exactMatch ? "A compact benchmark mix that matches your full order." : "Your closest benchmark mix. You can inspect the remaining disagreements below." : "Trying the benchmarks. Adjusting the weights. Keeping only what helps."}</p>
      </div>
      {stage === "compare" ? <Bracket seeds={bracketSeeds} models={models} labs={labs} options={flow.bracket} adaptive={adaptive} storageKey={inLab ? null : undefined} initial={extra ? calls : undefined} extra={extra} onFinish={finishBracket} onList={(step, answers) => { if (adaptive) { setCalls(answers); setBracket(step); setOrder(step.order); orderRef.current = step.order; } setStage("order"); }} /> : stage === "pick" ? <TopPicker seeds={bracketSeeds} models={models} labs={labs} count={flow.pickCount ?? 3} onFinish={finishPick} onList={() => setStage("order")} /> : <div className={`experiment-grid ${inLab ? "lab-mode-grid" : ""}`}>
        <section className="order-board" aria-label={stage === "order" ? "Your model preferences" : "Fitted model ranking"}>
          {stage === "order" && !bracket && (!inLab || labMode?.placement === "board-top") && <div className={inLab ? "lab-pairwise-top" : "production-pairwise-top"}>{pairwiseAction()}</div>}
          <div className="board-heading"><span>{stage === "order" ? "YOUR ORDER" : "BEST FIT · YOUR SELECTED MODELS"}</span>{labMode?.placement === "board-heading" && stage === "order" ? <div className="lab-board-heading-action">{pairwiseAction() }<span>BEST FIRST</span></div> : <span>{stage === "order" ? "BEST FIRST" : "SCORE / YOUR ORDER"}</span>}</div>
          {stage === "order" && <div className={`focus-picker ${flow.focus === "compact" ? "compact" : ""}`}>
            <span className="focus-label">Focus</span>
            <div className="focus-row" role="radiogroup" aria-label="Benchmark focus">
              {FOCUSES.map((f) => <button key={f.id} role="radio" aria-checked={focus === f.id} className={`focus-option ${focus === f.id ? "selected" : ""}`} onClick={() => setFocus(f.id)}><span className="focus-name">{f.name}</span><span className="focus-blurb">{f.blurb}</span></button>)}
            </div>
          </div>}
          <div className="tactile-list" role="list" aria-label="Model ranking" style={{ height: order.length * ROW }}>
            {liveOrder.map(id => {
              const model = models.get(id)!; const index = liveOrder.indexOf(id); const wanted = order.indexOf(id); const result = liveScores.get(id); const picked = drag?.id === id;
              return <div key={id} role="listitem" data-model={id} className={`tactile-row ${picked ? "picked" : ""}`} style={{ "--lab": colors.get(model.labId) ?? "#8A8A80", transform: `translateY(${picked ? drag.y : index * ROW}px)`, zIndex: picked ? 20 : 1 } as CSSProperties}>
                <span className="rank-number">{String(index + 1).padStart(2, "0")}</span>
                <button className="model-grab" aria-label={stage === "order" ? `Move ${model.name}, rank ${wanted + 1}` : `${model.name}, rank ${index + 1}, score ${result ? result.score.toFixed(1) : "unavailable"}`} aria-describedby={stage === "order" ? "drag-help" : undefined} onPointerDown={e => grab(e, id)} onKeyDown={e => { if (stage !== "order") return; if (e.key === "ArrowUp" || e.key === "ArrowDown") { e.preventDefault(); move(id, wanted + (e.key === "ArrowUp" ? -1 : 1)); } }}>
                  <span className="model-name">{model.name}</span><span className="belief-track"><span className="belief-bar" style={{ width: stage === "order" || !update ? "100%" : `${result ? Math.max(2, result.score / maxScore * 100) : 0}%` }} /></span>
                  {stage === "order" ? <span className="grip"><Grip /></span> : <span className="live-score">{result ? result.score.toFixed(1) : "—"}</span>}
                </button>
                {stage === "order" ? <span className="nudge"><button aria-label={`Move ${model.name} up`} disabled={wanted === 0} onClick={() => move(id, wanted - 1)}><Arrow direction="up" /></button><button aria-label={`Move ${model.name} down`} disabled={wanted === order.length - 1} onClick={() => move(id, wanted + 1)}><Arrow direction="down" /></button></span> : <span className={`wanted-rank ${index === wanted ? "matched" : ""}`} title={`You put ${model.name} at ${wanted + 1}`}>{index === wanted ? "✓" : `#${wanted + 1}`}</span>}
              </div>;
            })}
          </div>
          <div className="board-foot">{stage === "order" ? <><span id="drag-help">Drag a handle, or use the arrows.</span>{!inLab && bracket && !adaptive && <button className="text-control" onClick={backToMatchups}>Back to the matchups</button>}<button className="text-control" onClick={() => openDialog("models")}>Choose models <span aria-hidden="true">+</span></button></> : <><span>Relative order within your lineup.</span><button className="text-control" onClick={edit}>{running ? "Stop & reorder" : "Change my order"}</button></>}</div>
        </section>
        <aside className="experiment-side">
          {stage === "order" ? <div className="review-side">
            <div className="review-cta">
              {!bracket && <h2>Intuition first.<br />Evidence next.</h2>}
              <button className="primary-action" onClick={() => start(orderRef.current, bracket ? "review" : "list")} disabled={order.length < 3}>{bracket ? "Looks right, find my index" : "Find my index"} <Arrow /></button>
              <span className="action-note">{order.length} models · up to 12 benchmarks</span>
            </div>
            {bracket && <div className="review-adjust"><span>Something off?</span>{adaptive ? <button className="text-control" onClick={compareMore}>Compare more pairs <Arrow /></button> : <button className="text-control" onClick={openPairwise}>Start the matchups over <Arrow /></button>}<span>Or drag a model in the list.</span></div>}
            <div className="setup-note">
              <p>Your top choices lead the search. Changes you make and models you add get extra priority.</p>
              <div className="preference-note"><span className="tiny-star" aria-hidden="true">✳</span><p>Your focus biases the search toward high-quality benchmarks in that area. Newer, less saturated, more objective tests get more weight when choosing between similar fits.</p></div>
              <button className="text-control evidence-link" onClick={() => openDialog("quality")}>See benchmark preferences <Arrow /></button>
            </div>
          </div> : <>
            <SearchMonitor variant={flow.monitor ?? "ladder"} update={update} wanted={order} history={history} logs={logs} elapsed={elapsed} running={running} complete={complete} error={!!error} benchmarks={searchable} />
            {error && <div className="fit-error" role="alert"><p>{error}</p><button className="text-control" onClick={() => start()}>Try again <Arrow /></button></div>}
            <div className="mix-panel"><div className="mix-heading"><h2>{complete ? `${FOCUSES.find(f => f.id === focus)?.name ?? ""} fit · ${update?.benchmarkCount ?? 0} benchmarks` : update ? phaseNames[update.phase] : "Reading the evidence"}</h2><span className="phase-mark">{complete ? update?.exactMatch ? "✓" : "≈" : "⋯"}</span></div>
              {activeWeights.length ? <div className="mix-rows">{activeWeights.map(([id, w]) => { const q = qMap.get(id); return <button key={id} className="mix-row" onClick={() => openDialog("quality")} title={q?.reason}><span className="mix-name">{q?.preferred && <span className="preferred-star" aria-label="Preferred benchmark">✳</span>}{q?.name ?? snapshot.benchmarks.find(b => b.id === id)?.name ?? id}</span><span className="mix-percent">{(w / totalWeight * 100).toFixed(1)}%</span><span className="mix-weight-track"><i style={{ width: `${w / totalWeight * 100}%` }} /></span></button>; })}</div> : <div className="mix-empty">Checking coverage across your models<span className="cursor">_</span></div>}
              {update && <div className="mix-quality"><button className="text-control" onClick={() => openDialog("quality")}>Evidence quality <span>{Math.round(update.quality)}/100</span></button><span>✳ Your preferred benchmarks</span></div>}
            </div>
            {complete && <div className="result-actions"><p className="fit-disclosure">{update!.exactMatch ? "Every model matches your requested order." : "Approximate fit. Some models differ from your requested order."} {update!.estimatedShare > 0 && `${Math.round(update!.estimatedShare * 100)}% of weighted evidence is estimated.`}</p>{update!.mismatches.length > 0 && <details className="fit-details"><summary>See the disagreements</summary><ul>{update!.mismatches.map((pair, i) => <li key={i}>You placed <strong>{models.get(pair.above)?.name}</strong> above <strong>{models.get(pair.below)?.name}</strong>.</li>)}</ul></details>}<details className="fit-details"><summary>How this fit was calculated</summary><p>Strictness {update!.config.strictness ?? 20}/100. {update!.config.effortMatching === "strict" ? "Exact reasoning efforts only." : "Calibrated reasoning-effort estimates allowed."} {update!.config.estimateMissing ? "Peer estimates may fill remaining gaps." : "Remaining gaps are left out and available weights are renormalized."} Calibrated benchmark fallbacks are allowed below maximum strictness. Only the relative order of your selected models is optimized. An unselected model appearing between them adds no penalty. Displayed positions are within your lineup. Your reversals and the placements of added models take priority, starting at the top. Remaining comparisons favor higher ranks. A comparison checks whether one selected model ranks above another; it is not an extra model. Unselected models cannot compensate for a mistake in that lineup. Best effort per model. The search starts from benchmark mixes precomputed for your focus and favors tests with more coverage, fresher releases, more headroom, and more objective grading. The displayed fit is rank-weighted: mistakes near the top of your lineup cost the most, thin margins and extra benchmarks cost a little. Candidates are screened against a surrogate, then checked with the builder’s scoring engine under a time budget (about 30 seconds typical, 60 seconds at most). This is a best fit found, not a guarantee of the global minimum.</p></details><Link className="primary-action" href={resultUrl as "/builder"} transitionTypes={["nav-forward"]}>Explore this index <Arrow /></Link><button className="text-control copy-result" onClick={copy}>{copied ? "Link copied ✓" : "Copy index link"}</button></div>}
          </>}
        </aside>
      </div>}
    </main>
    <span className="sr-only" aria-live="polite">{announcement}</span>
    <dialog ref={done} className={`done-dialog ${flow.done !== "classic" ? "wide" : ""}`} aria-labelledby="done-heading" onClick={e => { if (e.target === e.currentTarget) done.current?.close(); }}>
      {complete && update && flow.done !== "classic" && <Finish update={update} models={models} cardUrl={cardUrl} resultUrl={resultUrl} publicUrl={`https://mypriors.com/builder?${resultQuery}`} reference={labReference ?? via?.ids} referenceLabel={labReference ? "@demo" : via ? `@${via.handle}` : undefined} onClose={() => done.current?.close()} />}
      {complete && update && flow.done === "classic" && <div className="done-body">
        <div className="done-check" aria-hidden="true"><svg viewBox="0 0 52 52"><circle cx="26" cy="26" r="24" /><path d="M15 27l7 7 15-16" /></svg></div>
        <p className="done-cap">{update.exactMatch ? "Search complete · every model in place" : `Search complete · ${update.matchedPositions}/${order.length} in place`}</p>
        <h2 id="done-heading">{update.exactMatch ? <>Your index <em>is ready.</em></> : <>The closest index <em>we found.</em></>}</h2>
        <div className="done-stats"><strong>{Math.round(update.fitScore)}<span>%</span></strong><span>fit to your lineup<br /><small>{update.benchmarkCount} benchmarks · {(update.tested ?? 0).toLocaleString()} combinations tested</small></span></div>
        <div className="done-mix">{activeWeights.slice(0, 4).map(([id, w], i) => <div key={id} style={{ "--d": `${200 + i * 110}ms`, "--w": `${w / totalWeight * 100}%` } as CSSProperties}><span>{qMap.get(id)?.name ?? snapshot.benchmarks.find(b => b.id === id)?.name ?? id}</span><em>{(w / totalWeight * 100).toFixed(0)}%</em><b><i /></b></div>)}</div>
        <Link className="primary-action done-cta" href={resultUrl as "/builder"} transitionTypes={["nav-forward"]}>Explore your index <Arrow /></Link>
        <button className="text-control done-later" onClick={() => done.current?.close()}>Review the fit first</button>
      </div>}
    </dialog>
    <Intro snapshot={snapshot} lineup={order} dialogRef={intro} onClose={() => { if (!inLab) try { localStorage.setItem(INTRO_KEY, "1"); } catch { /* ignore */ } }} />
    <dialog ref={dialog} className="evidence-dialog" aria-labelledby="dialog-heading" onClick={e => { if (e.target === e.currentTarget) { const r = e.currentTarget.getBoundingClientRect(); if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) dialog.current?.close(); } }}>
      <div className="dialog-heading"><div><h2 id="dialog-heading">{modal === "models" ? "Who’s in your lineup?" : "Better evidence, fewer benchmarks."}</h2><p>{modal === "models" ? `Choose 3 to 18 models. ${order.length} selected.` : "Your preferences guide the search. Quality helps break close calls."}</p></div><button aria-label="Close dialog" className="icon-close" onClick={() => dialog.current?.close()}><Cross /></button></div>
      {modal === "models" ? <><input className="model-search" type="search" placeholder="Find a model…" aria-label="Find a model" value={query} onChange={e => setQuery(e.target.value)} /><div className="model-options">{modelOptions.map(m => <label key={m.id}><input type="checkbox" checked={order.includes(m.id)} disabled={order.includes(m.id) ? order.length <= 3 : order.length >= 18} onChange={() => { edited.current = true; setOrder(o => o.includes(m.id) ? o.filter(id => id !== m.id) : [...o, m.id]); }} /><i style={{ background: colors.get(m.labId) ?? "#8A8A80" }} /><span>{m.name}</span></label>)}{!modelOptions.length && <p>No models found.</p>}</div><button className="primary-action" onClick={() => dialog.current?.close()}>Use this lineup <Arrow /></button></> : <>
        <div className="quality-explainer"><p><strong>Coverage</strong> counts how many models have measured results — a test most models took beats a niche one.</p><p><strong>Recency</strong> rewards recent test releases. An unknown release date gets a neutral score. A fresh scrape is not a fresh benchmark.</p><p><strong>Headroom</strong> measures saturation and score spread. Tests that separate models beat tests everyone passes.</p><p><strong>Objectivity</strong> favors verifiable outcomes over preferences and subjective judging.</p></div>
        <p className="quality-caveat">Quality combines 25% coverage, 25% recency, 30% headroom, and 20% objectivity — plus a bonus for preferred benchmarks, minus a penalty for superseded versions. Objectivity is an assigned judgment score. This heuristic does not measure contamination or scientific validity.</p>
        <div className="quality-table"><div className="quality-table-head"><span>Benchmark</span><span>Recent</span><span>Headroom</span><span>Objective</span><span>Quality</span></div>{quality.filter(q => q.preferred || activeWeights.some(([id]) => id === q.id)).sort((a, b) => Number(b.preferred) - Number(a.preferred) || b.score - a.score).map(q => <div className="quality-entry" key={q.id}><div className="quality-table-row"><span>{q.preferred && <span className="preferred-star">✳ </span>}{q.name}</span><span>{q.dateConfidence === "unknown" ? "?" : Math.round(q.recency)}</span><span>{Math.round(q.saturation)}</span><span>{Math.round(q.objectivity)}</span><strong>{Math.round(q.score)}</strong></div><details><summary>{q.releaseDate ? `Released ${q.releaseDate}` : "Release date unverified"} · Why this score</summary><p>{q.reason} <a href={q.sourceUrl} target="_blank" rel="noreferrer">Source ↗</a></p></details></div>)}</div>
      </>}
    </dialog>
  </div>;
}
