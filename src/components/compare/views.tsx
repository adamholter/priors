"use client";
import { useState } from "react";
import type { Pair, Placed } from "@/lib/compare";
import { useLabColor } from "../chart/echarts";

/** One ranking drawn two ways: the slope (lists with the lines between them), and the matched table. All take the lists already cut to the top `n`. */
export interface ViewProps { a: Placed[]; b: Placed[]; pairs: Pair[]; n: number; names: { a: string; b: string }; heads: { a: string; b: string }; labs: Map<string, string> }

const ROW = 38;
const pairOf = (pairs: Pair[]) => new Map(pairs.map((p) => [p.modelId, p]));

/** Where a model sits on the other side when it is off this top list: its rank, or a dash when the other side does not rank it. */
const there = (p: Placed | undefined) => (p ? `#${p.rank}` : "–");

/** Two top lists with a line from each model to its place on the other list. A model outside the other's top `n` keeps a short stub and its rank there. */
export function SlopeView({ a, b, pairs, n, names, heads, lines: showLines = true }: ViewProps & { lines?: boolean }) {
  const [focus, setFocus] = useState<string | null>(null);
  const by = pairOf(pairs);
  const rowsA = a.slice(0, n), rowsB = b.slice(0, n), h = Math.max(rowsA.length, rowsB.length) * ROW;
  const y = (i: number) => i * ROW + ROW / 2;
  const posB = new Map(rowsB.map((p, i) => [p.modelId, i])), posA = new Map(rowsA.map((p, i) => [p.modelId, i]));
  const lines = [
    ...rowsA.map((p, i) => ({ id: p.modelId, y1: y(i), y2: posB.has(p.modelId) ? y(posB.get(p.modelId)!) : null, side: "a" as const })),
    ...rowsB.filter((p) => !posA.has(p.modelId)).map((p) => ({ id: p.modelId, y1: null, y2: y(posB.get(p.modelId)!), side: "b" as const })),
  ];
  const state = (id: string) => (focus == null ? "" : focus === id ? "on" : "off");
  return <div className="cmp-slope" data-lines={showLines || undefined} data-focus={focus ?? undefined} onMouseLeave={() => setFocus(null)}>
    <div className="cmp-col-head cmp-a"><i aria-hidden="true" />{heads.a}</div>
    <div />
    <div className="cmp-col-head cmp-b"><i aria-hidden="true" />{heads.b}</div>
    <ol className="cmp-list cmp-list-a" style={{ height: h }}>
      {rowsA.map((p) => { const q = by.get(p.modelId)?.b; return <li key={p.modelId} className="cmp-row" data-shared={posB.has(p.modelId) || undefined} data-state={state(p.modelId)} onMouseEnter={() => setFocus(p.modelId)} onFocus={() => setFocus(p.modelId)} tabIndex={0} title={`${p.name}: #${p.rank} for ${names.a} (${p.score.toFixed(1)}), ${q ? `#${q.rank} (${q.score.toFixed(1)})` : "not ranked"} for ${names.b}`}>
        <span className="cmp-name">{p.name}</span><span className="num cmp-rank">{p.rank}</span>
      </li>; })}
    </ol>
    <div className="cmp-mid" style={{ height: h }}>
      {showLines && <svg className="cmp-lines" viewBox={`0 0 100 ${h}`} preserveAspectRatio="none" aria-hidden="true">
        {lines.map((l) => {
          const move = l.y1 != null && l.y2 != null && Math.abs(l.y1 - l.y2) >= ROW * 3;
          const d = l.y1 != null && l.y2 != null ? `M0 ${l.y1} C50 ${l.y1} 50 ${l.y2} 100 ${l.y2}` : l.y1 != null ? `M0 ${l.y1} H30` : `M100 ${l.y2} H70`;
          return <path key={l.side + l.id} d={d} className="cmp-line" data-state={state(l.id)} data-move={move || undefined} data-stub={l.y1 == null || l.y2 == null || undefined} />;
        })}
      </svg>}
      {showLines && lines.filter((l) => l.y1 == null || l.y2 == null).map((l) => { const q = by.get(l.id)?.[l.side === "a" ? "b" : "a"]; return <span key={l.side + l.id} className="cap cmp-stub" data-side={l.side} data-state={state(l.id)} style={{ top: (l.y1 ?? l.y2)! }} title={q ? `#${q.rank} on the other list` : "Not ranked on the other list"}>{there(q)}</span>; })}
    </div>
    <ol className="cmp-list cmp-list-b" style={{ height: h }}>
      {rowsB.map((p) => { const q = by.get(p.modelId)?.a; const d = q ? q.rank - p.rank : 0; return <li key={p.modelId} className="cmp-row" data-shared={posA.has(p.modelId) || undefined} data-state={state(p.modelId)} onMouseEnter={() => setFocus(p.modelId)} onFocus={() => setFocus(p.modelId)} tabIndex={0} title={`${p.name}: #${p.rank} for ${names.b} (${p.score.toFixed(1)}), ${q ? `#${q.rank} (${q.score.toFixed(1)})` : "not ranked"} for ${names.a}`}>
        <span className="num cmp-rank">{p.rank}</span><span className="cmp-name">{p.name}</span>
        {posA.has(p.modelId) && d !== 0 ? <span className="cap cmp-delta" data-up={d > 0 || undefined}>{d > 0 ? "↑" : "↓"}{Math.abs(d)}</span> : null}
      </li>; })}
    </ol>
  </div>;
}

const initial = (name: string) => name.trim().charAt(0).toUpperCase();

/** One list, every model once, A's order: its rank on each side and the gap between them. Dense, so it is what a phone gets. */
export function TableView({ a, b, pairs, n, names, heads, labs }: ViewProps) {
  const labColor = useLabColor();
  const top = new Set([...a.slice(0, n), ...b.slice(0, n)].map((p) => p.modelId));
  const rows = pairs.filter((p) => top.has(p.modelId));
  rows.sort((x, y) => (x.a?.rank ?? 1e3) - (y.a?.rank ?? 1e3) || (x.b?.rank ?? 1e3) - (y.b?.rank ?? 1e3));
  const span = Math.max(4, ...rows.map((p) => Math.abs(p.shift ?? 0)));
  return <table className="cmp-table">
    <thead><tr><th scope="col" className="cmp-a" title={heads.a}><span className="cmp-th-full">{names.a}</span><span className="cmp-th-init" aria-hidden="true">{initial(names.a)}</span></th><th scope="col">Model</th><th scope="col" className="cmp-b" title={heads.b}><span className="cmp-th-full">{names.b}</span><span className="cmp-th-init" aria-hidden="true">{initial(names.b)}</span></th><th scope="col" className="cmp-gap-head">Gap</th></tr></thead>
    <tbody>{rows.map((p) => <tr key={p.modelId}>
      <td className="num">{p.a ? p.a.rank : "–"}</td>
      <td><i className="cmp-dot" style={{ background: labColor(p.labId, labs.get(p.labId)) }} aria-hidden="true" />{p.name}</td>
      <td className="num">{p.b ? p.b.rank : "–"}</td>
      <td className="cmp-gap">{p.shift != null && p.shift !== 0 ? <span className="cmp-bar" data-up={p.shift < 0 || undefined} style={{ width: `${(Math.abs(p.shift) / span) * 100}%` }} title={`${Math.abs(p.shift)} places ${p.shift < 0 ? "higher" : "lower"} for ${names.b}`} /> : null}</td>
    </tr>)}</tbody>
    <tfoot><tr><td colSpan={4} className="cap cmp-caption">Gap: places apart. Blue means higher for {names.b}.</td></tr></tfoot>
  </table>;
}

/** Every model in either top list on one rank axis: a dot for each side and the line between them, the biggest splits first. */
export function GapsView({ a, b, pairs, n, names }: ViewProps) {
  const top = new Set([...a.slice(0, n), ...b.slice(0, n)].map((p) => p.modelId));
  const rows = pairs.filter((p) => top.has(p.modelId));
  rows.sort((x, y) => (y.shift != null ? Math.abs(y.shift) : -1) - (x.shift != null ? Math.abs(x.shift) : -1) || Math.min(x.a?.rank ?? 1e3, x.b?.rank ?? 1e3) - Math.min(y.a?.rank ?? 1e3, y.b?.rank ?? 1e3));
  const max = Math.max(n, ...rows.flatMap((p) => [p.a?.rank ?? 0, p.b?.rank ?? 0]).filter((r) => r <= n * 2));
  const x = (r: number) => `${((Math.min(r, max) - 1) / (max - 1 || 1)) * 100}%`;
  return <div className="cmp-gaps">
    <div className="cmp-gaps-axis cap"><span>#1</span><span>rank</span><span>#{max}</span></div>
    {rows.map((p) => <div key={p.modelId} className="cmp-gaps-row">
      <span className="cmp-name">{p.name}</span>
      <div className="cmp-track">
        {p.a && p.b && <i className="cmp-span" style={{ left: x(Math.min(p.a.rank, p.b.rank)), width: `calc(${x(Math.max(p.a.rank, p.b.rank))} - ${x(Math.min(p.a.rank, p.b.rank))})` }} />}
        {p.a && <b className="cmp-pt cmp-a" style={{ left: x(p.a.rank) }} title={`${names.a}: #${p.a.rank}`} />}
        {p.b && <b className="cmp-pt cmp-b" style={{ left: x(p.b.rank) }} title={`${names.b}: #${p.b.rank}`} />}
      </div>
      <span className="num cap cmp-gaps-end">{p.a ? p.a.rank : "–"} · {p.b ? p.b.rank : "–"}</span>
    </div>)}
  </div>;
}

/** The top three of each side as podium columns facing each other, then the rest of each top list underneath. */
export function PodiumView({ a, b, pairs, n, names, heads, labs }: ViewProps) {
  const labColor = useLabColor();
  const by = pairOf(pairs);
  const col = (list: Placed[], side: "a" | "b") => {
    const lead = list[0]?.score || 1, low = list[Math.min(2, list.length - 1)]?.score ?? lead, floor = lead - Math.max(8, (lead - low) * 2);
    return <div className="cmp-pod" data-side={side}>
      <div className="cmp-pod-cols">{list.slice(0, 3).map((p) => { const q = by.get(p.modelId)?.[side === "a" ? "b" : "a"]; return <div key={p.modelId} className="cmp-pod-col">
        <span className="num cmp-pod-score">{p.score.toFixed(1)}</span>
        <div className="cmp-pod-bar"><b style={{ height: `${Math.max(14, ((p.score - floor) / (lead - floor || 1)) * 100)}%`, background: labColor(p.labId, labs.get(p.labId)) }} /></div>
        <span className="cmp-name" title={p.name}><span className="cap">{p.rank}</span> {p.name}</span>
        <span className="cap cmp-pod-there">{q ? `#${q.rank} ${side === "a" ? names.b : names.a}` : "not ranked there"}</span>
      </div>; })}</div>
      <ol className="cmp-pod-rest" start={4}>{list.slice(3, n).map((p) => { const q = by.get(p.modelId)?.[side === "a" ? "b" : "a"]; return <li key={p.modelId}><span className="num cap">{p.rank}</span><span className="cmp-name">{p.name}</span><span className="cap">{q ? `#${q.rank}` : "–"}</span></li>; })}</ol>
    </div>;
  };
  return <div className="cmp-podium"><div className="cmp-col-head cmp-a"><i aria-hidden="true" />{heads.a}</div><div className="cmp-col-head cmp-b"><i aria-hidden="true" />{heads.b}</div>{col(a, "a")}{col(b, "b")}</div>;
}
