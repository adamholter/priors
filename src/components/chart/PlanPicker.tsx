"use client";
import type { ReactNode } from "react";
import type { CostBasis } from "@/data/subscription";
import styles from "./ChartSettings.module.css";

type Lab = { labId: string; name: string; plans: { plan: string; feeUsd?: number; models: number }[]; median: { plan: string; models: number }[] };
export interface PlanOptions { labs: Lab[]; value: Record<string, string>; onChange: (labId: string, plan?: string) => void; onReset: () => void }
interface Props { id: string; plans: PlanOptions; basis: { value: CostBasis; onChange: (basis: CostBasis) => void } }

const withFee = (usd?: number) => usd ? ` · $${usd % 1 ? usd.toFixed(2) : usd}/mo` : "";
/** A lab's unpicked option says which plan that is: one plan with its fee, or the most common one and how many more. */
const medianLabel = (l: Lab) => {
  const [top, ...rest] = l.median;
  return !top ? "Median plan" : rest.length ? `Median: ${top.plan} +${rest.length}` : `Median: ${top.plan}${withFee(l.plans.find((p) => p.plan === top.plan)?.feeUsd)}`;
};
const medianTitle = (l: Lab) => l.median.map((m) => `${m.plan}: ${m.models === 1 ? "1 model" : `${m.models} models`}`).join(", ");

export const picked = ({ labs, value }: PlanOptions) => labs.filter((l) => value[l.labId]).length;
const planStatus = ({ plans, basis }: Pick<Props, "plans" | "basis">) => basis.value !== "subscription" ? "API pricing" : picked(plans) ? `${picked(plans)} picked` : "Median";

function Note({ plans, basis }: Pick<Props, "plans" | "basis">) {
  if (basis.value !== "subscription") return <p className={styles.planNote}><span>Plans only apply to subscription pricing.</span><button type="button" onClick={() => basis.onChange("subscription")}>Use subscription</button></p>;
  return <p className={styles.planNote}><span>Each model uses its median plan until you pick one.</span>{picked(plans) > 0 && <button type="button" onClick={plans.onReset}>Reset</button>}</p>;
}

function SelectRows({ id, plans, basis }: Props) {
  return <>{plans.labs.map((l) => { const v = plans.value[l.labId] ?? ""; return <div key={l.labId} className={styles.planRow}>
    <label htmlFor={`${id}-plan-${l.labId}`}>{l.name}</label>
    <select id={`${id}-plan-${l.labId}`} aria-label={`${l.name} plan`} disabled={basis.value !== "subscription"} title={v || medianTitle(l)} value={v} onChange={(e) => plans.onChange(l.labId, e.target.value || undefined)}>
      <option value="">{medianLabel(l)}</option>
      {l.plans.map((p) => <option key={p.plan} value={p.plan}>{p.plan}{withFee(p.feeUsd)}</option>)}
      {v && !l.plans.some((p) => p.plan === v) && <option value={v}>{v} (no data)</option>}
    </select>
  </div>; })}</>;
}

/** The Data tab's collapsed section: stays listed under API pricing, disabled, with the way back to subscription. */
export function PlanSection({ id, plans, basis, extra, children }: Props & { extra?: string; children?: ReactNode }) {
  return <details className={styles.sub}>
    <summary className="disclosure">Subscription plans<span>{[planStatus({ plans, basis }), extra].filter(Boolean).join(", ")}</span></summary>
    <Note plans={plans} basis={basis} />
    <SelectRows id={id} plans={plans} basis={basis} />
    {children}
  </details>;
}
