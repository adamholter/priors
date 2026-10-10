"use client";
import { useState } from "react";
import Link from "next/link";
import type { Snapshot } from "@/data/types";
import { LIVE_FLOW, Onboarding } from "@/onboarding/Onboarding";
import type { BenchmarkQuality } from "@/onboarding/quality";
import { MONITOR_VARIANTS, type MonitorVariant } from "@/onboarding/SearchMonitor";
import "./onboarding-lab.css";

/** The real search step with a switchable in-progress panel. The search runs for real and replays when it ends. */
export function SearchLab({ snapshot, lineup, quality, observedModelIds }: { snapshot: Snapshot; lineup: string[]; quality: BenchmarkQuality[]; observedModelIds: string[] }) {
  const [variant, setVariant] = useState<MonitorVariant>("ladder");
  const [run, setRun] = useState(0);
  return <div className="ob-lab">
    <div className="ob-lab-bar">
      <div className="ob-lab-group">
        <span className="ob-lab-label">Search animation lab</span>
        <div role="group" aria-label="Search animation" className="ob-lab-options">
          {MONITOR_VARIANTS.map(v => <button key={v.id} type="button" aria-pressed={variant === v.id} onClick={() => setVariant(v.id)}><span>{v.name}</span><small>{v.note}</small></button>)}
        </div>
      </div>
      <div className="ob-lab-group">
        <button type="button" className="ob-lab-restart" onClick={() => setRun(n => n + 1)}>Replay</button>
        <Link className="ob-lab-restart" href="/lab/onboarding" as="/lab/onboarding">Onboarding lab ↗</Link>
      </div>
    </div>
    <Onboarding key={run} snapshot={snapshot} lineup={lineup} seeds={lineup} quality={quality} observedModelIds={observedModelIds} hasSavedMix={false}
      labMode={{ label: "Rank in pairs", placement: "board-top", search: true }} flow={{ ...LIVE_FLOW, start: "order", monitor: variant }} />
  </div>;
}
