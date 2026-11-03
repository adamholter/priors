"use client";
import { useEffect, useMemo, useState } from "react";
import type { EChartsOption } from "echarts";
import { money } from "@/lib/metrics";
import type { TokenPrice } from "@/data/subscription";
import type { CostRow, ModelView } from "@/lib/model-view";
import { CONTAIN_AXIS_LABELS, insideLabels, useChartPalette, useEChart } from "../chart/echarts";
import { FieldStrip, type StripPoint } from "./FieldStrip";
import { escapeSvg as esc } from "../chart/export-frame";

type Metric = { id: string; title: string; better: "lower" | "higher"; word: string; log: boolean; fmt: (v: number) => string; tick?: (v: number) => string; of: (r: CostRow) => number | undefined };

const secs = (v: number) => (v >= 60 ? `${(v / 60).toFixed(v >= 600 ? 0 : 1)} min` : `${v.toFixed(v >= 10 ? 0 : 1)}s`);
const tokens = (v: number) => (v >= 1000 ? `${(v / 1000).toFixed(v >= 10000 ? 0 : 1)}k` : `${Math.round(v)}`);
const effortOf = (r: CostRow) => (r.effort === "default" ? "" : r.effort);

/**
 * What the model costs and how fast it is, against every ranked model: index score against cost
 * per task for each of its efforts, then one field strip per metric (cost, time per task, output
 * speed, time to first token, output tokens) with its value and place. Metrics nobody measured
 * for this model are named rather than hidden.
 */
export function ModelCostSpeed({ data, modelId, name, color }: { data: ModelView["cost"]; modelId: string; name: string; color: string }) {
  const { rows, floor, hasFree, models, token } = data;
  const metrics = useMemo<Metric[]>(() => [
    // A free tier has no place on a log axis; it sits on the floor left of the cheapest paid cost.
    { id: "cost", title: "Cost per task", better: "lower", word: "cheapest", log: true, fmt: (v) => (v === floor ? "free" : money(v)), tick: money, of: (r) => (r.costUsd === 0 ? floor : r.costUsd && r.costUsd > 0 ? r.costUsd : undefined) },
    { id: "tpt", title: "Time per task", better: "lower", word: "quickest", log: false, fmt: secs, of: (r) => r.tpt },
    { id: "speed", title: "Output speed", better: "higher", word: "fastest", log: false, fmt: (v) => `${Math.round(v)} tok/s`, tick: (v) => `${Math.round(v)}`, of: (r) => (r.speed && r.speed > 0 ? r.speed : undefined) },
    { id: "latency", title: "Time to first token", better: "lower", word: "quickest", log: true, fmt: secs, of: (r) => r.latency },
    { id: "tokens", title: "Output tokens per task", better: "lower", word: "fewest", log: true, fmt: tokens, of: (r) => r.tokens },
  ], [floor]);
  const mineAll = useMemo(() => rows.filter((r) => r.modelId === modelId), [rows, modelId]);
  const has = metrics.filter((m) => mineAll.some((r) => m.of(r) != null)), missing = metrics.filter((m) => !has.includes(m));
  const withCost = mineAll.some((r) => r.costUsd != null && r.costUsd >= 0);
  return (
    <section className="grid gap-4">
      <div className="flex items-baseline justify-between border-b hairline pb-2"><h2 className="text-[26px]">Cost and speed</h2><span className="cap">{models ? `against ${models} ranked models` : ""}</span></div>
      {withCost && <ScoreCost rows={rows} floor={floor} hasFree={hasFree} modelId={modelId} color={color} />}
      {has.length > 0 && <div className="grid gap-x-8 gap-y-6 lg:grid-cols-2">{has.map((m) => <MetricCard key={m.id} m={m} ranked={rows} mine={mineAll} modelId={modelId} color={color} />)}</div>}
      <TokenPriceCard price={token} />
      {missing.length > 0 && <p className="cap">Not measured for {name}: {missing.map((m) => m.title.toLowerCase()).join(", ")}{missing.some((m) => m.id === "cost") ? " (no published API price yet)" : ""}.</p>}
    </section>
  );
}

const HARNESS: Record<string, string> = { claudeAgent: "Claude Code", codex: "Codex", opencode: "OpenCode", cursor: "Cursor" };
const perM = (v: number) => `$${v >= 0.01 ? v.toFixed(3) : v.toPrecision(2)}`;
const pct = (v: number) => `${(v * 100).toFixed(v >= 0.1 ? 1 : 2)}%`;
const day = (d: string) => new Date(`${d}T00:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });

/** What a million of this model's tokens cost, and where the token mix behind that number comes from. */
function TokenPriceCard({ price }: { price?: TokenPrice }) {
  if (!price) return null;
  const { mix, measured, apiUsd, standardUsd, subscription } = price;
  return <div className="grid gap-1" data-token-price>
    <h3 className="text-[18px]">Token price</h3>
    <p className="flex flex-wrap items-baseline gap-x-5"><span><span className="num text-[20px] text-indigo">{perM(apiUsd)}</span> <span className="cap">per 1M tokens at API prices</span></span>{subscription && <span><span className="num text-[20px] text-indigo">{perM(subscription.usd)}</span> <span className="cap">on {subscription.plan}</span></span>}</p>
    <p className="cap">{pct(mix.cache)} cache read · {pct(mix.input)} fresh input · {pct(mix.cacheWrite ?? 0)} cache write · {pct(mix.output)} output</p>
    <p className="cap">{measured ? <>Measured from T3 Code usage in {HARNESS[measured.harness] ?? measured.harness}, {day(measured.start)} to {day(measured.end)}, {measured.confidence} confidence. One app&rsquo;s users, not everyone&rsquo;s. {perM(standardUsd)} at the standard 97 / 2.5 / 0.5 mix.</> : <>Assumed mix: no measured T3 Code usage for this model.</>}</p>
  </div>;
}

function MetricCard({ m, ranked, mine, modelId, color }: { m: Metric; ranked: CostRow[]; mine: CostRow[]; modelId: string; color: string }) {
  const { field, points, lead, head, rank, of } = useMemo(() => {
    // One point per other model: its best-scoring effort that has this metric.
    const seen = new Set<string>(), field: { r: CostRow; v: number }[] = [];
    for (const r of ranked) { if (r.modelId === modelId || seen.has(r.modelId)) continue; const v = m.of(r); if (v == null) continue; seen.add(r.modelId); field.push({ r, v }); }
    const own = mine.flatMap((r) => { const v = m.of(r); return v == null ? [] : [{ r, v }]; });
    const better = (a: number, b: number) => (m.better === "lower" ? a < b : a > b);
    const head = own[0], best = field.reduce<{ r: CostRow; v: number } | undefined>((a, x) => (!a || better(x.v, a.v) ? x : a), undefined);
    const point = (x: { r: CostRow; v: number }, label: string): StripPoint => ({ key: x.r.id, value: x.v, label, tip: `<b>${esc(x.r.name)}${effortOf(x.r) ? ` ${esc(effortOf(x.r))}` : ""}</b><br/><span style="font-family:var(--font-jetbrains)">${m.fmt(x.v)} · index ${x.r.score.toFixed(1)}</span>` });
    return {
      field: field.map((x) => point(x, "")), points: own.map((x) => point(x, own.length > 1 ? effortOf(x.r) : "")),
      lead: best && head && better(best.v, head.v) ? point(best, best.r.name) : undefined,
      head, rank: head ? 1 + field.filter((x) => better(x.v, head.v)).length : 0, of: field.length + 1,
    };
  }, [m, ranked, mine, modelId]);
  if (!head) return null;
  return (
    <article className="grid gap-1 content-start">
      <div className="flex items-baseline justify-between gap-3">
        <h3 className="text-[19px] leading-tight">{m.title}</h3>
        <span className="cap shrink-0">{rank === 1 ? `${m.word} of ${of}` : `#${rank} ${m.word} of ${of}`}</span>
      </div>
      <p className="num text-[22px] leading-none" style={{ color: "var(--indigo)" }}>{m.fmt(head.v)}{effortOf(head.r) && <span className="cap ml-2 align-middle">at {effortOf(head.r)}</span>}</p>
      <FieldStrip field={field} mine={points} lead={lead} color={color} fmt={m.fmt} tick={m.tick} log={m.log} aria={`${m.title}: this model against ${of - 1} other models`} height={140} />
    </article>
  );
}

/** Index score against cost per task: this model's efforts joined in order, every other model's best effort ghosted. */
function ScoreCost({ rows, floor, hasFree, modelId, color }: { rows: CostRow[]; floor: number; hasFree: boolean; modelId: string; color: string }) {
  const pal = useChartPalette();
  const [plotW, setPlotW] = useState(0);
  const option = useMemo<EChartsOption>(() => {
    // Free tiers sit on the floor left of the cheapest paid cost (costChart.points).
    const x = new Map(rows.flatMap((r) => (r.costUsd == null || !(r.costUsd >= 0) ? [] : [[r.id, r.costUsd === 0 ? floor : r.costUsd] as const])));
    const seen = new Set<string>(), rest: CostRow[] = [];
    for (const r of rows) if (r.modelId !== modelId && x.has(r.id) && !seen.has(r.modelId)) { seen.add(r.modelId); rest.push(r); }
    const mine = rows.filter((r) => r.modelId === modelId && x.has(r.id)).sort((a, b) => a.costUsd! - b.costUsd!);
    // Tooltips are HTML; model names and efforts come from scraped sources, so they are escaped.
    const tip = (r: CostRow) => `<b>${esc(r.name)}${effortOf(r) ? ` ${esc(effortOf(r))}` : ""}</b><br/><span style="font-family:var(--font-jetbrains)">index ${r.score.toFixed(1)} · ${r.costUsd === 0 ? "free" : `${money(r.costUsd!)}/task`}</span>`;
    return {
      grid: { left: 40, right: 70, top: 14, bottom: 36, ...CONTAIN_AXIS_LABELS },
      xAxis: { type: "log", name: "$ / task", nameLocation: "end", nameGap: 6, nameTextStyle: { color: pal.grey, fontSize: 10, align: "right", verticalAlign: "top", padding: [24, 0, 0, 0] }, axisLabel: { formatter: (v: number) => money(v), hideOverlap: true, showMinLabel: false, showMaxLabel: false }, min: (e: { min: number }) => e.min / 1.5, max: (e: { max: number }) => e.max * 1.5 },
      yAxis: { type: "value", scale: true, name: "Index score", nameTextStyle: { color: pal.grey, fontSize: 10, align: "left" } },
      tooltip: { trigger: "item", confine: true, formatter: (p: unknown) => { const r = (p as { data?: { r?: CostRow } }).data?.r; return r ? tip(r) : ""; } },
      series: [
        { type: "scatter", id: "ghost", symbolSize: 7, data: rest.map((r) => ({ value: [x.get(r.id), r.score], r })), itemStyle: { color: pal.grey, opacity: pal.dark ? 0.35 : 0.32 }, emphasis: { itemStyle: { opacity: 0.9 } }, z: 1,
          ...(hasFree ? { markLine: { silent: true, symbol: "none", lineStyle: { color: pal.grey, type: "dashed" as const, width: 1, opacity: 0.7 }, label: { show: true, position: "end" as const, formatter: "free", color: pal.grey, fontSize: 10 }, data: [[{ xAxis: floor, yAxis: "min" }, { xAxis: floor, yAxis: "max" }]] } } : {}) },
        { type: "line", id: "mine-line", data: mine.map((r) => [x.get(r.id), r.score]), showSymbol: false, lineStyle: { color, width: 1.4, opacity: 0.7 }, silent: true, z: 2 },
        { type: "scatter", id: "mine", symbolSize: 12, data: mine.map((r) => ({ value: [x.get(r.id), r.score], r, name: effortOf(r) })), itemStyle: { color, borderColor: pal.ink, borderWidth: 1.2 }, label: { show: true, position: "right", formatter: "{b}", fontSize: 11, color: pal.ink, distance: 6, textBorderColor: pal.bg, textBorderWidth: 3 }, labelLayout: insideLabels(() => plotW || undefined, { moveOverlap: true }), z: 3 },
      ],
    };
  }, [rows, floor, hasFree, modelId, color, pal, plotW]);
  const { ref } = useEChart(option, [option]);
  useEffect(() => { const el = ref.current; if (!el) return; const ro = new ResizeObserver(([e]) => setPlotW(Math.round(e.contentRect.width / 4) * 4)); ro.observe(el); return () => ro.disconnect(); }, [ref]);
  return <div ref={ref} role="img" aria-label="Index score against cost per task, this model's efforts highlighted" style={{ width: "100%", height: 300 }} />;
}
