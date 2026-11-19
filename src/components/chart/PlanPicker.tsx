"use client";
import { useState, type ReactNode } from "react";
import { IconChevronRight, IconInfoCircle } from "@tabler/icons-react";
import { studentBase, studentOfferFor, type CostBasis } from "@/data/subscription";
import { naturalPlanName } from "@/data/plan-defaults";
import { studentSavingUsd, studentValueMultiple, todayIso, type StudentOffer } from "@/data/student-offers";
import styles from "./ChartSettings.module.css";
import "./plan-picker.css";

/** `multiple`: how many times the fee in API value the lab's models get on the plan (median), when measured. */
type Lab = { labId: string; name: string; plans: { plan: string; feeUsd?: number; models: number; multiple?: number }[]; median: { plan: string; models: number }[] };
export interface PlanOptions { labs: Lab[]; value: Record<string, string>; onChange: (labId: string, plan?: string) => void; onReset: () => void }
/** Two readings of a model's plan rate (Fable 5.2), from `planReadingSettings`. */
export type PlanReading = { models: { name: string }[]; options: { id: string; name: string; note: string }[]; value: string; onChange: (id: string) => void };
interface Props { id: string; plans: PlanOptions; basis: { value: CostBasis; onChange: (basis: CostBasis) => void } }

export const picked = ({ labs, value }: PlanOptions) => labs.filter((l) => value[l.labId]).length;
const planStatus = ({ plans, basis }: Pick<Props, "plans" | "basis">) => basis.value !== "subscription" ? "API pricing" : picked(plans) ? `${picked(plans)} picked` : "Best common plan";
const fee = (v?: number) => v == null ? "" : `$${Number.isInteger(v) ? v : v.toFixed(2)}/mo`;
const times = (m: number) => `${m >= 10 ? Math.round(m) : m.toFixed(1)}x`;

/** Model labs whose logo is in `public/logos` (under the id the subsidies page uses for the company). */
const LOGO: Record<string, string> = { anthropic: "anthropic", openai: "openai", google: "google", xai: "xai", cursor: "cursor", moonshot: "kimi", zhipu: "zhipu", minimax: "minimax", xiaomi: "xiaomi", tencent: "tencent", alibaba: "alibaba", mistral: "mistral", cognition: "devin" };
function Logo({ lab, name }: { lab: string; name: string }) {
  // eslint-disable-next-line @next/next/no-img-element
  return LOGO[lab] ? <img className="pp-logo" src={`/logos/${LOGO[lab]}.png`} alt="" width={18} height={18} loading="lazy" /> : <span className="pp-logo pp-letter" aria-hidden="true">{name.slice(0, 1)}</span>;
}

function Note({ plans, basis }: Pick<Props, "plans" | "basis">) {
  if (basis.value !== "subscription") return <p className={styles.planNote}><span>Plans only apply to subscription pricing.</span><button type="button" onClick={() => basis.onChange("subscription")}>Use subscription</button></p>;
  return <p className={styles.planNote}><span>Each lab starts on its best common plan. Lines show API value per dollar.</span>{picked(plans) > 0 && <button type="button" onClick={plans.onReset}>Reset</button>}</p>;
}

/** A picked student option: what the offer is, who can claim it, and the lab's own page. */
function StudentOfferCard({ offer }: { offer: StudentOffer }) {
  const x = studentValueMultiple(offer);
  return <div className={styles.studentList} aria-label="Student offer">
    <p>{offer.studentFeeUsd === 0 ? "Free" : `$${offer.studentFeeUsd}/mo`} for {offer.months} months, then ${offer.regularFeeUsd}/mo. Saves ${studentSavingUsd(offer)}{x ? `, ${x}x the API value per dollar` : ""}.{offer.models ? " Only some of the plan's models are covered; the rest keep the regular price." : ""}</p>
    <p>{offer.eligibility}{offer.deadline ? ` Claim by ${offer.deadline}.` : ""}</p>
    <a href={offer.url} target="_blank" rel="noopener noreferrer">Official page</a>
  </div>;
}

/** Fable 5.2's two readings as a two-way switch, with what each means on hover. */
export function PlanReadingSwitch({ reading }: { reading: PlanReading }) {
  const label = `${reading.models.map((m) => m.name).join(", ")} counts`;
  return <div className="pp-reading">
    <span title={reading.options.map((o) => `${o.name}: ${o.note}`).join("\n\n")}>{label}<IconInfoCircle size={13} stroke={1.6} aria-hidden="true" /></span>
    <div role="group" aria-label={`${reading.models.map((m) => m.name).join(", ")} plan rate`}>{reading.options.map((o) => <button key={o.id} type="button" aria-pressed={reading.value === o.id} title={o.note} onClick={() => reading.onChange(o.id)}>{o.name}</button>)}</div>
  </div>;
}

/** What a lab is priced at now: the visitor's pick, else the plan most of its models default to, and how many sit on other plans. */
function current(l: Lab, value: Record<string, string>) {
  const pick = value[l.labId];
  if (pick) return { plan: pick, picked: true, others: 0 };
  const [top, ...rest] = l.median;
  return { plan: top?.plan, picked: false, others: rest.reduce((a, m) => a + m.models, 0) };
}

/** A subsidy as a line on one log scale for every lab (1x at the left, the biggest at the right). */
function Line({ multiple, high }: { multiple?: number; high: number }) {
  const share = multiple == null ? 0 : Math.log(Math.max(multiple, 1)) / Math.log(high);
  return <span className="pp-line" aria-hidden="true">{multiple != null && <i style={{ width: `max(3px, ${(share * 100).toFixed(1)}%)` }} />}</span>;
}

/**
 * One row per lab: its logo, the plan its models are priced at and that plan's subsidy as a line. Opening a row lists every plan
 * that sells the lab's models, the biggest subsidy first; clicking one prices the lab's models on it, clicking it again goes back.
 */
function LabRows({ id, plans, basis, reading }: Props & { reading?: PlanReading }) {
  const [open, setOpen] = useState<string | null>(null), disabled = basis.value !== "subscription", today = todayIso();
  const high = Math.max(100, ...plans.labs.flatMap((l) => l.plans.flatMap((p) => p.multiple ?? [])));
  return <div className="pp-rows">{plans.labs.map((l) => {
    const now = current(l, plans.value), mine = l.plans.find((p) => p.plan === now.plan), expanded = open === l.labId, defaults = new Map(l.median.map((m) => [m.plan, m.models]));
    const offer = now.picked && studentBase(now.plan!) !== undefined ? studentOfferFor(l.labId, now.plan!, today) : undefined;
    const list = [...l.plans].sort((a, b) => (b.multiple ?? -1) - (a.multiple ?? -1) || (a.feeUsd ?? 0) - (b.feeUsd ?? 0));
    return <div key={l.labId} className="pp-lab" data-open={expanded || undefined} data-lab={l.labId}>
      <button type="button" className="pp-head" aria-expanded={expanded} aria-controls={`${id}-plans-${l.labId}`} aria-label={`${l.name} plan: ${now.plan ? naturalPlanName(now.plan) : "none"}`} title={l.name} onClick={() => setOpen(expanded ? null : l.labId)}>
        <IconChevronRight size={13} stroke={1.8} className="pp-chev" aria-hidden="true" />
        <Logo lab={l.labId} name={l.name} />
        <span className={`pp-current ${now.picked ? "is-picked" : ""}`}>{now.plan ? naturalPlanName(now.plan) : "No plan"}{now.others ? <small> · {now.others} on other plans</small> : null}</span>
        <Line multiple={mine?.multiple} high={high} />
        <span className="pp-num">{mine?.multiple != null ? times(mine.multiple) : ""}</span>
      </button>
      {expanded && <div className="pp-plans" id={`${id}-plans-${l.labId}`} role="radiogroup" aria-label={`${l.name} plan`}>
        {list.map((p) => {
          const on = p.plan === now.plan;
          return <button key={p.plan} type="button" role="radio" aria-checked={on} disabled={disabled} className={`pp-plan ${on ? "is-on" : ""}`} title={p.plan} onClick={() => plans.onChange(l.labId, on ? undefined : p.plan)}>
            <span className="pp-name"><span className="pp-label">{naturalPlanName(p.plan)}</span>{defaults.has(p.plan) && <small title={l.median.length > 1 ? `${defaults.get(p.plan)} of ${l.name}'s models default to it` : undefined}>default</small>}</span>
            <span className="pp-fee">{fee(p.feeUsd)}</span>
            <Line multiple={p.multiple} high={high} />
            <span className="pp-num">{p.multiple != null ? times(p.multiple) : ""}</span>
          </button>;
        })}
        {now.picked && !disabled && <button type="button" className="pp-back" onClick={() => plans.onChange(l.labId, undefined)}>Back to the default</button>}
        {offer && <StudentOfferCard offer={offer} />}
        {reading && l.labId === "anthropic" && <PlanReadingSwitch reading={reading} />}
      </div>}
    </div>;
  })}</div>;
}

/** The Data tab's collapsed section: stays listed under API pricing, disabled, with the way back to subscription. */
export function PlanSection({ id, plans, basis, extra, reading, children }: Props & { extra?: string; reading?: PlanReading; children?: ReactNode }) {
  // The Fable switch lives in Anthropic's list; without an Anthropic row it stands on its own line.
  const loose = reading && !plans.labs.some((l) => l.labId === "anthropic");
  return <details className={styles.sub}>
    <summary className="disclosure">Subscription plans<span>{[planStatus({ plans, basis }), extra].filter(Boolean).join(", ")}</span></summary>
    <Note plans={plans} basis={basis} />
    <LabRows id={id} plans={plans} basis={basis} reading={reading} />
    {loose && <PlanReadingSwitch reading={reading} />}
    {children}
  </details>;
}
