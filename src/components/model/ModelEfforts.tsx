"use client";
import { createContext, memo, useCallback, useContext, useEffect, useMemo, useState, useSyncExternalStore, type CSSProperties, type KeyboardEvent as ReactKeyboardEvent } from "react";
import { IconClock, IconCoin, IconLetterCase } from "@tabler/icons-react";
import type { BenchRow, ViewBenchmark } from "@/lib/model-view";
import { BEST_VALUE_NOTE, BEST_VALUE_TITLE, cardRows, fmtStep, placeOf, secs, tokens, usd, type Eff, type EffortsData } from "@/lib/model-efforts";
import { InfoIcon } from "../BenchmarkInfo";
import "./model-efforts.css";

/** The section's best-value effort, so every benchmark card below can mark the same word in indigo. */
export const BestEffortContext = createContext<string | null>(null);

/** Below Tailwind's sm: the page's own phone breakpoint. */
const subscribePhone = (cb: () => void) => { const m = window.matchMedia("(max-width: 639px)"); m.addEventListener("change", cb); return () => m.removeEventListener("change", cb); };
const usePhone = () => useSyncExternalStore(subscribePhone, () => window.matchMedia("(max-width: 639px)").matches, () => false);

/** A grey hyphen for a value nobody measured. */
const Nil = () => <span className="num eff-nil"><span aria-hidden="true">-</span><span className="sr-only">not measured</span></span>;
/** A column head that is an icon with a hover label. */
const Head = ({ Icon, title }: { Icon: typeof IconCoin; title: string }) => <span className="eff-head" title={title} role="img" aria-label={title}><Icon size={15} stroke={1.6} /></span>;

/** The reasoning-effort section: one row per effort in a fixed order (max on top) with score, step, cost, time and tokens side by side. The cheapest effort within 5% of the best score is indigo. */
export function ModelEfforts({ data, color, pending }: { data: EffortsData; color: string; pending: boolean }) {
  const { list, hasCost, hasTime, hasTokens, plan, best, total } = data;
  const phone = usePhone();
  const [open, setOpen] = useState<string | null>(null);
  const [note, setNote] = useState(false);
  useEffect(() => {
    if (!note) return;
    const key = (e: KeyboardEvent) => { if (e.key === "Escape") setNote(false); };
    document.addEventListener("keydown", key);
    return () => document.removeEventListener("keydown", key);
  }, [note]);
  const toggle = useCallback((id: string) => setOpen((o) => (o === id ? null : id)), []);
  const style = useMemo(() => ({
    "--cols": ["72px", "minmax(0,1fr)", "104px", ...(hasCost ? [plan ? "80px" : "72px"] : []), ...(hasTime ? ["72px"] : []), ...(hasTokens ? ["72px"] : [])].join(" "),
    "--cols-m": ["56px", "minmax(0,1fr)", "44px", ...(hasCost ? ["60px"] : [])].join(" "),
  }) as CSSProperties, [hasCost, hasTime, hasTokens, plan]);
  if (list.length < 2) return null;
  return (
    <section aria-busy={pending || undefined} data-stale={pending || undefined} className="eff grid gap-3">
      <div>
        <div className="flex items-center justify-between gap-3 border-b hairline pb-2">
          <h2 className="text-[26px]">Reasoning effort</h2>
          {best && <span className="inline-flex"><InfoIcon name="best value" onClick={() => setNote((o) => !o)} expanded={note} controls="eff-note" /></span>}
        </div>
        <div id="eff-note" className="eff-note" data-open={note} inert={!note}><div><p role="note">{BEST_VALUE_NOTE}</p></div></div>
      </div>
      <div className="eff-ladder" style={style}>
        <div className="eff-cap" aria-hidden="true">
          <span /><span /><span />
          {hasCost && <span><Head Icon={IconCoin} title={plan ? "Plan cost per task (a share of API price)" : "Cost per task"} /></span>}
          {hasTime && <span><Head Icon={IconClock} title="Time per task" /></span>}
          {hasTokens && <span><Head Icon={IconLetterCase} title="Output tokens per task" /></span>}
        </div>
        {list.map((r, i) => <EffortRow key={r.id} r={r} i={i} below={list[i + 1]} color={color} total={total} data={data} phone={phone} open={open === r.id} toggle={toggle} />)}
      </div>
    </section>
  );
}

/** What a phone's row shows when tapped, since the columns it hides are too narrow there. */
const detail = (r: Eff) => [r.step != null ? `${fmtStep(r.step)} pts` : null, r.tpt != null ? secs(r.tpt) : null, r.tokens != null ? `${tokens(r.tokens)} tokens` : null].filter(Boolean).join(", ");

const EffortRow = memo(function EffortRow({ r, i, below, color, total, data, phone, open, toggle }: { r: Eff; i: number; below?: Eff; color: string; total: number; data: EffortsData; phone: boolean; open: boolean; toggle: (id: string) => void }) {
  const sub = detail(r);
  const inner = (
    <>
      <span className="eff-word" data-best={r.best}>{r.effort}</span>
      <span className="eff-track"><i className="eff-fill" style={{ width: `${Math.max(0, Math.min(100, r.score))}%`, background: color, opacity: r.est ? 0.55 : 1, "--i": i } as CSSProperties} /></span>
      <span className="eff-scorecell">
        <span className="num eff-score" title={`#${r.rank} of ${total} variants`}><span className="sr-only">score </span>{r.score.toFixed(1)}</span>
        <span className="num eff-opt eff-step" title={r.step != null && below ? `${fmtStep(r.step)} points over ${below.effort}` : undefined}>{r.step == null ? "" : <><span className="sr-only">step </span>{fmtStep(r.step)}</>}</span>
      </span>
      {data.hasCost && <span className="num" title={r.cost != null ? `$${r.cost.toFixed(4)} per task` : undefined}><span className="sr-only">cost </span>{r.cost != null ? usd(r.cost) : <Nil />}</span>}
      {data.hasTime && <span className="num eff-opt" title={r.tpt != null ? `${Math.round(r.tpt)} s` : undefined}><span className="sr-only">time </span>{r.tpt != null ? secs(r.tpt) : <Nil />}</span>}
      {data.hasTokens && <span className="num eff-opt" title={r.tokens != null ? `${Math.round(r.tokens).toLocaleString("en-US")} output tokens` : undefined}><span className="sr-only">tokens </span>{r.tokens != null ? tokens(r.tokens) : <Nil />}</span>}
    </>
  );
  const title = r.best ? BEST_VALUE_TITLE : undefined;
  const tap = phone && !!sub;
  return (
    <div>
      {/* One element type on the server and the client, so a phone does not remount the rows (and replay the bar animation) after hydration. */}
      <div className="eff-row" data-best={r.best} title={title} {...(tap ? { role: "button", tabIndex: 0, "aria-expanded": open, onClick: () => toggle(r.id), onKeyDown: (e: ReactKeyboardEvent<HTMLDivElement>) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); toggle(r.id); } } } : {})}>{inner}</div>
      {tap && <div className="eff-sub" data-open={open} inert={!open}><div><p className="cap">{sub}</p></div></div>}
    </div>
  );
});

/** The effort list under one benchmark card: every effort in the same fixed order as the section, each with where it placed. A benchmark with one effort, or its own setting, keeps the plain single line. */
export function EffortRows({ b, mine, of, color, fmt }: { b: Pick<ViewBenchmark, "effortBasis" | "unit">; mine: BenchRow[]; of: number; color: string; fmt: (b: Pick<ViewBenchmark, "unit">, v: number) => string }) {
  const best = useContext(BestEffortContext);
  const { rows, best: top, single } = useMemo(() => cardRows(b, mine), [b, mine]);
  if (single) {
    return (
      <ol className="grid gap-[4px]">
        {mine.map((r) => <li key={r.variantId} className="grid grid-cols-[52px_minmax(0,1fr)_70px] items-center gap-3 text-[12.5px] h-[24px]">
          <span className="num text-[15px]" style={{ color: "var(--indigo)" }}>#{r.rank}</span>
          <span className="truncate">{b.effortBasis ? "best measured setting" : r.effort === "default" ? "default" : r.effort} <span className="cap">of {of}</span></span>
          <span className="num text-right">{fmt(b, r.value)}</span>
        </li>)}
      </ol>
    );
  }
  return (
    <ol className="eff-card">
      {rows.map((r, i) => (
        <li key={r.variantId} className="eff-crow" data-top={r === top} title={`#${r.rank} of ${of} results, ahead of ${Math.round(placeOf(r.rank, of) * 100)}%`}>
          <span className="eff-word" data-best={best === r.effort} title={best === r.effort ? BEST_VALUE_TITLE : undefined}>{r.effort}</span>
          <span className="eff-place" aria-hidden="true"><i style={{ width: `${placeOf(r.rank, of) * 100}%`, background: color, "--i": i } as CSSProperties} /></span>
          <span className="num">{fmt(b, r.value)}</span>
          <span className="cap">#{r.rank}</span>
        </li>
      ))}
    </ol>
  );
}
