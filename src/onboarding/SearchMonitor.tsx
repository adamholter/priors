"use client";
import { useEffect, useRef, useState, type CSSProperties } from "react";
import type { FitUpdate } from "./optimizer";

/** Looks for the search-in-progress panel. "trace" is live; the rest are compared in /lab/search. */
export type MonitorVariant = "trace" | "ladder" | "strips" | "skyline" | "quiet";
export const MONITOR_VARIANTS: { id: MonitorVariant; name: string; note: string }[] = [
  { id: "trace", name: "A · Trace (live)", note: "Fit line and a running log" },
  { id: "ladder", name: "B · Ladder + board", note: "Mini leaderboard beside the tests" },
  { id: "strips", name: "C · Two strips", note: "A row of slots over a row of tests" },
  { id: "skyline", name: "D · Skyline", note: "Score columns over the tests" },
  { id: "quiet", name: "E · Quiet", note: "One sentence and a progress line" },
];
type Log = { id: number; text: string };
type Props = {
  variant: MonitorVariant; update: FitUpdate | null; wanted: string[]; history: number[]; logs: Log[]; elapsed: number;
  running: boolean; complete: boolean; error: boolean; benchmarks: { id: string; name: string }[];
};

function Trace({ values }: { values: number[] }) {
  const path = values.map((v, i) => `${i ? "L" : "M"}${i / Math.max(1, values.length - 1) * 300},${68 - v * .6}`).join(" ");
  return <svg className="fit-trace" viewBox="0 0 300 76" role="img" aria-label="How closely the search matches your requested order"><path d="M0 68H300M0 38H300M0 8H300" style={{ stroke: "var(--hair)" }} strokeWidth=".5" /><path d={path} fill="none" style={{ stroke: "var(--indigo)" }} strokeWidth="1.5" vectorEffect="non-scaling-stroke" />{values.length > 0 && <circle cx="300" cy={68 - values[values.length - 1] * .6} r="3" style={{ fill: "var(--indigo)" }} />}</svg>;
}

const FILLER = {
  preparing: ["Reading the benchmark evidence.", "Lining up your models.", "Checking who was tested on what."],
  searching: ["Trying a new mix of tests.", "Weighing the tests against your order.", "Swapping one benchmark for another.", "Checking the top of your list first.", "Looking for tests that agree with you.", "Nudging the weights."],
  simplifying: ["Dropping tests that add nothing.", "Keeping the mix small.", "Checking the fit still holds."],
} as const;
const HOLD = 2300;

/** Loading-screen pacing: one line at a time, each held about as long as the last, however unevenly
 * the search reports. A new search message goes next; with none waiting, a stock line for the phase. */
function useTicker(latest: Log | undefined, phase: FitUpdate["phase"] | undefined, running: boolean) {
  const [lines, setLines] = useState<{ cur: Log; prev?: Log }>({ cur: { id: 0, text: FILLER.preparing[0] } });
  const feed = useRef({ latest, phase, used: 0, turn: 0, text: "" });
  useEffect(() => { feed.current.latest = latest; feed.current.phase = phase; }, [latest, phase]);
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const show = (text: string) => { feed.current.text = text; setLines(l => l.cur.text === text ? l : { cur: { id: l.cur.id + 1, text }, prev: l.cur }); };
    const tick = () => {
      const f = feed.current;
      // A search message already on screen is not news; the line still has to change on the beat.
      if (f.latest && f.latest.id !== f.used && f.latest.text !== f.text) { f.used = f.latest.id; show(f.latest.text); }
      else { const pool = FILLER[f.phase === "complete" || !f.phase ? "preparing" : f.phase].filter(line => line !== f.text); f.used = f.latest?.id ?? f.used; show(pool[f.turn++ % pool.length]); }
      timer = setTimeout(tick, HOLD + (Math.random() - .5) * 500);
    };
    // The verdict is not held back for the line before it.
    if (!running) { timer = setTimeout(() => { const f = feed.current; if (f.latest) { f.used = f.latest.id; show(f.latest.text); } }, 0); return () => clearTimeout(timer); }
    feed.current.used = 0; feed.current.turn = 0;
    timer = setTimeout(tick, HOLD);
    return () => clearTimeout(timer);
  }, [running]);
  return lines;
}
function Ticker({ lines, className = "" }: { lines: { cur: Log; prev?: Log }; className?: string }) {
  return <p className={`ticker ${className}`} aria-hidden="true">{lines.prev && <span key={lines.prev.id} className="tick-out">{lines.prev.text}</span>}<span key={lines.cur.id} className="tick-in">{lines.cur.text}</span></p>;
}

/** The lineup as the mix currently ranks it: one slot per rank, solid once that slot holds the model you put there. */
function slotsOf(update: FitUpdate | null, wanted: string[]) {
  const scores = new Map(update?.ranking.map(r => [r.modelId, r.score]) ?? []);
  const live = update ? [...update.ranking.map(r => r.modelId).filter(id => wanted.includes(id)), ...wanted.filter(id => !scores.has(id))] : wanted;
  const max = Math.max(1, ...live.map(id => scores.get(id) ?? 0));
  return live.map((id, i) => ({ id, placed: !!update && wanted[i] === id, size: update ? Math.max(.12, (scores.get(id) ?? 0) / max) : 1 }));
}
/** Every candidate test: lit when it is in the mix, stronger with more weight, ringed while the search tries it. */
function testsOf(update: FitUpdate | null, benchmarks: Props["benchmarks"]) {
  const weights = update?.weights ?? {}, total = Object.values(weights).reduce((n, w) => n + Math.max(0, w), 0) || 1;
  const max = Math.max(.0001, ...Object.values(weights)) / total;
  const trying = benchmarks.find(b => update?.log.endsWith(` ${b.id}`))?.id;
  return benchmarks.map(b => { const share = Math.max(0, weights[b.id] ?? 0) / total; return { ...b, lit: share > 0, level: share / max, trying: trying === b.id }; });
}
type Slots = ReturnType<typeof slotsOf>; type Tests = ReturnType<typeof testsOf>;
const testClass = (t: Tests[number]) => `${t.lit ? "on" : ""} ${t.trying ? "trying" : ""}`;
const level = (t: Tests[number]) => ({ "--level": t.level } as CSSProperties);

function Ladder({ slots, tests }: { slots: Slots; tests: Tests }) {
  return <div className="ladder">
    <div><span className="mini-cap">Your order</span><div className="ladder-rows">{slots.map((s, i) => <i key={i} className={s.placed ? "placed" : ""} style={{ width: `${s.size * 100}%` }} />)}</div></div>
    <div><span className="mini-cap">The tests</span><div className="test-dots">{tests.map(t => <i key={t.id} title={t.name} className={testClass(t)} style={level(t)} />)}</div></div>
  </div>;
}
function Strips({ slots, tests }: { slots: Slots; tests: Tests }) {
  return <div className="strips">
    <span className="mini-cap">Your order</span><div className="strip-slots">{slots.map((s, i) => <i key={i} className={s.placed ? "placed" : ""} />)}</div>
    <span className="mini-cap">The tests</span><div className="strip-tests">{tests.map(t => <i key={t.id} title={t.name} className={testClass(t)} style={level(t)} />)}</div>
  </div>;
}
function Skyline({ slots, tests }: { slots: Slots; tests: Tests }) {
  return <div className="skyline">
    <div className="skyline-cols">{slots.map((s, i) => <i key={i} className={s.placed ? "placed" : ""} style={{ height: `${s.size * 100}%` }} />)}</div>
    <div className="test-dots wide">{tests.map(t => <i key={t.id} title={t.name} className={testClass(t)} style={level(t)} />)}</div>
  </div>;
}

export function SearchMonitor(p: Props) {
  const { variant, update, wanted, logs, elapsed, running, complete, error } = p;
  const lines = useTicker(logs.at(-1), update?.phase, running);
  const slots = slotsOf(update, wanted), tests = testsOf(update, p.benchmarks);
  const placed = slots.filter(s => s.placed).length, picture = `${placed} of ${wanted.length} models in place, ${update?.benchmarkCount ?? 0} of ${tests.length} tests in the mix`;
  const stats = <div className="monitor-metrics"><span>{Math.round(update?.fitScore ?? 0)}% <small>fit</small></span><span>{placed}/{wanted.length} <small>in place</small></span><span>{update?.benchmarkCount ?? "—"} <small>{variant === "quiet" ? "benchmarks" : `of ${tests.length} tests`}</small></span></div>;
  const steps = ["preparing", "searching", "simplifying"] as const, at = complete ? 3 : Math.max(0, steps.indexOf((update?.phase ?? "preparing") as typeof steps[number]));
  return <div className={`solver-monitor monitor-${variant}`} role="region" aria-label="Optimization monitor">
    <span className="sr-only" role="status" aria-label={error ? "Search error" : complete ? "Search complete" : "Search running"}>{error ? "Search stopped" : complete ? "Search complete" : "Searching benchmark combinations"}</span>
    <div className="monitor-top"><span><i className={running ? "pulse" : ""} />{error ? "SEARCH STOPPED" : complete ? "SEARCH COMPLETE" : "SEARCH IN PROGRESS"}</span><span>{elapsed.toFixed(1)}s</span></div>
    {variant === "trace" && <>
      <div className="agreement"><strong>{Math.round(update?.fitScore ?? 0)}<span>%</span></strong><span>fit to your lineup<br /><small>{update?.matchedPositions ?? 0}/{wanted.length} in place{update?.priorityTotal ? update.priorityMatched === update.priorityTotal ? " · your edits are preserved" : " · some edits unresolved" : ""}</small>{update?.provisional && !complete && <small className="checking">checking…</small>}</span></div>
      <Trace values={p.history} />
      <div className="monitor-metrics"><span>{(update?.tested ?? 0).toLocaleString()} <small>combinations</small></span><span>{update?.benchmarkCount ?? "—"} <small>benchmarks</small></span></div>
      <div className="terminal-log" aria-hidden="true">{logs.length ? logs.map(log => <div key={log.id}><span aria-hidden="true">·</span>{log.text}</div>) : <div><span aria-hidden="true">·</span>Reading the benchmark evidence.</div>}</div>
    </>}
    {variant !== "trace" && variant !== "quiet" && <>
      <Ticker lines={lines} />
      <div role="img" aria-label={picture}>{variant === "ladder" ? <Ladder slots={slots} tests={tests} /> : variant === "strips" ? <Strips slots={slots} tests={tests} /> : <Skyline slots={slots} tests={tests} />}</div>
      {stats}
    </>}
    {variant === "quiet" && <>
      <div className="quiet">
        <Ticker lines={lines} className="large" />
        <div className={`quiet-track ${running ? "is-live" : ""}`}><i style={{ transform: `scaleX(${at / 3})` }} /><b /></div>
        <ol className="quiet-steps">{["Read", "Search", "Simplify"].map((s, i) => <li key={s} className={i < at ? "passed" : i === at ? "current" : ""}>{s}</li>)}</ol>
      </div>
      {stats}
    </>}
  </div>;
}
