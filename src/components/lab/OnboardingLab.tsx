"use client";
import { useMemo, useState } from "react";
import Link from "next/link";
import type { Snapshot } from "@/data/types";
import { LIVE_FLOW, Onboarding, type OnboardingFlow } from "@/onboarding/Onboarding";
import type { BenchmarkQuality } from "@/onboarding/quality";
import { versionAssumptions, type RankingEvidence } from "@/onboarding/adaptive";
import "./onboarding-lab.css";

type Variant = { id: string; name: string; note: string; cap: number; adaptive: boolean; flow: OnboardingFlow };
const VARIANTS: Variant[] = [
 { id: "smart", name: "A · Smart sprint", note: "Uncertainty first, up to 6 calls", cap: 6, adaptive: true, flow: { ...LIVE_FLOW, bracket: { cap: 6 } } },
 { id: "short", name: "B · Short sprint", note: "Same selection, up to 4 calls", cap: 4, adaptive: true, flow: { ...LIVE_FLOW, bracket: { cap: 4 } } },
 { id: "previous", name: "C · Previous sprint", note: "Original pair selection, up to 6 calls", cap: 6, adaptive: false, flow: { ...LIVE_FLOW, bracket: { top: 4, challengers: 3, cap: 6 } } },
];

export function OnboardingLab({ snapshot, lineup, quality, observedModelIds, rankedCount, evidence }: { snapshot: Snapshot; lineup: string[]; quality: BenchmarkQuality[]; observedModelIds: string[]; rankedCount: number; evidence: RankingEvidence[] }) {
 const [variant, setVariant] = useState(VARIANTS[0]);
 const [comparison, setComparison] = useState("winner");
 const [run, setRun] = useState(0);
 const experience = useMemo(() => {
  const reference = [...lineup];
  const a = comparison === "winner" ? 0 : 10, b = comparison === "winner" ? 2 : 11;
  if (reference.length > b) [reference[a], reference[b]] = [reference[b], reference[a]];
  return { adaptive: variant.adaptive ? { evidence, cap: variant.cap } : undefined, reference: comparison === "none" ? undefined : reference };
 }, [lineup, evidence, variant, comparison]);
 const models = useMemo(() => new Map(snapshot.models.map(m => [m.id, m])), [snapshot]);
 const assumptions = useMemo(() => versionAssumptions(lineup.flatMap(id => models.get(id) ? [models.get(id)!] : [])), [lineup, models]);
 return <div className="ob-lab">
  <div className="ob-lab-bar">
   <div className="ob-lab-group">
    <span className="ob-lab-label">Onboarding lab</span>
    <div role="group" aria-label="Onboarding variant" className="ob-lab-options">
     {VARIANTS.map(v => <button key={v.id} type="button" aria-pressed={variant.id === v.id} onClick={() => { setVariant(v); setRun(n => n + 1); }}><span>{v.name}</span><small>{v.note}</small></button>)}
    </div>
   </div>
   <div className="ob-lab-group">
    <label className="ob-lab-check">Comparison example <select aria-label="Comparison example" value={comparison} onChange={e => setComparison(e.target.value)}><option value="winner">Different #1</option><option value="lower">Lower ranks differ</option><option value="none">None</option></select></label>
    <button type="button" className="ob-lab-restart" onClick={() => setRun(n => n + 1)}>Restart</button>
    <Link className="ob-lab-restart" href="/lab/index" as="/lab/index">Builder lab ↗</Link>
   </div>
   <details className="ob-lab-diagnostics"><summary>Question logic</summary><div><p>{evidence.length} rankings from this snapshot. Same-family versions and transitive answers are skipped. Remaining questions favor uncertainty near the top, using the solver&apos;s rank weighting. The sprint can finish before its cap.</p><ul>{assumptions.map(e => <li key={`${e.above}-${e.below}`}>{models.get(e.above)?.name} above {models.get(e.below)?.name}</li>)}</ul><p>Assumptions can be changed in the ranking list. Similarity reuses the solver&apos;s weighted pair score across the full lineup, averaged in both directions. Score margins and benchmark-count penalties are excluded.</p></div></details>
  </div>
  <Onboarding key={`${variant.id}-${run}`} snapshot={snapshot} lineup={lineup} seeds={lineup} quality={quality} observedModelIds={observedModelIds} hasSavedMix={false} rankedCount={rankedCount}
   labMode={{ label: "Rank in pairs", placement: "board-top" }} flow={variant.flow} labExperience={experience} />
 </div>;
}
