"use client";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { IconArrowDown, IconArrowUp, IconBuilding, IconCube, IconHistory, IconLockOpen, IconSearch, IconStack2 } from "@tabler/icons-react";
import { MODEL_SORTS, searchModels, sortModels, type ModelItem, type ModelSort, type SortDir } from "@/lib/model-directory";
import { useLabColor } from "@/components/chart/echarts";
import "../benchmark/benchmarks.css";
import "./models.css";

const plural = (n: number, one: string, many = `${one}s`) => `${n.toLocaleString("en-US")} ${n === 1 ? one : many}`;
const sortOf = (id: ModelSort) => MODEL_SORTS.find((s) => s.id === id)!;
const usd = (v: number) => `$${v.toFixed(v >= 0.1 ? 2 : 3)}`;
const params = (b: number) => b >= 1000 ? `${(b / 1000).toFixed(b >= 10000 ? 0 : 1)}T params` : `${b >= 10 ? Math.round(b) : b}B params`;

/** Every model Priors ranks, searchable, filtered by lab and sorted by any column; each row opens the model's own page. */
export function ModelDirectory({ items, indexName }: { items: ModelItem[]; indexName: string }) {
  const TIP = {
    rank: `Rank and score on ${indexName}, Priors' default ranking, at the model's best reasoning effort. An older version shows its score without a rank, as rankings leave it out; blank when too little is measured to rank.`,
    released: "When the lab released it.",
    benchmarks: "How many benchmarks publish a result for it, any reasoning effort. Priors' estimates don't count.",
    price: "API price in USD per million tokens, blended 3 input : 1 output, from Artificial Analysis. Its cheapest effort.",
    name: "The model's name. Click to sort A to Z, again for Z to A.",
  };
  const [q, setQ] = useState("");
  const [lab, setLab] = useState("all");
  const [order, setOrder] = useState<{ sort: ModelSort; dir: SortDir }>({ sort: "rank", dir: "asc" });
  const [older, setOlder] = useState(false);
  const [open, setOpen] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "/" && !(e.target as HTMLElement)?.closest("input,textarea,select")) { e.preventDefault(); input.current?.focus(); } };
    addEventListener("keydown", onKey); return () => removeEventListener("keydown", onKey);
  }, []);
  const searching = q.trim().length > 0;
  // Searching looks at older versions too: an old model is often exactly what someone typed.
  const base = useMemo(() => items.filter((x) => (older || searching || !x.superseded) && (!open || x.openWeights)), [items, older, open, searching]);
  const labs = useMemo(() => {
    const count = new Map<string, { id: string; name: string; color: string; n: number }>();
    for (const x of base) { const c = count.get(x.labId) ?? count.set(x.labId, { id: x.labId, name: x.labName, color: x.labColor, n: 0 }).get(x.labId)!; c.n++; }
    return [...count.values()].sort((a, b) => b.n - a.n || a.name.localeCompare(b.name));
  }, [base]);
  const found = useMemo(() => {
    const inLab = base.filter((x) => lab === "all" || x.labId === lab);
    const sorted = sortModels(inLab, order.sort, order.dir);
    // While searching, the default order means best match first; a column picked by hand orders the matches.
    return searching ? (order.sort === "rank" && order.dir === "asc" ? searchModels(sortModels(inLab, "rank", "asc"), q) : sortModels(searchModels(inLab, q), order.sort, order.dir)) : sorted;
  }, [base, lab, order, q, searching]);
  const column = (id: ModelSort) => setOrder((o) => o.sort === id ? { sort: id, dir: o.dir === "asc" ? "desc" : "asc" } : { sort: id, dir: sortOf(id).natural });
  const totals = useMemo(() => ({ labs: new Set(base.map((x) => x.labId)).size, open: base.filter((x) => x.openWeights).length }), [base]);

  return (
    <div className="bench-dir model-dir grid gap-8">
      <div className="bench-totals" aria-label="Directory totals">
        <span><IconCube size={16} stroke={1.5} aria-hidden />{plural(base.length, "model")}</span>
        <span><IconBuilding size={16} stroke={1.5} aria-hidden />{plural(totals.labs, "lab")}</span>
        <span><IconLockOpen size={16} stroke={1.5} aria-hidden />{totals.open.toLocaleString("en-US")} with open weights</span>
      </div>
      <div className="bench-layout">
        <nav className="bench-rail model-rail" aria-label="Labs">
          <button type="button" aria-pressed={lab === "all"} onClick={() => setLab("all")}><IconStack2 size={17} stroke={1.5} aria-hidden /><span>All labs</span><span className="cap">{base.length}</span></button>
          {labs.map((l) => <LabButton key={l.id} l={l} on={lab === l.id} onClick={() => setLab(l.id)} />)}
        </nav>
        <div className="grid gap-5 content-start min-w-0">
          <div className="grid gap-3">
            <div className="relative">
              <IconSearch size={18} stroke={1.5} className="absolute left-4 top-1/2 -translate-y-1/2 text-grey pointer-events-none" aria-hidden />
              <input ref={input} type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by model or lab: Opus, Gemini Neon, DeepSeek…" aria-label="Search models" className="inp !text-[16px] !py-3 !pl-11 !pr-12 w-full" autoComplete="off" spellCheck={false} />
              <kbd className="absolute right-3 top-1/2 -translate-y-1/2 cap border hairline rounded px-1.5 max-sm:hidden" aria-hidden="true">/</kbd>
            </div>
            <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
              <label className="cap flex items-center gap-2">Sort
                <select className="model-sort-select normal-case" aria-label="Sort models" value={`${order.sort}:${order.dir}`} onChange={(e) => { const [sort, dir] = e.target.value.split(":") as [ModelSort, SortDir]; setOrder({ sort, dir }); }}>
                  {MODEL_SORTS.flatMap((s) => [s.natural, s.natural === "asc" ? "desc" : "asc"].map((d, i) => <option key={`${s.id}:${d}`} value={`${s.id}:${d}`}>{s.name}: {s.names[i]}</option>))}
                </select>
              </label>
              {!searching && <label className="cap flex items-center gap-2 cursor-pointer" title="Earlier versions of a model line that has a newer one, which rankings hide by default"><input type="checkbox" data-older checked={older} onChange={(e) => setOlder(e.target.checked)} />Older versions</label>}
              <label className="cap flex items-center gap-2 cursor-pointer"><input type="checkbox" data-open-weights checked={open} onChange={(e) => setOpen(e.target.checked)} />Open weights only</label>
              <span className="cap ml-auto" role="status">{searching ? plural(found.length, "match", "matches") : plural(found.length, "model")}</span>
            </div>
          </div>
          {found.length ? <div className="min-w-0">
            <div className="bench-head cap" role="toolbar" aria-label="Sort by column">
              <Head id="name" order={order} onClick={column} text={TIP.name}>Model</Head>
              <Head id="rank" order={order} onClick={column} text={TIP.rank} end>Priors rank</Head>
              <Head id="released" order={order} onClick={column} text={TIP.released} end>Released</Head>
              <Head id="benchmarks" order={order} onClick={column} text={TIP.benchmarks} end>Benchmarks</Head>
              <Head id="price" order={order} onClick={column} text={TIP.price} end>API price</Head>
            </div>
            <ul className="grid">{found.map((x) => <Row key={x.id} x={x} showLab={lab === "all"} tip={TIP} />)}</ul>
          </div> : <p className="cap py-6">{searching ? <>Nothing matches &ldquo;{q}&rdquo;. Try a lab or a shorter name.</> : "No models here with these filters."}</p>}
        </div>
      </div>
    </div>
  );
}

function LabButton({ l, on, onClick }: { l: { id: string; name: string; color: string; n: number }; on: boolean; onClick: () => void }) {
  const color = useLabColor();
  return <button type="button" aria-pressed={on} onClick={onClick}><i className="model-dot" style={{ background: color(l.id, l.color) }} aria-hidden="true" /><span className="model-lab-name">{l.name}</span><span className="cap">{l.n}</span></button>;
}

function Tip({ text, end, children, className = "" }: { text: string; end?: boolean; children: ReactNode; className?: string }) {
  return <span className={`bench-tip ${end ? "bench-tip-end" : ""} ${className}`} data-bench-tip={text}>{children}</span>;
}

function Head({ id, order, onClick, text, end, children }: { id: ModelSort; order: { sort: ModelSort; dir: SortDir }; onClick: (id: ModelSort) => void; text: string; end?: boolean; children: ReactNode }) {
  const on = order.sort === id, s = sortOf(id), now = on ? s.names[order.dir === s.natural ? 0 : 1] : undefined;
  const Arrow = on && order.dir === "asc" ? IconArrowUp : IconArrowDown;
  const arrow = <Arrow size={12} stroke={2} className="bench-sort-arrow" aria-hidden />;
  return <Tip text={text} end={end}>
    <button type="button" className="bench-sort" data-sort={id} data-on={on || undefined} aria-pressed={on} aria-label={`Sort by ${s.name}${now ? `, ${now.toLowerCase()}` : ""}`} onClick={() => onClick(id)}>
      {end && arrow}{children}{!end && arrow}
    </button>
  </Tip>;
}

function Row({ x, showLab, tip }: { x: ModelItem; showLab: boolean; tip: Record<"rank" | "released" | "benchmarks" | "price", string> }) {
  const color = useLabColor();
  const sub = [showLab ? x.labName : undefined, x.paramsB ? params(x.paramsB) : undefined, x.reasoning ? "reasoning" : undefined].filter(Boolean).join(" · ");
  return (
    <li className="bench-li border-b hairline last:border-b-0">
      <Link href={`/models/${encodeURIComponent(x.id)}` as "/"} prefetch={false} className="bench-row group" data-model={x.id}>
        <span className="bench-main">
          <i className="model-dot model-dot-row" style={{ background: color(x.labId, x.labColor) }} aria-hidden="true" />
          <span className="min-w-0">
            <span className="flex flex-wrap items-center gap-x-2">
              <span className="text-[15px] group-hover:underline decoration-dotted underline-offset-2">{x.name}</span>
              {x.openWeights && <span className="cap inline-flex items-center gap-1 model-open"><IconLockOpen size={12} stroke={1.6} aria-hidden />open weights</span>}
              {x.superseded && <span className="cap inline-flex items-center gap-1"><IconHistory size={12} stroke={1.6} aria-hidden />older version</span>}
            </span>
            {sub && <span className="block text-[13px] text-ink-2 truncate">{sub}</span>}
          </span>
        </span>
        <span className={`bench-cell bench-num ${x.score == null ? "bench-none" : ""}`}><Tip text={tip.rank} end><span className="bench-word">Priors rank </span>{x.score != null ? <>{x.rank != null && <span className="num">#{x.rank}</span>}<span className="text-grey num model-score">{x.score.toFixed(1)}</span></> : <span className="num" aria-hidden="true">–</span>}</Tip></span>
        <span className={`bench-cell bench-num ${x.releaseDate ? "" : "bench-none"}`}><Tip text={tip.released} end><span className="bench-word">Released </span><span className="num">{x.releaseDate ?? "–"}</span></Tip></span>
        <span className="bench-cell bench-num"><Tip text={tip.benchmarks} end><span className="num">{x.benchmarks}</span><span className="bench-word"> {x.benchmarks === 1 ? "benchmark" : "benchmarks"}</span></Tip></span>
        <span className={`bench-cell bench-num ${x.priceUsd != null ? "" : "bench-none"}`}><Tip text={tip.price} end><span className="num">{x.priceUsd != null ? usd(x.priceUsd) : "–"}</span><span className="bench-word"> per 1M tokens</span></Tip></span>
      </Link>
    </li>
  );
}
