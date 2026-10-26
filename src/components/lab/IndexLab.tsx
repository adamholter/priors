"use client";
import { useState } from "react";
import type { Snapshot } from "@/data/types";
import type { IndexConfig } from "@/engine";
import { Builder } from "@/components/Builder";
import type { PublishPlacement } from "./IndexLabActions";
import "./lab.css";
import "./sharing-lab.css";

const placements: { id: PublishPlacement; label: string; note: string }[] = [
 { id: "inline", label: "A · Below the ranking", note: "Publish beside the result" },
 { id: "rail", label: "B · Beside the controls", note: "Stays visible while you adjust" },
 { id: "dock", label: "C · Bottom bar", note: "Follows you through the charts" },
];
export function IndexLab({ snapshot, indices }: { snapshot: Snapshot; indices: IndexConfig[] }) {
 const [placement, setPlacement] = useState<PublishPlacement>("inline");
 return <div className="index-lab">
  <div className="index-lab-bar"><span>Builder lab</span><div className="ob-lab-options" role="group" aria-label="Publishing placement">{placements.map(p => <button key={p.id} type="button" aria-pressed={p.id === placement} onClick={() => setPlacement(p.id)}><span>{p.label}</span><small>{p.note}</small></button>)}</div></div>
  <Builder snapshot={snapshot} initialIndices={indices} labPlacement={placement} />
 </div>;
}
