"use client";
import { memo, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore, type KeyboardEvent, type PointerEvent as ReactPointerEvent, type RefObject } from "react";
import { IconChevronRight, IconMinus, IconSearch } from "@tabler/icons-react";
import type { PlanSubsidy, SubsidySeller } from "@/lib/model-availability";
import { TICKS, dollarScale, feeText, logShare, mainLab, measured, nearestMark, rowPlanOf, scaleHigh, searchSellers, shortOf, times, trackMarks, type Hit, type Scale } from "@/lib/plan-subsidies";
import { labLogo } from "@/data/lab-logos";
import { LabLogo } from "./LabLogo";
import { useChartPalette } from "./chart/palette-context";
import { markColor } from "./chart/theme-tokens";
import { PlanGrid, type GridCtx } from "./PlanSubsidyGrid";
import { Collapse } from "./PlanSubsidyParts";
import "./plan-subsidies.css";

const DOLLARS_KEY = "priors:subsidies-dollars";
/** How close a mouse must be to a mark to name it, and a finger. */
const REACH_PX = 16, TOUCH_REACH_PX = 20;
const PHONE = "(max-width:639px)";
const watchPhone = (cb: () => void) => { const mq = window.matchMedia(PHONE); mq.addEventListener("change", cb); return () => mq.removeEventListener("change", cb); };
const usePhone = () => useSyncExternalStore(watchPhone, () => window.matchMedia(PHONE).matches, () => false);

/** The grid's dollar switch, kept for the visitor's next visit. */
function useDollars(): [boolean, () => void] {
  const [on, setOn] = useState(() => { try { return localStorage.getItem(DOLLARS_KEY) === "1"; } catch { return false; } });
  const now = useRef(on);
  const toggle = useCallback(() => {
    now.current = !now.current;
    setOn(now.current);
    try { localStorage.setItem(DOLLARS_KEY, now.current ? "1" : "0"); } catch { /* storage blocked */ }
  }, []);
  return [on, toggle];
}

/** The width of an element, measured before paint and kept current. */
function useWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null), [width, setWidth] = useState(0);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    setWidth(el.getBoundingClientRect().width);
    const ro = new ResizeObserver((e) => setWidth(e[0].contentRect.width));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, width] as const;
}

/** A tap anywhere outside `[data-hold]` puts a touch pick down. */
function useTapAway(active: boolean, clear: () => void) {
  useEffect(() => {
    if (!active) return;
    const on = (e: PointerEvent) => { if (e.pointerType === "touch" && !(e.target as Element | null)?.closest?.("[data-hold]")) clear(); };
    document.addEventListener("pointerdown", on);
    return () => document.removeEventListener("pointerdown", on);
  }, [active, clear]);
}

/** Pointer handling for a strip: a mouse hovers to the nearest mark within 16px; a finger selects and scrubs within 20px and leaves the pick up. */
function useScrub<G extends { x: number }>(ref: RefObject<HTMLElement | null>, marks: G[], pick: (g: G | null) => void) {
  const down = useRef(false);
  const at = (e: ReactPointerEvent<HTMLElement>, reach: number) => pick(nearestMark(marks, e.clientX - (ref.current ?? e.currentTarget).getBoundingClientRect().left, reach));
  return {
    onPointerMove: (e: ReactPointerEvent<HTMLElement>) => { if (e.pointerType === "touch") { if (down.current) at(e, TOUCH_REACH_PX); } else at(e, REACH_PX); },
    onPointerLeave: (e: ReactPointerEvent<HTMLElement>) => { if (e.pointerType !== "touch") pick(null); },
    onPointerDown: (e: ReactPointerEvent<HTMLElement>) => { if (e.pointerType === "touch") { down.current = true; at(e, TOUCH_REACH_PX); } },
    onPointerUp: () => { down.current = false; },
    onPointerCancel: () => { down.current = false; },
  };
}

/** The seller's logo: its id is a lab or seller id in `data/lab-logos.ts`; an unlisted plan name is tried by its first word ("Perplexity Max"). */
function Logo({ seller }: { seller: SubsidySeller }) {
  const first = seller.name.split(/\s+/)[0];
  return <LabLogo lab={labLogo(seller.id) ? seller.id : first} name={seller.name} size={20} />;
}

/** Plans by the company selling them. A row is one bar to the median of the company's default plan, with a tick at its best model, on one log scale of API value per dollar; opening it shows every plan beside every model. */
export function PlanSubsidies({ sellers, labColors }: { sellers: SubsidySeller[]; labColors: Record<string, string | undefined> }) {
  const pal = useChartPalette(), phone = usePhone(), [dollars, toggleDollars] = useDollars();
  const [query, setQuery] = useState(""), [open, setOpen] = useState<Record<string, boolean>>({});
  const high = useMemo(() => scaleHigh(sellers), [sellers]), dscale = useMemo(() => dollarScale(sellers), [sellers]);
  const scale: Scale = useMemo(() => ({ high, ticks: TICKS.filter((t) => t <= high), share: (m) => logShare(m, high), pct: (m) => `${(logShare(m, high) * 100).toFixed(2)}%`, color: (lab) => markColor(labColors[lab], pal, lab) }), [high, labColors, pal]);
  const ctx: GridCtx = useMemo(() => ({ scale, dscale, dollars, phone }), [scale, dscale, dollars, phone]);
  const shown = useMemo(() => searchSellers(sellers, query), [sellers, query]);
  const toggle = useCallback((id: string, deep: boolean) => setOpen((v) => ({ ...v, [id]: !(v[id] ?? deep) })), []);
  const searching = query.trim() !== "";
  return <div className="sub-root grid gap-5" data-searching={searching ? "" : undefined}>
    <label className="relative block max-w-[420px]"><IconSearch size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-grey" aria-hidden="true" /><input className="inp !pl-9 h-[44px] !text-[14px]" value={query} placeholder="Search companies, plans or models" aria-label="Search companies, plans or models" onChange={(e) => setQuery(e.target.value)} /></label>
    <div>
      <AxisRow scale={scale} />
      {!shown.length && <p className="cap py-10 text-center">Nothing matches.</p>}
      {shown.map((hit) => <Seller key={hit.s.id} hit={hit} expanded={open[hit.s.id] ?? hit.deep} toggle={toggle} ctx={ctx} toggleDollars={toggleDollars} />)}
    </div>
  </div>;
}

/** The axis over the bars: 1x, 10x and 100x, sticky under the phone nav. */
function AxisRow({ scale }: { scale: Scale }) {
  return <div className="sub-row sub-stick z-30 h-7 bg-bone border-b hairline" aria-hidden="true">
    <span className="sub-left" /><div className="sub-cell relative h-full">{[1, 10, 100].filter((t) => t <= scale.high).map((t, i, a) => <span key={t} className={`cap absolute top-1/2 -translate-y-1/2 ${i === 0 ? "" : i === a.length - 1 ? "-translate-x-full" : "-translate-x-1/2"}`} style={{ left: scale.pct(t) }}>{t}x</span>)}</div><span className="sub-med cap max-sm:hidden">median</span>
  </div>;
}

const Seller = memo(function Seller({ hit, expanded, toggle, ctx, toggleDollars }: { hit: Hit; expanded: boolean; toggle: (id: string, deep: boolean) => void; ctx: GridCtx; toggleDollars: () => void }) {
  const { s } = hit, short = shortOf(s), main = rowPlanOf(hit.plans), flip = () => toggle(s.id, hit.deep);
  return <section className="sub-seller border-b hairline" data-seller={s.id} data-expanded={expanded}>
    <div className="sub-row sub-row-hover -mx-2 px-2 min-h-[56px] max-sm:pb-1 cursor-pointer" onClick={(e) => { if (!(e.target as Element).closest(".sub-cell")) flip(); }}>
      <button type="button" aria-expanded={expanded} onClick={(e) => { e.stopPropagation(); flip(); }} className="sub-left min-w-0 flex items-center gap-2 text-[14px] text-left py-2 max-sm:pb-0 max-sm:min-h-10">
        <IconChevronRight size={14} className={`shrink-0 text-grey transition-transform duration-200 ${expanded ? "rotate-90" : ""}`} aria-hidden="true" /><Logo seller={s} /><span className="shrink-0">{s.name}</span><span className="cap min-w-0 break-words line-clamp-2 leading-[13px]" title={main.plan}>{short(main.plan)}</span><span className="cap shrink-0">{feeText(main.feeUsd)}</span>
      </button>
      <Track plan={main} scale={ctx.scale} label={`${s.name} ${short(main.plan)}`} />
      <span className="sub-med num text-[13px] text-right">{main.median ? times(main.median) : ""}</span>
    </div>
    <Collapse open={expanded}><PlanGrid hit={hit} ctx={ctx} toggleDollars={toggleDollars} /></Collapse>
  </section>;
});

/** A bar from 1x to the plan's median with one tick at its best model. Hover, a tap or the arrow keys name the bar's end or the tick under the bar. */
function Track({ plan, scale, label }: { plan: PlanSubsidy; scale: Scale; label: string }) {
  const ms = useMemo(() => measured(plan.models), [plan]), [ref, width] = useWidth<HTMLDivElement>();
  const marks = useMemo(() => trackMarks(plan, scale.share, width), [plan, scale, width]);
  const color = useMemo(() => scale.color(mainLab(plan)), [plan, scale]);
  const [on, setOn] = useState<string | null>(null), [kb, setKb] = useState(-1);
  const clear = useCallback(() => setOn(null), []);
  useTapAway(!!on, clear);
  const bind = useScrub(ref, marks, (g) => setOn(g?.k ?? null));
  if (!ms.length) return <span className="sub-cell cap inline-flex items-center gap-1 leading-[21px]"><IconMinus size={12} aria-hidden="true" />not measured</span>;
  const shown = kb >= 0 ? marks[kb] : marks.find((m) => m.k === on), room = (shown?.text.length ?? 0) * 6.6, flip = !!shown && shown.x + room > width;
  const key = (e: KeyboardEvent) => {
    if (e.key === "Escape") return setKb(-1);
    const d = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0;
    if (!d) return;
    e.preventDefault();
    setKb(Math.max(0, Math.min(marks.length - 1, kb < 0 ? (d > 0 ? 0 : marks.length - 1) : kb + d)));
  };
  const best = marks[1];
  return <div ref={ref} className="sub-cell sub-strip hit relative h-10 touch-pan-y" role="group" tabIndex={0} aria-label={`${label}: median ${times(plan.median)}, best ${ms[0].name} ${times(ms[0].multiple)}`} data-hold="" {...bind} onKeyDown={key} onBlur={() => setKb(-1)}>
    <span className="absolute left-0 right-0 top-[16px] h-[7px] rounded-[2px] bg-hair-2" aria-hidden="true" />
    <i className="sub-fill absolute left-0 top-[16px] h-[7px] rounded-[2px]" style={{ width: `max(3px, ${scale.pct(plan.median)})`, background: color }} aria-hidden="true" />
    {ms.length > 1 && <i className="absolute top-[13px] h-[13px] w-[2px] -ml-[1px] rounded-[1px] bg-ink" style={{ left: best.x, opacity: shown && shown.k !== "best" ? 0.4 : 1 }} aria-hidden="true" />}
    {shown && <span className="sub-mark cap absolute top-[28px] whitespace-nowrap text-ink-2" style={flip ? { right: Math.max(0, width - shown.x - 4) } : { left: Math.max(0, shown.x - 4) }} aria-hidden="true">{shown.text}</span>}
    <span className="sr-only" aria-live="polite">{shown?.text}</span>
  </div>;
}
