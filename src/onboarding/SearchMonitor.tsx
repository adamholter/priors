"use client";
import type { CSSProperties, ReactNode } from "react";
import type { FitUpdate } from "./optimizer";

/** Looks for the search-in-progress panel. "trace" is live; the rest are compared in /lab/search. */
export type MonitorVariant = "trace" | "pairs" | "dial" | "grid" | "quiet";
export const MONITOR_VARIANTS: { id: MonitorVariant; name: string; note: string }[] = [
  { id: "trace", name: "A · Trace (live)", note: "Fit line and a running log" },
  { id: "pairs", name: "B · Every matchup", note: "One mark per pair, filled when it agrees" },
  { id: "dial", name: "C · Dial", note: "Fit ring, a tick per benchmark" },
  { id: "grid", name: "D · Benchmark board", note: "Every test, lit when it is in the mix" },
  { id: "quiet", name: "E · Quiet", note: "One sentence and a progress line" },
];
type Props = {
  variant: MonitorVariant; update: FitUpdate | null; wanted: string[]; history: number[]; logs: { id: number; text: string }[]; elapsed: number;
  running: boolean; complete: boolean; error: boolean; benchmarks: { id: string; name: string }[];
};

function Trace({ values }: { values: number[] }) {
  const path = values.map((v, i) => `${i ? "L" : "M"}${i / Math.max(1, values.length - 1) * 300},${68 - v * .6}`).join(" ");
  return <svg className="fit-trace" viewBox="0 0 300 76" role="img" aria-label="How closely the search matches your requested order"><path d="M0 68H300M0 38H300M0 8H300" style={{ stroke: "var(--hair)" }} strokeWidth=".5" /><path d={path} fill="none" style={{ stroke: "var(--indigo)" }} strokeWidth="1.5" vectorEffect="non-scaling-stroke" />{values.length > 0 && <circle cx="300" cy={68 - values[values.length - 1] * .6} r="3" style={{ fill: "var(--indigo)" }} />}</svg>;
}

/** One mark per pair in the lineup: row = the model you ranked higher, filled once the mix agrees. */
function Pairs({ update, wanted, running }: Pick<Props, "update" | "wanted" | "running">) {
  const pos = new Map(update?.ranking.map((r, i) => [r.modelId, i]) ?? []);
  const n = wanted.length, w = 300 / Math.max(1, n - 1), h = Math.min(w, 13);
  let agree = 0, total = 0;
  const marks: ReactNode[] = [];
  for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) {
    const a = pos.get(wanted[i]), b = pos.get(wanted[j]), ok = a !== undefined && b !== undefined && a < b;
    total++; if (ok) agree++;
    marks.push(<rect key={`${i}-${j}`} className={ok ? "ok" : update ? "off" : ""} x={(j - 1) * w + 1.5} y={i * h + 1.5} width={w - 3} height={h - 3} />);
  }
  return <>
    <div className="agreement"><strong>{agree}</strong><span>of {total} matchups agree<br /><small>Top rows are your highest picks</small></span></div>
    <svg className={`pair-map ${running ? "is-live" : ""}`} viewBox={`0 0 300 ${(n - 1) * h}`} role="img" aria-label={`${agree} of ${total} pairs in your lineup match the benchmark mix`}>{marks}</svg>
  </>;
}

function Dial({ update, wanted, running }: Pick<Props, "update" | "wanted" | "running">) {
  const fit = update?.fitScore ?? 0, r = 58, c = 2 * Math.PI * r, used = update?.benchmarkCount ?? 0;
  return <div className="dial">
    <svg viewBox="0 0 160 160" role="img" aria-label={`${Math.round(fit)} percent fit`}>
      <circle className="dial-track" cx="80" cy="80" r={r} />
      <circle className="dial-arc" cx="80" cy="80" r={r} strokeDasharray={c} strokeDashoffset={c * (1 - fit / 100)} transform="rotate(-90 80 80)" />
      {Array.from({ length: 12 }, (_, i) => <path key={i} className={i < used ? "dial-tick on" : "dial-tick"} d="M80 6v9" transform={`rotate(${i * 30} 80 80)`} />)}
      {running && <g className="dial-orbit"><circle cx="80" cy="22" r="3" /></g>}
      <text x="80" y="90" textAnchor="middle" className="dial-number">{Math.round(fit)}<tspan className="dial-unit" dx="2">%</tspan></text>
    </svg>
    <dl><div><dt>{update?.matchedPositions ?? 0}/{wanted.length}</dt><dd>in place</dd></div><div><dt>{update?.benchmarkCount ?? "—"}</dt><dd>benchmarks</dd></div><div><dt>{(update?.tested ?? 0).toLocaleString()}</dt><dd>combinations</dd></div></dl>
  </div>;
}

/** Every candidate test as a cell. Lit cells are in the mix, stronger with more weight; the outlined one is being tried. */
function Grid({ update, benchmarks }: Pick<Props, "update" | "benchmarks">) {
  const weights = update?.weights ?? {}, total = Object.values(weights).reduce((n, w) => n + Math.max(0, w), 0) || 1;
  const max = Math.max(.0001, ...Object.values(weights)) / total;
  const trying = benchmarks.find(b => update?.log.endsWith(` ${b.id}`))?.id;
  return <>
    <div className="agreement"><strong>{update?.benchmarkCount ?? 0}</strong><span>of {benchmarks.length} tests in your mix<br /><small>{Math.round(update?.fitScore ?? 0)}% fit · {update?.matchedPositions ?? 0} models in place</small></span></div>
    <div className="bench-grid" role="img" aria-label={`${update?.benchmarkCount ?? 0} of ${benchmarks.length} benchmarks are in the mix`}>{benchmarks.map(b => { const share = Math.max(0, weights[b.id] ?? 0) / total; return <i key={b.id} title={b.name} className={`${share > 0 ? "on" : ""} ${trying === b.id ? "trying" : ""}`} style={{ "--share": share > 0 ? .35 + .65 * share / max : 0 } as CSSProperties} />; })}</div>
  </>;
}

function Quiet({ update, logs, running, complete }: Pick<Props, "update" | "logs" | "running" | "complete">) {
  const steps = ["preparing", "searching", "simplifying"] as const, at = complete ? 3 : Math.max(0, steps.indexOf((update?.phase ?? "preparing") as typeof steps[number]));
  const line = logs.at(-1);
  return <div className="quiet">
    <p className="quiet-line" key={line?.id ?? 0}>{line?.text ?? "Reading the benchmark evidence."}</p>
    <div className={`quiet-track ${running ? "is-live" : ""}`}><i style={{ transform: `scaleX(${at / 3})` }} /><b /></div>
    <ol className="quiet-steps">{["Read", "Search", "Simplify"].map((s, i) => <li key={s} className={i < at ? "passed" : i === at ? "current" : ""}>{s}</li>)}</ol>
  </div>;
}

export function SearchMonitor(p: Props) {
  const { variant, update, wanted, logs, elapsed, running, complete, error } = p;
  const last = logs.at(-1)?.text ?? "Reading the benchmark evidence.";
  const metrics = <div className="monitor-metrics"><span>{(update?.tested ?? 0).toLocaleString()} <small>combinations</small></span><span>{update?.benchmarkCount ?? "—"} <small>benchmarks</small></span></div>;
  const oneLine = <div className="monitor-line" aria-hidden="true"><span>·</span>{last}</div>;
  return <div className={`solver-monitor monitor-${variant}`} role="region" aria-label="Optimization monitor">
    <span className="sr-only" role="status" aria-label={error ? "Search error" : complete ? "Search complete" : "Search running"}>{error ? "Search stopped" : complete ? "Search complete" : "Searching benchmark combinations"}</span>
    <div className="monitor-top"><span><i className={running ? "pulse" : ""} />{error ? "SEARCH STOPPED" : complete ? "SEARCH COMPLETE" : "SEARCH IN PROGRESS"}</span><span>{elapsed.toFixed(1)}s</span></div>
    {variant === "trace" && <>
      <div className="agreement"><strong>{Math.round(update?.fitScore ?? 0)}<span>%</span></strong><span>fit to your lineup<br /><small>{update?.matchedPositions ?? 0}/{wanted.length} in place{update?.priorityTotal ? update.priorityMatched === update.priorityTotal ? " · your edits are preserved" : " · some edits unresolved" : ""}</small>{update?.provisional && !complete && <small className="checking">checking…</small>}</span></div>
      <Trace values={p.history} />
      {metrics}
      <div className="terminal-log" aria-hidden="true">{logs.length ? logs.map(log => <div key={log.id}><span aria-hidden="true">·</span>{log.text}</div>) : <div><span aria-hidden="true">·</span>Reading the benchmark evidence.</div>}</div>
    </>}
    {variant === "pairs" && <><Pairs update={update} wanted={wanted} running={running} />{metrics}{oneLine}</>}
    {variant === "dial" && <><Dial update={update} wanted={wanted} running={running} />{oneLine}</>}
    {variant === "grid" && <><Grid update={update} benchmarks={p.benchmarks} />{oneLine}</>}
    {variant === "quiet" && <><Quiet update={update} logs={logs} running={running} complete={complete} /><div className="monitor-metrics"><span>{Math.round(update?.fitScore ?? 0)}% <small>fit</small></span><span>{update?.matchedPositions ?? 0}/{wanted.length} <small>in place</small></span><span>{update?.benchmarkCount ?? "—"} <small>benchmarks</small></span></div></>}
  </div>;
}
