"use client";
import { PlanCaveatSources } from "@/components/PlanCaveatSources";
import { useState } from "react";
import type { ModelAvailability } from "@/lib/model-availability";

const usd = (v: number) => `$${v >= 100 ? Math.round(v) : v >= 0.01 ? v.toFixed(2) : v.toPrecision(2)}`;
const fee = (v?: number) => (v == null ? "" : v === 0 ? "free" : `$${Number.isInteger(v) ? v : v.toFixed(2)}`);
const multiple = (ratio: number) => { const m = 1 / ratio; return `${m >= 10 ? Math.round(m) : m.toFixed(1)}x`; };
const FIRST_PROVIDERS = 8;

/** Where the model can be used: subscriptions with what they give per dollar, and the API providers serving it. */
export function ModelAvailabilitySection({ data }: { data: ModelAvailability }) {
  const { plans, providers, openRouterUrl, aaUrl } = data;
  const [all, setAll] = useState(false);
  const shown = all ? providers : providers.slice(0, FIRST_PROVIDERS), top = Math.max(...plans.flatMap((p) => (p.ratio ? [1 / p.ratio] : [])), 1);
  return <section className="grid gap-4" data-availability>
    <div className="border-b hairline pb-2"><h2 className="text-[26px]">Availability</h2></div>
    <div className={`grid gap-x-10 gap-y-8 ${plans.length && providers.length ? "lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]" : ""}`}>
      {plans.length > 0 && <div className="grid gap-2 content-start min-w-0">
        <div className="flex items-baseline justify-between gap-3"><h3 className="text-[18px]">Subscriptions</h3><span className="cap">API value per $</span></div>
        <ul className="grid gap-3">{plans.map((p) => <li key={p.plan} className="grid gap-1 min-w-0">
          <div className="flex items-baseline gap-2 text-[13px] min-w-0">
            <span className="truncate" title={p.plan}>{p.plan}</span>
            {p.preliminary ? <span className="cap shrink-0" title={`${p.preliminary.short} ${p.preliminary.note}`}>{p.preliminary.label.toLowerCase()}</span> : p.assumed && <span className="cap shrink-0">assumed</span>}
            <span className="cap shrink-0 ml-auto">{p.free ? "" : `${fee(p.feeUsd)}/mo`}</span>
            {p.free ? <span className="num shrink-0 w-[46px] text-right">free</span> : p.ratio ? <span className="num shrink-0 w-[46px] text-right">{multiple(p.ratio)}</span> : <span className="cap shrink-0">not measured</span>}
          </div>
          <PlanCaveatSources caveat={p.preliminary} />
          <span className="h-[6px] rounded-[2px] bg-hair-2 overflow-hidden" aria-hidden="true"><i className="block h-full rounded-[2px] bg-indigo" style={{ width: p.free ? "100%" : p.ratio ? `${Math.max(2, 100 / p.ratio / top).toFixed(2)}%` : 0 }} /></span>
        </li>)}</ul>
      </div>}
      {providers.length > 0 && <div className="grid gap-2 content-start min-w-0">
        <div className="flex items-baseline justify-between gap-3"><h3 className="text-[18px]">API providers</h3><span className="cap">{providers.length}</span></div>
        <div className="grid grid-cols-[minmax(0,1fr)_112px_50px_50px] gap-x-3 cap pb-1 border-b hairline"><span>Provider</span><span className="text-right">In / out per 1M</span><span className="text-right">Tok/s</span><span className="text-right">First</span></div>
        <ul className="grid">{shown.map((p) => <li key={p.provider} className="grid grid-cols-[minmax(0,1fr)_112px_50px_50px] gap-x-3 items-baseline py-[5px] text-[13px] border-b hairline last:border-b-0">
          <span className="truncate" title={p.provider}>{p.provider}</span>
          <span className="num text-[12px] text-right whitespace-nowrap">{p.input != null && p.output != null ? `${usd(p.input)} / ${usd(p.output)}` : ""}</span>
          <span className="num text-[12px] text-right">{p.speed ? Math.round(p.speed) : ""}</span>
          <span className="num text-[12px] text-right">{p.ttft ? `${p.ttft.toFixed(1)}s` : ""}</span>
        </li>)}</ul>
        {providers.length > FIRST_PROVIDERS && <button type="button" className="btn-quiet justify-self-start max-sm:min-h-[44px]" onClick={() => setAll((v) => !v)}>{all ? "Show fewer" : `Show all ${providers.length}`}</button>}
        <p className="cap">{openRouterUrl && <a className="underline" href={openRouterUrl} target="_blank" rel="noreferrer">OpenRouter</a>}{openRouterUrl && aaUrl && ", "}{aaUrl && <a className="underline" href={aaUrl} target="_blank" rel="noreferrer">Artificial Analysis</a>}</p>
      </div>}
    </div>
  </section>;
}
