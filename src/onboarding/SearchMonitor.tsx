"use client";
import { useEffect, useRef, useState, type CSSProperties } from "react";
import type { FitUpdate } from "./optimizer";

type Log = { id: number; text: string };
type Props = {
  update: FitUpdate | null; wanted: string[]; logs: Log[]; elapsed: number;
  running: boolean; complete: boolean; error: boolean; benchmarks: { id: string; name: string }[];
};

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
function Ticker({ lines }: { lines: { cur: Log; prev?: Log } }) {
  return <p className="ticker" aria-hidden="true">{lines.prev && <span key={lines.prev.id} className="tick-out">{lines.prev.text}</span>}<span key={lines.cur.id} className="tick-in">{lines.cur.text}</span></p>;
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

/** The search-in-progress panel: a mini leaderboard of the lineup beside the candidate tests, one status line at a time. */
export function SearchMonitor({ update, wanted, logs, elapsed, running, complete, error, benchmarks }: Props) {
  const lines = useTicker(logs.at(-1), update?.phase, running);
  const slots = slotsOf(update, wanted), tests = testsOf(update, benchmarks);
  const placed = slots.filter(s => s.placed).length;
  return <div className="solver-monitor monitor-ladder" role="region" aria-label="Optimization monitor">
    <span className="sr-only" role="status" aria-label={error ? "Search error" : complete ? "Search complete" : "Search running"}>{error ? "Search stopped" : complete ? "Search complete" : "Searching benchmark combinations"}</span>
    <div className="monitor-top"><span><i className={running ? "pulse" : ""} />{error ? "SEARCH STOPPED" : complete ? "SEARCH COMPLETE" : "SEARCH IN PROGRESS"}</span><span>{elapsed.toFixed(1)}s</span></div>
    <Ticker lines={lines} />
    <div className="ladder" role="img" aria-label={`${placed} of ${wanted.length} models in place, ${update?.benchmarkCount ?? 0} of ${tests.length} tests in the mix`}>
      <div><span className="mini-cap">Your order</span><div className="ladder-rows">{slots.map((s, i) => <i key={i} className={s.placed ? "placed" : ""} style={{ width: `${s.size * 100}%` }} />)}</div></div>
      <div><span className="mini-cap">The tests</span><div className="test-dots">{tests.map(t => <i key={t.id} title={t.name} className={`${t.lit ? "on" : ""} ${t.trying ? "trying" : ""}`} style={{ "--level": t.level } as CSSProperties} />)}</div></div>
    </div>
    <div className="monitor-metrics"><span>{Math.round(update?.fitScore ?? 0)}% <small>fit</small></span><span>{placed}/{wanted.length} <small>in place</small></span><span>{update?.benchmarkCount ?? "—"} <small>of {tests.length} tests</small></span></div>
  </div>;
}
