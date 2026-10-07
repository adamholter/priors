"use client";
import { useState, type CSSProperties } from "react";
import type { Lab, Model } from "@/data/types";
import { track } from "@/lib/analytics";

/** Tap your favourites in order. The fastest start: three taps, then the search runs on the rest in index order. */
export function TopPicker({ seeds, models, labs, count, onFinish, onList }: { seeds: string[]; models: Map<string, Model>; labs: Map<string, Lab>; count: number; onFinish: (picked: string[]) => void; onList: () => void }) {
  const [picked, setPicked] = useState<string[]>([]);
  const toggle = (id: string) => {
    if (!picked.length) track("onboarding_started", { mode: "pick" });
    const next = picked.includes(id) ? picked.filter((x) => x !== id) : picked.length < count ? [...picked, id] : picked;
    setPicked(next);
  };
  const full = picked.length === count;
  return <div className="top-picker">
    <div className="pick-grid" role="group" aria-label={`Pick your top ${count}, best first`}>
      {seeds.map((id) => {
        const m = models.get(id); const lab = m ? labs.get(m.labId) : undefined; const rank = picked.indexOf(id);
        return <button key={id} type="button" className={`pick-card ${rank >= 0 ? "on" : ""}`} aria-pressed={rank >= 0} disabled={full && rank < 0} onClick={() => toggle(id)} style={{ "--lab": lab?.color ?? "#8A8A80" } as CSSProperties}>
          <span className="pick-rank" aria-hidden="true">{rank >= 0 ? rank + 1 : ""}</span>
          <span className="pick-lab">{lab?.name ?? m?.labId}</span>
          <span className="pick-name">{m?.name ?? id}</span>
        </button>;
      })}
    </div>
    <div className="pick-foot">
      <span className="pick-count">{picked.length}/{count} picked{picked.length ? ` · ${picked.map((id) => models.get(id)?.name).join(" › ")}` : ""}</span>
      <div className="pick-actions">
        {picked.length > 0 && <button type="button" className="text-control" onClick={() => setPicked([])}>Clear</button>}
        <button type="button" className="text-control" onClick={onList}>Rank the full list instead</button>
        <button type="button" className="primary-action pick-go" disabled={!full} onClick={() => onFinish(picked)}>Find my index <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true"><path d="M4 12h15m-6-6 6 6-6 6" /></svg></button>
      </div>
    </div>
  </div>;
}
