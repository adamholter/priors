"use client";
import { escapeSvg } from "./chart/export-frame";
import { ChartShare } from "./chart/ChartShare";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import type { Lab } from "@/data/types";
import { barShare, scoringLabel, type RankedVariant } from "@/engine";
import { variantLabel } from "./chart/ParetoChart";
import { markColor, markFillSvg, useChartPalette } from "./chart/echarts";
import { RankingColumns } from "./chart/RankingColumns";
import { RankingList } from "./RankingList";
import { rankingHeightFor, rankingsImageSvg } from "./chart/rankings-image";
import { labelScale } from "./chart/label-size";
import type { EditorState } from "@/lib/export-editor";

const ExportEditor = dynamic(() => import("./chart/ExportEditor"), { ssr: false });

/**
 * The leaderboard inside the screenshot editor: the same rows, drawn as an SVG exactly the size of the image, in the editor's
 * theme. A taller image holds more models. It hands the SVG to the editor, which frames and downloads it.
 */
function RankingsShot({ ranked, labs, showEffort, format, width, height, scale, svgRef }: { ranked: RankedVariant[]; labs: Lab[]; showEffort: boolean; format?: (r: RankedVariant) => string; width: number; height: number; scale: number; svgRef: { current: (() => string | undefined) | null } }) {
  const pal = useChartPalette();
  const color = new Map(labs.map((l) => [l.id, markColor(l.color, pal, l.id)]));
  const max = Math.max(...ranked.map((r) => r.score), 1);
  const defs = [...color].map(([lab, c]) => markFillSvg(`shot-fill-${lab.replace(/[^a-z0-9-]/gi, "")}`, c, pal) ?? "").join("");
  const svg = rankingsImageSvg(ranked.map((r) => {
    const c = color.get(r.model.labId) ?? "#A3A39B";
    return { rank: r.rank, label: r.model.name, effort: showEffort && r.variant.effort !== "default" ? r.variant.effort : undefined, value: format ? format(r) : r.score.toFixed(1), share: barShare(r, max), fill: markFillSvg("x", c, pal) ? `url(#shot-fill-${r.model.labId.replace(/[^a-z0-9-]/gi, "")})` : c };
  }), { width, height, scale: scale * (pal.size?.row ?? 1), bg: pal.bg, ink: pal.ink, grey: pal.grey, track: pal.dark ? "#262624" : "#ECEAE3", sans: pal.fonts?.sans ?? "Inter, Arial, sans-serif", mono: pal.fonts?.mono ?? "JetBrains Mono, Menlo, monospace", defs });
  useEffect(() => { svgRef.current = () => svg; }, [svgRef, svg]);
  return <div data-testid="rankings-shot" style={{ width, height, lineHeight: 0 }} dangerouslySetInnerHTML={{ __html: svg }} />;
}

/** Scores from a method other than the weighted average mean something different, so the list says which, by the scores. */
function MethodLabel({ ranked }: { ranked: RankedVariant[] }) {
  const method = ranked[0]?.method?.method;
  return method ? <p className="cap text-right mb-1.5" data-scoring={method}>{scoringLabel(method)} · <Link href="/methods/scoring" className="underline underline-offset-2 hover:text-ink" transitionTypes={["nav-forward"]}>what this score means</Link></p> : null;
}

const NO_ROWS = "No model has enough measured data for this index. Loosen a requirement, lower a weight, or reduce strictness.";

/** Dense horizontal bars, color by lab, rows slide to their new position when the order changes. */
type RankingsProps = { /** The heading a screenshot of this leaderboard starts with (default "Rankings"). */ imageTitle?: string; /** The number beside each bar; the index score by default. A benchmark page shows its published value. */ format?: (r: RankedVariant) => string; ranked: RankedVariant[]; labs: Lab[]; limit?: number; showEffort?: boolean; onSelect?: (r: RankedVariant | null) => void; selected?: string | null; title?: ReactNode; /** Beside the toolbar, under a heading that gets its own line (on phones it takes the width the toolbar leaves, so a one-line subtitle shares the row). */ subtitle?: ReactNode; actions?: ReactNode; anchor?: string; /** Models new to this visitor (`useNewModels`), labeled New. */ fresh?: Set<string>; /** What to say with no rows, when the usual advice does not fit. */ empty?: string };

/** Analysis-style themes draw the leaderboard as vertical columns; every other theme keeps the dense rows. */
export function Rankings(props: RankingsProps) {
  const columns = useChartPalette().style?.barLabels === "inside";
  return columns ? <RankingsColumns {...props} /> : <RankingsRows {...props} />;
}

function RankingsColumns({ ranked, labs, limit = 30, onSelect, selected, showEffort = true, title, subtitle, actions, anchor, fresh, empty }: RankingsProps) {
  const [expanded, setExpanded] = useState(false);
  const cap = Math.min(limit, 20);
  const rows = expanded ? ranked : ranked.slice(0, cap);
  const svg = useRef<() => string | undefined>(() => undefined);
  const head = <><div id={anchor} className="flex flex-wrap items-start justify-between gap-x-4 gap-y-1 mb-3 min-h-8 scroll-mt-20">{subtitle ? <div className="w-full min-w-0">{title}</div> : <div className="min-w-0 max-w-full shrink-0">{title}</div>}{subtitle && <div className="min-w-0 flex-1 basis-[280px] max-sm:basis-0">{subtitle}</div>}<div className="flex items-center gap-1 ml-auto">{actions}<ChartShare link={anchor ? { id: anchor, name: "Rankings" } : undefined} name="Rankings" getSvg={() => svg.current()} getRows={() => ranked.map((r) => ({ rank: r.rank, model: r.model.name, effort: showEffort ? r.variant.effort : "best", score: +r.score.toFixed(2), lab: r.model.labId, cost_per_task_usd: r.costUsd ?? null, speed_toks: r.speed ?? null, coverage: r.coverage }))} /></div></div></>;
  if (!rows.length) return <>{head}<p className="cap py-6">{empty ?? NO_ROWS}</p></>;
  // Bars have no room for a label, so new models are named below them.
  const newNames = [...new Set(rows.filter((r) => fresh?.has(r.model.id)).map((r) => r.model.name))];
  return <>{head}<MethodLabel ranked={ranked} /><RankingColumns rows={rows} labs={labs} showEffort={showEffort} selected={selected} onSelect={onSelect} getRef={(f) => { svg.current = f; }} />
    {newNames.length > 0 && <p className="cap mt-2" data-new-models><span className="text-indigo">New to you:</span> {newNames.join(", ")}</p>}
    {ranked.length > cap && <button className="cap mt-3 hover:text-ink" onClick={() => setExpanded(!expanded)}>{expanded ? "Show fewer" : `Show all ${ranked.length} ${showEffort ? "variants" : "models"}`}</button>}</>;
}

function RankingsRows({ ranked, labs, limit = 30, onSelect, selected, showEffort = true, title, subtitle, actions, anchor, format, fresh, empty, imageTitle }: RankingsProps) {
  const list = useRef<HTMLDivElement>(null);
  const [editor, setEditor] = useState<EditorState | null>(null);
  const pal = useChartPalette();
  const color = new Map(labs.map((l) => [l.id, markColor(l.color, pal, l.id)]));
  const [expanded, setExpanded] = useState(false);
  const rows = expanded ? ranked : ranked.slice(0, limit);
  const max = Math.max(...rows.map((r) => r.score), 1);
  const toggle = useCallback(() => setExpanded((e) => !e), []);

  const head = (exp: ReactNode) => <><div id={anchor} className="flex flex-wrap items-start justify-between gap-x-4 gap-y-1 mb-3 min-h-8 scroll-mt-20">{subtitle ? <div className="w-full min-w-0">{title}</div> : <div className="min-w-0 max-w-full shrink-0">{title}</div>}{subtitle && <div className="min-w-0 flex-1 basis-[280px] max-sm:basis-0">{subtitle}</div>}<div className="flex items-center gap-1 ml-auto">{actions}{exp}</div></div></>;
  if (!rows.length) return <>{head(anchor ? <ChartShare link={{ id: anchor, name: "Rankings" }} name="Rankings" /> : null)}<p className="cap py-6">{empty ?? NO_ROWS}</p></>;
  return (
    <>
    {head(<ChartShare link={anchor ? { id: anchor, name: "Rankings" } : undefined} name="Rankings" onEdit={() => setEditor({ w: Math.round(Math.min(1200, Math.max(480, list.current?.getBoundingClientRect().width ?? 900))), h: rankingHeightFor(Math.min(rows.length, 20), pal.size?.row ?? 1), view: {} })} getRows={() => ranked.map((r) => ({ rank: r.rank, model: r.model.name, effort: showEffort ? r.variant.effort : "best", score: +r.score.toFixed(2), lab: r.model.labId, cost_per_task_usd: r.costUsd ?? null, speed_toks: r.speed ?? null, coverage: r.coverage }))} getSvg={() => {
      const h = 88 + rows.length * 38;
      return `<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="${h}" viewBox="0 0 1600 ${h}">${[...color].map(([lab, c]) => markFillSvg(`fill-${lab}`, c, pal) ?? "").join("").replace(/^(.+)$/, "<defs>$1</defs>")}<rect width="1600" height="${h}" fill="${pal.bg}"/><g font-family="Inter,Arial,sans-serif" fill="${pal.ink}"><text x="30" y="36" font-size="24">Rankings</text>${rows.map((r, i) => {
        const y = 76 + i * 38;
        const label = showEffort ? variantLabel(r) : r.model.name;
        return `<text x="30" y="${y}" font-size="14" fill="${pal.grey}">${i + 1}</text><text x="70" y="${y}" font-size="15">${escapeSvg(label)}</text><rect x="330" y="${y - 13}" width="1120" height="14" fill="${pal.dark ? "#262624" : "#ECEAE3"}"/><rect x="330" y="${y - 13}" width="${barShare(r, max) * 1120}" height="14" fill="${color.has(r.model.labId) && markFillSvg("x", color.get(r.model.labId)!, pal) ? `url(#fill-${escapeSvg(r.model.labId)})` : escapeSvg(color.get(r.model.labId) ?? '#A3A39B')}"/><text x="1550" y="${y}" text-anchor="end" font-size="16">${r.score.toFixed(1)}</text>`;
      }).join('')}</g></svg>`;
    }} />)}
    <MethodLabel ranked={ranked} />
    <RankingList ranked={ranked} labs={labs} rows={rows} limit={limit} expanded={expanded} onToggle={toggle} showEffort={showEffort} format={format} fresh={fresh} onSelect={onSelect} selected={selected} listRef={list} />
    {editor && <ExportEditor name={imageTitle ?? "Rankings"} initial={editor} controls="rows" showScale={false} base={{ density: 1, frontier: false, links: false }} onClose={() => setEditor(null)}
      plot={(v, h, _chart, shot) => <RankingsShot ranked={ranked} labs={labs} showEffort={showEffort} format={format} width={shot.width} height={h} scale={labelScale(v.labelScale)} svgRef={shot.svg} />} />}
    </>
  );
}
