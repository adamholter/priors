"use client";
import { Fragment, memo, useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent, type ReactNode, type RefObject } from "react";
import { IconArrowDown, IconArrowUp, IconFilter, IconSearch, IconX } from "@tabler/icons-react";
import { bestOf, fmtCost, fmtMonth, fmtScore, labsOf, NATURAL, optionOf, searchOptions, secs, sortOptions, windowStart, type SortDir, type SortKey } from "@/lib/compare-chooser";
import type { CompareOption, CompareSide, ModelCompareView } from "@/lib/model-view";
import { LabLogo } from "../LabLogo";
import "./compare-chooser.css";

const WINDOW = 11, ROW = 44, ROW_PHONE = 52, MORE = 50;
const HEADS: { key: SortKey; label: string; cls: string }[] = [
  { key: "name", label: "Model", cls: "" }, { key: "score", label: "Score", cls: "r" }, { key: "cost", label: "Cost", cls: "r" }, { key: "tpt", label: "Time", cls: "r chooser-time" }, { key: "rank", label: "Rank", cls: "r chooser-rank" },
];
type Colors = ModelCompareView["labColors"];

/** Arrow, page and home/end keys over the ids on screen, Enter picks, Esc clears the query first. Focus stays in the search; a highlight moves. */
function useActive(ids: string[], o: { pick: (id: string) => void; query: string; clear: () => void; reset: string }) {
  // The highlight is an id, not a row number: rows loading in or a section opening must not move it.
  const [cur, setCur] = useState<string | undefined>(undefined);
  const sig = `${o.query}|${o.reset}`;
  const [seen, setSeen] = useState(sig);
  if (seen !== sig) { setSeen(sig); setCur(undefined); }
  const floor = o.query ? 0 : -1;
  const i = cur === undefined ? floor : Math.max(floor, ids.indexOf(cur));
  const at = (n: number) => ids[Math.max(0, Math.min(ids.length - 1, n))];
  const first = o.query ? ids[0] : undefined;
  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.nativeEvent.isComposing) return;
    const k = e.key;
    if (k === "ArrowDown") { e.preventDefault(); setCur(at(i + 1)); }
    else if (k === "ArrowUp") { e.preventDefault(); setCur(i <= 0 ? first : ids[i - 1]); }
    else if (k === "PageDown") { e.preventDefault(); setCur(at(i + 8)); }
    else if (k === "PageUp") { e.preventDefault(); setCur(at(i - 8)); }
    else if ((k === "Home" || k === "End") && (e.ctrlKey || e.metaKey || i >= 0)) { e.preventDefault(); setCur(k === "Home" ? ids[0] : ids[ids.length - 1]); }
    else if (k === "Enter") { const id = ids[i] ?? first; if (id) { e.preventDefault(); o.pick(id); } }
    else if (k === "Escape" && o.query) { e.preventDefault(); e.stopPropagation(); o.clear(); }
  };
  const activeId = ids[i];
  return { active: i, activeId, setActive: (n: number) => setCur(ids[n]), onKeyDown };
}

/** "/" jumps to the search, as everywhere else on the site. A fine pointer gets the focus at once; a phone keyboard would cover the list. */
function useSearchFocus(ref: RefObject<HTMLInputElement | null>, autoFocus: boolean) {
  useEffect(() => {
    if (autoFocus && window.matchMedia("(pointer: fine)").matches) ref.current?.focus({ preventScroll: true });
    const slash = (e: globalThis.KeyboardEvent) => {
      if (e.key !== "/" || e.ctrlKey || e.metaKey || e.altKey || (e.target as HTMLElement | null)?.closest("input, textarea, select, [contenteditable]")) return;
      e.preventDefault(); ref.current?.focus();
    };
    window.addEventListener("keydown", slash);
    return () => window.removeEventListener("keydown", slash);
  }, [ref, autoFocus]);
}

/** Keeps the highlighted row in view without moving the page more than it must. */
function useReveal(root: RefObject<HTMLElement | null>, id: string | undefined, uid: string) {
  useEffect(() => {
    if (id) root.current?.querySelector<HTMLElement>(`[id="${CSS.escape(`${uid}-${id}`)}"]`)?.scrollIntoView({ block: "nearest" });
  }, [id, uid, root]);
}

/** A section that opens in place; hidden, it takes no focus. */
const Collapse = ({ open, children }: { open: boolean; children: ReactNode }) => <div className="chooser-collapse" data-open={open || undefined}><div>{children}</div></div>;
const Disclosure = ({ open, onToggle, label, count }: { open: boolean; onToggle: () => void; label: string; count: number }) => <button type="button" className="disclosure chooser-disc" aria-expanded={open} onClick={onToggle}><span>{label}</span><span className="cap">{count}</span></button>;
const Dash = () => <span className="chooser-dash"><span aria-hidden="true">-</span><span className="sr-only">No data</span></span>;

function SearchField({ value, onChange, onKeyDown, inputRef, count, listId, activeId }: { value: string; onChange: (v: string) => void; onKeyDown: (e: KeyboardEvent<HTMLInputElement>) => void; inputRef: RefObject<HTMLInputElement | null>; count: string; listId: string; activeId?: string }) {
  return <div className="chooser-search">
    <IconSearch size={16} className="chooser-search-ico" aria-hidden="true" />
    <input ref={inputRef} className="inp" role="combobox" aria-expanded aria-controls={listId} aria-activedescendant={activeId} aria-autocomplete="list" autoComplete="off" spellCheck={false} value={value} placeholder="Search models or labs" aria-label="Search models or labs" onChange={(e) => onChange(e.target.value)} onKeyDown={onKeyDown} />
    <span className="chooser-search-end">{value && <span className="cap" role="status">{count}</span>}{value && <button type="button" className="chooser-clear" aria-label="Clear search" onMouseDown={(e) => e.preventDefault()} onClick={() => onChange("")}><IconX size={14} /></button>}</span>
  </div>;
}

/** Labs as logos: click one to keep only its models; its name (and the tooltip of each logo) says which. Below 640px the row sits behind one filter button. */
function LabStrip({ labs, labColors, value, onChange }: { labs: ReturnType<typeof labsOf>; labColors: Colors; value: string | null; onChange: (id: string | null) => void }) {
  const [open, setOpen] = useState(false), chosen = labs.find((l) => l.id === value);
  const logo = (l: { id: string; name: string }) => <LabLogo lab={l.id} name={l.name} color={labColors[l.id]} size={20} />;
  return <div className="chooser-labs-wrap">
    <div className="chooser-labs-bar">
      <button type="button" className="chooser-lab-toggle" aria-expanded={open} aria-pressed={!!chosen} aria-label={chosen ? `Lab: ${chosen.name}. Change` : "Filter by lab"} onClick={() => setOpen((v) => !v)}>{chosen ? logo(chosen) : <IconFilter size={18} stroke={1.5} />}</button>
      {chosen && <><span className="cap">{chosen.name}, {chosen.n} ranked</span><button type="button" className="chooser-clear" aria-label="Show every lab" onClick={() => { onChange(null); setOpen(false); }}><IconX size={14} /></button></>}
    </div>
    <Collapse open={open}>
      <div className="chooser-labs" role="group" aria-label="Labs">
        {labs.map((l) => <button key={l.id} type="button" className="chooser-lab" aria-pressed={value === l.id} aria-label={`${l.name}, ${l.n} ranked`} title={l.name} onClick={() => onChange(value === l.id ? null : l.id)}>{logo(l)}</button>)}
        {chosen && <span className="chooser-lab-name cap" role="status">{chosen.name}, {chosen.n} ranked</span>}
      </div>
    </Collapse>
  </div>;
}

/** One model: logo, name, score, cost, time, rank. The best number of each column in the list is indigo. */
const Row = memo(function Row({ o, uid, pick, active, muted, ls, lc, lt, plan, labColors }: { o: CompareOption; uid: string; pick: (id: string) => void; active: boolean; muted?: boolean; ls: boolean; lc: boolean; lt: boolean; plan: boolean; labColors: Colors }) {
  const rk = o.rank != null ? `#${o.rank}` : fmtMonth(o.date);
  // An older model with no numbers at all shows its date and nothing else; a ranked one with a gap shows a dash.
  const blank = o.rank == null && o.score == null && o.cost == null && o.tpt == null, cell = (text?: string) => (text != null ? text : blank ? null : <Dash />);
  return <div id={`${uid}-${o.id}`} role="option" aria-selected={active} data-active={active || undefined} data-muted={muted || undefined} className="chooser-row" onClick={() => pick(o.id)}>
    <LabLogo lab={o.labId} name={o.labName} color={labColors[o.labId]} size={20} />
    <span className="chooser-who"><span className="chooser-name" title={o.name}>{o.name}</span><span className="cap chooser-sub">{rk}{o.tpt != null && <> · <span className={lt ? "lead" : undefined}>{secs(o.tpt)}</span></>}</span></span>
    <span className={`num${ls ? " lead" : ""}`}>{cell(o.score != null ? fmtScore(o.score) : undefined)}</span>
    <span className={`num${lc ? " lead" : ""}`} title={plan && o.cost != null ? "Cost per task on plan" : undefined}>{cell(o.cost != null ? fmtCost(o.cost) : undefined)}</span>
    <span className={`num chooser-time${lt ? " lead" : ""}`}>{cell(o.tpt != null ? secs(o.tpt) : undefined)}</span>
    <span className="cap chooser-rank">{rk}</span>
  </div>;
});

/** The model you keep, as a reference line above the list: the numbers every row is read against. Not a choice. */
function KeptRow({ o, labColors }: { o: CompareOption; labColors: Colors }) {
  const rk = o.rank != null ? `#${o.rank}` : fmtMonth(o.date);
  return <div className="chooser-grid chooser-row chooser-kept" role="group" aria-label={`Compared with ${o.name}`}>
    <LabLogo lab={o.labId} name={o.labName} color={labColors[o.labId]} size={20} />
    <span className="chooser-who"><span className="chooser-name" title={o.name}>{o.name}</span><span className="cap chooser-sub">{rk}{o.tpt != null && ` · ${secs(o.tpt)}`}</span></span>
    <span className="num">{o.score != null ? fmtScore(o.score) : <Dash />}</span>
    <span className="num">{o.cost != null ? fmtCost(o.cost) : <Dash />}</span>
    <span className="num chooser-time">{o.tpt != null ? secs(o.tpt) : <Dash />}</span>
    <span className="cap chooser-rank">{rk}</span>
  </div>;
}

interface ChooserProps {
  /** Every model that can be picked: not the one you keep, nor the one beside it. */
  options: CompareOption[];
  /** The model you keep. */
  kept: CompareSide;
  labColors: Colors;
  costBasis: ModelCompareView["costBasis"];
  onPick: (id: string) => void;
  /** In the replace dialog the whole list scrolls inside it in whole rows; on the page it opens around the kept model and grows in the page. */
  dialog?: boolean;
  autoFocus?: boolean;
}

/** Find a model to compare with: one ranked list opened around the kept model's place, rows with score, cost and time, lab logos to filter, older models behind a disclosure. */
export function CompareChooser({ options, kept: keptSide, labColors, costBasis, onPick, dialog = false, autoFocus = false }: ChooserProps) {
  const kept = useMemo(() => optionOf(keptSide), [keptSide]);
  const [query, setQuery] = useState(""), [lab, setLab] = useState<string | null>(null), [sort, setSort] = useState<{ key: SortKey; dir: SortDir }>({ key: "rank", dir: "asc" });
  const [expanded, setExpanded] = useState(false), [olderOpen, setOlderOpen] = useState(false), [seen, setSeen] = useState({ all: false, older: false }), [limit, setLimit] = useState(MORE);
  const [listH, setListH] = useState<number | undefined>(undefined);
  const input = useRef<HTMLInputElement>(null), root = useRef<HTMLDivElement>(null), scroller = useRef<HTMLDivElement>(null), chrome = useRef<HTMLDivElement>(null), end = useRef<HTMLDivElement>(null);
  const uid = useId().replace(/:/g, ""), listId = `${uid}-list`;
  const latest = useRef(onPick);
  useEffect(() => { latest.current = onPick; });
  const pick = useCallback((id: string) => latest.current(id), []);
  useSearchFocus(input, autoFocus);

  const q = query.trim();
  const inLab = useCallback((o: CompareOption) => !lab || o.labId === lab, [lab]);
  const labs = useMemo(() => labsOf(options), [options]);
  const ranked = useMemo(() => options.filter((o) => o.rank != null), [options]);
  const older = useMemo(() => options.filter((o) => o.rank == null && inLab(o)), [options, inLab]);
  const matches = useMemo(() => (q ? searchOptions(options, q).filter(inLab) : []), [options, q, inLab]);
  const rankedMatches = useMemo(() => matches.filter((o) => o.rank != null), [matches]), olderMatches = useMemo(() => matches.filter((o) => o.rank == null), [matches]);

  // The ranked sequence and where the kept model would sit in it. On the page, with nothing typed or filtered, a window of it is shown.
  const seq = useMemo(() => sortOptions(ranked.filter(inLab), sort.key, sort.dir), [ranked, inLab, sort]);
  const byRank = sort.key === "rank" && sort.dir === "asc", windowed = !dialog && !q && !lab && byRank, pivotOn = byRank && kept.rank != null;
  const pivot = pivotOn ? (() => { const i = seq.findIndex((o) => o.rank! > kept.rank!); return i < 0 ? seq.length : i; })() : 0;
  const lo = windowed ? windowStart(pivot, seq.length, WINDOW) : 0, hi = windowed ? Math.min(seq.length, lo + WINDOW) : seq.length;
  const above = useMemo(() => seq.slice(0, lo), [seq, lo]), mid = useMemo(() => seq.slice(lo, hi), [seq, lo, hi]), below = useMemo(() => seq.slice(hi), [seq, hi]);
  const showAll = expanded || !windowed;

  // Ids on screen in reading order, for the keyboard.
  const shownOlder = useMemo(() => (q ? olderMatches.slice(0, limit) : olderOpen ? older : []), [q, olderMatches, limit, olderOpen, older]);
  const nav = useMemo(() => (q ? [...rankedMatches, ...shownOlder] : [...(showAll ? above : []), ...mid, ...(showAll ? [...below, ...shownOlder] : [])]).map((o) => o.id), [q, rankedMatches, shownOlder, showAll, above, mid, below]);
  const best = useMemo(() => bestOf(q ? [...rankedMatches, ...shownOlder] : showAll ? seq : mid, kept), [q, rankedMatches, shownOlder, showAll, seq, mid, kept]);
  const keys = useActive(nav, { pick, query: q, reset: `${lab}|${sort.key}|${sort.dir}`, clear: () => { setQuery(""); setLimit(MORE); } });
  useReveal(root, keys.activeId, uid);
  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    // The first press lands on the row next to the model you keep.
    if (e.key === "ArrowDown" && keys.active === -1 && !q) { e.preventDefault(); keys.setActive(Math.max(0, pivot > 0 && pivot < seq.length ? nav.indexOf(seq[pivot].id) : 0)); return; }
    keys.onKeyDown(e);
  };

  // More older matches as the end of the list scrolls into view, never a silent cap.
  const hasMore = !!q && olderMatches.length > limit;
  const more = useRef(() => {});
  useEffect(() => { more.current = () => setLimit((l) => l + MORE); });
  useEffect(() => {
    if (!hasMore || !end.current) return;
    const io = new IntersectionObserver((es) => { if (es.some((x) => x.isIntersecting)) more.current(); }, { rootMargin: "240px" });
    io.observe(end.current);
    return () => io.disconnect();
  }, [hasMore, limit]);

  // Dialog: the list fills it in whole rows (re-fitted when the window or the lab row changes size), and opens centred on where the kept model would sit.
  useLayoutEffect(() => {
    const top = chrome.current, body = root.current?.closest<HTMLElement>(".chooser-dlg-body"), head = body?.parentElement?.querySelector(".chooser-dlg-head");
    if (!dialog || !top || !body || !head) return;
    let frame = 0;
    const fit = () => {
      const phone = window.matchMedia("(max-width: 639px)").matches, rowH = phone ? ROW_PHONE : ROW, st = getComputedStyle(body);
      const space = (phone ? window.innerHeight : Math.min(780 + 20, window.innerHeight)) - 20 - head.getBoundingClientRect().height - top.getBoundingClientRect().height - 12 - (parseFloat(st.paddingTop) || 0) - (parseFloat(st.paddingBottom) || 0);
      setListH(Math.max(rowH * 4, Math.floor(space / rowH) * rowH));
    };
    const later = () => { cancelAnimationFrame(frame); frame = requestAnimationFrame(fit); };
    fit();
    const watch = new ResizeObserver(later);
    watch.observe(top);
    window.addEventListener("resize", later);
    return () => { cancelAnimationFrame(frame); watch.disconnect(); window.removeEventListener("resize", later); };
  }, [dialog]);
  const centred = useRef(false);
  useLayoutEffect(() => {
    const list = scroller.current, mark = list?.querySelector<HTMLElement>("[data-pivot]");
    if (!dialog || centred.current || !listH || !list || !mark) return;
    centred.current = true;
    const rowH = window.matchMedia("(max-width: 639px)").matches ? ROW_PHONE : ROW;
    list.scrollTop = Math.max(0, Math.round((mark.offsetTop - listH / 2) / rowH) * rowH);
  }, [dialog, listH]);
  useEffect(() => { if (scroller.current && q) scroller.current.scrollTop = 0; }, [q]);

  const plan = costBasis === "subscription";
  const row = (o: CompareOption, muted?: boolean) => <Row key={o.id} o={o} uid={uid} pick={pick} active={keys.activeId === o.id} muted={muted} ls={best.score === o.id} lc={best.cost === o.id} lt={best.tpt === o.id} plan={plan} labColors={labColors} />;
  const clickHead = (key: SortKey) => setSort((s) => (s.key === key ? { key, dir: s.dir === "asc" ? "desc" : "asc" } : { key, dir: NATURAL[key] }));

  const body = q ? <>
    {rankedMatches.map((o) => row(o))}
    {rankedMatches.length > 0 && olderMatches.length > 0 && <div className="chooser-rule" aria-hidden="true" />}
    {shownOlder.map((o) => row(o, true))}
    {hasMore && <div ref={end} className="chooser-sentinel" aria-hidden="true" />}
    {matches.length === 0 && <p className="cap chooser-none">No model matches.</p>}
  </> : <>
    <Collapse open={showAll}>{(showAll || seen.all) && above.map((o) => row(o))}</Collapse>
    {mid.map((o, i) => <Fragment key={o.id}>{pivotOn && i === pivot - lo && <div data-pivot="" />}{row(o)}</Fragment>)}
    {pivotOn && pivot - lo >= mid.length && <div data-pivot="" />}
    {windowed && above.length + below.length > 0 && <Disclosure open={expanded} onToggle={() => { setExpanded((v) => !v); setSeen((s) => ({ ...s, all: true })); }} label="All ranked" count={seq.length} />}
    <Collapse open={showAll}>{(showAll || seen.all) && below.map((o) => row(o))}</Collapse>
    {older.length > 0 && <Collapse open={showAll}>
      <div className="chooser-rule" aria-hidden="true" />
      <Disclosure open={olderOpen} onToggle={() => { setOlderOpen((v) => !v); setSeen((s) => ({ ...s, older: true })); }} label="Older and unranked" count={older.length} />
      <Collapse open={olderOpen}>{seen.older && older.map((o) => row(o, true))}</Collapse>
    </Collapse>}
  </>;

  return <div ref={root} className="chooser">
    <div ref={chrome} className="chooser-chrome">
      <SearchField value={query} onChange={(v) => { setQuery(v); setLimit(MORE); }} onKeyDown={onKeyDown} inputRef={input} count={`${matches.length} ${matches.length === 1 ? "match" : "matches"}`} listId={listId} activeId={keys.activeId ? `${uid}-${keys.activeId}` : undefined} />
      <LabStrip labs={labs} labColors={labColors} value={lab} onChange={setLab} />
      <div className="chooser-head chooser-grid" role="presentation"><span />{HEADS.map((h) => <button key={h.key} type="button" className={h.cls} aria-sort={sort.key === h.key ? (sort.dir === "asc" ? "ascending" : "descending") : undefined} onClick={() => clickHead(h.key)}>{h.label}{sort.key === h.key && (sort.dir === "asc" ? <IconArrowUp className="ar" /> : <IconArrowDown className="ar" />)}</button>)}</div>
      <KeptRow o={kept} labColors={labColors} />
    </div>
    <div id={listId} role="listbox" aria-label="Models" ref={scroller} className={dialog ? "chooser-scroll" : undefined} style={dialog && listH ? { height: listH } : undefined}>{body}</div>
  </div>;
}

/** The replace dialog around the chooser. The chooser mounts once the dialog is open, so it can measure the room it has before the first paint. */
export function ChooserDialog({ title, onClose, ...props }: Omit<ChooserProps, "dialog" | "autoFocus"> & { title: string; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null), frame = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  useLayoutEffect(() => {
    const d = ref.current;
    if (!d || d.open) return;
    d.showModal();
    // A phone keyboard would cover the list, so the search takes the focus on a fine pointer only (once the chooser is there).
    frame.current?.focus({ preventScroll: true });
    setOpen(true);
  }, []);
  return <dialog ref={ref} aria-label={title} onClose={onClose} onClick={(e) => { if (e.target === ref.current) ref.current?.close(); }} className="chooser-dialog">
    <div ref={frame} className="chooser-frame" tabIndex={-1}>
      <div className="chooser-dlg-head"><h2>{title}</h2><button type="button" aria-label="Close" className="chooser-dlg-x" onClick={() => ref.current?.close()}><IconX size={18} /></button></div>
      <div className="chooser-dlg-body">{open && <CompareChooser {...props} dialog autoFocus />}</div>
    </div>
  </dialog>;
}
