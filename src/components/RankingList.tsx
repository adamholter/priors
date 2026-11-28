"use client";
import { memo, useCallback, useEffect, useMemo, useRef, type CSSProperties, type RefObject } from "react";
import type { Lab } from "@/data/types";
import { barShare, scoringNote, type RankedVariant } from "@/engine";
import { variantLabel } from "./chart/ParetoChart";
import { markColor, markFillCss, useChartPalette } from "./chart/echarts";
import { LabLogo } from "./LabLogo";
import { labTitle, shownScore, tieLabel, tiesOf, type Tie } from "@/lib/ranking-rows";
import "./ranking-list.css";

type RowProps = {
  r: RankedVariant; index: number; showEffort: boolean; tie?: Tie; labName: string; labColor?: string; fill: string; logo: number;
  share: number; text: string; fresh: boolean; selected: boolean; onPick: (r: RankedVariant) => void;
};

/** One row: rank (`=2` when tied), the lab's logo, the name, the effort in its own column when efforts show, the bar and the score. Memoized: a list of 65+ rows re-renders only the rows that changed. */
const Row = memo(function Row({ r, index, showEffort, tie, labName, labColor, fill, logo, share, text, fresh, selected, onPick }: RowProps) {
  const base = r.variant.sourceModel?.name ?? variantLabel(r);
  const note = scoringNote(r);
  const title = `${base} · ${labName}${note ? ` · ${note}` : ""}${tie ? ` · Tied at ${tie.text}` : ""}`;
  const label = `${base}, ${labName}${fresh ? ", new" : ""}, ${text}${tie ? `, tied for rank ${tie.first}` : ""}`;
  return (
    <button type="button" className="rl-row" title={title} aria-label={label} data-k={r.variant.id} data-mixed={r.mixedEfforts || undefined} data-selected={selected || undefined}
      onClick={() => onPick(r)} style={{ "--i": index } as CSSProperties}>
      <span className="cap rl-rk">{tieLabel(tie, r.rank)}</span>
      <LabLogo lab={r.model.labId} name={labName} color={labColor} size={logo} />
      <span className="rl-name"><span className="rl-nm">{r.model.name}</span>{fresh && <em className="not-italic cap rl-new" data-new-model>New</em>}</span>
      {showEffort && <span className="cap rl-effcol">{r.variant.effort !== "default" ? r.variant.effort : ""}</span>}
      <span className="rl-track"><i className="bar-fill rl-fill" style={{ width: `${(share * 100).toFixed(2)}%`, background: fill }} /></span>
      <span className="num rl-sc">{text}</span>
    </button>
  );
});

/**
 * The leaderboard's rows and its Show all button. Rows are absolutely placed in a list whose height and pitch come from CSS,
 * so they slide when the order changes and a phone's 40px rows need no JS.
 */
export function RankingList({ ranked, labs, rows, limit, expanded, onToggle, showEffort, format, fresh, onSelect, selected, listRef }: {
  ranked: RankedVariant[]; labs: Lab[]; rows: RankedVariant[]; limit: number; expanded: boolean; onToggle: () => void; showEffort: boolean;
  format?: (r: RankedVariant) => string; fresh?: Set<string>; onSelect?: (r: RankedVariant | null) => void; selected?: string | null; listRef: RefObject<HTMLDivElement | null>;
}) {
  const pal = useChartPalette();
  const logo = Math.round(16 * (pal.size?.row ?? 1));
  const labById = useMemo(() => new Map(labs.map((l) => [l.id, l])), [labs]);
  const fills = useMemo(() => new Map(labs.map((l) => [l.id, markFillCss(markColor(l.color, pal, l.id), pal)])), [labs, pal]);
  const plain = useMemo(() => markFillCss(markColor(undefined, pal), pal), [pal]);
  const text = useCallback((r: RankedVariant) => (format ? format(r) : r.score.toFixed(1)), [format]);
  const ties = useMemo(() => tiesOf(ranked.map((r) => ({ id: r.variant.id, rank: r.rank, text: text(r) }))), [ranked, text]);
  const max = useMemo(() => Math.max(...rows.map((r) => r.score), 1), [rows]);
  // The click handler reads the latest props through a ref, so it stays the same function and memoized rows are not re-rendered by it.
  const latest = useRef({ onSelect, selected });
  useEffect(() => { latest.current = { onSelect, selected }; });
  const pick = useCallback((r: RankedVariant) => { const { onSelect: on, selected: sel } = latest.current; on?.(sel === r.variant.id ? null : r); }, []);
  const formatted = !!format;
  const topShown = shownScore(max, formatted);
  return (
    <>
    <div ref={listRef} className="ranking-list rl-list relative overflow-hidden isolate" data-fmt={formatted || undefined} data-eff={showEffort || undefined} style={{ "--n": rows.length, "--rp": `${Math.round(30 * (pal.size?.row ?? 1))}px` } as CSSProperties}>
      {rows.map((r, i) => {
        const lab = labById.get(r.model.labId);
        return <Row key={showEffort ? r.variant.id : r.model.id} r={r} index={i} showEffort={showEffort} tie={ties.get(r.variant.id)} labName={labTitle(lab?.name, r.model.labId)} labColor={lab?.color}
          fill={fills.get(r.model.labId) ?? plain} logo={logo} share={barShare({ score: shownScore(r.score, formatted), method: r.method }, topShown)} text={text(r)}
          fresh={!!fresh?.has(r.model.id)} selected={selected === r.variant.id} onPick={pick} />;
      })}
      {rows[0] && <span className="sr-only">{variantLabel(rows[0])}</span>}
    </div>
    {ranked.length > limit && <button className="cap mt-3 hover:text-ink hit" onClick={onToggle}>{expanded ? "Show fewer" : `Show all ${ranked.length} ${showEffort ? "variants" : "models"}`}</button>}
    </>
  );
}
