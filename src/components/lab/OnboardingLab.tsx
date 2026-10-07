"use client";
import { useState } from "react";
import type { Snapshot } from "@/data/types";
import { LIVE_FLOW, Onboarding, type OnboardingFlow } from "@/onboarding/Onboarding";
import type { BenchmarkQuality } from "@/onboarding/quality";
import "./onboarding-lab.css";

type Variant = { id: string; name: string; note: string; flow: OnboardingFlow };
const VARIANTS: Variant[] = [
  { id: "live", name: "A · Live now", note: "Duel first, ≤10 calls, search starts on its own", flow: LIVE_FLOW },
  { id: "pick", name: "B · Tap your top 3", note: "Three taps, then the search. Fastest", flow: { ...LIVE_FLOW, start: "pick", pickCount: 3 } },
  { id: "sprint", name: "C · Sprint duel", note: "Top 7 only, ≤6 calls", flow: { ...LIVE_FLOW, bracket: { top: 4, challengers: 3, cap: 6 } } },
  { id: "review", name: "D · Duel + review", note: "≤10 calls, then the list before searching", flow: { ...LIVE_FLOW, autoFit: false } },
  { id: "old", name: "E · Before (baseline)", note: "Yesterday's flow: list first, full focus, 15 calls", flow: { start: "order", autoFit: false, intro: false, focus: "full", done: "classic" } },
];
const DONES: { id: OnboardingFlow["done"]; name: string; note: string }[] = [
  { id: "compare", name: "Share + compare", note: "Card, X, and how you differ from the page you came from" },
  { id: "share", name: "Share card", note: "Card preview, Share on X, Download, Publish" },
  { id: "classic", name: "Before", note: "Stats and mix only" },
];

export function OnboardingLab({ snapshot, lineup, quality, observedModelIds, rankedCount, demoTop }: { snapshot: Snapshot; lineup: string[]; quality: BenchmarkQuality[]; observedModelIds: string[]; rankedCount: number; demoTop: string[] }) {
  const [variant, setVariant] = useState(VARIANTS[0]);
  const [done, setDone] = useState<OnboardingFlow["done"]>("compare");
  const [via, setVia] = useState(true);
  const [run, setRun] = useState(0);
  const flow = { ...variant.flow, done };
  return <div className="ob-lab">
    <div className="ob-lab-bar">
      <div className="ob-lab-group">
        <span className="ob-lab-label">Onboarding</span>
        <div role="group" aria-label="Onboarding variant" className="ob-lab-options">
          {VARIANTS.map((v) => <button key={v.id} type="button" aria-pressed={variant.id === v.id} onClick={() => { setVariant(v); setRun((n) => n + 1); }}><span>{v.name}</span><small>{v.note}</small></button>)}
        </div>
      </div>
      <div className="ob-lab-group">
        <span className="ob-lab-label">Finish screen</span>
        <div role="group" aria-label="Finish screen" className="ob-lab-options">
          {DONES.map((d) => <button key={d.id} type="button" aria-pressed={done === d.id} onClick={() => setDone(d.id)}><span>{d.name}</span><small>{d.note}</small></button>)}
        </div>
        <label className="ob-lab-check"><input type="checkbox" checked={via} onChange={(e) => setVia(e.target.checked)} />Arrived from @demo&apos;s page</label>
        <button type="button" className="ob-lab-restart" onClick={() => setRun((n) => n + 1)}>Restart</button>
      </div>
    </div>
    <Onboarding key={`${variant.id}-${run}`} snapshot={snapshot} lineup={lineup} seeds={lineup} quality={quality} observedModelIds={observedModelIds} hasSavedMix={false} rankedCount={rankedCount}
      labMode={{ label: "Rank in pairs", placement: "board-top" }} flow={flow} labVia={via ? { handle: "demo", name: "Demo", top: demoTop } : undefined} />
  </div>;
}
