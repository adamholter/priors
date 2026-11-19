"use client";
/**
 * The bar at the bottom of every chart's settings: say what you want in plain words and an agent (`/api/chart-agent`) changes the
 * chart, its settings, or the plan data it is priced with. Data adjustments are kept in this browser and listed here, each removable.
 */
import { useState } from "react";
import Link from "next/link";
import { IconArrowUp, IconX } from "@tabler/icons-react";
import type { CostBasis } from "@/data/subscription";
import type { PlanAdjustment } from "@/data/plan-defaults";
import { setPlanAdjustments, usePlanAdjustments } from "@/lib/subscription-plans-pref";
import "./chart-composer.css";

export type ChartChanges = {
  reply?: string;
  view?: Partial<{ labelScale: number; dotScale: number; lineScale: number; density: number; frontier: boolean; links: boolean; scale: "log" | "linear"; allModels: boolean; paretoOnly: boolean; kind: "scatter" | "bars" }>;
  settings?: Partial<{ costBasis: CostBasis; efforts: string[]; mode: "all" | "best"; releasedAfter: string; dataSource: string; freeTiers: "generous" | "limited" | "off"; planResets: boolean; planReading: string }>;
  plans?: { lab: string; plan: string | null }[];
  models?: { showOnly?: string[]; hide?: string[]; show?: string[] };
  dataOverrides?: PlanAdjustment[];
};

const describe = (a: PlanAdjustment) => a.note || (a.kind === "cost" ? `${a.model} cost ×${a.factor.toFixed(2)}` : `${a.plan ?? a.lab ?? a.model} allowance ×${a.factor.toFixed(2)}`);

export function ChartComposer({ label, context, apply }: { label: string; context: () => string; apply: (changes: ChartChanges) => void }) {
  const adjustments = usePlanAdjustments();
  const [text, setText] = useState(""), [busy, setBusy] = useState(false), [reply, setReply] = useState<{ text: string; signIn?: boolean; error?: boolean } | null>(null);
  const send = async () => {
    const message = text.trim();
    if (!message || busy) return;
    setBusy(true); setReply(null);
    try {
      const res = await fetch("/api/chart-agent", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ message, context: context() }) });
      const data = await res.json().catch(() => ({})) as { reply?: string; changes?: ChartChanges; error?: string };
      if (res.status === 401) { setReply({ text: "Sign in to change charts by asking.", signIn: true }); return; }
      if (!res.ok || data.error) { setReply({ text: data.error ?? "That did not work. Nothing was changed.", error: true }); return; }
      if (data.changes) {
        apply(data.changes);
        if (data.changes.dataOverrides?.length) setPlanAdjustments([...adjustments, ...data.changes.dataOverrides]);
      }
      setReply({ text: data.reply || "Done." }); setText("");
    } catch { setReply({ text: "Could not reach the chart agent. Nothing was changed.", error: true }); } finally { setBusy(false); }
  };
  return <div className="cc-root" data-busy={busy || undefined}>
    {adjustments.length > 0 && <ul className="cc-adjustments" aria-label="Your data adjustments">{adjustments.map((a, i) => <li key={`${i}-${a.note}`}><span>{describe(a)}</span><button type="button" aria-label={`Remove: ${describe(a)}`} onClick={() => setPlanAdjustments(adjustments.filter((_, j) => j !== i))}><IconX size={13} stroke={1.8} aria-hidden="true" /></button></li>)}</ul>}
    {reply && <p className={`cc-reply ${reply.error ? "is-error" : ""}`} role="status">{reply.text}{reply.signIn && <> <Link href="/sign-in" prefetch={false}>Sign in</Link></>}</p>}
    <form className="cc-pill" onSubmit={(e) => { e.preventDefault(); void send(); }} aria-busy={busy}>
      {busy && <span className="cc-sweep" aria-hidden="true" />}
      <input value={text} onChange={(e) => setText(e.target.value)} placeholder={busy ? "Working on it" : "Ask for any change to this chart"} aria-label={`Ask for a change to ${label}`} readOnly={busy} />
      <button type="submit" aria-label={busy ? "Working" : "Send"} disabled={!busy && !text.trim()}>
        {busy ? <span className="cc-dots" aria-hidden="true"><i /><i /><i /></span> : <IconArrowUp size={15} stroke={2} aria-hidden="true" />}
      </button>
    </form>
  </div>;
}
