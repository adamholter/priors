"use client";
import { useEffect, useState } from "react";
import type { Snapshot } from "@/data/types";
import type { IndexConfig } from "@/engine";
import { Builder } from "@/components/Builder";
import { PlanLayoutContext, type PlanLayout } from "@/components/chart/PlanPicker";
import "./lab.css";
import "./sharing-lab.css";

const layouts: { id: PlanLayout; label: string; note: string }[] = [
  { id: "advanced", label: "A · In Advanced", note: "Collapsed section, live now" },
  { id: "pricing", label: "B · Under Pricing", note: "Collapsed, next to its toggle" },
  { id: "choices", label: "C · Plan lists", note: "Every plan, fee and model count" },
  { id: "page", label: "D · Own panel", note: "Opens in place of the settings" },
];

/** Opens the cost chart's settings on the Settings tab, once the chart has loaded, so each variant shows without hunting for it. */
function openMenu(layout: PlanLayout) {
  let tries = 0, timer = 0;
  const step = () => {
    const summary = document.querySelector<HTMLElement>('summary[aria-label="Pareto settings"]');
    if (!summary) { if (++tries < 60) timer = window.setTimeout(step, 250); return; }
    if (!summary.parentElement?.hasAttribute("open")) { summary.scrollIntoView({ block: "start" }); window.scrollBy(0, -80); summary.click(); }
    timer = window.setTimeout(() => {
      const menu = summary.parentElement?.querySelector(".chart-settings-menu");
      menu?.querySelector<HTMLElement>('[role="tab"]:last-child')?.click();
      timer = window.setTimeout(() => {
        if (layout !== "advanced") return;
        const advanced = [...(menu?.querySelectorAll("summary") ?? [])].find((s) => s.textContent?.startsWith("Advanced"));
        if (advanced && !advanced.parentElement?.hasAttribute("open")) advanced.click();
      }, 80);
    }, 80);
  };
  step();
  return () => window.clearTimeout(timer);
}

export function PlansLab({ snapshot, indices, initial }: { snapshot: Snapshot; indices: IndexConfig[]; initial?: PlanLayout }) {
  const [layout, setLayout] = useState<PlanLayout>(initial ?? "advanced");
  useEffect(() => openMenu(layout), [layout]);
  return <div className="index-lab">
    <div className="index-lab-bar"><span>Plan picker lab</span><div className="ob-lab-options" role="group" aria-label="Plan picker layout">{layouts.map((l) => <button key={l.id} type="button" aria-pressed={l.id === layout} onClick={() => setLayout(l.id)}>{l.label}<small>{l.note}</small></button>)}</div></div>
    <PlanLayoutContext.Provider value={layout}><Builder snapshot={snapshot} initialIndices={indices} labPlacement="none" /></PlanLayoutContext.Provider>
  </div>;
}
