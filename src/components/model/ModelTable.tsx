"use client";
import Link from "next/link";
import { memo, useEffect, type RefObject } from "react";
import { IconArrowDown, IconArrowUp } from "@tabler/icons-react";
import { age, dateText, isNew, MODEL_SORTS, paramsHint, reasonWord, usd, type ModelItem, type ModelSort, type Order } from "@/lib/model-list";
import { LabLogo } from "@/components/LabLogo";
import { OpenIcon, ScoreBar, useMarkColor, Why } from "./directory-ui";

type Col = "rank" | "name" | "score" | "released" | "benchmarks" | "cost";
const HEADS: { id: Col; label: string; sort?: ModelSort }[] = [
  { id: "rank", label: "Rank", sort: "rank" },
  { id: "name", label: "Model", sort: "name" },
  { id: "score", label: "Score" },
  { id: "released", label: "Released", sort: "released" },
  { id: "benchmarks", label: "Benchmarks", sort: "benchmarks" },
  { id: "cost", label: "Cost per task", sort: "cost" },
];

/** The column heads, as the shipped table had them: click one to sort, again to flip. A phone has the sort menu instead. */
function ColumnHead({ order, onSort, cost, indexName }: { order: Order; onSort: (id: ModelSort) => void; cost: boolean; indexName: string }) {
  const TIP: Partial<Record<Col, string>> = {
    rank: `Rank on ${indexName}, Priors' default ranking, at the model's best reasoning effort.`,
    score: `Score on ${indexName}. Bars run 0 to 100; a gap marks a lower reasoning effort.`,
    released: "When the lab released it.",
    benchmarks: "How many benchmarks publish a result for it, any reasoning effort. Priors' estimates don't count.",
    cost: "Measured cost of one task at its best reasoning effort.",
  };
  return (
    <div className="md-head cap" role="toolbar" aria-label="Sort by column" data-cost={cost || undefined}>
      {HEADS.filter((h) => cost || h.id !== "cost").map((h) => {
        const cls = `md-c-${h.id}`;
        if (!h.sort) return <span key={h.id} className={cls} title={TIP[h.id]}>{h.label}</span>;
        const s = MODEL_SORTS.find((x) => x.id === h.sort)!, on = order.sort === h.sort, end = h.id !== "name" && h.id !== "rank";
        const Arrow = on && order.dir === "asc" ? IconArrowUp : IconArrowDown;
        const arrow = <Arrow size={12} stroke={2} className="md-sort-arrow" aria-hidden />;
        return (
          <span key={h.id} className={cls} title={TIP[h.id]}>
            <button type="button" className="md-sort" data-on={on || undefined} aria-pressed={on} aria-label={`Sort by ${s.name}${on ? `, ${s.names[order.dir === s.natural ? 0 : 1].toLowerCase()}` : ""}`} onClick={() => onSort(h.sort!)}>
              {end && arrow}{h.label}{!end && arrow}
            </button>
          </span>
        );
      })}
    </div>
  );
}

/** Arrow keys and j/k move through the rows; ArrowUp from the first row hands focus back. */
function useRowKeys(list: RefObject<HTMLElement | null>, back: () => void) {
  useEffect(() => {
    const on = (e: KeyboardEvent) => {
      const el = list.current; if (!el || e.metaKey || e.ctrlKey || e.altKey) return;
      const down = e.key === "ArrowDown" || e.key === "j", up = e.key === "ArrowUp" || e.key === "k";
      if (!down && !up) return;
      const t = e.target as HTMLElement;
      if (t.closest("input,textarea,select,[role=slider],[role=dialog]")) return;
      const links = [...el.querySelectorAll<HTMLElement>("a[data-model]")];
      const i = links.indexOf(t.closest("a[data-model]") as HTMLElement);
      if (i < 0) { if (down && !(e.key === "ArrowDown" && !el.contains(t) && t !== document.body)) { e.preventDefault(); links[0]?.focus(); } return; }
      e.preventDefault();
      if (down) links[Math.min(links.length - 1, i + 1)]?.focus();
      else if (i === 0) back(); else links[i - 1]?.focus();
    };
    addEventListener("keydown", on);
    return () => removeEventListener("keydown", on);
  }, [list, back]);
}

/**
 * One model. Desktop reads it across (rank, name, score bar, released, benchmarks, cost); a phone reads it as two lines. The same elements do both, laid out
 * by `models.css`, so the page needs no script to choose a layout and no second copy of the list.
 */
const Row = memo(function Row({ x, showLab, cost, color }: { x: ModelItem; showLab: boolean; cost: boolean; color: string }) {
  const ranked = x.rank != null, sub = [showLab ? x.labName : "", paramsHint(x)].filter(Boolean).join(" · ");
  const when = age(x.releaseDate), line2 = [showLab ? x.labName : "", when, ranked ? (x.costUsd != null ? usd(x.costUsd) : "") : reasonWord(x)].filter(Boolean).join(" · ");
  return (
    <li className="md-li">
      <Link href={`/models/${encodeURIComponent(x.id)}` as "/"} prefetch={false} className="md-row" data-model={x.id}>
        <span className="md-c-rank num">{ranked ? x.rank : ""}</span>
        <span className="md-name">
          <LabLogo lab={x.labId} name={x.labName} color={x.labColor} size={20} />
          <span className="md-text">
            <span className="md-title"><span className="md-trunc md-title-text" title={x.name}>{x.name}</span>{x.openWeights && <OpenIcon />}</span>
            {sub && <span className="md-sub md-trunc">{sub}</span>}
            <span className="md-line2 md-trunc">{line2}</span>
          </span>
        </span>
        <span className="md-c-score md-scorecell">
          {x.score != null && <span className={ranked ? "num md-num" : "num md-num md-grey"}>{x.score.toFixed(1)}</span>}
          {ranked ? <ScoreBar score={x.score!} color={color} efforts={x.efforts} /> : <Why x={x} />}
        </span>
        <span className={isNew(x.releaseDate) ? "md-c-released num md-new" : "md-c-released num"} title={dateText(x.releaseDate)} suppressHydrationWarning>{when}</span>
        <span className="md-c-benchmarks num">{x.benchmarks}</span>
        {cost && <span className="md-c-cost num">{x.costUsd != null && usd(x.costUsd)}</span>}
      </Link>
    </li>
  );
});

/** The ledger: sortable column heads, then rows. Memoized, so opening a menu or typing in the search box does not redraw hundreds of rows. */
export const ModelTable = memo(function ModelTable({ rows, showLab, order, onSort, onBack, listRef, cost, indexName }: { rows: ModelItem[]; showLab: boolean; order: Order; onSort: (id: ModelSort) => void; onBack: () => void; listRef: RefObject<HTMLUListElement | null>; cost: boolean; indexName: string }) {
  const mark = useMarkColor();
  useRowKeys(listRef, onBack);
  return (
    <div className="md-table" role="group" aria-label="Models" data-cost={cost || undefined}>
      <ColumnHead order={order} onSort={onSort} cost={cost} indexName={indexName} />
      <ul ref={listRef} className="md-list">
        {rows.map((x) => <Row key={x.id} x={x} showLab={showLab} cost={cost} color={mark(x)} />)}
      </ul>
    </div>
  );
});
