"use client";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import type { Benchmark } from "@/data/types";
import { searchBenchmarks } from "@/lib/benchmark-search";
import { benchmarkPath } from "@/lib/benchmark-slug";

/** One row of the directory: what the benchmark is, how much it covers, how good and how used it is. */
export interface DirectoryItem {
  id: string; name: string; shortName?: string; sourceId: string; category: Benchmark["category"]; description: string; host: string;
  models: number; quality: number; uses: number; lastUpdated?: string;
  /** An older version of a benchmark that has a newer one. */
  superseded?: boolean;
  /** A category split of another board (arena categories, subsets); `splits` counts them on the main board. */
  variantOf?: string; splits?: number;
}

type Sort = "recommended" | "uses" | "quality" | "models" | "updated" | "name";
const SORTS: { id: Sort; name: string }[] = [
  { id: "recommended", name: "Recommended" }, { id: "uses", name: "Most used in mixes" }, { id: "quality", name: "Quality" },
  { id: "models", name: "Most models" }, { id: "updated", name: "Recently updated" }, { id: "name", name: "A to Z" },
];
/** Quality, lifted by how many published pages weight it: a benchmark people actually use rises within its quality band. */
export const recommendedScore = (x: Pick<DirectoryItem, "quality" | "uses">) => x.quality + 12 * Math.log2(1 + x.uses);
const compare: Record<Sort, (a: DirectoryItem, b: DirectoryItem) => number> = {
  recommended: (a, b) => recommendedScore(b) - recommendedScore(a),
  uses: (a, b) => b.uses - a.uses || b.quality - a.quality,
  quality: (a, b) => b.quality - a.quality,
  models: (a, b) => b.models - a.models,
  updated: (a, b) => (b.lastUpdated ?? "").localeCompare(a.lastUpdated ?? ""),
  name: (a, b) => a.name.localeCompare(b.name),
};
const title = (c: string) => c.charAt(0).toUpperCase() + c.slice(1).replace(/-/g, " ");

export function BenchmarkDirectory({ items }: { items: DirectoryItem[] }) {
  const [q, setQ] = useState("");
  const [category, setCategory] = useState("all");
  const [sort, setSort] = useState<Sort>("recommended");
  const [everything, setEverything] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  // "/" jumps to search from anywhere on the page.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "/" && !(e.target as HTMLElement)?.closest("input,textarea,select")) { e.preventDefault(); input.current?.focus(); } };
    addEventListener("keydown", onKey); return () => removeEventListener("keydown", onKey);
  }, []);
  const pool = useMemo(() => items.filter((x) => (everything || (!x.superseded && !x.variantOf)) && (category === "all" || x.category === category)), [items, everything, category]);
  const searching = q.trim().length > 0;
  // A search over everything: an older version or a category split is often exactly what someone typed.
  // Equal matches keep input order, so feed it current boards before older versions and splits, then by recommendation.
  const ranked = useMemo(() => [...items].sort((a, b) => Number(!!a.superseded) - Number(!!b.superseded) || Number(!!a.variantOf) - Number(!!b.variantOf) || recommendedScore(b) - recommendedScore(a)), [items]);
  const found = useMemo(() => searching ? searchBenchmarks(ranked.filter((x) => category === "all" || x.category === category), q, title, { loose: true }) : [], [ranked, q, category, searching]);
  const categories = useMemo(() => [...new Set(items.map((x) => x.category))].sort(), [items]);
  const groups = useMemo(() => {
    const order = categories.map((c) => ({ c, list: pool.filter((x) => x.category === c).sort(compare[sort]) })).filter((g) => g.list.length);
    // Busiest, best categories first: by their strongest benchmark.
    return order.sort((a, b) => recommendedScore(b.list[0]) - recommendedScore(a.list[0]));
  }, [pool, categories, sort]);

  return (
    <div className="grid gap-8">
      <div className="grid gap-3">
        <div className="relative">
          <input ref={input} type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by name or what it measures: coding agents, legal, long context, vending…" aria-label="Search benchmarks" className="inp !text-[16px] !py-3 !pl-4 !pr-12 w-full" autoComplete="off" spellCheck={false} />
          <kbd className="absolute right-3 top-1/2 -translate-y-1/2 cap border hairline rounded px-1.5 max-sm:hidden" aria-hidden="true">/</kbd>
        </div>
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
          <label className="cap flex items-center gap-2">Category<select className="inp !w-auto !py-1 !text-[12.5px] normal-case" value={category} onChange={(e) => setCategory(e.target.value)}><option value="all">All</option>{categories.map((c) => <option key={c} value={c}>{title(c)}</option>)}</select></label>
          {!searching && <label className="cap flex items-center gap-2">Sort<select className="inp !w-auto !py-1 !text-[12.5px] normal-case" value={sort} onChange={(e) => setSort(e.target.value as Sort)}>{SORTS.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select></label>}
          {!searching && <label className="cap flex items-center gap-2 cursor-pointer"><input type="checkbox" checked={everything} onChange={(e) => setEverything(e.target.checked)} />Older versions and category splits</label>}
          <span className="cap ml-auto" role="status">{searching ? `${found.length} match${found.length === 1 ? "" : "es"}` : `${pool.length} benchmarks`}</span>
        </div>
      </div>

      {searching
        ? found.length ? <ul className="grid">{found.slice(0, 60).map((x) => <Row key={x.id} x={x} showCategory />)}</ul>
          : <p className="cap py-6">Nothing matches &ldquo;{q}&rdquo;. Try a word for what you want measured, such as coding, math or agents.</p>
        : groups.map((g) => <Category key={g.c} name={title(g.c)} list={g.list} open={category !== "all"} />)}
    </div>
  );
}

/** A category's best few first; the rest a click away, so the page reads as an overview rather than a wall. */
function Category({ name, list, open }: { name: string; list: DirectoryItem[]; open: boolean }) {
  const [all, setAll] = useState(open);
  const shown = all ? list : list.slice(0, 8);
  return <section className="grid gap-1">
    <div className="flex items-baseline justify-between border-b hairline pb-2"><h2 className="text-[20px]">{name}</h2><span className="cap">{list.length}</span></div>
    <ul className="grid">{shown.map((x) => <Row key={x.id} x={x} />)}</ul>
    {list.length > shown.length || all && list.length > 8 ? <button type="button" className="btn-quiet justify-self-start mt-1" onClick={() => setAll((v) => !v)}>{all ? "Show fewer" : `Show all ${list.length} ${name.toLowerCase()}`}</button> : null}
  </section>;
}

function Row({ x, showCategory }: { x: DirectoryItem; showCategory?: boolean }) {
  return (
    <li className="border-b hairline last:border-b-0">
      <Link href={benchmarkPath(x.id) as "/"} className="grid sm:grid-cols-[minmax(0,1fr)_auto] gap-x-6 gap-y-0.5 py-2.5 group">
        <span className="min-w-0">
          <span className="text-[15px] group-hover:underline decoration-dotted underline-offset-2">{x.name}</span>
          {x.superseded && <span className="cap"> · older version</span>}
          {x.splits ? <span className="cap"> · {x.splits} categories</span> : null}
          <span className="block text-[13px] text-ink-2 truncate">{x.description}</span>
        </span>
        <span className="cap sm:text-right whitespace-nowrap self-center">
          {showCategory && <>{title(x.category)} · </>}{x.models} models{x.uses ? ` · in ${x.uses} mix${x.uses === 1 ? "" : "es"}` : ""} · quality {Math.round(x.quality)}{x.host && <span className="max-md:hidden"> · {x.host}</span>}
        </span>
      </Link>
    </li>
  );
}
