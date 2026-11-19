"use client";
/**
 * The bar at the bottom of every chart's settings: say what you want in plain words, or ask why the chart looks the way it does, and an
 * agent (`/api/chart-agent`) answers. It sees what the chart draws, can look up any model's data, and changes the chart, its settings, or
 * the plan data it is priced with. The conversation carries on until the page reloads. Data adjustments are kept in this browser and
 * listed here, each removable.
 */
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { IconArrowUp, IconX } from "@tabler/icons-react";
import type { CostBasis } from "@/data/subscription";
import type { PlanAdjustment } from "@/data/plan-defaults";
import { setPlanAdjustments, usePlanAdjustments } from "@/lib/subscription-plans-pref";
import "./chart-composer.css";

export type ChartChanges = {
  reply?: string;
  view?: Partial<{ labelScale: number; dotScale: number; lineScale: number; density: number; frontier: boolean; links: boolean; guides: boolean; scale: "log" | "linear"; allModels: boolean; paretoOnly: boolean; kind: "scatter" | "bars"; formula: string; formulaBetter: "higher" | "lower" }>;
  grid?: boolean;
  settings?: Partial<{ costBasis: CostBasis; efforts: string[]; mode: "all" | "best"; releasedAfter: string; dataSource: string; freeTiers: "generous" | "limited" | "off"; planResets: boolean; planReading: string; minUsers: number | null; speedTiers: string[] | null }>;
  plans?: { lab: string; plan: string | null }[];
  models?: { showOnly?: string[]; hide?: string[]; show?: string[] };
  highlight?: { mode: "set" | "add" | "remove" | "clear"; models?: string[] };
  dataOverrides?: PlanAdjustment[];
};
type Turn = { role: "user" | "assistant"; content: string; error?: boolean; signIn?: boolean };

const describe = (a: PlanAdjustment) => a.note || (a.kind === "cost" ? `${a.model} cost ×${a.factor.toFixed(2)}` : `${a.plan ?? a.lab ?? a.model} allowance ×${a.factor.toFixed(2)}`);
/** Per chart, while the page is open: reopening the menu keeps the conversation. */
const conversations = new Map<string, Turn[]>();

export function ChartComposer({ label, context, apply }: { label: string; context: () => string | Promise<string>; apply: (changes: ChartChanges) => void }) {
  const adjustments = usePlanAdjustments();
  const [text, setText] = useState(""), [busy, setBusy] = useState(false), [turns, setTurns] = useState<Turn[]>(() => conversations.get(label) ?? []);
  const log = useRef<HTMLDivElement>(null);
  useEffect(() => { conversations.set(label, turns); log.current?.scrollTo({ top: log.current.scrollHeight }); }, [label, turns]);
  const send = async () => {
    const message = text.trim();
    if (!message || busy) return;
    const history = turns.filter((t) => !t.error).map(({ role, content }) => ({ role, content }));
    setBusy(true); setText(""); setTurns((t) => [...t, { role: "user", content: message }]);
    const answer = (turn: Omit<Turn, "role">) => setTurns((t) => [...t, { role: "assistant", ...turn }]);
    try {
      const res = await fetch("/api/chart-agent", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ message, context: await context(), history }) });
      const data = await res.json().catch(() => ({})) as { reply?: string; changes?: ChartChanges; error?: string };
      if (res.status === 401) return answer({ content: "Sign in to change charts by asking.", signIn: true, error: true });
      if (!res.ok || data.error) return answer({ content: data.error ?? "That did not work. Nothing was changed.", error: true });
      if (data.changes) {
        apply(data.changes);
        if (data.changes.dataOverrides?.length) setPlanAdjustments([...adjustments, ...data.changes.dataOverrides]);
      }
      answer({ content: data.reply || "Done." });
    } catch { answer({ content: "Could not reach the chart agent. Nothing was changed.", error: true }); } finally { setBusy(false); }
  };
  return <div className="cc-root" data-busy={busy || undefined}>
    {adjustments.length > 0 && <ul className="cc-adjustments" aria-label="Your data adjustments">{adjustments.map((a, i) => <li key={`${i}-${a.note}`}><span>{describe(a)}</span><button type="button" aria-label={`Remove: ${describe(a)}`} onClick={() => setPlanAdjustments(adjustments.filter((_, j) => j !== i))}><IconX size={13} stroke={1.8} aria-hidden="true" /></button></li>)}</ul>}
    {turns.length > 0 && <div className="cc-log" ref={log} role="log" aria-label={`Conversation about ${label}`}>
      {turns.map((t, i) => <p key={i} className={`cc-turn is-${t.role}${t.error ? " is-error" : ""}`} role={t.role === "assistant" && i === turns.length - 1 ? "status" : undefined}>{t.content}{t.signIn && <> <Link href="/sign-in" prefetch={false}>Sign in</Link></>}</p>)}
      {turns.length > 1 && !busy && <button type="button" className="cc-clear" onClick={() => setTurns([])}>Clear</button>}
    </div>}
    <form className="cc-pill" onSubmit={(e) => { e.preventDefault(); void send(); }} aria-busy={busy}>
      {busy && <span className="cc-sweep" aria-hidden="true" />}
      <input value={text} onChange={(e) => setText(e.target.value)} placeholder={busy ? "Looking at the chart" : turns.length ? "Reply or ask something else" : "Ask for a change, or why the chart looks this way"} aria-label={`Ask for a change to ${label}`} readOnly={busy} />
      <button type="submit" aria-label={busy ? "Working" : "Send"} disabled={!busy && !text.trim()}>
        {busy ? <span className="cc-dots" aria-hidden="true"><i /><i /><i /></span> : <IconArrowUp size={15} stroke={2} aria-hidden="true" />}
      </button>
    </form>
  </div>;
}
