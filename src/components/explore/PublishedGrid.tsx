"use client";
import { useRouter } from "next/navigation";
import { useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import { IconCheck, IconSearch } from "@tabler/icons-react";
import { leaving } from "@/components/nav-progress";
import type { ExploreCardData } from "@/lib/explore-cards";
import { arrange, EXPLORE_LIMIT, EXPLORE_SORTS, hiddenMatches, isExploreSort, plural, prepare, type ExploreSort } from "@/lib/explore-find";
import { ExploreCard } from "./ExploreCard";

const PAGE = 48;
/** Fewer pages than this need no search or sort. */
const TOOLBAR_FROM = 6;

/** View state the address carries (`?q=coding&sort=newest&all=1`), read on the server so the first paint matches. */
export interface GridParams { q?: string; sort?: string; all?: string }

/**
 * Every published page: search, sort and a switch that hides unchanged copies of the default index over one grid.
 * Pages that rank nothing come last. The view mirrors itself into the address so a link keeps it.
 */
export function PublishedGrid({ cards, initial, failed, capped }: { cards: ExploreCardData[]; initial?: GridParams; failed?: boolean; capped?: boolean }) {
  const [q, setQ] = useState(initial?.q ?? "");
  const [sort, setSort] = useState<ExploreSort>(isExploreSort(initial?.sort) ? initial.sort : "updated");
  const [all, setAll] = useState(initial?.all === "1");
  const input = useRef<HTMLInputElement>(null);
  const items = useMemo(() => prepare(cards), [cards]);
  // Typing stays instant; the grid catches up between keystrokes.
  const dq = useDeferredValue(q);
  const copies = useMemo(() => items.reduce((n, x) => n + (x.card.kind !== "custom" ? 1 : 0), 0), [items]);
  const custom = copies > 0 && copies < items.length && !all;
  const searching = dq.trim() !== "";
  const rows = useMemo(() => arrange(items, { q: dq, sort, custom }), [items, dq, sort, custom]);
  const hidden = useMemo(() => (custom && searching ? hiddenMatches(items, dq) : 0), [items, dq, custom, searching]);
  const sig = `${dq}|${sort}|${custom}`;
  const [paged, setPaged] = useState({ sig, n: PAGE });
  const shown = paged.sig === sig ? paged.n : PAGE;
  const bar = items.length >= TOOLBAR_FROM;

  // The address follows the view, off the click path and never while a link is being followed.
  useEffect(() => {
    const t = window.setTimeout(() => {
      if (leaving()) return;
      try {
        const u = new URL(window.location.href);
        for (const [k, v] of [["q", q.trim() ? q : ""], ["sort", sort === "updated" ? "" : sort], ["all", all ? "1" : ""]]) { if (v) u.searchParams.set(k, v); else u.searchParams.delete(k); }
        if (u.href !== window.location.href) window.history.replaceState(window.history.state, "", u);
      } catch { /* an address that cannot be written is not worth a crash */ }
    }, 250);
    return () => window.clearTimeout(t);
  }, [q, sort, all]);

  // "/" jumps to the search field from anywhere on the page.
  useEffect(() => {
    if (!bar) return;
    const on = (e: KeyboardEvent) => { if (e.key === "/" && !e.metaKey && !e.ctrlKey && !(e.target as HTMLElement | null)?.closest("input,textarea,select,[contenteditable]")) { e.preventDefault(); input.current?.focus(); } };
    window.addEventListener("keydown", on);
    return () => window.removeEventListener("keydown", on);
  }, [bar]);

  if (failed) return <Failed />;
  if (!cards.length) return <p className="cap py-16 text-center">No published pages yet. Build an index and claim your page to be the first.</p>;
  return <div>
    {bar && <div className="ex-bar">
      <label className="ex-search" title="Search by handle, name, model or benchmark">
        <IconSearch size={16} stroke={1.5} aria-hidden />
        <input ref={input} type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search pages" aria-label="Search published pages by handle, name, model or benchmark" autoComplete="off" spellCheck={false}
          onKeyDown={(e) => { if (e.key === "Escape") { setQ(""); e.currentTarget.blur(); } }} />
        {!q && <kbd className="cap" aria-hidden="true">/</kbd>}
      </label>
      <select className="ex-select" value={sort} onChange={(e) => setSort(e.target.value as ExploreSort)} aria-label="Sort pages">{EXPLORE_SORTS.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}</select>
      {copies > 0 && copies < items.length && <label className="ex-switch"><input type="checkbox" checked={custom} onChange={(e) => setAll(!e.target.checked)} /><span className={`bench-check${custom ? " on" : ""}`} aria-hidden="true">{custom && <IconCheck size={11} stroke={3} />}</span><span className="ex-sw-long">Custom mixes only</span><span className="ex-sw-short">Custom mixes</span></label>}
      <span className="cap ex-count" role="status">{plural(rows.length, "page")}</span>
    </div>}
    {rows.length ? <ul className="ex-grid">{rows.slice(0, shown).map((r) => <ExploreCard key={r.item.card.handle} c={r.item.card} via={searching ? r.via : undefined} />)}</ul>
      : <div className="ex-none" role="status"><p className="ex-none-t">Nothing for &ldquo;{dq}&rdquo;</p><div className="ex-none-a">
        {hidden > 0 && <button type="button" className="ex-textbtn" onClick={() => setAll(true)}>Include default copies</button>}
        <button type="button" className="ex-textbtn" onClick={() => setQ("")}>Clear</button></div></div>}
    {rows.length > shown && <div className="ex-more-row"><button type="button" className="ex-more" onClick={() => setPaged({ sig, n: shown + PAGE })}>Show {Math.min(rows.length - shown, PAGE).toLocaleString("en-US")} more</button></div>}
    {capped && <p className="cap ex-capnote">Newest {EXPLORE_LIMIT} shown</p>}
  </div>;
}

/** The query failed: say so, instead of claiming nobody has published. */
function Failed() {
  const router = useRouter();
  return <div className="ex-block" role="alert"><p>Couldn&apos;t load pages.</p><button type="button" className="ex-textbtn" onClick={() => router.refresh()}>Retry</button></div>;
}
