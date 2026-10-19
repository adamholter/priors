"use client";
import { useState } from "react";
import { mixLead, type MixRow } from "@/lib/compare";

/** Why two rankings differ is their benchmark weights. Three ways to draw them, each led by the same plain sentence. */
export type MixStyle = "grouped" | "pull" | "stacked";
interface MixProps { rows: MixRow[]; names: { a: string; b: string }; style?: MixStyle }

const pct = (v: number) => `${Math.round(v)}%`;
const LIMIT = 6;

export function MixView({ rows, names, style = "grouped" }: MixProps) {
  return <section className="cmp-mix" aria-label="Why the rankings differ">
    <h3 className="cmp-h3">Why they differ</h3>
    <p className="cmp-mix-lead">{mixLead(rows, names)}</p>
    {style === "pull" ? <Pull rows={rows} names={names} /> : style === "stacked" ? <Stacked rows={rows} names={names} /> : <Grouped rows={rows} names={names} />}
  </section>;
}

function Legend({ names }: { names: { a: string; b: string } }) {
  return <p className="cmp-legend cap"><span className="cmp-a"><i aria-hidden="true" />{names.a}</span><span className="cmp-b"><i aria-hidden="true" />{names.b}</span></p>;
}

function Bar({ tone, value, max }: { tone: "a" | "b"; value: number; max: number }) {
  return <span className={`cmp-hbar cmp-${tone}`}><b style={{ width: `${(value / max) * 88}%` }} /><span className="num cap">{pct(value)}</span></span>;
}

/** Benchmarks by who counts them: one side only, or both. Only the last group needs two bars. */
function Grouped({ rows, names }: Omit<MixProps, "style">) {
  const [all, setAll] = useState(false);
  const max = Math.max(10, ...rows.map((r) => Math.max(r.a, r.b)));
  const byShare = (k: "a" | "b") => (x: MixRow, y: MixRow) => y[k] - x[k];
  const onlyA = rows.filter((r) => r.a > 0 && r.b === 0).sort(byShare("a"));
  const onlyB = rows.filter((r) => r.b > 0 && r.a === 0).sort(byShare("b"));
  const both = rows.filter((r) => r.a > 0 && r.b > 0);
  const shownBoth = all ? both : both.slice(0, LIMIT);
  return <div className="cmp-groups">
    <Legend names={names} />
    {both.length > 0 && <div className="cmp-group"><h4 className="cap">On both lists, weighted differently</h4>
      <ul className="cmp-glist">{shownBoth.map((r) => <li key={r.id} className="cmp-grow"><span className="cmp-gname" title={r.name}>{r.name}</span><span className="cmp-gbars"><Bar tone="a" value={r.a} max={max} /><Bar tone="b" value={r.b} max={max} /></span></li>)}</ul>
      {both.length > LIMIT && <button type="button" className="cmp-more" onClick={() => setAll((v) => !v)}>{all ? "Show fewer" : `Show all ${both.length}`}</button>}
    </div>}
    {([["a", onlyA], ["b", onlyB]] as const).filter(([, l]) => l.length > 0).map(([k, l]) => <div key={k} className="cmp-group"><h4 className="cap">Only {names[k]} counts</h4>
      <ul className="cmp-glist">{l.map((r) => <li key={r.id} className="cmp-grow"><span className="cmp-gname" title={r.name}>{r.name}</span><span className="cmp-gbars"><Bar tone={k} value={r[k]} max={max} /></span></li>)}</ul>
    </div>)}
  </div>;
}

/** One bar per benchmark, pulled toward whichever side weighs it more by the amount of the difference. */
function Pull({ rows, names }: Omit<MixProps, "style">) {
  const [all, setAll] = useState(false);
  const diff = rows.map((r) => ({ ...r, d: r.b - r.a })).sort((x, y) => Math.abs(y.d) - Math.abs(x.d));
  const apart = diff.filter((r) => Math.abs(r.d) >= 1), same = diff.filter((r) => Math.abs(r.d) < 1);
  const shown = all ? apart : apart.slice(0, LIMIT + 2);
  const max = Math.max(10, ...apart.map((r) => Math.abs(r.d)));
  return <div className="cmp-pull">
    <p className="cmp-pull-axis cap"><span className="cmp-a">◀ {names.a} counts it more</span><span className="cmp-b">{names.b} counts it more ▶</span></p>
    <ul className="cmp-glist">{shown.map((r) => <li key={r.id} className="cmp-prow">
      <span className="cmp-gname" title={`${r.name}: ${pct(r.a)} for ${names.a}, ${pct(r.b)} for ${names.b}`}>{r.name}</span>
      <span className="cmp-ptrack"><span className="cmp-pl">{r.d < 0 && <><span className="num cap">{Math.abs(Math.round(r.d))}</span><b className="cmp-a" style={{ width: `${(Math.abs(r.d) / max) * 100}%` }} /></>}</span><span className="cmp-pr">{r.d > 0 && <><b className="cmp-b" style={{ width: `${(r.d / max) * 100}%` }} /><span className="num cap">{Math.round(r.d)}</span></>}</span></span>
    </li>)}</ul>
    {apart.length > LIMIT + 2 && <button type="button" className="cmp-more" onClick={() => setAll((v) => !v)}>{all ? "Show fewer" : `Show all ${apart.length}`}</button>}
    {same.length > 0 && <p className="cap cmp-same">Weighted the same: {same.map((r) => r.name).join(", ")}.</p>}
    <p className="cap cmp-same">Numbers are points of weight apart.</p>
  </div>;
}

/** Each ranking's whole mix as one bar cut into its benchmarks, biggest first. */
function Stacked({ rows, names }: Omit<MixProps, "style">) {
  const bar = (k: "a" | "b") => {
    const r = rows.filter((x) => x[k] > 0).sort((x, y) => y[k] - x[k]);
    return <div className={`cmp-stack cmp-${k}`} role="img" aria-label={`${names[k]}: ${r.map((x) => `${x.name} ${pct(x[k])}`).join(", ")}`}>
      {r.map((x, i) => <span key={x.id} className="cmp-seg-block" style={{ flexGrow: x[k], opacity: Math.max(0.28, 1 - i * 0.14) }} title={`${x.name}: ${pct(x[k])}`}><span>{x[k] >= 12 ? x.name : ""}</span></span>)}
    </div>;
  };
  return <div className="cmp-stacked">
    <p className="cmp-stack-name cmp-a"><i aria-hidden="true" />{names.a}</p>{bar("a")}
    <p className="cmp-stack-name cmp-b"><i aria-hidden="true" />{names.b}</p>{bar("b")}
    <p className="cap cmp-same">Each bar is a ranking&apos;s whole mix. Hover a block for its benchmark.</p>
  </div>;
}
