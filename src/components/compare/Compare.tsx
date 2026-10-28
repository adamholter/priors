"use client";
import Link from "next/link";
import { useMemo, useState } from "react";
import type { Snapshot } from "@/data/types";
import { biggestGaps, mixRows, pairUp, topOverlap, type Pair } from "@/lib/compare";
import { compareUrl } from "@/lib/compare-ref";
import { prettyQuery, encodeIndex } from "@/lib/url";
import { track } from "@/lib/analytics";
import { rankSide, type Choice } from "./choice";
import { SidePicker, type Sources } from "./SidePicker";
import { SlopeView, TableView, type ViewProps } from "./views";
import { MixView } from "./mix-views";
import "./compare.css";
import { copyLink } from "@/lib/short-link";

export const TOPS = [5, 10, 20] as const;

/** The address that reopens this comparison. */
export const compareHref = (a?: Choice, b?: Choice, opts: { top?: number; same?: boolean } = {}) => compareUrl(a?.ref, b?.ref, opts);

export function Compare({ snapshot, a, b, onA, onB, sources, top, onTop, same, onSame, onSwap, labs }: {
  snapshot: Snapshot; a?: Choice; b?: Choice; onA: (c: Choice) => void; onB: (c: Choice) => void; sources: Sources;
  top: number; onTop: (n: number) => void; same: boolean; onSame: (v: boolean) => void; onSwap: () => void; labs: Map<string, string>;
}) {
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
      <SidePicker tone="a" label="First ranking" value={a} sources={sources} onPick={onA} />
      <button type="button" className="cmp-swap" onClick={onSwap} aria-label="Swap the two rankings" title="Swap sides" disabled={!a && !b}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M7 4 3 8l4 4M3 8h14M17 20l4-4-4-4M21 16H7" /></svg>
      </button>
      <SidePicker tone="b" label="Second ranking" value={b} sources={sources} onPick={onB} />
    </div>
    {!both || !paired || !view ? <Empty a={a} b={b} /> : <>
      <Summary a={sa.placed} b={sb.placed} pairs={paired.pairs} n={nTop} />
      <div className="cmp-controls">
        <div className="cmp-seg" role="group" aria-label="How many models">{TOPS.map((n) => <button key={n} type="button" aria-pressed={top === n} onClick={() => onTop(n)}>Top {n}</button>)}</div>
        <label className="cmp-check"><input type="checkbox" className="accent-indigo" checked={same} onChange={(e) => onSame(e.target.checked)} />Same models only</label>
      </div>
      <section className="cmp-view" aria-label="Rankings side by side">
        <div className="cmp-wide"><SlopeView {...view} /></div>
        <div className="cmp-narrow"><TableView {...view} /></div>
      </section>
      <MixView key={`${a?.title}|${a?.sub}|${b?.title}|${b?.sub}`} rows={mix} names={heads} />
      <Actions a={a as Choice} b={b as Choice} />
    </>}
  </div>;
}

function Empty({ a, b }: { a?: Choice; b?: Choice }) {
  const missing = !a && !b ? "two rankings" : "a second ranking";
  return <div className="cmp-empty"><p>Choose {missing} to see them side by side.</p>{!a && <Link href="/rank" className="btn">Rank models to make yours · 1 min</Link>}</div>;
}

/** What to say first, in one line: how much the top lists agree and the model they split on most. */
function Summary({ a, b, pairs, n }: { a: ViewProps["a"]; b: ViewProps["b"]; pairs: Pair[]; n: number }) {
  const { shared, n: m } = topOverlap(a, b, n);
  const gap = biggestGaps(pairs, 1, 3, n)[0];
  const lead = m === 0 ? "Nothing to compare yet." : shared.length === m ? `The top ${m} are the same on both lists.` : shared.length === 0 ? `No model is in both top ${m} lists.` : `${shared.length} of the top ${m} are on both lists.`;
  return <section className="cmp-summary" aria-live="polite"><p className="cmp-gaps-line"><b>{lead}</b>{gap && <> Biggest split: {gap.name}, #{gap.a!.rank} against #{gap.b!.rank}.</>}</p></section>;
}

function Actions({ a, b }: { a: Choice; b: Choice }) {
  const [copied, setCopied] = useState(false);
  const remix = (c: Choice) => `/builder?${prettyQuery(new URLSearchParams([["i", encodeIndex({ ...c.config, name: c.handle && !c.mine ? `From @${c.handle}` : c.config.name })]]))}`;
  const copy = async () => { try { await copyLink(location.href); setCopied(true); setTimeout(() => setCopied(false), 1600); track("compare_link_copied", {}); } catch { /* clipboard blocked */ } };
  return <div className="cmp-actions">
    <button type="button" className="btn" onClick={copy}>{copied ? "Link copied" : "Copy link"}</button>
    {[a, b].filter((c) => !c.mine).map((c) => <Link key={c.title + c.sub} href={remix(c) as "/builder"} className="btn-quiet" onClick={() => track("remix_clicked", { from: "compare", handle: c.handle ?? "" })}>Remix {c.title}</Link>)}
    {[a, b].filter((c) => c.href).map((c) => <Link key={`p${c.title}`} href={c.href as "/"} className="btn-quiet">{c.mine ? "Your page" : `${c.title}'s page`}</Link>)}
  </div>;
}
