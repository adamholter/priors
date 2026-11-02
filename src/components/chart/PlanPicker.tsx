"use client";
import { createContext, useContext } from "react";
import { IconChevronLeft, IconChevronRight } from "@tabler/icons-react";
import type { CostBasis } from "@/data/subscription";
import styles from "./ChartSettings.module.css";

/** Where the plan picker sits in the chart settings. Live: `advanced`. The others exist for `/lab/plans`. */
export type PlanLayout = "advanced" | "pricing" | "choices" | "page";
export const PlanLayoutContext = createContext<PlanLayout>("advanced");
export const usePlanLayout = () => useContext(PlanLayoutContext);

type Lab = { labId: string; name: string; plans: { plan: string; feeUsd?: number; models: number }[]; median: { plan: string; models: number }[] };
export interface PlanOptions { labs: Lab[]; value: Record<string, string>; onChange: (labId: string, plan?: string) => void; onReset: () => void }
interface Props { id: string; plans: PlanOptions; basis: { value: CostBasis; onChange: (basis: CostBasis) => void } }

const fee = (usd?: number) => usd ? `$${usd % 1 ? usd.toFixed(2) : usd}/mo` : "";
const withFee = (usd?: number) => usd ? ` · ${fee(usd)}` : "";
/** A lab's unpicked option says which plan that is: one plan with its fee, or the most common one and how many more. */
const medianLabel = (l: Lab) => {
  const [top, ...rest] = l.median;
  return !top ? "Median plan" : rest.length ? `Median: ${top.plan} +${rest.length} more` : `Median: ${top.plan}${withFee(l.plans.find((p) => p.plan === top.plan)?.feeUsd)}`;
};
const medianTitle = (l: Lab) => l.median.map((m) => `${m.plan}: ${m.models === 1 ? "1 model" : `${m.models} models`}`).join(", ");

export const picked = ({ labs, value }: PlanOptions) => labs.filter((l) => value[l.labId]).length;
export const planStatus = ({ plans, basis }: Pick<Props, "plans" | "basis">) => basis.value !== "subscription" ? "API pricing" : picked(plans) ? `${picked(plans)} picked` : "Median";

function Note({ plans, basis }: Pick<Props, "plans" | "basis">) {
  if (basis.value !== "subscription") return <p className={styles.planNote}><span>Plans only apply to subscription pricing.</span><button type="button" onClick={() => basis.onChange("subscription")}>Use subscription</button></p>;
  return <p className={styles.planNote}><span>Each model uses its median plan until you pick one.</span>{picked(plans) > 0 && <button type="button" onClick={plans.onReset}>Reset</button>}</p>;
}

function SelectRows({ id, plans, basis }: Props) {
  return <>{plans.labs.map((l) => { const v = plans.value[l.labId] ?? ""; return <div key={l.labId} className={styles.planRow}>
    <label htmlFor={`${id}-plan-${l.labId}`}>{l.name}</label>
    <select id={`${id}-plan-${l.labId}`} aria-label={`${l.name} plan`} disabled={basis.value !== "subscription"} title={v ? undefined : medianTitle(l)} value={v} onChange={(e) => plans.onChange(l.labId, e.target.value || undefined)}>
      <option value="">{medianLabel(l)}</option>
      {l.plans.map((p) => <option key={p.plan} value={p.plan}>{p.plan}{withFee(p.feeUsd)}</option>)}
      {v && !l.plans.some((p) => p.plan === v) && <option value={v}>{v} (no data)</option>}
    </select>
  </div>; })}</>;
}

/** Every plan on show, one lab open at a time: fee and how many models it prices, without opening a dropdown. */
function ChoiceRows({ id, plans, basis }: Props) {
  const off = basis.value !== "subscription";
  return <>{plans.labs.map((l) => { const v = plans.value[l.labId] ?? ""; const radio = (plan: string) => <input type="radio" name={`${id}-choice-${l.labId}`} disabled={off} checked={v === plan} onChange={() => plans.onChange(l.labId, plan || undefined)} />; return <details key={l.labId} name={`${id}-choice`} className={styles.planChoice}>
    <summary><b>{l.name}</b><span>{v || medianLabel(l)}</span></summary>
    <div role="radiogroup" aria-label={`${l.name} plan`}>
      <label title={medianTitle(l)}>{radio("")}<span>{medianLabel(l)}</span></label>
      {l.plans.map((p) => <label key={p.plan}>{radio(p.plan)}<span>{p.plan}</span><small>{[fee(p.feeUsd), p.models === 1 ? "1 model" : `${p.models} models`].filter(Boolean).join(" · ")}</small></label>)}
    </div>
  </details>; })}</>;
}

/** A collapsed section: `advanced` inside Advanced, `pricing` and `choices` right under the Pricing toggle. */
export function PlanSection({ id, plans, basis, layout }: Props & { layout: PlanLayout }) {
  return <details className={`${styles.sub} ${layout === "advanced" ? "" : styles.subPlain}`}>
    <summary>Subscription plans<span>{planStatus({ plans, basis })}</span></summary>
    <Note plans={plans} basis={basis} />
    {layout === "choices" ? <ChoiceRows id={id} plans={plans} basis={basis} /> : <SelectRows id={id} plans={plans} basis={basis} />}
  </details>;
}

/** The `page` layout's row under Pricing, and the panel it opens in place of the settings. */
export function PlanPageRow({ plans, basis, onOpen }: Pick<Props, "plans" | "basis"> & { onOpen: () => void }) {
  return <button type="button" className={styles.planPageRow} onClick={onOpen}><span>Subscription plans</span><span>{planStatus({ plans, basis })}</span><IconChevronRight size={14} stroke={1.5} aria-hidden="true" /></button>;
}
export function PlanPage({ id, plans, basis, onBack }: Props & { onBack: () => void }) {
  return <>
    <button type="button" className={styles.planBack} onClick={onBack}><IconChevronLeft size={14} stroke={1.5} aria-hidden="true" />Subscription plans</button>
    <Note plans={plans} basis={basis} />
    <SelectRows id={id} plans={plans} basis={basis} />
  </>;
}
