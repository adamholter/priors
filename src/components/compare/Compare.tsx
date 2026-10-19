"use client";
import Link from "next/link";
import { useMemo, useState } from "react";
import type { Snapshot } from "@/data/types";
import { biggestGaps, mixOverlap, mixRows, pairUp, rankCorrelation, topOverlap, type Pair } from "@/lib/compare";
import { compareUrl } from "@/lib/compare-ref";
import { prettyQuery, encodeIndex } from "@/lib/url";
import { track } from "@/lib/analytics";
import { rankSide, type Choice } from "./choice";
import { SidePicker, Strip, type Sources } from "./SidePicker";
import { SlopeView, TableView, type ViewProps } from "./views";
import { MixView, type MixStyle } from "./mix-views";
import "./compare.css";

export type SummaryStyle = "sentence" | "scoreboard" | "minimal";
export type PickerStyle = "popover" | "strip" | "sheet";
export const TOPS = [5, 10, 20] as const;

/** The address that reopens this comparison. */
export const compareHref = (a?: Choice, b?: Choice, opts: { top?: number; same?: boolean } = {}) => compareUrl(a?.ref, b?.ref, opts);

export function Compare({ snapshot, a, b, onA, onB, sources, top, onTop, same, onSame, summary = "sentence", picker = "popover", mixStyle = "grouped", onSwap, labs }: {
  snapshot: Snapshot; a?: Choice; b?: Choice; onA: (c: Choice) => void; onB: (c: Choice) => void; sources: Sources;
  top: number; onTop: (n: number) => void; same: boolean; onSame: (v: boolean) => void; summary?: SummaryStyle; picker?: PickerStyle; mixStyle?: MixStyle; onSwap: () => void; labs: Map<string, string>;
}) {
  const [target, setTarget] = useState<"a" | "b">("b");
  const sa = useMemo(() => (a ? rankSide(snapshot, a) : undefined), [snapshot, a]);
  const sb = useMemo(() => (b ? rankSide(snapshot, b) : undefined), [snapshot, b]);
  const both = sa && sb;
  const paired = useMemo(() => (both ? pairUp(sa.placed, sb.placed, same) : undefined), [both, sa, sb, same]);
  const names = { a: a?.short ?? "", b: b?.short ?? "" }, heads = { a: a?.title ?? "", b: b?.title ?? "" };
  const mix = useMemo(() => (both ? mixRows(sa.result.benchmarks, sb.result.benchmarks) : []), [both, sa, sb]);
  const view: ViewProps | undefined = paired ? { a: paired.a, b: paired.b, pairs: paired.pairs, n: top, names, heads, labs } : undefined;
  const nTop = view ? Math.min(top, Math.max(view.a.length, view.b.length)) : top;
  return <div className="cmp">
    <div className="cmp-sides">
      <SidePicker tone="a" label="First ranking" value={a} sources={sources} onPick={onA} style={picker} active={picker === "strip" && target === "a"} onTarget={() => setTarget("a")} />
      <button type="button" className="cmp-swap" onClick={onSwap} aria-label="Swap the two rankings" title="Swap sides" disabled={!a && !b}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M7 4 3 8l4 4M3 8h14M17 20l4-4-4-4M21 16H7" /></svg>
      </button>
      <SidePicker tone="b" label="Second ranking" value={b} sources={sources} onPick={onB} style={picker} active={picker === "strip" && target === "b"} onTarget={() => setTarget("b")} />
    </div>
    {picker === "strip" && <Strip tone={target} sources={sources} value={target === "a" ? a : b} onPick={target === "a" ? onA : onB} />}
    {!both || !paired || !view ? <Empty a={a} b={b} /> : <>
      <Summary style={summary} a={sa.placed} b={sb.placed} pairs={paired.pairs} names={names} mix={mixOverlap(mix)} n={nTop} />
      <div className="cmp-controls">
        <div className="cmp-seg" role="group" aria-label="How many models">{TOPS.map((n) => <button key={n} type="button" aria-pressed={top === n} onClick={() => onTop(n)}>Top {n}</button>)}</div>
        <label className="cmp-check"><input type="checkbox" className="accent-indigo" checked={same} onChange={(e) => onSame(e.target.checked)} />Same models only</label>
      </div>
      <section className="cmp-view" aria-label="Rankings side by side">
        <div className="cmp-wide"><SlopeView {...view} /></div>
        <div className="cmp-narrow"><TableView {...view} /></div>
      </section>
      <MixView key={`${a?.title}|${a?.sub}|${b?.title}|${b?.sub}`} rows={mix} names={heads} style={mixStyle} />
      <Actions a={a as Choice} b={b as Choice} />
    </>}
  </div>;
}

function Empty({ a, b }: { a?: Choice; b?: Choice }) {
  const missing = !a && !b ? "two rankings" : "a second ranking";
  return <div className="cmp-empty"><p>Choose {missing} to see them side by side.</p>{!a && <Link href="/rank" className="btn">Rank models to make yours · 1 min</Link>}</div>;
}

/** What to say first: how much the lists agree, then the two models they split on. */
function Summary({ style, a, b, pairs, names, mix, n }: { style: SummaryStyle; a: ViewProps["a"]; b: ViewProps["b"]; pairs: Pair[]; names: { a: string; b: string }; mix: number; n: number }) {
  const { shared, n: m } = topOverlap(a, b, n);
  const { rho, common } = rankCorrelation(a, b);
  const gaps = biggestGaps(pairs, 2, 3, n);
  const lead = m === 0 ? "Nothing to compare yet." : shared.length === m ? `The top ${m} are the same on both lists.` : shared.length === 0 ? `No model is in both top ${m} lists.` : `${shared.length} of the top ${m} are on both lists.`;
  const strength = rho == null ? "" : rho >= 0.9 ? "very close" : rho >= 0.7 ? "close" : rho >= 0.4 ? "partly alike" : rho >= 0 ? "loosely related" : "close to opposite";
  const gapLine = gaps.length > 0 && <p className="cmp-gaps-line">{gaps.map((p, i) => <span key={p.modelId}>{i > 0 && " "}<b>{p.name}</b> is #{p.a!.rank} for {names.a} and #{p.b!.rank} for {names.b}.</span>)}</p>;
  if (style === "scoreboard") return <section className="cmp-summary cmp-score" aria-live="polite">
    <dl className="cmp-tiles">
      <div><dd className="num">{shared.length}<small>/{m}</small></dd><dt>in both top {m}</dt></div>
      <div><dd className="num">{rho == null ? "–" : rho.toFixed(2)}</dd><dt>order agreement{strength ? `, ${strength}` : ""}</dt></div>
      <div><dd className="num">{mix}<small>%</small></dd><dt>benchmark overlap</dt></div>
    </dl>
    {gapLine}
  </section>;
  if (style === "minimal") return <section className="cmp-summary" aria-live="polite"><p className="cmp-gaps-line"><b>{lead}</b>{gaps.length > 0 && <> Biggest split: {gaps[0].name}, #{gaps[0].a!.rank} against #{gaps[0].b!.rank}.</>}</p></section>;
  return <section className="cmp-summary" aria-live="polite">
    <h2 className="cmp-lead">{lead}</h2>
    {gapLine}
    <dl className="cmp-stats">
      <div><dt className="cap">In both top {m}</dt><dd className="num">{shared.length} of {m}</dd></div>
      <div><dt className="cap">Order agreement</dt><dd className="num">{rho == null ? "–" : rho.toFixed(2)}{strength && <span className="cap"> {strength}, {common} models</span>}</dd></div>
      <div><dt className="cap">Benchmark overlap</dt><dd className="num">{mix}%</dd></div>
    </dl>
  </section>;
}

function Actions({ a, b }: { a: Choice; b: Choice }) {
  const [copied, setCopied] = useState(false);
  const remix = (c: Choice) => `/builder?${prettyQuery(new URLSearchParams([["i", encodeIndex({ ...c.config, name: c.handle && !c.mine ? `From @${c.handle}` : c.config.name })]]))}`;
  const copy = async () => { try { await navigator.clipboard.writeText(location.href); setCopied(true); setTimeout(() => setCopied(false), 1600); track("compare_link_copied", {}); } catch { /* clipboard blocked */ } };
  return <div className="cmp-actions">
    <button type="button" className="btn" onClick={copy}>{copied ? "Link copied" : "Copy link"}</button>
    {[a, b].filter((c) => !c.mine).map((c) => <Link key={c.title + c.sub} href={remix(c) as "/builder"} className="btn-quiet" onClick={() => track("remix_clicked", { from: "compare", handle: c.handle ?? "" })}>Remix {c.title}</Link>)}
    {[a, b].filter((c) => c.href).map((c) => <Link key={`p${c.title}`} href={c.href as "/"} className="btn-quiet">{c.mine ? "Your page" : `${c.title}'s page`}</Link>)}
  </div>;
}
