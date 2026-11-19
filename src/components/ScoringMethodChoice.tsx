"use client";
import { useId } from "react";
import type { IndexConfig, ScoringMethod } from "@/engine";

const OPTIONS: { value: ScoringMethod | "average"; name: string; note: string }[] = [
  { value: "average", name: "Weighted average", note: "Each benchmark's score times its weight, added up. The default." },
  { value: "irt", name: "IRT ability", note: "Works out how hard each benchmark is, then scores a model by the ability its results point to. Still 0 to 100." },
  { value: "eci", name: "ECI-style", note: "One capability number per model, fitted the way Epoch AI fits its Capabilities Index. The scale is open-ended, not 0 to 100." },
];

/** The scoring method of an index, in Calculation settings. Unset is the weighted average, which is what every index used before this existed. */
export function ScoringMethodChoice({ config, onChange }: { config: IndexConfig; onChange: (config: IndexConfig) => void }) {
  const name = useId(), value = config.scoring ?? "average";
  const pick = (next: ScoringMethod | "average") => {
    const rest = { ...config };
    delete rest.scoring;
    onChange(next === "average" ? rest : { ...rest, scoring: next });
  };
  return (
    <section className="grid gap-3" data-scoring-choice={value}>
      <h3 className="text-lg text-ink">Scoring method</h3>
      <div role="radiogroup" aria-label="Scoring method" className="grid gap-2.5 max-w-xl">
        {OPTIONS.map((o) => <label key={o.value} className="flex items-start gap-2"><input type="radio" name={name} value={o.value} className="accent-indigo mt-1" checked={value === o.value} onChange={() => pick(o.value)} /><span><span className="text-ink">{o.name}</span><span className="block">{o.note}</span></span></label>)}
      </div>
      <p>Every method ranks the same models from the same scores. <a href="/methods/scoring" target="_blank" rel="noreferrer" className="text-indigo underline">How the methods differ</a></p>
    </section>
  );
}
