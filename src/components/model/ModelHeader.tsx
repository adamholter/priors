"use client";
import Link from "next/link";
import type { ModelView } from "@/lib/model-view";
import { OWN_KEY, rankParam, type RankingOption } from "@/lib/model-ranking-param";
import { pct, unrankedLine, type RankSummary } from "@/lib/model-rank-text";
import type { OwnRanking } from "@/lib/model-ranks";
import { usePhone } from "../builder-size";
import { Computing, InfoPop, Score } from "./ModelHeaderParts";
import { RankMenu } from "./RankMenu";

export interface ModelHeaderProps {
  view: ModelView; summary?: string; labC: string;
  options: RankingOption[]; current: string; onPick: (param: string) => void;
  /** Where the model stands in each ranking on offer, by option key; a ranking not yet worked out is missing. */
  ranks: Record<string, RankSummary | undefined>;
  /** The ranking made for a model no standard ranking places, when it is on offer. */
  own?: OwnRanking;
  /** The chosen ranking is still downloading, or could not. */
  pending: boolean; error: string; retry: () => void;
  /** The picker opened or closed. */
  onMenu: (open: boolean) => void;
  /** Open "All N benchmarks" and bring it to the top of the screen. */
  onShowAll: () => void;
}

/**
 * The model's name and facts at the left, its score at the right: the number, its place, the ranking it is placed in (a menu that
 * lists where the model stands in every ranking), and for a model no standard ranking places, the ranking made from its own benchmarks.
 */
export function ModelHeader({ view, summary, labC, options, current, onPick, ranks, own, pending, error, retry, onMenu, onShowAll }: ModelHeaderProps) {
  const { model, lab, mine, measured } = view;
  const top = mine[0];
  const cur = options.find((o) => rankParam(o) === current) ?? options[0];
  const onOwn = cur?.key === OWN_KEY;
  // No score yet, and a ranking on its way: show the shape of one.
  const computing = pending && !top;
  const align = usePhone() ? "left" : "right";
  const effort = top && top.effort !== "default" && mine.length > 1 ? ` · best at ${top.effort}` : "";
  return (
    <section className="grid gap-5 sm:grid-cols-[1fr_auto] items-end">
      {/* On a phone the score comes before Compare, so it is on the first screen. */}
      <div className="max-sm:contents">
        <div className="min-w-0">
          <p className="cap flex items-center gap-2"><i className="inline-block w-2.5 h-2.5 rounded-full" style={{ background: labC }} />{lab?.name}{model.releaseDate && ` · released ${model.releaseDate}`}</p>
          <h1 className="text-[44px] leading-[1.05] mt-2">{model.name}</h1>
          {summary && <p className="text-[13.5px] text-ink-2 mt-2 max-w-[70ch]">{summary}</p>}
          <p className="text-[13.5px] text-ink-2 mt-2">Measured on {measured} benchmarks{mine.length > 1 ? ` across ${mine.length} reasoning efforts` : ""}.</p>
        </div>
        <Link href={`/models/${encodeURIComponent(model.id)}/compare` as "/"} prefetch={false} className="btn-quiet inline-flex items-center mt-3 justify-self-start max-sm:order-4 max-sm:mt-0 max-sm:min-h-[44px]">Compare</Link>
      </div>
      <div className="min-w-0 max-sm:order-2 grid gap-2 justify-items-end text-right max-sm:justify-items-start max-sm:text-left">
        {computing ? <Computing /> : top ? (
          <div className="grid gap-2 justify-items-end max-sm:justify-items-start">
            <Score value={top.score} dim={pending || !!error} />
            <p className="text-[13.5px] leading-[1.4] text-ink-2 flex items-center gap-1.5">#{view.place + 1} of {view.models} models{effort}{!onOwn && <ScoreInfo view={view} ranking={cur?.label} align={align} />}</p>
          </div>
        ) : <Unranked view={view} options={options} current={cur} ranks={ranks} onPick={onPick} onShowAll={onShowAll} dim={pending || !!error} />}
        {error && <p className="cap" role="status">Could not load. <button type="button" className="hit underline hover:text-ink" onClick={retry}>Retry</button></p>}
        <RankMenu options={options} current={current} onPick={onPick} ranks={ranks} busy={pending && !computing} onOpenChange={onMenu} />
        {pending && <span role="status" className="sr-only">Loading this ranking</span>}
        {onOwn && !computing && <OwnNote own={own} general={options.find((o) => o.key === "preset:general")?.label ?? "General frontier"} placed={!!ranks["preset:general"]?.standing} align={align} view={view} />}
      </div>
    </section>
  );
}

/** The info icon beside a ranked score: what the number is, and what is estimated in it. */
function ScoreInfo({ view, ranking, align }: { view: ModelView; ranking?: string; align: "left" | "right" }) {
  const share = view.mine[0]?.measuredShare ?? 0;
  return (
    <InfoPop label="About this score" align={align}>
      <span className="block">{view.outOf100 ? "A score out of 100: the" : "The"} weighted mean of {view.weighted} benchmarks in {ranking}.{view.loose && ` ${pct(share)} of the mix is measured for this model, the rest is estimated.`}</span>
      <a href={view.builderHref} className="model-head-link mt-2 inline-block text-ink">See the mix in the builder</a>
    </InfoPop>
  );
}

/** Under the score of a model ranked on its own benchmarks: that it is not placed in the standard ranking, and how this ranking is made. */
function OwnNote({ own, general, placed, align, view }: { own?: OwnRanking; general: string; placed: boolean; align: "left" | "right"; view: ModelView }) {
  const n = own?.benchmarks.length ?? view.weighted;
  return (
    <p className="cap flex items-center gap-1.5 justify-end max-sm:justify-start">{placed ? "On its own benchmarks" : `Not ranked in ${general}`}
      <InfoPop label="About this ranking" align={align} wide>
        <span className="block">{placed ? "This ranking" : `${general} needs more of its benchmarks than this model has. This ranking`} uses the {n} it has the most company on, at equal weight, so its score is not comparable with scores in {general}.</span>
        {own && <span className="mt-2 grid gap-y-1">
          {own.benchmarks.map((b) => <span key={b.id} className="flex items-baseline justify-between gap-3"><span className="min-w-0 truncate text-ink">{b.name}</span><span className="cap shrink-0">{b.models} models</span></span>)}
        </span>}
        <a href={view.builderHref} className="model-head-link mt-2.5 inline-block text-ink">Open in builder</a>
      </InfoPop>
    </p>
  );
}

/** A ranking that leaves the model out: why, another ranking that does place it (one tap), and its benchmarks. */
function Unranked({ view, options, current, ranks, onPick, onShowAll, dim }: { view: ModelView; options: RankingOption[]; current?: RankingOption; ranks: Record<string, RankSummary | undefined>; onPick: (param: string) => void; onShowAll: () => void; dim: boolean }) {
  const where = options.find((o) => o.key !== current?.key && ranks[o.key]?.standing);
  const place = where && ranks[where.key]!.standing!;
  return (
    <>
      <p className={`font-serif text-[30px] leading-[1.1] text-ink-2 model-head-fade ${dim ? "model-head-dim" : ""}`}>Not ranked</p>
      {view.unranked && <p className="cap">{unrankedLine(view.unranked)}</p>}
      {where && place && <button type="button" className="model-head-link hit text-[13px] text-ink-2 text-left" onClick={() => onPick(rankParam(where))}>Ranked #{place.rank} of {place.of} in {where.label}</button>}
      {view.others > 0 && <button type="button" className="model-head-link hit text-[13px] text-ink-2 text-left" onClick={onShowAll}>See its {view.measured} benchmarks</button>}
    </>
  );
}
