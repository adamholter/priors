"use client";
import { memo, useCallback, useDeferredValue, useEffect, useMemo, useRef, useState, type RefObject } from "react";
import { IconHistory, IconLockOpen, IconReceipt, IconStack2 } from "@tabler/icons-react";
import { labsOf, modelView, nextOrder, NO_FILTERS, RANK_ORDER, type Facet, type Filters, type LabInfo, type ModelItem, type ModelSort, type Order } from "@/lib/model-list";
import { Count, DateButton, Empty, IconBtn, LabList, LabMark, SearchField, Sheet, SortButton, useSlash } from "./directory-ui";
import { ModelTable } from "./ModelTable";
import "./models.css";

const NONE: Facet = { ranked: 0, total: 0 };

const RailRow = memo(function RailRow({ l, c, on, onPick }: { l: LabInfo; c: Facet; on: boolean; onPick: (id: string) => void }) {
  return (
    <button type="button" aria-pressed={on} data-dim={c.total === 0 || undefined} onClick={() => onPick(on ? "all" : l.id)}>
      <LabMark l={l} size={18} /><span className="md-trunc">{l.name}</span><Count c={c} />
    </button>
  );
});

/** Labs with a logo and ranked over total, in an order that does not move. Counts follow search and filters; a lab with nothing left dims in place. Labs with no ranked model wait behind "More labs". */
function Rail({ labs, counts, total, value, onPick }: { labs: LabInfo[]; counts: Map<string, Facet>; total: Facet; value: string; onPick: (id: string) => void }) {
  const [more, setMore] = useState(false);
  const main = useMemo(() => labs.filter((l) => l.ranked > 0), [labs]), rest = useMemo(() => labs.filter((l) => l.ranked === 0), [labs]);
  const shown = more || rest.some((l) => l.id === value);
  return (
    <nav className="md-rail" aria-label="Labs">
      <button type="button" aria-pressed={value === "all"} onClick={() => onPick("all")}>
        <IconStack2 size={18} stroke={1.5} aria-hidden /><span>All labs</span><Count c={total} />
      </button>
      {main.map((l) => <RailRow key={l.id} l={l} c={counts.get(l.id) ?? NONE} on={value === l.id} onPick={onPick} />)}
      {rest.length > 0 && <button type="button" className="disclosure md-disc" aria-expanded={shown} onClick={() => setMore((m) => !m)}><span>More labs</span><span className="md-count">{rest.length}</span></button>}
      {shown && rest.map((l) => <RailRow key={l.id} l={l} c={counts.get(l.id) ?? NONE} on={value === l.id} onPick={onPick} />)}
    </nav>
  );
}

/** Restarts a short fade on `el` whenever `key` changes, without remounting the rows under it. */
function useFade(el: RefObject<HTMLElement | null>, key: string) {
  const first = useRef(true);
  useEffect(() => {
    if (first.current) { first.current = false; return; }
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    el.current?.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 160, easing: "ease-out" });
  }, [el, key]);
}

/**
 * Every model Priors has results for, as a leaderboard: ranked by default with a score bar that carries the reasoning-effort ladder, a plain word where a model
 * has no rank, and counts that follow the search. Filtered by lab, open weights and release date, sorted by any column; each row opens the model's own page.
 */
export function ModelDirectory({ items, indexName }: { items: ModelItem[]; indexName: string }) {
  const [f, setF] = useState<Filters>(NO_FILTERS);
  const [order, setOrder] = useState<Order>(RANK_ORDER);
  const [costOn, setCostOn] = useState(false);
  const [sheet, setSheet] = useState(false);
  const input = useRef<HTMLInputElement>(null), list = useRef<HTMLUListElement>(null), body = useRef<HTMLDivElement>(null), labbar = useRef<HTMLButtonElement>(null);
  const patch = useCallback((p: Partial<Filters>) => setF((s) => ({ ...s, ...p })), []);
  const reset = useCallback(() => setF(NO_FILTERS), []);
  const onSort = useCallback((id: ModelSort) => setOrder((o) => nextOrder(o, id)), []);
  const back = useCallback(() => input.current?.focus(), []);
  const closeSheet = useCallback(() => setSheet(false), []);
  const pickLab = useCallback((id: string) => { patch({ lab: id }); setSheet(false); }, [patch]);
  useSlash(input);

  const labs = useMemo(() => labsOf(items), [items]);
  // Typing stays instant; the list catches up a frame later.
  const q = useDeferredValue(f.q);
  const view = useMemo(() => modelView(items, { q, lab: f.lab, open: f.open, since: f.since, tier: f.tier, older: f.older }, order), [items, q, f.lab, f.open, f.since, f.tier, f.older, order]);
  const { rows, counts, total, searching } = view;
  const lab = f.lab === "all" ? undefined : labs.find((l) => l.id === f.lab);
  const showCost = costOn || order.sort === "cost";
  useFade(body, `${f.lab}|${f.tier}|${f.open}|${f.since}|${f.older}|${searching}`);
  const empty = f.tier === "ranked" && !searching && view.allN > 0 ? { text: "No ranked models here", action: `Show all ${view.allN}`, run: () => patch({ tier: "all" }) } : { text: searching ? "No match" : "No models here", action: "Clear", run: reset };
  const labCount = lab ? counts.get(lab.id) ?? NONE : total;

  return (
    <div className="model-dir md-layout">
      <button type="button" ref={labbar} className="md-labbar" onClick={() => setSheet(true)} aria-haspopup="dialog">
        {lab ? <LabMark l={lab} size={22} /> : <IconStack2 size={22} stroke={1.5} aria-hidden />}
        <span className="md-trunc">{lab ? lab.name : "All labs"}</span><Count c={labCount} />
      </button>
      <Sheet open={sheet} onClose={closeSheet} title="Labs" opener={labbar}><LabList labs={labs} counts={counts} total={total} value={f.lab} onPick={pickLab} /></Sheet>
      <Rail labs={labs} counts={counts} total={total} value={f.lab} onPick={pickLab} />
      <div className="md-main">
        <SearchField q={f.q} setQ={(v) => patch({ q: v })} inputRef={input} onDown={() => list.current?.querySelector<HTMLElement>("a[data-model]")?.focus()} />
        <div className="md-tools">
          {!searching && view.rankedN !== view.allN && (
            <div className="seg md-segtext" role="group" aria-label="Show">
              <button type="button" aria-pressed={f.tier === "ranked"} onClick={() => patch({ tier: "ranked" })}>Ranked<span className="num">{view.rankedN}</span></button>
              <button type="button" aria-pressed={f.tier === "all"} onClick={() => patch({ tier: "all" })}>All<span className="num">{view.allN}</span></button>
            </div>
          )}
          <IconBtn label="Open weights only" pressed={f.open} onClick={() => patch({ open: !f.open })}><IconLockOpen size={18} stroke={1.5} aria-hidden /></IconBtn>
          <DateButton since={f.since} onChange={(since) => patch({ since })} />
          <IconBtn label={searching ? "Older versions are included while searching" : "Older versions"} pressed={f.older || searching} disabled={searching} onClick={() => patch({ older: !f.older })}><IconHistory size={18} stroke={1.5} aria-hidden /></IconBtn>
          <IconBtn className="md-costbtn" label="Cost per task" pressed={showCost} disabled={order.sort === "cost"} onClick={() => setCostOn((v) => !v)}><IconReceipt size={18} stroke={1.5} aria-hidden /></IconBtn>
          <SortButton order={order} onChange={setOrder} />
          <span className={searching ? "cap md-matches" : "md-sr"} role="status" aria-live="polite">{rows.length.toLocaleString("en-US")} {searching ? (rows.length === 1 ? "match" : "matches") : rows.length === 1 ? "model" : "models"}</span>
        </div>
        {rows.length ? (
          <div ref={body}><ModelTable rows={rows} showLab={f.lab === "all"} order={order} onSort={onSort} onBack={back} listRef={list} cost={showCost} indexName={indexName} /></div>
        ) : <div ref={body}><Empty text={empty.text} action={empty.action} onAction={() => { empty.run(); back(); }} /></div>}
      </div>
    </div>
  );
}
