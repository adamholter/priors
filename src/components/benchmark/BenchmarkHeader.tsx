"use client";
/**
 * The top of a benchmark's page: name and star, a description closed to a sentence, the warnings as short sentences (a chevron opens
 * their full wording), the other boards of the benchmark, and one row of icon facts led by the quality ring.
 */
import Link from "next/link";
import { memo, useId, useMemo, useRef, useState, type ReactElement, type ReactNode } from "react";
import { IconAdjustmentsHorizontal, IconAlertTriangle, IconArchive, IconCalendar, IconCalendarEvent, IconCube, IconExternalLink, IconInfoCircle, IconLock, IconLockOpen, IconLockQuestion, IconRosetteDiscountCheck, type Icon } from "@tabler/icons-react";
import { categoryNames } from "@/data/categories";
import { breaksFor } from "@/data/series-breaks";
import type { Benchmark } from "@/data/types";
import { benchmarkPath } from "@/lib/benchmark-slug";
import { shortDay, shorten, signedPoints, THIN_BOARD } from "@/lib/benchmark-header";
import { RECOMMENDED_NAME, RECOMMENDED_TIP, type QualityAdjustment } from "@/onboarding/quality";
import { BenchmarkStar } from "./BenchmarkStar";
import { Relatives } from "./BenchmarkExtras";
import type { SlicePeers } from "@/lib/benchmark-slices";
import type { QualityView } from "./QualityPanel";
import { CreatorByline } from "./CreatorBlocks";
import { Chevron, Glued, jumpToQuality, morph, Ring, Tip, usePhone } from "./header-ui";
import "./benchmark-header.css";

type Relative = { id: string; label: string };
type RelativeBoards = { family: Relative[]; familyLabel?: string; versions: Relative[]; peers?: SlicePeers };
type TestState = "private" | "partial" | "public" | "unknown";
type Frag = ReactElement<{ children?: ReactNode }>;

const TEST_ICON: Record<TestState, Icon> = { private: IconLock, partial: IconLock, public: IconLockOpen, unknown: IconLockQuestion };
const EFFORT_TIP = "Best measured setting per model, not one reasoning effort.";

interface Caveat {
  id: string;
  icon: Icon;
  /** The short sentence, its first clause set in weight 500. */
  short: Frag;
  /** The full wording. */
  full: Frag;
  /** Whether the full wording says more than the short one. */
  more: boolean;
  /** The data attribute checks find this note by. */
  attr: Record<string, string | true>;
}

interface Facts {
  quality?: { score: number; label: string };
  recommended: boolean;
  test?: { state: TestState; short: string; tip: string };
  models: number;
  thin: boolean;
  modelsTip: string;
  updated: { text: string; tip: string };
  effort: boolean;
  caveats: Caveat[];
}

/** Everything the header says, worked out once from the page's data. */
function useFacts({ b, benchmarkId, quality: view, relatives, models, results, date }: { b: Benchmark; benchmarkId: string; quality?: QualityView; relatives: RelativeBoards; models: number; results: number; date: string }): Facts {
  return useMemo<Facts>(() => {
    const q = view?.quality;
    const tf = q?.factors.find((f) => f.id === "testSet");
    const state = (q?.testSet ?? "unknown") as TestState;
    const thin = models < THIN_BOARD;
    const caveats: Caveat[] = [];
    if (b.stoppedPublishing) {
      const day = shortDay(b.stoppedPublishing, date);
      caveats.push({ id: "stopped", icon: IconAlertTriangle, short: <><b>Not current.</b> Last update {day}.</>, more: true, attr: { "data-stopped-publishing": true },
        full: <>Not current: the last update was {b.stoppedPublishing}, while the publisher&rsquo;s other boards kept updating.</> });
    }
    for (const x of breaksFor([benchmarkId])) {
      const day = shortDay(x.date, date);
      caveats.push({ id: `change-${x.date}`, icon: IconCalendarEvent, short: <><b>Method changed {day}.</b> Older values are not comparable.</>, more: true, attr: { "data-series-break": x.date },
        full: <>{x.note} <a href={x.url} target="_blank" rel="noreferrer" className="bench-top-link">Their method<IconExternalLink size={13} stroke={1.6} aria-hidden="true" /></a></> });
    }
    const adj = (id: QualityAdjustment["id"]) => q?.adjustments.find((a) => a.id === id);
    const sup = adj("superseded");
    if (sup && !b.stoppedPublishing) {
      // The newest version, when this board is not it: the replacement the penalty is about.
      const next = relatives.versions[0] && relatives.versions[0].id !== benchmarkId ? relatives.versions[0] : undefined;
      caveats.push({ id: "superseded", icon: IconArchive, attr: { "data-superseded": true }, more: true,
        short: next ? <><b>Older version.</b> Replaced by <Link href={benchmarkPath(next.id) as "/"} className="bench-top-link">{next.label}</Link>.</> : <><b>Older version.</b> A newer one replaced it.</>,
        full: <>{sup.label}. Quality takes {signedPoints(sup.points)} points for it.{next && <> Newer: <Link href={benchmarkPath(next.id) as "/"} className="bench-top-link">{next.label}</Link>.</>}</> });
    }
    const stale = adj("staleFrontier");
    if (stale && q?.lastUpdated) {
      const day = shortDay(q.lastUpdated, date);
      caveats.push({ id: "stale", icon: IconAlertTriangle, short: <><b>Last updated {day}.</b> Before the current frontier models began to ship.</>, more: true, attr: { "data-stale-frontier": true },
        full: <>{stale.label}. Quality takes {signedPoints(stale.points)} points for it.</> });
    }
    if (b.notice) {
      const first = b.notice.split(/(?<=\.)\s/)[0];
      caveats.push({ id: "notice", icon: IconInfoCircle, short: <>{first}</>, more: first.length < b.notice.length, attr: { "data-benchmark-notice": true }, full: <>{b.notice}</> });
    }
    return {
      quality: q ? { score: q.score, label: `Quality ${q.score} of 100${q.adjustments.length ? ` (${q.baseScore} before bonuses and penalties)` : ""}` } : undefined,
      recommended: !!q?.preferred,
      test: q && tf ? { state, short: tf.summary.split(",")[0], tip: tf.detail ? tf.detail.split(". ")[0].replace(/\.$/, "") : `Test set: ${tf.summary}` } : undefined,
      models, thin,
      modelsTip: thin ? `Only ${models} model${models === 1 ? "" : "s"} ${models === 1 ? "has" : "have"} a result` : `${models} models, ${results} results`,
      updated: {
        text: shortDay(b.lastUpdated ?? date, date),
        tip: b.stoppedPublishing ? `Not current. Last update ${b.stoppedPublishing}` : b.lastUpdated ? `Updated ${b.lastUpdated}` : `Data as of ${date}`,
      },
      effort: !!b.effortBasis,
      caveats,
    };
  }, [b, benchmarkId, view, relatives, models, results, date]);
}

/** The description, closed to a sentence or so. A chevron trails the last word and opens the rest in place. Text that already fits gets none. */
function Description({ text }: { text: string }) {
  const phone = usePhone();
  const cut = useMemo(() => shorten(text, phone ? 120 : 175), [text, phone]);
  const [open, setOpen] = useState(false);
  const el = useRef<HTMLParagraphElement>(null);
  const id = useId();
  if (!cut) return <div className="bench-top-clamp"><p className="bench-top-desc">{text}</p></div>;
  const shown = open ? text : `${cut.lead}${cut.mid ? "…" : ""}`;
  return <div className="bench-top-clamp"><p ref={el} id={id} className="bench-top-desc">
    <Glued after={<Chevron open={open} controls={id} label={open ? "Show less" : "Show more"} onClick={() => morph(el.current, () => setOpen((v) => !v))} />}>{shown}</Glued>
  </p></div>;
}

/**
 * The warnings, short sentences with an icon, none of them boxed. The chevron trails the first sentence and opens every row to its
 * full wording. Nothing renders, and nothing is reserved, when a board has none.
 */
function Notes({ rows }: { rows: Caveat[] }) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const id = useId();
  if (!rows.length) return null;
  const more = rows.some((r) => r.more);
  return <div ref={root} className="bench-top-notes" role="note">
    {rows.map((r, i) => {
      const I = r.icon, text = (open ? r.full : r.short).props.children;
      return <div key={r.id} className="bench-top-note" {...r.attr}>
        <I size={16} stroke={1.6} aria-hidden="true" className="bench-top-note-icon" />
        <p id={`${id}-${i}`}>{more && i === 0
          ? <Glued after={<Chevron open={open} label={open ? "Hide details" : "Show details"} controls={rows.map((_, k) => `${id}-${k}`).join(" ")} onClick={() => morph(root.current, () => setOpen((v) => !v))} />}>{text}</Glued>
          : text}</p>
      </div>;
    })}
  </div>;
}

/** One row of facts, each an icon and its value with a word on hover: the quality ring first, then what the board is and where it comes from. */
function FactRow({ f, b, host }: { f: Facts; b: Benchmark; host: string }) {
  const TestIcon = f.test ? TEST_ICON[f.test.state] : null;
  return <div className="bench-top-facts">
    {f.quality && <Tip text={f.quality.label} focusable={false} className="bench-top-fact bench-top-q">
      <a href="#quality" onClick={jumpToQuality} className="bench-top-q-link" data-quality-summary>
        <Ring score={f.quality.score} />
        <span className="bench-top-q-word" aria-hidden="true">Quality</span>
        <span className="sr-only">Quality {f.quality.score} of 100</span>
      </a>
    </Tip>}
    {f.recommended && <Tip text={RECOMMENDED_TIP.replace("this benchmark", "it")} className="bench-top-fact bench-top-rec" data-recommended><IconRosetteDiscountCheck size={16} stroke={1.6} aria-hidden="true" /><span>{RECOMMENDED_NAME}</span></Tip>}
    {f.test && TestIcon && <Tip text={f.test.tip} className="bench-top-fact"><TestIcon size={16} stroke={1.6} aria-hidden="true" /><span>{f.test.short}</span></Tip>}
    {f.models > 0 && <Tip text={f.modelsTip} className={`bench-top-fact ${f.thin ? "is-thin" : ""}`}><IconCube size={16} stroke={1.6} aria-hidden="true" /><span><b className="num">{f.models}</b></span></Tip>}
    <Tip text={f.updated.tip} className="bench-top-fact"><IconCalendar size={16} stroke={1.6} aria-hidden="true" /><span>{f.updated.text}</span></Tip>
    {f.effort && <Tip text={EFFORT_TIP} className="bench-top-fact" data-effort-basis><IconAdjustmentsHorizontal size={16} stroke={1.6} aria-hidden="true" /><span>Best setting</span></Tip>}
    {host && <a href={b.url} target="_blank" rel="noreferrer" className="bench-top-source" aria-label={`Source: ${host}`}>
      {b.sourceId === "gamefeel"
        // eslint-disable-next-line @next/next/no-img-element
        ? <img src="/logos/gamefeel.png" alt="" width={16} height={16} className="bench-top-fav" />
        : <IconExternalLink size={16} stroke={1.6} aria-hidden="true" />}
      <span className="bench-top-source-host">{host}</span>
    </a>}
  </div>;
}

export interface BenchmarkHeaderProps {
  b: Benchmark;
  benchmarkId: string;
  /** The server's quality view. Absent for token-price proxies. */
  quality?: QualityView;
  relatives: RelativeBoards;
  /** Models the benchmark has a score for (the directory's count). */
  models: number;
  /** Rows in the leaderboard. */
  results: number;
  /** The snapshot's date, YYYY-MM-DD. */
  date: string;
  /** The source's host without www, or "" when the url is not parseable. */
  host: string;
}

/** Memoized: the page re-renders on every setting, and the header only moves when its own data does. */
export const BenchmarkHeader = memo(function BenchmarkHeader(p: BenchmarkHeaderProps) {
  const { b, benchmarkId, quality, relatives, host } = p;
  const f = useFacts(p);
  const words = b.name.split(" "), last = words.pop() ?? "";
  return <section className="bench-top">
    <div className="bench-top-crumb"><p className="cap"><Link href={"/benchmarks" as "/"} className="hover:text-ink">Benchmarks</Link> &middot; {categoryNames(b)}</p></div>
    {/* The star rides the last word, so it never sits alone on a line. aria-label keeps the heading's name to the benchmark's. */}
    <div className="bench-top-title">
      <h1 className="text-[34px] sm:text-[44px] leading-[1.05]" aria-label={b.name}>{words.join(" ")}{words.length ? " " : ""}<span className="bench-top-nowrap">{last}<span className="bench-top-title-end">{quality && <BenchmarkStar id={benchmarkId} name={b.name} count={quality.stars} className="bench-top-starbtn hit" />}</span></span></h1>
    </div>
    <Description text={b.description} />
    <CreatorByline />
    <Notes rows={f.caveats} />
    {relatives.family.length + relatives.versions.length > 0 && <div className="bench-top-rel"><Relatives current={benchmarkId} family={relatives.family} familyLabel={relatives.familyLabel} versions={relatives.versions} peers={relatives.peers} /></div>}
    <FactRow f={f} b={b} host={host} />
  </section>;
});
