"use client";
import { useId, useRef, useState, useEffect, useImperativeHandle, type Ref, type ReactNode } from "react";
import type { Snapshot } from "@/data/types";
import { strictnessOf, type IndexConfig, type IndexResult } from "@/engine";
import { AA_METHODOLOGY_URL } from "@/data/aa-index";
import { ModelDetail } from "./ModelDetail";

export type CalculationSettingsHandle = { inspect: (variantId: string) => void };

export function CalculationSettings({ ref, config, result, snapshot, onChange, children }: { ref?: Ref<CalculationSettingsHandle>; config: IndexConfig; result: IndexResult; snapshot: Snapshot; onChange: (config: IndexConfig) => void; children?: ReactNode }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const title = useId();
  const [open, setOpen] = useState(false);
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
  useImperativeHandle(ref, () => ({ inspect: (variantId) => {
    setSelected(variantId);
    dialog.current?.showModal();
    setOpen(true);
  } }), []);
  const row = result.ranked.find((r) => r.variant.id === selected) ?? result.ranked[0];
  const strictness = strictnessOf(config);
  const DEFAULT_STRICTNESS = 50;
  return (
    <>
      <button type="button" className="mt-4 text-[12px] text-grey hover:text-ink" onClick={() => { dialog.current?.showModal(); setOpen(true); }}>Calculation settings</button>
      <dialog ref={dialog} onClose={() => setOpen(false)}
        onPointerDown={(e) => { backdropPress.current = e.target === e.currentTarget && outside(e.clientX, e.clientY); }}
        onClick={(e) => { if (backdropPress.current && e.target === e.currentTarget && outside(e.clientX, e.clientY)) dialog.current?.close(); backdropPress.current = false; }}
        aria-labelledby={title} className="m-auto w-[min(920px,calc(100vw-32px))] max-h-[85dvh] overflow-y-auto border hairline rounded-md bg-bone p-5 sm:p-8 text-ink backdrop:bg-black/25">
        <div className="flex items-center justify-between gap-3 mb-6">
          <h2 id={title} className="text-2xl">Calculation settings</h2>
          <button className="btn-quiet" aria-label="Close calculation settings" onClick={() => dialog.current?.close()}>Close</button>
        </div>
        <div className="grid gap-6 text-[13px] text-ink-2">
          <section className="grid gap-3">
            <h3 className="text-lg text-ink">Missing data</h3>
            <label className="grid gap-1.5 max-w-sm">Effort estimates
              <select aria-label="Effort estimates" className="inp" value={config.effortMatching === "strict" ? "strict" : "calibrated"} onChange={(e) => onChange({ ...config, effortMatching: e.target.value as "calibrated" | "strict" })}>
                <option value="calibrated">Estimate from measured effort differences</option>
                <option value="strict">Use exact effort results only</option>
              </select>
            </label>
            <p>For a missing effort score, we compare that same model’s target and source efforts on other benchmarks. Their performance ratios adjust the nearest measured result. Comparisons in the same category receive double weight; with five or more comparisons, we trim the most extreme 20% at each end. Missing evidence stays missing—not an unchanged copy of a maximum-effort score.</p>
            <label className="flex items-start gap-2"><input type="checkbox" className="accent-indigo mt-1" checked={config.estimateMissing} onChange={(e) => onChange({ ...config, estimateMissing: e.target.checked })} /><span>Estimate optional missing benchmarks from similar models</span></label>
            <p>Peer estimates use measured scores only, with release-date and price-tier constraints where those metadata exist. Each one averages two guesses: the models closest on this mix, and the models whose scores track the target most closely across every benchmark they share. The model detail lists the donors and a likely range. Otherwise optional missing values are left out and the remaining weights are renormalized. Cost and speed always come from measured results at the displayed effort.</p>
          </section>
          <section className="grid gap-2 border-t hairline pt-5">
            <h3 className="text-lg text-ink">AA v4.3 baseline</h3>
            <p>The starting mix uses AA&apos;s published weights across ten evaluations. Omniscience has two components, accuracy and non-hallucination. Briefcase and GDPval use a fixed 500 to 2500 Elo scale. The baseline requires measured results at the exact configuration; missing results are excluded. Small differences from AA&apos;s published totals can remain because AA freezes Elo when adding models.</p>
            <a href={AA_METHODOLOGY_URL} target="_blank" rel="noreferrer" className="text-indigo underline">Artificial Analysis methodology</a>
          </section>
          <section className="grid gap-2 border-t hairline pt-5">
            <h3 className="text-lg text-ink">Strictness and requirements</h3>
            <label className="grid gap-2 max-w-sm text-ink">
              <span className="flex justify-between"><span>Strictness</span><span className="cap">{Math.round(strictness)}{Math.round(strictness) !== DEFAULT_STRICTNESS && <> · <button type="button" className="hover:text-ink underline" onClick={() => onChange({ ...config, strictness: DEFAULT_STRICTNESS })}>reset to {DEFAULT_STRICTNESS}</button></>}</span></span>
              <input type="range" aria-label="Strictness" min={0} max={100} value={strictness} onChange={(e) => onChange({ ...config, strictness: Number(e.target.value) })} className="h-[3px] w-full" />
              <span className="flex justify-between text-[11px] text-grey"><span>Flexible</span><span>Strict</span></span>
            </label>
            <p>Strictness is {Math.round(strictness)}. A model is ranked only when measured scores cover at least {Math.round(strictness)}% of this index&apos;s weight — a model with one benchmark cannot ride that benchmark alone. Required checkboxes add hard per-benchmark gates. Higher strictness also demands more effort comparisons, limits how far apart the source and target efforts can be, and narrows peer comparisons. At 100, estimates are disabled.</p>
            <p>Effort estimates require {strictness >= 95 ? 3 : strictness >= 75 ? 2 : 1} paired benchmark comparisons{strictness >= 85 ? " and adjacent effort levels" : ""}. Manual Required and Optional choices persist when strictness changes.</p>
            <fieldset className="grid gap-1.5 max-w-sm"><legend className="text-ink mb-1.5">Required benchmarks</legend>
              {Object.entries(config.weights).filter(([, w]) => w > 0).map(([id]) => <label key={id} className="flex items-center gap-2"><input type="checkbox" className="accent-indigo" checked={config.required.includes(id)} onChange={(e) => onChange({ ...config, required: [...config.required.filter((x) => x !== id), ...(e.target.checked ? [id] : [])], optional: [...(config.optional ?? []).filter((x) => x !== id), ...(e.target.checked ? [] : [id])] })} />{snapshot.benchmarks.find((b) => b.id === id)?.name ?? id}</label>)}
            </fieldset>
            <button className="btn-quiet justify-self-start" onClick={() => onChange({ ...config, required: [], optional: [] })}>Reset requirement overrides</button>
          </section>
          <section className="grid gap-3 border-t hairline pt-5">
            <h3 className="text-lg text-ink">Inspect a calculation</h3>
            {row ? <>
              <select aria-label="Inspect model calculation" value={row.variant.id} onChange={(e) => setSelected(e.target.value)} className="inp max-w-sm">
                {result.ranked.map((r) => <option key={r.variant.id} value={r.variant.id}>{r.variant.sourceModel?.name ?? `${r.model.name} · ${r.variant.effort}`}</option>)}
              </select>
              <ModelDetail r={row} snapshot={snapshot} result={result} />
            </> : <p>No models qualify under the current settings.</p>}
            <details><summary className="cursor-pointer">Excluded variants ({result.excluded.length})</summary>
              <ul className="mt-3 max-h-60 overflow-y-auto grid gap-2">{result.excluded.map((r) => <li key={r.variant.id}>{r.model.name} · {r.variant.effort}<span className="block text-grey">{r.reason === "coverage" ? `Measured data covers ${Math.round(r.measuredShare * 100)}% of the index (needs ${Math.round(strictness)}%)` : `Missing usable data for ${r.missing.map((id) => snapshot.benchmarks.find((b) => b.id === id)?.name ?? id).join(", ")}`}</span></li>)}</ul>
            </details>
          </section>
          {children}
        </div>
      </dialog>
    </>
  );
}
