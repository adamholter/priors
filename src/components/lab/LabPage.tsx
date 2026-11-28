"use client";
import Link from "next/link";
import { useCallback, useMemo, useRef, useState } from "react";
import { IconHistory, IconLockOpen, IconReceipt } from "@tabler/icons-react";
import { LabLogo } from "@/components/LabLogo";
import { Empty, IconBtn, SortButton } from "@/components/model/directory-ui";
import { ModelTable } from "@/components/model/ModelTable";
import { dateText, modelView, nextOrder, NO_FILTERS, RANK_ORDER, type Filters, type ModelSort, type Order } from "@/lib/model-list";
import type { LabPageData, LabStanding, LabSummary } from "@/lib/lab-page";
import { labPath } from "@/lib/lab-path";
import "@/components/model/models.css";
import "./labs.css";

const plural = (n: number, one: string, many = `${one}s`) => `${n.toLocaleString("en-US")} ${n === 1 ? one : many}`;
const ordinal = (n: number) => ["", "First", "Second", "Third"][n] ?? `#${n}`;

/** The lab's name and facts, with its best-ranked model at the right the way a model page shows its score. */
function Header({ lab, indexName }: { lab: LabSummary; indexName: string }) {
  const facts = [plural(lab.models, "model"), lab.ranked ? `${lab.ranked} ranked` : "none ranked", lab.open ? `${lab.open} with open weights` : null].filter(Boolean).join(" · ");
  return (
    <section className="lab-head">
      <div className="lab-id">
        <span className="lab-mark"><LabLogo lab={lab.id} name={lab.name} color={lab.color} size={40} /></span>
        <div className="min-w-0">
          <p className="cap"><Link href="/labs" className="hover:text-ink">Labs</Link></p>
          <h1 className="text-[44px] leading-[1.05] mt-1">{lab.name}</h1>
          <p className="text-[13.5px] text-ink-2 mt-2">{facts}{lab.latest && <> · newest <Link href={`/models/${encodeURIComponent(lab.latest.id)}` as "/"} prefetch={false} className="underline underline-offset-2 hover:text-ink">{lab.latest.name}</Link>, {dateText(lab.latest.date)}</>}</p>
        </div>
      </div>
      {lab.best && (
        <Link href={`/models/${encodeURIComponent(lab.best.id)}` as "/"} prefetch={false} className="lab-best">
          <span className="lab-best-rank num">#{lab.best.rank}</span>
          <span className="text-[13.5px] text-ink-2">{lab.best.name}, its best on {indexName}</span>
        </Link>
      )}
    </section>
  );
}

/** The lab's models as the model directory lists them: ranked first by default, with older versions and unranked ones a click away. */
function Models({ data }: { data: LabPageData }) {
  const { lab, items, indexName } = data;
  const [f, setF] = useState<Filters>(() => ({ ...NO_FILTERS, lab: lab.id, tier: lab.ranked ? "ranked" : "all" }));
  const [order, setOrder] = useState<Order>(RANK_ORDER);
  const [costOn, setCostOn] = useState(false);
  const list = useRef<HTMLUListElement>(null);
  const patch = useCallback((p: Partial<Filters>) => setF((s) => ({ ...s, ...p })), []);
  const onSort = useCallback((id: ModelSort) => setOrder((o) => nextOrder(o, id)), []);
  const back = useCallback(() => list.current?.querySelector<HTMLElement>("a[data-model]")?.focus(), []);
  const view = useMemo(() => modelView(items, f, order), [items, f, order]);
  const cost = costOn || order.sort === "cost";
  return (
    <section className="lab-section" aria-labelledby="lab-models">
      <div className="lab-section-head">
        <h2 id="lab-models" className="text-[24px] leading-tight">Models</h2>
        <div className="md-tools">
          {view.rankedN !== view.allN && view.rankedN > 0 && (
            <div className="seg md-segtext" role="group" aria-label="Show">
              <button type="button" aria-pressed={f.tier === "ranked"} onClick={() => patch({ tier: "ranked" })}>Ranked<span className="num">{view.rankedN}</span></button>
              <button type="button" aria-pressed={f.tier === "all"} onClick={() => patch({ tier: "all" })}>All<span className="num">{view.allN}</span></button>
            </div>
          )}
          <IconBtn label="Open weights only" pressed={f.open} onClick={() => patch({ open: !f.open })}><IconLockOpen size={18} stroke={1.5} aria-hidden /></IconBtn>
          <IconBtn label="Older versions" pressed={f.older} onClick={() => patch({ older: !f.older })}><IconHistory size={18} stroke={1.5} aria-hidden /></IconBtn>
          <IconBtn className="md-costbtn" label="Cost per task" pressed={cost} disabled={order.sort === "cost"} onClick={() => setCostOn((v) => !v)}><IconReceipt size={18} stroke={1.5} aria-hidden /></IconBtn>
          <SortButton order={order} onChange={setOrder} />
        </div>
      </div>
      {view.rows.length
        ? <ModelTable rows={view.rows} showLab={false} order={order} onSort={onSort} onBack={back} listRef={list} cost={cost} indexName={indexName} />
        : <Empty text="No models here" action="Show all" onAction={() => patch({ tier: "all", open: false, older: true })} />}
    </section>
  );
}

const SHOWN = 12;

function StandingRow({ s }: { s: LabStanding }) {
  return (
    <li className="lab-st">
      <Link href={`/benchmarks/${encodeURIComponent(s.benchmarkId)}` as "/"} prefetch={false} className="lab-st-bench">
        <span className="lab-st-name md-trunc">{s.name}</span>
        <span className="cap">{s.category} · {s.labs} labs</span>
      </Link>
      <Link href={`/models/${encodeURIComponent(s.model.id)}` as "/"} prefetch={false} className="lab-st-model md-trunc">{s.model.name}</Link>
      <span className="lab-st-value num">{s.value}{s.tied && <span className="cap"> tied</span>}</span>
      {s.ahead && <span className="lab-st-ahead cap md-trunc">behind <Link href={labPath(s.ahead.labId) as "/"} prefetch={false} className="hover:text-ink">{s.ahead.name}</Link> ({s.ahead.model}, {s.ahead.value})</span>}
    </li>
  );
}

/** Benchmarks where the lab's best model beats every other lab's best, then where it is second or third. */
function Standings({ standings, name }: { standings: LabStanding[]; name: string }) {
  const counts = [1, 2, 3].map((p) => standings.filter((s) => s.place === p).length);
  const [place, setPlace] = useState(() => (counts.findIndex((n) => n > 0) + 1) || 1);
  const [all, setAll] = useState(false);
  const rows = standings.filter((s) => s.place === place), shown = all ? rows : rows.slice(0, SHOWN);
  if (!standings.length) return null;
  return (
    <section className="lab-section" aria-labelledby="lab-standings">
      <div className="lab-section-head">
        <div>
          <h2 id="lab-standings" className="text-[24px] leading-tight">Where {name} places</h2>
          <p className="text-[13.5px] text-ink-2 mt-1 max-w-[70ch]">Each lab&apos;s best model on each benchmark, any reasoning effort, against every other lab&apos;s best. Current boards with four or more labs; cost, speed, reliability and safety boards are left out.</p>
        </div>
        <div className="seg md-segtext" role="group" aria-label="Place">
          {[1, 2, 3].map((p) => <button key={p} type="button" aria-pressed={place === p} disabled={!counts[p - 1]} onClick={() => { setPlace(p); setAll(false); }}>{ordinal(p)}<span className="num">{counts[p - 1]}</span></button>)}
        </div>
      </div>
      <ul className="lab-st-list">{shown.map((s) => <StandingRow key={s.benchmarkId} s={s} />)}</ul>
      {rows.length > SHOWN && <button type="button" className="disclosure lab-more" aria-expanded={all} onClick={() => setAll((a) => !a)}>{all ? "Show fewer" : `Show all ${rows.length}`}</button>}
    </section>
  );
}

/** The other labs with a ranked model, best first, so one lab's page leads to the next. */
function Peers({ peers, current }: { peers: LabSummary[]; current: string }) {
  const others = peers.filter((p) => p.id !== current);
  if (!others.length) return null;
  return (
    <nav className="lab-section" aria-labelledby="lab-peers">
      <div className="lab-section-head"><h2 id="lab-peers" className="text-[24px] leading-tight">Other labs</h2><Link href="/labs" className="cap hover:text-ink">All labs</Link></div>
      <ul className="lab-peers">
        {others.map((p) => <li key={p.id}><Link href={labPath(p.id) as "/"} prefetch={false}><LabLogo lab={p.id} name={p.name} color={p.color} size={18} /><span className="md-trunc">{p.name}</span>{p.best && <span className="num md-grey">#{p.best.rank}</span>}</Link></li>)}
      </ul>
    </nav>
  );
}

/** A lab's page: who it is, every model of its that Priors has results for, where it places on each benchmark, and the labs around it. */
export function LabPage({ data }: { data: LabPageData }) {
  return (
    <div className="lab-page grid gap-12">
      <Header lab={data.lab} indexName={data.indexName} />
      <Models data={data} />
      <Standings standings={data.standings} name={data.lab.name} />
      <Peers peers={data.peers} current={data.lab.id} />
    </div>
  );
}
