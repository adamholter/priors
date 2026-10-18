"use client";
import { costChart } from "@/lib/metrics";
import type { Snapshot } from "@/data/types";
import type { IndexResult, RankedVariant } from "@/engine";
import Link from "next/link";
import { variantLabel } from "./chart/ParetoChart";
import { peerNote } from "@/lib/peer-note";
import { useLabColor } from "./chart/echarts";

/** Per-benchmark breakdown for one ranked variant. */
export function ModelDetail({ r, snapshot, result, onClose }: { r: RankedVariant; snapshot: Snapshot; result: IndexResult; onClose?: () => void }) {
  const benches = new Map(snapshot.benchmarks.map((b) => [b.id, b]));
  const lab = snapshot.labs.find((l) => l.id === r.model.labId);
  const labColor = useLabColor();
  const modelNames = new Map(snapshot.models.map((m) => [m.id, m.name]));
  const donorName = (variantId: string) => modelNames.get(variantId.split("@")[0]) ?? variantId;
  const siblings = result.ranked.filter((x) => x.model.id === r.model.id && x.variant.id !== r.variant.id);
  return (
    <div className="border hairline rounded-md bg-white p-5">
      <div className="flex items-baseline justify-between mb-3">
        <div className="flex items-baseline gap-3">
          <span className="inline-block w-2.5 h-2.5 rounded-full translate-y-[-1px]" style={{ background: labColor(lab?.id, lab?.color) }} />
          <h3 className="text-[20px]">{variantLabel(r)}</h3>
          <span className="cap">{lab?.name}{r.model.releaseDate && ` · ${r.model.releaseDate}`}</span>
        </div>
        <div className="flex items-baseline gap-4"><Link href={`/models/${r.model.id}` as "/"} className="cap text-indigo hover:underline">Model page →</Link>{onClose && <button type="button" onClick={onClose} className="cap hover:text-ink">close</button>}</div>
      </div>
      {r.variant.sourceModel && <p className="text-[12px] text-ink-2 mb-3"><a href={r.variant.sourceModel.url} target="_blank" rel="noreferrer" className="text-indigo underline">{r.variant.sourceModel.name}</a></p>}
      {r.mixedEfforts && <p className="text-[12px] text-indigo mb-3">This score includes effort-adjusted estimates. Cost and speed remain measured at {r.variant.effort}.</p>}
      <div className="grid grid-cols-1 xl:grid-cols-[1fr_1fr] gap-x-10 gap-y-4 text-[12.5px]">
        <div className="grid grid-cols-[1fr_auto_auto] gap-x-4 gap-y-1">
          <span className="cap">benchmark</span><span className="cap text-right">source raw</span><span className="cap text-right">0–100 · share</span>
          {r.values.map((v) => {
            const sourceRaw = v.raw;
            const b = benches.get(v.benchmarkId)!; const share = result.benchmarks.find((x) => x.benchmark.id === v.benchmarkId)!.share;
            return [
              <span key={v.benchmarkId + "n"} className="min-w-0" title={b.description}>{b.name}{v.estimated && <span className="block text-indigo">{v.effortFactor != null ? `${v.sourceVariantId?.split("@")[1] ?? "Source effort"} → ${r.variant.effort}: ×${v.effortFactor.toFixed(3)} from ${v.evidence?.length ?? 0} comparisons` : peerNote(v, donorName) ?? "Calibrated or inferred evidence"}<span className="block text-grey">{v.evidence?.map((id) => benches.get(id)?.name ?? id).join(", ")}</span></span>}{v.sourceUrl && /^https?:\/\//.test(v.sourceUrl) && <a href={v.sourceUrl} target="_blank" rel="noreferrer" className="ml-1 text-indigo underline">source</a>}{v.from && v.from !== v.benchmarkId && <span className="cap ml-1">via {benches.get(v.from)?.shortName ?? v.from}</span>}{v.estimated && <span className="cap ml-1 text-indigo">estimated</span>}</span>,
              <span key={v.benchmarkId + "r"} className="num text-right text-ink-2">{!v.estimated && sourceRaw != null ? fmt(sourceRaw, b.unit) : "—"}</span>,
              <span key={v.benchmarkId + "v"} className="num text-right">{v.value.toFixed(1)} <span className="text-grey">· {share.toFixed(0)}%</span></span>,
            ];
          })}
        </div>
        <div className="grid gap-1 content-start">
          <div className="flex justify-between"><span className="text-grey">Index score</span><span className="num">{r.score.toFixed(1)}</span></div>
          <div className="flex justify-between"><span className="text-grey">Measured share of weight</span><span className="num">{Math.round(r.measuredShare * 100)}%</span></div>
          {r.costUsd != null && <div className="flex justify-between"><span className="text-grey">{r.costPlan ? "Subscription cost per task" : "Cost per task"}</span><span className="num">{costChart.formatX(r.costUsd)} <span className="cap">{r.costPlan ? r.costPlan.plan : r.costSource === "aa-cost-to-run-index" ? "AA" : ""}</span></span></div>}
          {r.speed && <div className="flex justify-between"><span className="text-grey">Output speed</span><span className="num">{Math.round(r.speed)} tok/s</span></div>}
          <div className="flex justify-between"><span className="text-grey">Pareto frontier</span><span>{r.onFrontier ? "yes" : "no"}</span></div>
          {r.variant.sourceModel?.metadata && <details className="mt-2"><summary className="cursor-pointer cap">Source model metadata</summary><pre className="text-[11px] whitespace-pre-wrap break-all mt-2">{JSON.stringify(r.variant.sourceModel.metadata, null, 2)}</pre></details>}
          {siblings.length > 0 && <div className="mt-2"><div className="cap mb-1">other efforts</div>{siblings.map((s) => <div key={s.variant.id} className="flex justify-between"><span>{s.variant.sourceModel?.name ?? s.variant.effort}</span><span className="num">{s.score.toFixed(1)}{s.costUsd != null && <span className="text-grey"> · ${s.costUsd.toFixed(2)}</span>}</span></div>)}</div>}
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
