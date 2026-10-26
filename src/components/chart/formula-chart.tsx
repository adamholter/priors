"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import type { RankedVariant } from "@/engine";
import { formulaChart, type FormulaChart, type FormulaInputs, type MetricChart } from "@/lib/metrics";
import { FORMULA_MAX } from "@/lib/formula";
import type { ScatterView } from "./scatter-option";
import styles from "./ChartSettings.module.css";

/** What a chart's settings need to offer the custom formula. */
export interface FormulaSettings {
  variables: () => { name: string; label: string }[];
  /** Validate a draft: an error to show, or how many models it yields. */
  check: (source: string) => { error: string } | { count: number; total: number };
}

/**
 * Applies a chart's custom formula (Advanced settings). Returns the metric to draw: the formula
 * chart when one is set and valid, else the chart's own. A formula with zero or negative results
 * cannot use a log axis, so the view is forced linear and the scale switch is withheld.
 */
export function useFormulaChart(base: MetricChart | undefined, view: ScatterView, inputs: FormulaInputs | undefined, ranked: RankedVariant[]) {
  const source = view.formula?.trim() ?? "", better = view.formulaBetter ?? "higher";
  const custom = useMemo<FormulaChart | undefined>(() => {
    if (!source || !inputs || !base) return undefined;
    const built = formulaChart(base, source, better, inputs, ranked);
    return "error" in built ? undefined : built;
  }, [base, source, better, inputs, ranked]);
  const settings = useMemo<FormulaSettings | undefined>(() => inputs && base ? {
    variables: () => [...inputs.get().variables, { name: "value", label: "This chart's own metric" }],
    check: (draft) => {
      const built = formulaChart(base, draft, "higher", inputs, ranked);
      if ("error" in built) return built;
      // Valid but empty (always divides by zero, or no model has every input): keep the chart as it is.
      return built.count ? { count: built.count, total: built.total } : { error: "No model gets a value from this formula" };
    },
  } : undefined, [inputs, base, ranked]);
  const logScale = custom ? (custom.logOk ? custom.scale as "log" | "linear" : undefined) : base?.scale === "log" ? "log" as const : undefined;
  return {
    metric: custom ?? base, custom, settings,
    view: custom && !custom.logOk && view.scale !== "linear" ? { ...view, scale: "linear" as const } : view,
    /** Default for the Log/Linear switch; undefined hides it. */
    defaultScale: logScale,
    /** Chart-link params that carry the formula. */
    link: custom ? { cf: custom.source, cb: better === "lower" ? "lower" : undefined } : { cf: undefined, cb: undefined },
    caption: custom ? `Custom formula · ${better} is better · ${custom.count} of ${custom.total} models have every input` : undefined,
  };
}

/** A formula carried by a chart deep link (`cf`, `cb`), as view fields. */
export function linkedFormula(params: URLSearchParams): Pick<ScatterView, "formula" | "formulaBetter"> | undefined {
  const cf = params.get("cf")?.trim().slice(0, FORMULA_MAX);
  return cf ? { formula: cf, formulaBetter: params.get("cb") === "lower" ? "lower" : "higher" } : undefined;
}

/** The Advanced section's formula controls. Valid drafts apply after a short pause in typing. */
export function FormulaEditor({ id, label, formula, view, onView }: { id: string; label: string; formula: FormulaSettings; view: ScatterView; onView: (view: ScatterView, persist?: boolean) => void }) {
  const [draft, setDraft] = useState(view.formula ?? "");
  const input = useRef<HTMLInputElement>(null), timer = useRef<ReturnType<typeof setTimeout>>(undefined), latest = useRef({ view, onView });
  useEffect(() => { latest.current = { view, onView }; });
  useEffect(() => () => clearTimeout(timer.current), []);
  const text = draft.trim();
  const result = useMemo(() => (text ? formula.check(text) : undefined), [text, formula]);
  const variables = useMemo(() => formula.variables(), [formula]);
  const better = view.formulaBetter ?? "higher";
  const change = (next: string) => {
    setDraft(next);
    clearTimeout(timer.current);
    const t = next.trim(), ok = !t || !("error" in formula.check(t));
    // "" (not undefined) records that the viewer cleared a page owner's formula.
    if (ok) timer.current = setTimeout(() => { const { view: v, onView: set } = latest.current; if ((v.formula ?? "") !== t) set({ ...v, formula: t }); }, t ? 350 : 0);
  };
  const insert = (name: string) => {
    const el = input.current, start = el?.selectionStart ?? draft.length, end = el?.selectionEnd ?? draft.length;
    change(draft.slice(0, start) + name + draft.slice(end));
    requestAnimationFrame(() => { el?.focus(); el?.setSelectionRange(start + name.length, start + name.length); });
  };
  return <div className={styles.formula}>
    <label htmlFor={`${id}-formula`}>Custom formula</label>
    <p>Replaces this chart&rsquo;s metric. Bars sort by it; the scatter plots it against index score.</p>
    <div className={styles.formulaInput}>
      <input ref={input} id={`${id}-formula`} type="text" aria-label={`${label} custom formula`} aria-invalid={!!result && "error" in result} aria-describedby={`${id}-formula-status`} placeholder="score / (cost * time)" value={draft} maxLength={FORMULA_MAX} spellCheck={false} autoCapitalize="off" autoCorrect="off" autoComplete="off" onChange={e => change(e.target.value)} />
      {draft && <button type="button" aria-label="Clear formula" onClick={() => { change(""); input.current?.focus(); }}>Clear</button>}
    </div>
    <div className={styles.variables} role="group" aria-label="Insert a variable">{variables.map(v => <button key={v.name} type="button" title={v.label} onClick={() => insert(v.name)}>{v.name}</button>)}</div>
    <p id={`${id}-formula-status`} role={result && "error" in result ? "alert" : "status"} className={result && "error" in result ? styles.formulaError : undefined}>
      {!result ? "Use + − × ÷ ^, parentheses, and log, ln, sqrt, abs, min, max." : "error" in result ? result.error : `${result.count} of ${result.total} models have every input${result.count < result.total ? "; the rest are left off" : ""}.`}
    </p>
    <div className={styles.row}><span id={`${id}-better-label`}>Better is</span><div className={styles.choice} role="group" aria-labelledby={`${id}-better-label`}>{(["higher", "lower"] as const).map(value => <button key={value} type="button" aria-pressed={better === value} onClick={() => onView({ ...view, formulaBetter: value })}>{value === "higher" ? "Higher" : "Lower"}</button>)}</div></div>
  </div>;
}
