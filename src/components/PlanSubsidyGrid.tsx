"use client";
import { Fragment, memo, useMemo, useRef, useState, type CSSProperties, type KeyboardEvent } from "react";
import { IconCurrencyDollar, IconHistory, IconLayoutColumns, IconMinus, IconSortDescending } from "@tabler/icons-react";
import type { PlanSubsidy } from "@/lib/model-availability";
import { chunk, feeShort, gridPlans, gridRows, isClosedPlan, modelsOf, rowPlanOf, shortOf, times, usd, usdc, type DScale, type Hit, type Model, type Scale } from "@/lib/plan-subsidies";
import { Collapse, Flags, ModelBars, ModelLink, Sources, order } from "./PlanSubsidyParts";

export type GridCtx = { scale: Scale; dscale: DScale; dollars: boolean; phone: boolean };
const ROWS = 12;

/** An opened company: every plan with figures is a column and every model a row, so a model's climb from Plus to Pro to Max reads straight across. Six plans to a grid (three on a phone), the rest behind one disclosure. A company with fewer than two plans to compare gets one bar list. */
export const PlanGrid = memo(function PlanGrid({ hit, ctx, toggleDollars }: { hit: Hit; ctx: GridCtx; toggleDollars: () => void }) {
  const per = ctx.phone ? 3 : 6, main = rowPlanOf(hit.plans), [more, setMore] = useState(false);
  const cols = useMemo(() => gridPlans(hit), [hit]);
  const chunks = useMemo(() => chunk(cols, per), [cols, per]), none = hit.plans.length - cols.length;
  if (cols.length < 2) {
    const p = cols[0] ?? main;
    return <div className="pt-1 pb-3"><ModelBars models={modelsOf(hit, p)} scale={ctx.scale} />{none > 0 && cols.length > 0 && <NoFigures n={none} />}</div>;
  }
  const rest = cols.length - chunks[0].length;
  return <div className="pt-1 pb-3">
    <Matrix hit={hit} plans={chunks[0]} ctx={ctx} toggleDollars={toggleDollars} />
    {chunks.length > 1 && <>
      <button type="button" aria-expanded={more} onClick={() => setMore((v) => !v)} className="disclosure sub-focus w-full min-h-10 text-[13px] text-ink-2 hover:text-ink sm:pl-[50px] [&::after]:ml-auto"><IconLayoutColumns size={14} className="text-grey" aria-hidden="true" /><span className="cap">{rest} more {rest === 1 ? "plan" : "plans"}</span></button>
      <Collapse open={more}><div className="grid gap-4 pt-1">{chunks.slice(1).map((c) => <Matrix key={c[0].plan} hit={hit} plans={c} ctx={ctx} />)}</div></Collapse>
    </>}
    {none > 0 && <NoFigures n={none} />}
  </div>;
});
const NoFigures = ({ n }: { n: number }) => <p className="cap flex items-center gap-1 pt-2 sm:pl-[50px]"><IconMinus size={12} aria-hidden="true" />{n} {n === 1 ? "plan" : "plans"} not measured</p>;

/** What a cell shows: its multiple, or its dollars of API use for the fee. The other reading is one hover, tap or Enter away. */
function readings(feeUsd: number | undefined, multiple: number, dollars: boolean) {
  const mult = times(multiple), money = feeUsd != null ? usdc(feeUsd * multiple) : null;
  return dollars && money ? { a: money, b: mult } : { a: mult, b: money };
}

function Matrix({ hit, plans, ctx, toggleDollars }: { hit: Hit; plans: PlanSubsidy[]; ctx: GridCtx; toggleDollars?: () => void }) {
  const { s } = hit, short = shortOf(s), { scale, dscale, dollars } = ctx;
  const [sort, setSort] = useState<string | null>(null), [all, setAll] = useState(false), [rov, setRov] = useState("0,0");
  const [flipped, setFlipped] = useState<Record<string, boolean>>({}), [src, setSrc] = useState<Record<string, boolean>>({});
  const rows = useMemo(() => gridRows(hit, plans, sort), [hit, plans, sort]);
  const shown = useMemo(() => (all ? rows : rows.slice(0, ROWS)), [all, rows]), flagged = useMemo(() => rows.some((r) => [...r.cells.values()].some((c) => c.assumed || c.preliminary)), [rows]);
  // The one tab stop: the focused cell, or the first measured cell when sorting leaves that spot empty.
  const stop = useMemo(() => {
    let first = "";
    for (let ri = 0; ri < shown.length; ri++) for (let ci = 0; ci < plans.length; ci++) {
      if (shown[ri].cells.get(plans[ci].plan)?.multiple == null) continue;
      if (`${ri},${ci}` === rov) return rov;
      first ||= `${ri},${ci}`;
    }
    return first;
  }, [shown, plans, rov]);
  const touch = useRef(false), flip = (k: string) => setFlipped((v) => ({ ...v, [k]: !v[k] }));
  const move = (e: KeyboardEvent) => {
    const el = e.target as HTMLElement, r = el.dataset.r, c = el.dataset.c;
    if (e.key === "Escape") { setFlipped({}); return; }
    if (r == null || c == null) return;
    if (e.key === "Enter") { flip(el.dataset.k!); return; }
    const dr = e.key === "ArrowDown" ? 1 : e.key === "ArrowUp" ? -1 : 0, dc = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0;
    if (!dr && !dc) return;
    e.preventDefault();
    const next = e.currentTarget.querySelector<HTMLElement>(`[data-r="${+r + dr}"][data-c="${+c + dc}"]`);
    if (next) { setRov(`${next.dataset.r},${next.dataset.c}`); next.focus(); }
  };
  return <div><div className="sub-matrix" role="table" aria-label={`${s.name} value per dollar by plan`} style={{ "--n": plans.length } as CSSProperties} data-flag={flagged ? "" : undefined} onKeyDown={move}>
    <div role="row" className="sub-mrow sub-mhead sub-stick2 z-20 bg-bone">
      <span role="columnheader" className="flex justify-end sm:pr-1">
        <span className="sr-only">Model</span>
        {toggleDollars && <button type="button" className="hit sub-focus grid place-items-center w-8 h-8 -mt-1.5 rounded-[4px] text-grey hover:text-ink aria-pressed:text-ink" aria-pressed={dollars} aria-label="Show dollars of API use" title="Dollars of API use" onClick={toggleDollars}><IconCurrencyDollar size={18} stroke={1.6} aria-hidden="true" /></button>}
      </span>
      {plans.map((p) => <button key={p.plan} type="button" role="columnheader" title={p.plan} aria-sort={sort === p.plan ? "descending" : "none"} onClick={() => setSort((v) => (v === p.plan ? null : p.plan))} className="sub-mh sub-focus min-w-0 text-left">
        <span className="flex items-start gap-1 text-[13px] max-sm:text-[11px] leading-tight font-medium">{isClosedPlan(p.plan) && <IconHistory size={12} className="mt-0.5 shrink-0 text-grey" aria-hidden="true" />}<span className="min-w-0 break-words line-clamp-2 max-sm:line-clamp-3">{short(p.plan)}</span>{sort === p.plan && <IconSortDescending size={12} className="mt-0.5 shrink-0" aria-hidden="true" />}</span>
        <span className="cap block">{feeShort(p.feeUsd)}</span>
      </button>)}
    </div>
    {shown.map(({ m, cells }, ri) => {
      const val = (p: PlanSubsidy, c: Model) => (dollars && p.feeUsd != null ? p.feeUsd * (c.multiple ?? 0) : c.multiple ?? 0);
      const top = Math.max(...plans.map((p) => { const c = cells.get(p.plan); return c ? val(p, c) : 0; }));
      return <Fragment key={m.id}>
        <div role="row" className="sub-mrow sub-mline sub-anim" style={order(ri)}>
          <span role="rowheader" className="min-w-0 text-[13px] max-sm:text-[12.5px] max-sm:leading-tight sm:pl-[50px]"><ModelLink m={m} className="max-sm:whitespace-normal max-sm:[display:-webkit-box] max-sm:[-webkit-line-clamp:2] max-sm:[-webkit-box-orient:vertical] max-sm:break-words" /></span>
          {plans.map((p, ci) => {
            const c = cells.get(p.plan), k = `${m.id}|${p.plan}`;
            if (!c) return <span key={p.plan} role="cell" className="sub-mcell" />;
            if (c.multiple == null) return <span key={p.plan} role="cell" className="sub-mcell text-grey" title="Not measured"><IconMinus size={12} aria-hidden="true" /></span>;
            const best = val(p, c) >= top * 0.99, fill = dollars && p.feeUsd != null ? dscale.share(p.feeUsd * c.multiple) : scale.share(c.multiple), { a, b } = readings(p.feeUsd, c.multiple, dollars);
            return <span key={p.plan} role="cell" tabIndex={stop === `${ri},${ci}` ? 0 : -1} data-r={ri} data-c={ci} data-k={k} data-best={best ? "" : undefined} data-flip={flipped[k] ? "" : undefined} aria-label={`${m.name} on ${short(p.plan)}: ${times(c.multiple)}${p.feeUsd != null ? `, ${usd(p.feeUsd * c.multiple)} of API use` : ""}`}
              className="sub-mcell sub-focus" onFocus={() => setRov(`${ri},${ci}`)} onPointerDown={(e) => { touch.current = e.pointerType === "touch"; }} onClick={(e) => { if (b && touch.current && !(e.target as HTMLElement).closest("button")) flip(k); }}>
              <span className="sub-mbar"><i className="sub-grow" style={{ width: `${Math.max(2, fill * 100)}%`, background: scale.color(c.lab) }} /></span>
              {flagged && <span className="sub-mflag">{(c.assumed || c.preliminary) && <Flags m={c} open={!!src[k]} onToggle={() => setSrc((v) => ({ ...v, [k]: !v[k] }))} />}</span>}
              <span className="sub-mnum num" aria-hidden="true"><b>{a}</b>{b && <b>{b}</b>}</span>
            </span>;
          })}
        </div>
        {plans.map((p) => { const c = cells.get(p.plan); return c?.preliminary && src[`${m.id}|${p.plan}`] ? <div key={p.plan} role="row"><div role="cell"><Sources m={c} className="sub-msrc sm:pl-[50px]" /></div></div> : null; })}
      </Fragment>;
    })}
    </div>
    {rows.length > ROWS && <button type="button" aria-expanded={all} onClick={() => setAll((v) => !v)} className="disclosure sub-focus w-full min-h-10 text-[13px] text-ink-2 hover:text-ink sm:pl-[50px]"><span>{all ? "Show fewer" : `Show all ${rows.length}`}</span></button>}
  </div>;
}
