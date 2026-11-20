"use client";
import { useId, useRef, useState, useEffect, type KeyboardEvent, type ReactNode } from "react";
import { IconInfoCircle, IconX } from "@tabler/icons-react";
import type { Snapshot } from "@/data/types";
import { strictnessOf, type IndexConfig, type IndexResult } from "@/engine";
import { AA_METHODOLOGY_URL } from "@/data/aa-index";
import { ModelDetail } from "./ModelDetail";
import { ScoringMethodChoice } from "./ScoringMethodChoice";
import "./calculation-settings.css";

const DEFAULT_STRICTNESS = 50;
const TABS = [["settings", "Settings"], ["breakdown", "Breakdown"], ["excluded", "Left out"], ["sources", "Sources"]] as const;
type Tab = (typeof TABS)[number][0];

/**
 * The mix's calculation settings, in a dialog with four tabs: the settings themselves (one screen, each explanation behind its
 * info button), one model's breakdown, the variants the settings leave out, and the sources. `children` is the sources panel.
 */
export function CalculationSettings({ trigger = true, config, result, snapshot, onChange, children }: { /** Shows the button. The rest stays mounted without it, for the check for newer data. */ trigger?: boolean; config: IndexConfig; result: IndexResult; snapshot: Snapshot; onChange: (config: IndexConfig) => void; children?: ReactNode }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const id = useId();
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<Tab>("settings");
  /** The one explanation that is open, if any. */
  const [how, setHow] = useState<"effort" | "peers" | "strictness" | null>(null);
  const backdropPress = useRef(false);
  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = previous; };
  }, [open]);
  const outside = (x: number, y: number) => {
    const box = dialog.current?.getBoundingClientRect();
    return !!box && (x < box.left || x > box.right || y < box.top || y > box.bottom);
  };
  const [selected, setSelected] = useState("");
  const row = result.ranked.find((r) => r.variant.id === selected) ?? result.ranked[0];
  const strictness = Math.round(strictnessOf(config));
  const benchmarks = Object.entries(config.weights).filter(([, w]) => w > 0).map(([b]) => ({ id: b, name: snapshot.benchmarks.find((x) => x.id === b)?.name ?? b }));
  const tabKey = (e: KeyboardEvent, i: number) => {
    const n = TABS.length, to = e.key === "ArrowRight" ? (i + 1) % n : e.key === "ArrowLeft" ? (i + n - 1) % n : e.key === "Home" ? 0 : e.key === "End" ? n - 1 : -1;
    if (to < 0) return;
    e.preventDefault();
    setTab(TABS[to][0]);
    document.getElementById(`${id}-${TABS[to][0]}-tab`)?.focus();
  };
  const info = (key: NonNullable<typeof how>, label: string) => <button type="button" className="calc-info" aria-expanded={how === key} aria-controls={`${id}-${key}-how`} aria-label={label} title={label} onClick={() => setHow(how === key ? null : key)}><IconInfoCircle size={15} stroke={1.5} aria-hidden="true" /></button>;
  const panel = (t: Tab) => ({ role: "tabpanel", id: `${id}-${t}-panel`, "aria-labelledby": `${id}-${t}-tab`, hidden: tab !== t }) as const;
  return (
    <>
      {trigger && <button type="button" className="mt-4 text-[12px] text-grey hover:text-ink" onClick={() => { setTab("settings"); setHow(null); dialog.current?.showModal(); setOpen(true); }}>Calculation settings</button>}
      <dialog ref={dialog} onClose={() => setOpen(false)}
        onPointerDown={(e) => { backdropPress.current = e.target === e.currentTarget && outside(e.clientX, e.clientY); }}
        onClick={(e) => { if (backdropPress.current && e.target === e.currentTarget && outside(e.clientX, e.clientY)) dialog.current?.close(); backdropPress.current = false; }}
        aria-labelledby={`${id}-title`} className="calc-dialog">
        <div className="calc-top">
          <div className="calc-head">
            <h2 id={`${id}-title`}>Calculation settings</h2>
            <button type="button" className="calc-close" aria-label="Close calculation settings" onClick={() => dialog.current?.close()}><IconX size={18} stroke={1.5} aria-hidden="true" /></button>
          </div>
          <div className="calc-tabs" role="tablist" aria-label="Calculation settings sections">
            {TABS.map(([t, name], i) => <button key={t} id={`${id}-${t}-tab`} role="tab" type="button" aria-selected={tab === t} aria-controls={`${id}-${t}-panel`} tabIndex={tab === t ? 0 : -1} onKeyDown={(e) => tabKey(e, i)} onClick={() => setTab(t)}>{name}{t === "excluded" && <span className="num" data-left-out={result.excluded.length}>{result.excluded.length}</span>}</button>)}
          </div>
        </div>

        <div {...panel("settings")} className="calc-rows">
          <div className="calc-row">
            <div className="calc-label"><span>Scoring method</span><a href="/methods/scoring" target="_blank" rel="noreferrer">How the methods differ</a></div>
            <ScoringMethodChoice config={config} onChange={onChange} />
          </div>
          <div className="calc-row">
            <div className="calc-label"><span>Missing scores</span></div>
            <div className="grid gap-1.5">
              <div className="calc-check"><label><input type="checkbox" className="accent-indigo" aria-label="Effort estimates" checked={config.effortMatching !== "strict"} onChange={(e) => onChange({ ...config, effortMatching: e.target.checked ? "calibrated" : "strict" })} /><span>Estimate a missing effort from the model&rsquo;s other efforts</span></label>{info("effort", "How effort estimates work")}</div>
              {how === "effort" && <p id={`${id}-effort-how`} className="calc-how">We compare the same model&rsquo;s two efforts on other benchmarks and adjust its nearest measured result by their ratio. Comparisons in the same category count double, and with five or more the most extreme 20% at each end are dropped. A maximum-effort score is never copied down unchanged. Off, only results measured at the exact effort are used.</p>}
              <div className="calc-check"><label><input type="checkbox" className="accent-indigo" checked={config.estimateMissing} onChange={(e) => onChange({ ...config, estimateMissing: e.target.checked })} /><span>Estimate a missing benchmark from similar models</span></label>{info("peers", "How benchmark estimates work")}</div>
              {how === "peers" && <p id={`${id}-peers-how`} className="calc-how">Uses measured scores only, from models of a similar release date and price where those are known. Each estimate averages two guesses: the models closest on this mix, and the models whose scores track this one most closely across every benchmark they share. The breakdown lists the donors and a likely range. Off, a missing benchmark is left out and the other weights fill in. Cost and speed are always measured.</p>}
            </div>
          </div>
          <div className="calc-row">
            <div className="calc-label"><span>Strictness</span></div>
            <div className="grid gap-1.5">
              <div className="calc-check">
                <div className="calc-strict">
                  <span>Flexible</span>
                  <input type="range" aria-label="Strictness" min={0} max={100} value={strictness} onChange={(e) => onChange({ ...config, strictness: Number(e.target.value) })} className="h-[3px]" />
                  <span>Strict</span>
                  <output className="num">{strictness}</output>
                </div>
                {info("strictness", "How strictness works")}
              </div>
              <p className="calc-note">A model is ranked when measured scores cover at least {strictness}% of the mix.{strictness !== DEFAULT_STRICTNESS && <> <button type="button" onClick={() => onChange({ ...config, strictness: DEFAULT_STRICTNESS })}>Reset to {DEFAULT_STRICTNESS}</button></>}</p>
              {how === "strictness" && <p id={`${id}-strictness-how`} className="calc-how">A model with one benchmark cannot rank on that benchmark alone. Higher strictness also asks for more evidence before estimating: effort estimates now need {strictness >= 95 ? 3 : strictness >= 75 ? 2 : 1} paired benchmark comparison{strictness >= 75 ? "s" : ""}{strictness >= 85 ? " at adjacent effort levels" : ""}, and fewer models count as similar. At 100, nothing is estimated.</p>}
            </div>
          </div>
          <div className="calc-row">
            <div className="calc-label"><span>Required</span><small>A model with no measured score on a required benchmark is left out.</small></div>
            <div className="grid gap-2.5 justify-items-start">
              <fieldset className="calc-chips" aria-label="Required benchmarks">
                {benchmarks.map((b) => <label key={b.id} className="calc-chip" title={b.name}><input type="checkbox" className="accent-indigo" checked={config.required.includes(b.id)} onChange={(e) => onChange({ ...config, required: [...config.required.filter((x) => x !== b.id), ...(e.target.checked ? [b.id] : [])], optional: [...(config.optional ?? []).filter((x) => x !== b.id), ...(e.target.checked ? [] : [b.id])] })} /><span>{b.name}</span></label>)}
              </fieldset>
              {benchmarks.length === 0 && <p className="calc-note">Add a benchmark to the mix first.</p>}
              {config.required.length > 0 && <button type="button" className="calc-note" onClick={() => onChange({ ...config, required: [], optional: [] })}>Clear required benchmarks</button>}
            </div>
          </div>
        </div>

        <div {...panel("breakdown")} className="calc-panel">
          {row ? <>
            <select aria-label="Inspect model calculation" value={row.variant.id} onChange={(e) => setSelected(e.target.value)} className="inp max-w-sm">
              {result.ranked.map((r) => <option key={r.variant.id} value={r.variant.id}>{r.variant.sourceModel?.name ?? `${r.model.name} · ${r.variant.effort}`}</option>)}
            </select>
            <ModelDetail r={row} snapshot={snapshot} result={result} />
          </> : <p>No models qualify under the current settings.</p>}
        </div>

        <div {...panel("excluded")} className="calc-panel">
          {result.excluded.length
            ? <ul className="calc-excluded">{result.excluded.map((r) => <li key={r.variant.id}>{r.model.name} · {r.variant.effort}<span>{r.reason === "coverage" ? `${Math.round(r.measuredShare * 100)}% of the mix measured, needs ${strictness}%` : `No score on ${r.missing.map((b) => snapshot.benchmarks.find((x) => x.id === b)?.name ?? b).join(", ")}`}</span></li>)}</ul>
            : <p>Every model with data on this mix is ranked.</p>}
        </div>

        <div {...panel("sources")} className="calc-panel">
          <section className="grid gap-1.5 max-w-[68ch]">
            <h3>Artificial Analysis Index</h3>
            <p>The page opens on AA&rsquo;s published index score, unchanged. A mix rebuilt from its evaluations at AA&rsquo;s weights can land a few tenths away, because AA freezes Elo when adding models. Omniscience has two components, accuracy and non-hallucination. Briefcase and GDPval use a fixed 500 to 2500 Elo scale.</p>
            <a href={AA_METHODOLOGY_URL} target="_blank" rel="noreferrer" className="text-indigo underline w-fit">Artificial Analysis methodology</a>
          </section>
          {children}
        </div>
      </dialog>
    </>
  );
}
