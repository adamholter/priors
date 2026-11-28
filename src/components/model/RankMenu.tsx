"use client";
import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { IconCheck, IconChevronDown } from "@tabler/icons-react";
import { OWN_KEY, rankParam, type RankingOption } from "@/lib/model-ranking-param";
import { describeRanking, type RankSummary } from "@/lib/model-rank-text";
import { useDismiss } from "../use-popover";
import { Spinner } from "./ModelHeaderParts";

/** Where the model stands in one ranking: its place, "not ranked", or a bar while that is worked out. */
function RankCell({ summary }: { summary: RankSummary | undefined }) {
  if (!summary) return <span className="block h-[10px] w-[40px] rounded-[2px] load-bar" aria-label="Working out" />;
  if (!summary.standing) return <span className="cap">not ranked</span>;
  return <span className="num text-[13px] text-ink">#{summary.standing.rank} of {summary.standing.of}</span>;
}

/**
 * The picker, as a menu: one row per ranking with its size and where this model stands in it. The button is the current ranking's
 * name in serif, underlined, with a chevron (a spinner while a ranking loads). Keyboard: arrows, Home, End, a letter, Enter, Escape.
 */
export function RankMenu({ options, current, onPick, ranks, busy, onOpenChange }: {
  options: RankingOption[]; current: string; onPick: (param: string) => void; ranks: Record<string, RankSummary | undefined>; busy: boolean; onOpenChange: (open: boolean) => void;
}) {
  const [open, setOpenState] = useState(false);
  const box = useRef<HTMLDivElement>(null), btn = useRef<HTMLButtonElement>(null), list = useRef<HTMLDivElement>(null);
  const setOpen = useCallback((v: boolean) => { setOpenState(v); onOpenChange(v); }, [onOpenChange]);
  const close = useCallback(() => setOpen(false), [setOpen]);
  useDismiss(open, [box], close);
  const cur = options.find((o) => rankParam(o) === current) ?? options[0];
  const groups = useMemo(() => [...new Set(options.map((o) => o.group))], [options]);
  useEffect(() => {
    if (!open) return;
    const on = list.current?.querySelector<HTMLElement>('[aria-checked="true"]') ?? list.current?.querySelector<HTMLElement>("[role=menuitemradio]");
    on?.scrollIntoView({ block: "nearest" });
    on?.focus({ preventScroll: true });
  }, [open]);
  const onKey = (e: KeyboardEvent) => {
    const els = [...(list.current?.querySelectorAll<HTMLElement>("[role=menuitemradio]") ?? [])], at = els.indexOf(document.activeElement as HTMLElement);
    const go = (i: number) => { els[(i + els.length) % els.length]?.focus(); e.preventDefault(); };
    if (e.key === "ArrowDown") go(at + 1); else if (e.key === "ArrowUp") go(at - 1); else if (e.key === "Home") go(0); else if (e.key === "End") go(els.length - 1);
    else if (e.key === "Escape") { close(); btn.current?.focus(); }
    else if (e.key === "Tab") { close(); btn.current?.focus(); } // focus goes on from the button, and the menu does not stay open behind it
    else if (e.key.length === 1 && /\S/.test(e.key)) {
      const k = e.key.toLowerCase(), starts = (el: HTMLElement) => (el.dataset.name ?? "").toLowerCase().startsWith(k);
      const next = els.findIndex((el, i) => i > at && starts(el)), m = next >= 0 ? next : els.findIndex(starts);
      if (m >= 0) go(m);
    }
  };
  const pick = (o: RankingOption) => { onPick(rankParam(o)); close(); btn.current?.focus(); };
  return (
    <div ref={box} className="relative inline-block max-w-full" onKeyDown={onKey}>
      <button ref={btn} type="button" aria-haspopup="menu" aria-expanded={open} aria-busy={busy} aria-label={`Ranking to place this model in: ${cur?.label}`}
        onClick={() => setOpen(!open)} onKeyDown={(e) => { if (e.key === "ArrowDown" && !open) { e.preventDefault(); setOpen(true); } }}
        className="model-head-trig hit inline-flex max-w-full rounded-[3px] text-left">
        <span className="inline-flex items-center gap-1 max-w-full">
          <span className="model-head-trig-text truncate font-serif text-[16px] leading-[1.4] text-ink" title={cur?.label}>{cur?.label}</span>
          {busy ? <Spinner /> : <IconChevronDown size={16} stroke={1.75} aria-hidden="true" className="model-head-chev shrink-0 text-grey" />}
        </span>
      </button>
      {open && (
        <div ref={list} role="menu" aria-label="Rankings" className="model-head-pop absolute top-full mt-2 z-50 w-[min(340px,calc(100vw-40px))] max-h-[60vh] overflow-y-auto grid gap-0.5 p-1.5 bg-white border hairline rounded-lg shadow-[0_18px_40px_-18px_var(--shadow)] font-sans text-left right-0 max-sm:right-auto max-sm:left-0">
          {groups.map((g, gi) => (
            <div key={g} role="group" aria-label={g} className={gi ? "mt-1.5" : ""}>
              {groups.length > 1 && <p className="cap px-3 pt-1 pb-0.5" aria-hidden="true">{g}</p>}
              {options.filter((o) => o.group === g).map((o) => (
                <button key={o.key} type="button" role="menuitemradio" aria-checked={rankParam(o) === current} data-name={o.label} tabIndex={-1} onClick={() => pick(o)}
                  className="model-head-row grid w-full grid-cols-[16px_minmax(0,1fr)_auto] items-center gap-2.5 h-[52px] max-sm:h-[48px] px-3 rounded text-left">
                  <span className="grid place-items-center">{rankParam(o) === current && <IconCheck size={16} stroke={2} aria-hidden="true" className="text-indigo" />}</span>
                  <span className="min-w-0"><span className="block truncate font-serif text-[15px] text-ink" title={o.label}>{o.label}</span><span className="cap block truncate min-h-[16px]">{describeRanking(ranks[o.key], o.key === OWN_KEY)}</span></span>
                  <RankCell summary={ranks[o.key]} />
                </button>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
