"use client";
import { costChart } from "@/lib/metrics";
import type { Snapshot } from "@/data/types";
import { scoringLabel, type IndexResult, type RankedVariant } from "@/engine";
import Link from "next/link";
import { variantLabel } from "./chart/ParetoChart";
import { peerNote } from "@/lib/peer-note";
import { LabLogo } from "./LabLogo";
import "./model-detail.css";

/** Per-benchmark breakdown for one ranked variant. */
export function ModelDetail({ r, snapshot, result, onClose }: { r: RankedVariant; snapshot: Snapshot; result: IndexResult; onClose?: () => void }) {
  const benches = new Map(snapshot.benchmarks.map((b) => [b.id, b]));
  const lab = snapshot.labs.find((l) => l.id === r.model.labId);
  const modelNames = new Map(snapshot.models.map((m) => [m.id, m.name]));
  const donorName = (variantId: string) => modelNames.get(variantId.split("@")[0]) ?? variantId;
  const siblings = result.ranked.filter((x) => x.model.id === r.model.id && x.variant.id !== r.variant.id);
  return (
    <div className="border hairline rounded-md bg-white p-3 sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 mb-3">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 min-w-0">
          <LabLogo lab={r.model.labId} name={lab?.name ?? r.model.name} color={lab?.color} size={20} />
          <h3 className="text-[20px]">{variantLabel(r)}</h3>
          <span className="cap whitespace-nowrap">{lab?.name}{r.model.releaseDate && ` · ${r.model.releaseDate}`}</span>
        </div>
        <div className="flex items-baseline gap-4"><Link href={`/models/${r.model.id}` as "/"} className="cap text-indigo hover:underline whitespace-nowrap">Model page →</Link>{onClose && <button type="button" onClick={onClose} className="cap hover:text-ink">close</button>}</div>
      </div>
      {r.variant.sourceModel && <p className="text-[12px] text-ink-2 mb-3"><a href={r.variant.sourceModel.url} target="_blank" rel="noreferrer" className="text-indigo underline">{r.variant.sourceModel.name}</a></p>}
      {r.mixedEfforts && <p className="text-[12px] text-indigo mb-3">This score includes effort-adjusted estimates. Cost and speed remain measured at {r.variant.effort}.</p>}
      <div className="grid grid-cols-1 xl:grid-cols-[1.35fr_1fr] gap-x-10 gap-y-4 text-[12.5px]">
        <div className="md-rows">
          <span className="cap">benchmark</span><span className="cap text-right">source</span><span className="cap">0 to 100</span><span className="cap text-right">share</span>
          {r.values.map((v) => {
            const b = benches.get(v.benchmarkId)!, share = result.benchmarks.find((x) => x.benchmark.id === v.benchmarkId)!.share;
            const note = v.estimated ? (v.effortFactor != null ? `${v.sourceVariantId?.split("@")[1] ?? "Another effort"} → ${r.variant.effort}, ×${v.effortFactor.toFixed(3)}` : peerNote(v, donorName) ?? "Estimated") : null;
            return <div key={v.benchmarkId} className="md-row" data-estimated={v.estimated || undefined}>
              <span className="min-w-0" title={b.description}>
                <span className="block">{b.name}</span>
                {note && <span className="md-note">{note}{v.evidence?.length ? <details><summary>from {v.evidence.length} benchmark{v.evidence.length === 1 ? "" : "s"}</summary><span>{v.evidence.map((id) => benches.get(id)?.name ?? id).join(", ")}</span></details> : null}</span>}
              </span>
              <span className="num text-right text-ink-2">{!v.estimated && v.raw != null ? fmt(v.raw, b.unit) : "est."}</span>
              <span className="md-bar"><i style={{ width: `${Math.max(0, Math.min(100, v.value))}%` }} /><b className="num">{v.value.toFixed(1)}</b></span>
              <span className="num text-right text-ink-2">{share.toFixed(0)}%</span>
            </div>;
          })}
        </div>
        <div className="grid gap-1 content-start">
          <div className="flex justify-between"><span className="text-grey">{r.method ? scoringLabel(r.method.method) : "Index score"}</span><span className="num">{r.score.toFixed(1)}</span></div>
          {r.method && <>
            <div className="flex justify-between"><span className="text-grey">Likely range (95%)</span><span className="num">{r.method.range[0].toFixed(1)} to {r.method.range[1].toFixed(1)}</span></div>
            <div className="flex justify-between"><span className="text-grey">Benchmarks it rests on</span><span className="num">{r.method.used} of {result.benchmarks.length}</span></div>
            <div className="flex justify-between"><span className="text-grey">Weighted average, for comparison</span><span className="num">{r.method.average.toFixed(1)}</span></div>
          </>}
          <div className="flex justify-between"><span className="text-grey">Measured share of weight</span><span className="num">{Math.round(r.measuredShare * 100)}%</span></div>
          {r.costUsd != null && <div className="flex justify-between"><span className="text-grey">{r.costPlan ? "Subscription cost per task" : "Cost per task"}</span><span className="num">{costChart.formatX(r.costUsd)} <span className="cap">{r.costPlan ? r.costPlan.plan : r.costSource === "aa-cost-to-run-index" ? "AA" : ""}</span></span></div>}
          {r.speed && <div className="flex justify-between"><span className="text-grey">Output speed</span><span className="num">{Math.round(r.speed)} tok/s</span></div>}
          <div className="flex justify-between"><span className="text-grey">Pareto frontier</span><span>{r.onFrontier ? "yes" : "no"}</span></div>
          {r.variant.sourceModel?.metadata && <details className="mt-2"><summary className="disclosure disclosure-inline cap">Source model metadata</summary><pre className="text-[11px] whitespace-pre-wrap break-all mt-2">{JSON.stringify(r.variant.sourceModel.metadata, null, 2)}</pre></details>}
          {siblings.length > 0 && <div className="mt-2"><div className="cap mb-1">other efforts</div>{siblings.map((s) => <div key={s.variant.id} className="flex justify-between"><span>{s.variant.effort}</span><span className="num">{s.score.toFixed(1)}{s.costUsd != null && <span className="text-grey"> · ${s.costUsd.toFixed(2)}</span>}</span></div>)}</div>}
        </div>
      </div>
    </div>
  );
}

function fmt(v: number, unit: string) {
  if (unit === "percent") return `${v.toFixed(1)}%`;
  if (unit === "usd") return `$${v.toFixed(2)}`;
  if (unit === "elo") return v.toFixed(0);
  return v.toFixed(1);
}
