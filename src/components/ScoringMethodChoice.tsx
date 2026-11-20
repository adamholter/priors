"use client";
import { useId } from "react";
import type { IndexConfig, ScoringMethod } from "@/engine";

const OPTIONS: { value: ScoringMethod | "average"; name: string; note: string }[] = [
  { value: "average", name: "Weighted average", note: "Each score times its weight, added up." },
  { value: "irt", name: "IRT ability", note: "Allows for how hard each benchmark is. Still 0 to 100." },
  { value: "eci", name: "ECI-style", note: "Fitted like Epoch AI's Capabilities Index. Open-ended scale." },
];

/** The scoring method of an index, in Calculation settings: three cards. Unset is the weighted average, which is what every index used before this existed. */
export function ScoringMethodChoice({ config, onChange }: { config: IndexConfig; onChange: (config: IndexConfig) => void }) {
  const name = useId(), value = config.scoring ?? "average";
  const pick = (next: ScoringMethod | "average") => {
    const rest = { ...config };
    delete rest.scoring;
    onChange(next === "average" ? rest : { ...rest, scoring: next });
  };
  return (
    <div role="radiogroup" aria-label="Scoring method" className="calc-methods" data-scoring-choice={value}>
      {OPTIONS.map((o) => <label key={o.value} className="calc-method"><span><input type="radio" name={name} value={o.value} className="accent-indigo" checked={value === o.value} onChange={() => pick(o.value)} />{o.name}</span><small>{o.note}</small></label>)}
    </div>
  );
}
