"use client";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState, type ComponentType, type ReactNode } from "react";
import {
  IconBolt, IconBook2, IconBrain, IconBriefcase, IconChartPie, IconChess, IconCode, IconCube, IconDots, IconEye, IconFileText, IconFlask, IconHistory, IconLanguage, IconMathFunction, IconMoodSmile, IconPalette,
  IconReceipt, IconRepeat, IconRobot, IconSearch, IconShieldCheck, IconStack2, IconThumbUp, IconTrophy, IconUsers, IconWorld,
} from "@tabler/icons-react";
import type { Benchmark } from "@/data/types";
import { categoriesOf, categoryBlurb, categoryName, categoryOrder } from "@/data/categories";
import { searchBenchmarks } from "@/lib/benchmark-search";
import { recommendedScore } from "@/lib/benchmark-recommended";
import { benchmarkPath } from "@/lib/benchmark-slug";
import { useLabColor } from "@/components/chart/echarts";
import "./benchmarks.css";

/** One row of the directory: what the benchmark is, how much it covers, how good and how used it is. */
export interface DirectoryItem {
  id: string; name: string; shortName?: string; sourceId: string; category: Benchmark["category"]; categories?: Benchmark["category"][]; description: string; host: string;
  models: number; quality: number; uses: number; lastUpdated?: string;
  /** The model with the best score the publisher reports on this board, older models included. */
  leader?: { name: string; labId: string; color: string };
  /** An older version of a benchmark that has a newer one. */
  superseded?: boolean;
  /** A category split of another board (arena categories, subsets); `splits` counts them on the main board. */
  variantOf?: string; splits?: number;
}

type Icon = ComponentType<{ size?: number; stroke?: number; className?: string; "aria-hidden"?: boolean }>;
const CATEGORY_ICON: Record<Benchmark["category"], Icon> = {
  coding: IconCode, agentic: IconRobot, professional: IconBriefcase, science: IconFlask, math: IconMathFunction, reasoning: IconBrain, games: IconChess,
  knowledge: IconBook2, vision: IconEye, "long-context": IconFileText, creative: IconPalette, behavior: IconMoodSmile, safety: IconShieldCheck,
  multilingual: IconLanguage, preference: IconThumbUp, composite: IconChartPie, speed: IconBolt, cost: IconReceipt, reliability: IconRepeat, other: IconDots,
};
const TIP = {
  leader: "The model with the best score this benchmark reports, older models included.",
  models: "How many models the publisher has measured here. Priors' estimates don't count.",
  uses: "How many published Priors pages give this benchmark weight.",
  quality: "How useful this benchmark is for telling current models apart, from 0 to 100. See How scores work.",
};

type Sort = "recommended" | "uses" | "quality" | "models" | "updated" | "name";
const SORTS: { id: Sort; name: string }[] = [
  { id: "recommended", name: "Recommended" }, { id: "uses", name: "Most used in mixes" }, { id: "quality", name: "Quality" },
  { id: "models", name: "Most models" }, { id: "updated", name: "Recently updated" }, { id: "name", name: "A to Z" },
];
const compare: Record<Sort, (a: DirectoryItem, b: DirectoryItem) => number> = {
  recommended: (a, b) => recommendedScore(b) - recommendedScore(a),
  uses: (a, b) => b.uses - a.uses || b.quality - a.quality,
  quality: (a, b) => b.quality - a.quality,
  models: (a, b) => b.models - a.models,
  updated: (a, b) => (b.lastUpdated ?? "").localeCompare(a.lastUpdated ?? ""),
  name: (a, b) => a.name.localeCompare(b.name),
};
const title = categoryName;
const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;


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
  const base = useMemo(() => items.filter((x) => everything || (!x.superseded && !x.variantOf)), [items, everything]);
  const searching = q.trim().length > 0;
    const categories = useMemo(() => {
    const count = new Map<string, number>();
    for (const x of base) for (const c of categoriesOf(x)) count.set(c, (count.get(c) ?? 0) + 1);
    // A fixed order, so a category is always in the same place.
    return [...count.keys()].sort((a, b) => categoryOrder(a) - categoryOrder(b)).map((id) => ({ id, count: count.get(id)! }));
  }, [base]);
  // A search over everything: an older version or a category split is often exactly what someone typed.
  // Equal matches keep input order, so feed it current boards before older versions and splits, then by recommendation.
  const ranked = useMemo(() => [...items].sort((a, b) => Number(!!a.superseded) - Number(!!b.superseded) || Number(!!a.variantOf) - Number(!!b.variantOf) || recommendedScore(b) - recommendedScore(a)), [items]);
  const found = useMemo(() => {
    const inCategory = (x: DirectoryItem) => category === "all" || categoriesOf(x).some((c) => c === category);
    return searching ? searchBenchmarks(ranked.filter(inCategory), q, title, { loose: true }) : base.filter(inCategory).sort(compare[sort]);
  }, [base, ranked, category, sort, q, searching]);
  const totals = useMemo(() => ({ models: Math.max(0, ...base.map((x) => x.models)), publishers: new Set(base.map((x) => x.host).filter(Boolean)).size }), [base]);
  // Every benchmark is listed, so a new one is never hidden below a cut-off (and find-in-page sees it). Only search results stop at 60.
  // What keeps ~450 rows light: rows off screen skip layout and paint (content-visibility in benchmarks.css), and their icons
  // are references to one shared sprite rather than a full inline SVG each.
  const shown = searching ? found.slice(0, 60) : found;
  const choose = (c: string) => setCategory(c);

  return (
    <div className="bench-dir grid gap-8">
      <DirSprite />
      <div className="bench-totals" aria-label="Directory totals">
        <span><IconStack2 size={16} stroke={1.5} aria-hidden />{plural(base.length, "benchmark")}</span>
        <span><IconCube size={16} stroke={1.5} aria-hidden />up to {plural(totals.models, "model")} each</span>
        <span><IconWorld size={16} stroke={1.5} aria-hidden />{plural(totals.publishers, "publisher")}</span>
      </div>
      <div className="bench-layout">
        <nav className="bench-rail" aria-label="Categories">
          <button type="button" aria-pressed={category === "all"} onClick={() => choose("all")}><IconStack2 size={17} stroke={1.5} aria-hidden /><span>All</span><span className="cap">{base.length}</span></button>
          {categories.map((c) => { const I = CATEGORY_ICON[c.id as Benchmark["category"]] ?? IconDots; return <button key={c.id} type="button" aria-pressed={category === c.id} title={categoryBlurb(c.id)} onClick={() => choose(c.id)}><I size={17} stroke={1.5} aria-hidden /><span>{categoryName(c.id)}</span><span className="cap">{c.count}</span></button>; })}
        </nav>
        <div className="grid gap-5 content-start min-w-0">
          <div className="grid gap-3">
            <div className="relative">
              <IconSearch size={18} stroke={1.5} className="absolute left-4 top-1/2 -translate-y-1/2 text-grey pointer-events-none" aria-hidden />
              <input ref={input} type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by name or what it measures: coding agents, legal, chess…" aria-label="Search benchmarks" className="inp !text-[16px] !py-3 !pl-11 !pr-12 w-full" autoComplete="off" spellCheck={false} />
              <kbd className="absolute right-3 top-1/2 -translate-y-1/2 cap border hairline rounded px-1.5 max-sm:hidden" aria-hidden="true">/</kbd>
            </div>
            <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
              {!searching && <label className="cap flex items-center gap-2">Sort<select className="inp !w-auto !py-1 !text-[12.5px] normal-case" value={sort} onChange={(e) => setSort(e.target.value as Sort)}>{SORTS.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select></label>}
              {!searching && <label className="cap flex items-center gap-2 cursor-pointer"><input type="checkbox" checked={everything} onChange={(e) => setEverything(e.target.checked)} />Older versions and sub-boards</label>}
              <Link href="/benchmarks/methodology" className="cap underline decoration-dotted underline-offset-2 hover:text-ink">How scores work</Link>
              <span className="cap ml-auto" role="status">{searching ? plural(found.length, "match", "matches") : plural(found.length, "benchmark")}</span>
            </div>
          </div>
          {shown.length ? <div className="min-w-0">
            <div className="bench-head cap" aria-hidden="true">
              <span>Benchmark</span>
              <Tip text={TIP.leader}><IconTrophy size={13} stroke={1.6} aria-hidden />Top model</Tip>
              <Tip text={TIP.models} end><IconCube size={13} stroke={1.6} aria-hidden />Models</Tip>
              <Tip text={TIP.uses} end><IconUsers size={13} stroke={1.6} aria-hidden />Mixes</Tip>
              <Tip text={TIP.quality} end>Quality</Tip>
            </div>
            <ul className="grid">{shown.map((x) => <Row key={x.id} x={x} showCategory={category === "all"} />)}</ul>
          </div> : <p className="cap py-6">Nothing matches &ldquo;{q}&rdquo;. Try a word for what you want measured, such as coding, math or agents.</p>}
        </div>
      </div>
    </div>
  );
}

/**
 * Row icons as references to one shared sprite. A Tabler icon inline is an <svg> with several paths, five icons a row across
 * ~450 rows; a <use> is two nodes. The referenced paths keep stroke="currentColor", so each use takes its row's color.
 */
const SPRITE: Record<string, { I: Icon; stroke: number }> = {
  trophy: { I: IconTrophy, stroke: 1.6 }, cube: { I: IconCube, stroke: 1.6 }, users: { I: IconUsers, stroke: 1.6 }, history: { I: IconHistory, stroke: 1.6 },
  ...Object.fromEntries(Object.entries(CATEGORY_ICON).map(([c, I]) => [`cat-${c}`, { I, stroke: 1.5 }])),
};
function DirSprite() {
  return <svg width="0" height="0" style={{ position: "absolute" }} aria-hidden="true" focusable="false"><defs>
    {Object.entries(SPRITE).map(([k, { I, stroke }]) => <symbol key={k} id={`bd-${k}`} viewBox="0 0 24 24"><I size={24} stroke={stroke} /></symbol>)}
  </defs></svg>;
}
function Use({ k, size, className }: { k: string; size: number; className?: string }) {
  return <svg width={size} height={size} className={className} aria-hidden="true" focusable="false"><use href={`#bd-${k}`} /></svg>;
}

/** A word for a value, after a short hover. Screen readers get the visually hidden labels in the row instead. */
function Tip({ text, end, children, className = "" }: { text: string; end?: boolean; children: ReactNode; className?: string }) {
  return <span className={`bench-tip ${end ? "bench-tip-end" : ""} ${className}`} data-bench-tip={text}>{children}</span>;
}

/** Quality as five bars with the number beside them, so it reads at a glance and exactly. */
function Quality({ v }: { v: number }) {
  const score = Math.round(v), filled = Math.max(score > 0 ? 1 : 0, Math.round(score / 20));
  return <span className="bench-quality">
    <span className="bench-word bench-quality-word">Quality </span>
    <span className="bench-bars" aria-hidden="true">{[0, 1, 2, 3, 4].map((i) => <i key={i} className={i < filled ? "on" : ""} />)}</span>
    <b className="num">{score}</b>
  </span>;
}

function Favicon({ host }: { host: string }) {
  const [ok, setOk] = useState(true);
  if (!ok) return null;
  // eslint-disable-next-line @next/next/no-img-element
  return <img className="bench-fav" src={`https://www.google.com/s2/favicons?domain=${encodeURIComponent(host)}&sz=32`} alt="" width={14} height={14} loading="lazy" onError={() => setOk(false)} />;
}

function Row({ x, showCategory }: { x: DirectoryItem; showCategory?: boolean }) {
  const lab = useLabColor(), main = categoriesOf(x)[0], icon = CATEGORY_ICON[main] ? main : "other";
  return (
    <li className="border-b hairline last:border-b-0">
      <Link href={benchmarkPath(x.id) as "/"} className="bench-row group">
        <span className="bench-main">
          {showCategory && <Tip text={categoriesOf(x).map(categoryName).join(" · ")} className="bench-cat"><Use k={`cat-${icon}`} size={16} /></Tip>}
          <span className="min-w-0">
            <span className="flex flex-wrap items-center gap-x-2">
              <span className="text-[15px] group-hover:underline decoration-dotted underline-offset-2">{x.name}</span>
              {x.superseded && <span className="cap inline-flex items-center gap-1"><Use k="history" size={12} />older version</span>}
              {x.splits ? <span className="cap">{plural(x.splits, "sub-board")}</span> : null}
            </span>
            <span className="block text-[13px] text-ink-2 truncate">{x.description}</span>
            {x.host && <span className="bench-host cap"><Favicon host={x.host} />{x.host}</span>}
          </span>
        </span>
        <span className="bench-cell bench-leader">{x.leader && <Tip text={TIP.leader}><Use k="trophy" className="bench-trophy" size={13} /><i style={{ background: lab(x.leader.labId, x.leader.color) }} /><span className="truncate"><span className="bench-word">Top model: </span>{x.leader.name}</span></Tip>}</span>
        <span className="bench-cell bench-num"><Tip text={TIP.models} end><Use k="cube" className="bench-inline" size={13} /><span className="num">{x.models}</span><span className="bench-word"> {x.models === 1 ? "model" : "models"}</span></Tip></span>
        <span className={`bench-cell bench-num ${x.uses ? "" : "bench-none"}`}><Tip text={TIP.uses} end><Use k="users" className="bench-inline" size={13} /><span className="num">{x.uses || <><span aria-hidden="true">–</span><span className="bench-word">0</span></>}</span><span className="bench-word"> {x.uses === 1 ? "mix" : "mixes"}</span></Tip></span>
        <span className="bench-cell bench-q"><Tip text={`Quality ${Math.round(x.quality)} of 100. ${TIP.quality}`} end><Quality v={x.quality} /></Tip></span>
      </Link>
    </li>
  );
}
