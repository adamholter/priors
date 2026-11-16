"use client";
import type { ReactNode } from "react";
import type { CostBasis } from "@/data/subscription";
import { activeStudentOffers, studentOptionNote, studentSavingUsd, studentValueMultiple, todayIso, type StudentOffer } from "@/data/student-offers";
import { setStudentPricingPref, useStudentPricingPref } from "@/lib/student-pricing-pref";
import styles from "./ChartSettings.module.css";

type Lab = { labId: string; name: string; plans: { plan: string; feeUsd?: number; models: number }[]; median: { plan: string; models: number }[] };
export interface PlanOptions { labs: Lab[]; value: Record<string, string>; onChange: (labId: string, plan?: string) => void; onReset: () => void }
interface Props { id: string; plans: PlanOptions; basis: { value: CostBasis; onChange: (basis: CostBasis) => void } }

const withFee = (usd?: number) => usd ? ` · $${usd % 1 ? usd.toFixed(2) : usd}/mo` : "";
/** A lab's unpicked option says which plan that is: one plan with its fee, or the most common one and how many more. */
const medianLabel = (l: Lab) => {
  const [top, ...rest] = l.median;
  if (!top) return "Median plan";
  if (rest.length) return `Median: ${top.plan} +${rest.length}`;
  // A long plan name keeps its whole name and leaves the fee to the plan's own option.
  const full = `Median: ${top.plan}${withFee(l.plans.find((p) => p.plan === top.plan)?.feeUsd)}`;
  return full.length > 40 ? `Median: ${top.plan}` : full;
};
const medianTitle = (l: Lab) => l.median.map((m) => `${m.plan}: ${m.models === 1 ? "1 model" : `${m.models} models`}`).join(", ");

export const picked = ({ labs, value }: PlanOptions) => labs.filter((l) => value[l.labId]).length;
const planStatus = ({ plans, basis }: Pick<Props, "plans" | "basis">) => basis.value !== "subscription" ? "API pricing" : picked(plans) ? `${picked(plans)} picked` : "Median";

function Note({ plans, basis }: Pick<Props, "plans" | "basis">) {
  if (basis.value !== "subscription") return <p className={styles.planNote}><span>Plans only apply to subscription pricing.</span><button type="button" onClick={() => basis.onChange("subscription")}>Use subscription</button></p>;
  return <p className={styles.planNote}><span>Each model uses its median plan until you pick one.</span>{picked(plans) > 0 && <button type="button" onClick={plans.onReset}>Reset</button>}</p>;
}

function StudentOffers({ offers, labName }: { offers: StudentOffer[]; labName: (id: string) => string }) {
  if (!offers.length) return <p className={styles.planNote}><span>No official student offers are open right now.</span></p>;
  return <ul className={styles.studentList} aria-label="Official student offers">{offers.map((o) => { const x = studentValueMultiple(o); return <li key={`${o.labId}-${o.plan}`}>
    <strong>{o.plan}</strong> <span>{labName(o.labId)}</span>
    <p>{o.studentFeeUsd === 0 ? "Free" : `$${o.studentFeeUsd}/mo`} for {o.months} months, then ${o.regularFeeUsd}/mo. Saves ${studentSavingUsd(o)}{x ? `, ${x}x the API value per dollar` : ""}.</p>
    <p>{o.eligibility}{o.deadline ? ` Claim by ${o.deadline}.` : ""}</p>
    <a href={o.url} target="_blank" rel="noopener noreferrer">Official page</a>
  </li>; })}</ul>;
}

function PriceBasis({ on }: { on: boolean }) {
  return <div className={styles.planRow}><label id="plan-prices-label">Plan prices</label>
    <div role="group" aria-labelledby="plan-prices-label" className={styles.studentToggle}>
      <button type="button" aria-pressed={!on} onClick={() => setStudentPricingPref(false)}>Regular</button>
      <button type="button" aria-pressed={on} onClick={() => setStudentPricingPref(true)}>Student</button>
    </div>
    {on && <span className={styles.planNote}>Cost charts price a plan at its official student offer where one exists. Rankings, links and saved pages keep regular prices.</span>}
  </div>;
}

function SelectRows({ id, plans, basis, offers }: Props & { offers: readonly StudentOffer[] }) {
  return <>{plans.labs.map((l) => { const v = plans.value[l.labId] ?? ""; return <div key={l.labId} className={styles.planRow}>
    <label htmlFor={`${id}-plan-${l.labId}`}>{l.name}</label>
    <select id={`${id}-plan-${l.labId}`} aria-label={`${l.name} plan`} disabled={basis.value !== "subscription"} title={v || medianTitle(l)} value={v} onChange={(e) => plans.onChange(l.labId, e.target.value || undefined)}>
      <option value="">{medianLabel(l)}</option>
      {l.plans.map((p) => <option key={p.plan} value={p.plan}>{p.plan}{withFee(p.feeUsd)}{studentOptionNote(offers, l.labId, p.plan)}</option>)}
      {v && !l.plans.some((p) => p.plan === v) && <option value={v}>{v} (no data)</option>}
    </select>
  </div>; })}</>;
}

/** The Data tab's collapsed section: stays listed under API pricing, disabled, with the way back to subscription. */
export function PlanSection({ id, plans, basis, extra, children }: Props & { extra?: string; children?: ReactNode }) {
  const student = useStudentPricingPref();
  const offers = student ? activeStudentOffers(todayIso()) : [];
  const names = new Map(plans.labs.map((l) => [l.labId, l.name]));
  return <details className={styles.sub}>
    <summary className="disclosure">Subscription plans<span>{[planStatus({ plans, basis }), extra].filter(Boolean).join(", ")}</span></summary>
    <Note plans={plans} basis={basis} />
    <PriceBasis on={student} />
    <SelectRows id={id} plans={plans} basis={basis} offers={offers} />
    {student && <StudentOffers offers={offers} labName={(l) => names.get(l) ?? l.charAt(0).toUpperCase() + l.slice(1)} />}
    {children}
  </details>;
}
