"use client";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useMyRankings } from "../my-rankings";
import { HeaderAccount } from "../AccountMenu";
import { SiteFooter } from "../SiteFooter";
import { SiteNav } from "../SiteNav";
import { SettingsButton } from "../SiteSettings";
import { Wordmark } from "../Wordmark";
import type { Snapshot } from "@/data/types";
import { PRESET_IDS } from "@/lib/compare-ref";
import { Compare, compareHref, TOPS } from "./Compare";
import { choiceFromIndex, choiceFromPage, choiceFromPreset, type Choice, type Published } from "./choice";
import { loadPage } from "./load-page";
import type { Sources } from "./SidePicker";

/** `/compare`: loads the benchmark data and the visitor's own rankings, then hands them to the view. */
export function CompareApp({ initialA, initialB, wantMine, top: top0, same: same0, published }: { initialA?: Choice; initialB?: Choice; wantMine: boolean; top: number; same: boolean; published: Published[] }) {
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  const { probe, handle, page, builder, builderReady } = useMyRankings();
  const [pickA, setA] = useState(initialA), [pickB, setB] = useState(initialB);
  const [top, setTop] = useState(top0), [same, setSame] = useState(same0);
  useEffect(() => {
    const c = new AbortController();
    fetch("/api/snapshot?view=core", { signal: c.signal }).then(async (r) => { if (!r.ok) throw new Error("Could not load benchmark data."); return (await r.json()).snapshot as Snapshot; })
      .then((s) => { if (!c.signal.aborted) setSnapshot(s); }).catch((e) => { if (!c.signal.aborted) setError(e instanceof Error ? e.message : "Could not load benchmark data."); });
    return () => c.abort();
  }, [retry]);
  // The left side nobody chose is the visitor's own ranking: their page, else the first index in their builder, else (with a note) the standard one.
  const mineReady = wantMine && handle !== undefined && builderReady && (!handle || page !== undefined);
  const mine = useMemo(() => (page ? choiceFromPage(page, undefined, true) : builder[0] ? choiceFromIndex(builder[0], { title: "You", short: "you", mine: true }) : undefined), [page, builder]);
  const noRanking = mineReady && !mine && !pickA;
  const a = pickA ?? (mineReady ? mine ?? (snapshot ? choiceFromPreset(snapshot, "aa") : undefined) : undefined), b = pickB;
  const sources = useMemo<Sources>(() => ({
    page: page ?? undefined, builder, published, loadPage,
    presets: snapshot ? PRESET_IDS.map((id) => choiceFromPreset(snapshot, id)).filter((c): c is Choice => !!c) : [],
  }), [page, builder, published, snapshot]);
  useEffect(() => {
    if (wantMine && !pickA && !mineReady) return;
    history.replaceState(null, "", compareHref(a, b, { top, same }));
  }, [a, b, top, same, wantMine, pickA, mineReady]);
  const swap = useCallback(() => { setA(b); setB(a); }, [a, b]);
  const labs = useMemo(() => new Map((snapshot?.labs ?? []).map((l) => [l.id, l.color])), [snapshot]);
  return <main className="min-h-dvh">
    {probe}
    <header className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 sm:px-8 py-2 sm:h-14 border-b hairline">
      <div className="flex items-center gap-5"><Wordmark /><span className="max-sm:hidden"><SiteNav /></span></div>
      <span className="ml-auto flex items-center gap-2"><HeaderAccount /><SettingsButton /></span>
      <span className="sm:hidden w-full"><SiteNav /></span>
    </header>
    <div className="max-w-[1100px] mx-auto px-4 sm:px-8 py-10">
      <h1 className="text-[36px] leading-tight mb-6">Compare</h1>
      {snapshot && noRanking && <p className="cmp-fallback">You have no ranking yet, so the left side is Artificial Analysis. <Link href="/rank">Rank models · 1 min</Link> to compare yours.</p>}
      {snapshot ? <Compare snapshot={snapshot} a={a} b={b} onA={setA} onB={setB} sources={sources} top={top} onTop={setTop} same={same} onSame={setSame} onSwap={swap} labs={labs} />
        : <div role="status" aria-busy={!error} className="grid gap-4"><div className="load-bar h-16 w-full" /><div className="load-bar h-64 w-full" />
          <p className="text-[12px] text-grey">{error ? <>{error} <button type="button" className="underline" onClick={() => { setError(""); setRetry((n) => n + 1); }}>Retry</button></> : "Loading benchmark data…"}</p></div>}
    </div>
    <SiteFooter />
  </main>;
}
export { TOPS };
