"use client";
import type { Snapshot } from "@/data/types";
import type { IndexResult } from "@/engine";
import { LabLogo } from "./LabLogo";

type Excluded = IndexResult["excluded"][number];
const ORDER = ["none", "minimal", "low", "medium", "high", "xhigh", "max", "default"];

/**
 * Calculation settings, Left out: the models the settings exclude, one row per model (its efforts together when they share a
 * reason), with its lab's logo. Too little measured data shows as a bar of the share measured against the line it needs;
 * a missing required benchmark names it.
 */
export function LeftOut({ excluded, snapshot, strictness }: { excluded: Excluded[]; snapshot: Snapshot; strictness: number }) {
  if (!excluded.length) return <p>Every model with data on this mix is ranked.</p>;
  const name = (id: string) => snapshot.benchmarks.find((b) => b.id === id)?.name ?? id;
  const labs = new Map(snapshot.labs.map((l) => [l.id, l]));
  // One row per model and reason; efforts that share a reason (and, for coverage, the same share) sit together.
  const rows = new Map<string, { r: Excluded; efforts: string[] }>();
  for (const r of excluded) {
    const key = `${r.model.id}|${r.reason}|${r.reason === "coverage" ? Math.round(r.measuredShare * 100) : r.missing.join(",")}`;
    const row = rows.get(key);
    if (row) row.efforts.push(r.variant.effort); else rows.set(key, { r, efforts: [r.variant.effort] });
  }
  const coverage = [...rows.values()].filter((x) => x.r.reason === "coverage").sort((a, b) => b.r.measuredShare - a.r.measuredShare);
  const required = [...rows.values()].filter((x) => x.r.reason === "required");
  const head = (x: { r: Excluded; efforts: string[] }) => {
    const lab = labs.get(x.r.model.labId);
    const efforts = [...x.efforts].sort((a, b) => ORDER.indexOf(a) - ORDER.indexOf(b));
    return <span className="left-out-name"><LabLogo lab={x.r.model.labId} name={lab?.name ?? x.r.model.name} color={lab?.color} /><span className="truncate">{x.r.model.name}</span><span className="cap shrink-0" title={efforts.join(", ")} data-efforts={efforts.join(", ")}>{efforts.length > 2 ? `${efforts.length} efforts` : efforts.join(", ")}</span></span>;
  };
  return <div className="grid gap-6">
    {coverage.length > 0 && <section className="grid gap-2" data-left-out-reason="coverage">
      <h3>Not enough measured <span className="cap">a model needs scores on {strictness}% of the mix</span></h3>
      <ul className="left-out">{coverage.map((x) => <li key={`${x.r.model.id}${x.efforts[0]}`}>
        {head(x)}
        <span className="left-out-bar" role="img" aria-label={`${Math.round(x.r.measuredShare * 100)}% measured of ${strictness}% needed`}><i style={{ width: `${x.r.measuredShare * 100}%` }} /><b style={{ left: `${strictness}%` }} /></span>
        <span className="num left-out-pct">{Math.round(x.r.measuredShare * 100)}%</span>
      </li>)}</ul>
    </section>}
    {required.length > 0 && <section className="grid gap-2" data-left-out-reason="required">
      <h3>Missing a required benchmark</h3>
      <ul className="left-out">{required.map((x) => <li key={`${x.r.model.id}${x.efforts[0]}`}>
        {head(x)}
        <span className="left-out-missing">{x.r.missing.map(name).join(", ")}</span>
      </li>)}</ul>
    </section>}
  </div>;
}
