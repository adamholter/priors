"use client";
import { useMemo, useState } from "react";
import type { Observation, Snapshot, Lab } from "@/data/types";
import type { RankedVariant } from "@/engine";
import { MetricScatter, type MetricPoint } from "../chart/MetricScatter";
import { SpeedChart } from "../chart/SpeedChart";

/** Collapsed-by-default metric charts for a profile page (AA-style gallery).
 *  Panels mount their chart only when first expanded. */
export function MetricGallery({ ranked, snapshot, labs }: { ranked: RankedVariant[]; snapshot: Snapshot; labs: Lab[] }) {
  const obs = useMemo(() => {
    const m = new Map<string, Map<string, Observation>>();
    for (const o of snapshot.observations) (m.get(o.benchmarkId) ?? m.set(o.benchmarkId, new Map()).get(o.benchmarkId)!).set(o.variantId, o);
    return m;
  }, [snapshot]);

  const at = (benchId: string, pick: (o: Observation) => number | undefined = (o) => o.value): MetricPoint[] =>
    ranked.flatMap((r) => { const o = obs.get(benchId)?.get(r.variant.id); const x = o && pick(o); return x != null && Number.isFinite(x) && x > 0 ? [{ x, r }] : []; });

  const panels: { id: string; title: string; desc: string; open?: boolean; node: React.ReactNode }[] = [];
  const ttft = at("aa-ttft");
  const decode = at("aa-intelligence-index-v4.3", (o) => (o.details?.estimatedDecodeSecondsPerTask as number | undefined) ?? undefined);
  const tokens = at("aa-intelligence-index-v4.3", (o) => (o.details?.outputTokensPerTask as number | undefined) ?? o.outputTokens ?? undefined);
  const uptime = at("openrouter-uptime");
  const toolErr = at("openrouter-tool-errors");
  const dates = ranked.flatMap((r) => r.model.releaseDate ? [{ x: Date.parse(r.model.releaseDate), r }] : []);

  const fmt = (u: string) => (x: number) => `${x.toLocaleString(undefined, { maximumFractionDigits: 2 })}${u}`;
  const fmtDate = (x: number) => new Date(x).toISOString().slice(0, 10);
  const MIN_PTS = 3;

  if (ranked.some((r) => r.speed)) panels.push({ id: "speed", title: "Output speed", desc: "tokens per second", open: true, node: <SpeedChart ranked={ranked} labs={labs} /> });
  if (ttft.length >= MIN_PTS) panels.push({ id: "latency", title: "Latency", desc: "seconds to first token", node: <MetricScatter pts={ttft} labs={labs} xLabel="s" xName="Time to first token (s)" scale="log" formatX={fmt("s")} aria="Index score versus time to first token" /> });
  if (decode.length >= MIN_PTS) panels.push({ id: "tpt", title: "Time per task", desc: "estimated decode time on the index suite", node: <MetricScatter pts={decode} labs={labs} xLabel="s/task" xName="Time per task (s)" scale="log" formatX={fmt("s")} aria="Index score versus estimated time per task" /> });
  if (tokens.length >= MIN_PTS) panels.push({ id: "tokens", title: "Output tokens", desc: "tokens generated per task", node: <MetricScatter pts={tokens} labs={labs} xLabel="tok" xName="Output tokens per task" scale="log" formatX={(x) => x >= 1000 ? `${(x / 1000).toFixed(0)}k` : `${x.toFixed(0)}`} aria="Index score versus output tokens per task" /> });
  if (dates.length >= MIN_PTS) panels.push({ id: "date", title: "Release date", desc: "when each model shipped", node: <MetricScatter pts={dates} labs={labs} xLabel="" xName="Release date" scale="time" formatX={fmtDate} aria="Index score versus model release date" /> });
  if (uptime.length >= MIN_PTS) panels.push({ id: "uptime", title: "Uptime", desc: "OpenRouter provider uptime, trailing 7 days", node: <MetricScatter pts={uptime} labs={labs} xLabel="%" xName="Uptime (%)" formatX={fmt("%")} aria="Index score versus OpenRouter uptime" /> });
  if (toolErr.length >= MIN_PTS) panels.push({ id: "errors", title: "Tool-call errors", desc: "OpenRouter error rate, trailing 3 days", node: <MetricScatter pts={toolErr} labs={labs} xLabel="%" xName="Error rate (%)" formatX={fmt("%")} aria="Index score versus tool-call error rate" /> });

  if (!panels.length) return null;
  return (
    <div className="border-t hairline">
      {panels.map((p) => <Panel key={p.id} title={p.title} desc={p.desc} defaultOpen={p.open}>{p.node}</Panel>)}
    </div>
  );
}

function Panel({ title, desc, defaultOpen, children }: { title: string; desc: string; defaultOpen?: boolean; children: React.ReactNode }) {
  const [open, setOpen] = useState(!!defaultOpen);
  const [mounted, setMounted] = useState(!!defaultOpen);
  return (
    <details className="gallery-panel border-b hairline" open={open} onToggle={(e) => { const o = e.currentTarget.open; setOpen(o); if (o) setMounted(true); }}>
      <summary className="flex items-baseline gap-4 py-3.5 cursor-pointer select-none list-none">
        <span className="text-[15px] font-medium">{title}</span>
        <span className="cap text-grey">{desc}</span>
        <span className="ml-auto text-grey transition-transform duration-200" style={{ transform: open ? "rotate(180deg)" : undefined }} aria-hidden="true">⌄</span>
      </summary>
      {mounted && <div className="pb-6">{children}</div>}
    </details>
  );
}
